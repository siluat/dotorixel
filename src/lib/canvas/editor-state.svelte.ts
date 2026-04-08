import type { PixelCanvas } from './pixel-canvas';
import { canvasFactory, viewportOps } from './wasm-backend';
import type { CanvasCoords, ResizeAnchor } from './canvas-types';
import type { ViewportData, ViewportSize } from './viewport';
import { TOOL_CURSORS, type ToolType } from './tool-registry';
import { colorToHex, hexToColor, addRecentColor, type Color } from './color';
import { SharedState } from './shared-state.svelte';
import { exportAsPng } from './export';
import { createKeyboardInput, type KeyboardInput } from './keyboard-input.svelte';
import { createToolRunner, type ToolRunner, type EditorEffects } from './tool-runner.svelte';

function assertNever(x: never): never {
	throw new Error(`Unhandled effect type: ${(x as { type: string }).type}`);
}

export interface EditorOptions {
	canvasWidth?: number;
	canvasHeight?: number;
	foregroundColor?: Color;
	backgroundColor?: Color;
	gridColor?: string;
	shared?: SharedState;
	name?: string;
	documentId?: string;
	pixelCanvas?: PixelCanvas;
	viewport?: ViewportData;
}

export class EditorState {
	readonly shared: SharedState;
	readonly name: string;
	readonly documentId: string;
	pixelCanvas = $state<PixelCanvas>(null!);
	viewportSize = $state<ViewportSize>({ width: 512, height: 512 });
	viewport = $state<ViewportData>(null!);
	renderVersion = $state(0);
	resizeAnchor = $state<ResizeAnchor>('top-left');
	isExportUIOpen = $state(false);

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

	readonly zoomPercent = $derived(Math.round(this.viewport.zoom * 100));

	readonly toolCursor = $derived(TOOL_CURSORS[this.activeTool]);

	readonly foregroundColorHex = $derived(colorToHex(this.foregroundColor));
	readonly backgroundColorHex = $derived(colorToHex(this.backgroundColor));

	#applyEffects(effects: EditorEffects): void {
		for (const effect of effects) {
			switch (effect.type) {
				case 'canvasChanged':
					this.renderVersion++;
					break;
				case 'canvasReplaced':
					this.pixelCanvas = effect.canvas;
					this.viewport = viewportOps.clampPan(
						this.viewport,
						effect.canvas.width,
						effect.canvas.height,
						this.viewportSize.width,
						this.viewportSize.height
					);
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
			this.pixelCanvas = canvasFactory.create(cw, ch);
		}

		if (options.viewport) {
			this.viewport = options.viewport;
		} else {
			const cw = this.pixelCanvas.width;
			const ch = this.pixelCanvas.height;
			const vd = viewportOps.forCanvas(cw, ch);
			this.viewport = options.gridColor ? { ...vd, gridColor: options.gridColor } : vd;
		}

		if (options.foregroundColor) {
			this.shared.foregroundColor = options.foregroundColor;
		}
		if (options.backgroundColor) {
			this.shared.backgroundColor = options.backgroundColor;
		}

		// Step 1: Create ToolRunner (getShiftHeld via lazy ref)
		const self = this;
		let keyboardRef: KeyboardInput | null = null;

		this.#toolRunner = createToolRunner({
			host: {
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
			shared: this.shared,
			getShiftHeld: () => keyboardRef?.isShiftHeld ?? false
		});

		// Step 2: Create KeyboardInput (toolRunner is initialized — callbacks are safe)
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
		keyboardRef = this.#keyboard;
	}

	handleViewportChange = (newViewport: ViewportData): void => {
		this.viewport = viewportOps.clampPan(
			newViewport,
			this.pixelCanvas.width,
			this.pixelCanvas.height,
			this.viewportSize.width,
			this.viewportSize.height
		);
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
		const newZoom = viewportOps.nextZoomLevel(this.viewport.zoom);
		const zoomed = viewportOps.zoomAtPoint(this.viewport, centerX, centerY, newZoom);
		this.handleViewportChange(zoomed);
	};

	handleZoomOut = (): void => {
		const centerX = this.viewportSize.width / 2;
		const centerY = this.viewportSize.height / 2;
		const newZoom = viewportOps.prevZoomLevel(this.viewport.zoom);
		const zoomed = viewportOps.zoomAtPoint(this.viewport, centerX, centerY, newZoom);
		this.handleViewportChange(zoomed);
	};

	handleZoomReset = (): void => {
		const centerX = this.viewportSize.width / 2;
		const centerY = this.viewportSize.height / 2;
		const zoomed = viewportOps.zoomAtPoint(this.viewport, centerX, centerY, 1.0);
		this.handleViewportChange(zoomed);
	};

	handleFit = (maxZoom: number = Infinity): void => {
		this.viewport = viewportOps.fitToViewport(
			this.viewport,
			this.pixelCanvas.width,
			this.pixelCanvas.height,
			this.viewportSize.width,
			this.viewportSize.height,
			maxZoom
		);
	};

	handleGridToggle = (): void => {
		this.viewport = { ...this.viewport, showGrid: !this.viewport.showGrid };
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
		this.pixelCanvas = canvasFactory.resizeWithAnchor(
			this.pixelCanvas,
			newWidth,
			newHeight,
			this.resizeAnchor
		);
		this.viewport = viewportOps.clampPan(
			this.viewport,
			newWidth,
			newHeight,
			this.viewportSize.width,
			this.viewportSize.height
		);
		this.renderVersion++;
	};

	toggleExportUI = (): void => {
		this.isExportUIOpen = !this.isExportUIOpen;
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
