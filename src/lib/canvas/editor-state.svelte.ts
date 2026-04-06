import {
	WasmPixelCanvas,
	WasmViewport,
	WasmResizeAnchor
} from '$wasm/dotorixel_wasm';
import type { CanvasCoords, ResizeAnchor, ViewportSize, ViewportState } from './view-types';
import { TOOL_CURSORS, type ToolType } from './tool-types';
import { colorToHex, hexToColor, addRecentColor, type Color } from './color';
import { SharedState } from './shared-state.svelte';
import { exportAsPng } from './export';
import { createKeyboardInput, type KeyboardInput } from './keyboard-input.svelte';
import { createToolRunner, type ToolRunner, type ToolEffects } from './tool-runner.svelte';

function assertNever(x: never): never {
	throw new Error(`Unhandled effect type: ${(x as { type: string }).type}`);
}

const RESIZE_ANCHOR_MAP: Record<ResizeAnchor, WasmResizeAnchor> = {
	'top-left': WasmResizeAnchor.TopLeft,
	'top-center': WasmResizeAnchor.TopCenter,
	'top-right': WasmResizeAnchor.TopRight,
	'middle-left': WasmResizeAnchor.MiddleLeft,
	center: WasmResizeAnchor.Center,
	'middle-right': WasmResizeAnchor.MiddleRight,
	'bottom-left': WasmResizeAnchor.BottomLeft,
	'bottom-center': WasmResizeAnchor.BottomCenter,
	'bottom-right': WasmResizeAnchor.BottomRight
};

export interface EditorOptions {
	canvasWidth?: number;
	canvasHeight?: number;
	foregroundColor?: Color;
	backgroundColor?: Color;
	gridColor?: string;
	shared?: SharedState;
	name?: string;
	documentId?: string;
	pixelCanvas?: WasmPixelCanvas;
	viewportState?: ViewportState;
}

export class EditorState {
	readonly shared: SharedState;
	readonly name: string;
	readonly documentId: string;
	pixelCanvas = $state<WasmPixelCanvas>(null!);
	viewportSize = $state<ViewportSize>({ width: 512, height: 512 });
	viewportState = $state<ViewportState>(null!);
	renderVersion = $state(0);
	resizeAnchor = $state<ResizeAnchor>('top-left');

	get activeTool(): ToolType {
		return this.shared.activeTool;
	}
	set activeTool(value: ToolType) {
		this.shared.activeTool = value;
	}

	get foregroundColor(): Color {
		return this.shared.foregroundColor;
	}
	set foregroundColor(value: Color) {
		this.shared.foregroundColor = value;
	}

	get backgroundColor(): Color {
		return this.shared.backgroundColor;
	}
	set backgroundColor(value: Color) {
		this.shared.backgroundColor = value;
	}

	get recentColors(): string[] {
		return this.shared.recentColors;
	}
	set recentColors(value: string[]) {
		this.shared.recentColors = value;
	}

	#toolRunner: ToolRunner;
	#keyboard: KeyboardInput;

	get isSpaceHeld(): boolean {
		return this.#keyboard.isSpaceHeld;
	}

	get isShiftHeld(): boolean {
		return this.#keyboard.isShiftHeld;
	}

	get isShortcutHintsVisible(): boolean {
		return this.#keyboard.isShortcutHintsVisible;
	}

	readonly canUndo = $derived.by(() => this.#toolRunner.canUndo);

	readonly canRedo = $derived.by(() => this.#toolRunner.canRedo);

	readonly zoomPercent = $derived(Math.round(this.viewportState.viewport.zoom * 100));

	readonly renderViewport = $derived({
		pixelSize: this.viewportState.viewport.pixel_size,
		zoom: this.viewportState.viewport.zoom,
		panX: this.viewportState.viewport.pan_x,
		panY: this.viewportState.viewport.pan_y,
		showGrid: this.viewportState.showGrid,
		gridColor: this.viewportState.gridColor
	});

	readonly toolCursor = $derived(TOOL_CURSORS[this.activeTool]);

	readonly foregroundColorHex = $derived(colorToHex(this.foregroundColor));
	readonly backgroundColorHex = $derived(colorToHex(this.backgroundColor));

	#applyEffects(effects: ToolEffects): void {
		for (const effect of effects) {
			switch (effect.type) {
				case 'canvasChanged':
					this.renderVersion++;
					break;
				case 'canvasReplaced':
					this.pixelCanvas = effect.canvas;
					this.viewportState = {
						...this.viewportState,
						viewport: this.viewportState.viewport.clamp_pan(
							effect.canvas.width,
							effect.canvas.height,
							this.viewportSize.width,
							this.viewportSize.height
						)
					};
					this.renderVersion++;
					break;
				case 'colorPick':
					if (effect.target === 'foreground') {
						this.foregroundColor = effect.color;
					} else {
						this.backgroundColor = effect.color;
					}
					break;
				case 'addRecentColor':
					this.recentColors = addRecentColor(this.recentColors, effect.hex);
					break;
				default:
					assertNever(effect);
			}
		}
	}

	constructor(options: EditorOptions = {}) {
		this.shared = options.shared ?? new SharedState();
		this.name = options.name ?? '';
		this.documentId = options.documentId ?? `doc-${crypto.randomUUID()}`;

		if (options.pixelCanvas) {
			this.pixelCanvas = options.pixelCanvas;
		} else {
			const cw = options.canvasWidth ?? 16;
			const ch = options.canvasHeight ?? 16;
			this.pixelCanvas = new WasmPixelCanvas(cw, ch);
		}

		if (options.viewportState) {
			this.viewportState = options.viewportState;
		} else {
			const cw = this.pixelCanvas.width;
			const ch = this.pixelCanvas.height;
			this.viewportState = {
				viewport: WasmViewport.for_canvas(cw, ch),
				showGrid: true,
				gridColor: options.gridColor ?? '#cccccc'
			};
		}

		if (options.foregroundColor) {
			this.shared.foregroundColor = options.foregroundColor;
		}
		if (options.backgroundColor) {
			this.shared.backgroundColor = options.backgroundColor;
		}

		// Step 1: Create ToolRunner (no isShiftHeld yet)
		const self = this;
		this.#toolRunner = createToolRunner(
			{
				get pixelCanvas() {
					return self.pixelCanvas;
				},
				get foregroundColor() {
					return self.foregroundColor;
				},
				get backgroundColor() {
					return self.backgroundColor;
				}
			},
			this.shared
		);

		// Step 2: Create KeyboardInput (references toolRunner.isDrawing)
		this.#keyboard = createKeyboardInput({
			isDrawing: () => this.#toolRunner.isDrawing,
			getActiveTool: () => this.activeTool,
			setActiveTool: (tool) => {
				this.activeTool = tool;
			},
			undo: () => this.handleUndo(),
			redo: () => this.handleRedo(),
			toggleGrid: () => this.handleGridToggle(),
			swapColors: () => this.swapColors(),
			notifyModifierChange: () => {
				this.#applyEffects(this.#toolRunner.modifierChanged());
			}
		});

		// Step 3: Wire isShiftHeld to ToolRunner
		this.#toolRunner.connectModifiers({
			isShiftHeld: () => this.#keyboard.isShiftHeld
		});
	}

	handleViewportChange = (newViewport: WasmViewport): void => {
		const clamped = newViewport.clamp_pan(
			this.pixelCanvas.width,
			this.pixelCanvas.height,
			this.viewportSize.width,
			this.viewportSize.height
		);
		this.viewportState = { ...this.viewportState, viewport: clamped };
	};

	handleDrawStart = (button: number): void => {
		if (this.#keyboard.isShortcutHintsVisible) return;
		this.#applyEffects(this.#toolRunner.drawStart(button));
	};

	handleDrawEnd = (): void => {
		this.#applyEffects(this.#toolRunner.drawEnd());
		const restored = this.#keyboard.consumePendingToolRestore();
		if (restored !== null) {
			this.activeTool = restored;
		}
	};

	handleLongPress = (coords: CanvasCoords, button: number): boolean => {
		if (this.activeTool === 'eyedropper') return false;
		const pixel = this.pixelCanvas.get_pixel(coords.x, coords.y);
		if (pixel.a !== 0) {
			const pickedColor = { r: pixel.r, g: pixel.g, b: pixel.b, a: pixel.a };
			const isRightClick = button === 2;
			if (isRightClick) {
				this.backgroundColor = pickedColor;
			} else {
				this.foregroundColor = pickedColor;
			}
			this.recentColors = addRecentColor(this.recentColors, colorToHex(pickedColor));
		}
		return true;
	};

	handleUndo = (): void => {
		this.#applyEffects(this.#toolRunner.undo());
	};

	handleRedo = (): void => {
		this.#applyEffects(this.#toolRunner.redo());
	};

	handleClear = (): void => {
		this.#applyEffects(this.#toolRunner.clear());
	};

	handleDraw = (current: CanvasCoords, previous: CanvasCoords | null): void => {
		if (this.#keyboard.isShortcutHintsVisible) return;
		this.#applyEffects(this.#toolRunner.draw(current, previous));
	};

	handleZoomIn = (): void => {
		const centerX = this.viewportSize.width / 2;
		const centerY = this.viewportSize.height / 2;
		const newZoom = WasmViewport.next_zoom_level(this.viewportState.viewport.zoom);
		const zoomed = this.viewportState.viewport.zoom_at_point(centerX, centerY, newZoom);
		this.handleViewportChange(zoomed);
	};

	handleZoomOut = (): void => {
		const centerX = this.viewportSize.width / 2;
		const centerY = this.viewportSize.height / 2;
		const newZoom = WasmViewport.prev_zoom_level(this.viewportState.viewport.zoom);
		const zoomed = this.viewportState.viewport.zoom_at_point(centerX, centerY, newZoom);
		this.handleViewportChange(zoomed);
	};

	handleZoomReset = (): void => {
		const centerX = this.viewportSize.width / 2;
		const centerY = this.viewportSize.height / 2;
		const zoomed = this.viewportState.viewport.zoom_at_point(centerX, centerY, 1.0);
		this.handleViewportChange(zoomed);
	};

	handleFit = (maxZoom: number = Infinity): void => {
		const fitted = this.viewportState.viewport.fit_to_viewport(
			this.pixelCanvas.width,
			this.pixelCanvas.height,
			this.viewportSize.width,
			this.viewportSize.height,
			maxZoom
		);
		this.viewportState = { ...this.viewportState, viewport: fitted };
	};

	handleGridToggle = (): void => {
		this.viewportState = { ...this.viewportState, showGrid: !this.viewportState.showGrid };
	};

	handleForegroundColorChange = (hex: string): void => {
		this.foregroundColor = hexToColor(hex);
	};

	handleBackgroundColorChange = (hex: string): void => {
		this.backgroundColor = hexToColor(hex);
	};

	swapColors = (): void => {
		const temp = this.foregroundColor;
		this.foregroundColor = this.backgroundColor;
		this.backgroundColor = temp;
	};

	handleResize = (newWidth: number, newHeight: number): void => {
		if (newWidth === this.pixelCanvas.width && newHeight === this.pixelCanvas.height) return;
		this.#toolRunner.pushSnapshot();
		this.pixelCanvas = this.pixelCanvas.resize_with_anchor(
			newWidth,
			newHeight,
			RESIZE_ANCHOR_MAP[this.resizeAnchor]
		);
		const clamped = this.viewportState.viewport.clamp_pan(
			newWidth,
			newHeight,
			this.viewportSize.width,
			this.viewportSize.height
		);
		this.viewportState = { ...this.viewportState, viewport: clamped };
		this.renderVersion++;
	};

	handleExportPng = (): void => {
		try {
			exportAsPng(this.pixelCanvas);
		} catch (error) {
			console.error('PNG export failed:', error);
		}
	};

	handleKeyDown = (event: KeyboardEvent): void => {
		this.#keyboard.handleKeyDown(event);
	};

	handleKeyUp = (event: KeyboardEvent): void => {
		this.#keyboard.handleKeyUp(event);
	};

	handleBlur = (): void => {
		this.#keyboard.handleBlur();
	};
}
