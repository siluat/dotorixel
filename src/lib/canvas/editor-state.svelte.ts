import {
	WasmPixelCanvas,
	WasmViewport,
	WasmHistoryManager,
	WasmColor,
	WasmToolType,
	WasmResizeAnchor,
	wasm_interpolate_pixels,
	wasm_rectangle_outline,
	wasm_ellipse_outline
} from '$wasm/dotorixel_wasm';
import type { CanvasCoords, ResizeAnchor, ViewportSize, ViewportState } from './view-types';
import { TOOL_CURSORS, type ToolType } from './tool-types';
import { colorToHex, hexToColor, addRecentColor, type Color } from './color';
import { SharedState } from './shared-state.svelte';
import { exportAsPng } from './export';
import { constrainLine, constrainSquare } from './constrain';
import type { DrawTool, DrawResult, ToolContext } from './draw-tool';
import { createKeyboardInput, type KeyboardInput } from './keyboard-input.svelte';
import { pencilTool, eraserTool } from './tools/pencil-tool';
import { floodfillTool } from './tools/floodfill-tool';
import { eyedropperTool } from './tools/eyedropper-tool';
import { createMoveTool } from './tools/move-tool';
import { createShapeTool } from './tools/shape-tool';

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

	#history = WasmHistoryManager.default_manager();
	#historyVersion = $state(0);
	#isDrawing = $state(false);
	#drawButton = 0;
	#activeDrawColor: WasmColor | null = null;
	#keyboard: KeyboardInput = null!;

	get isSpaceHeld(): boolean {
		return this.#keyboard.isSpaceHeld;
	}

	get isShiftHeld(): boolean {
		return this.#keyboard.isShiftHeld;
	}

	get isShortcutHintsVisible(): boolean {
		return this.#keyboard.isShortcutHintsVisible;
	}

	readonly canUndo = $derived.by(() => {
		void this.#historyVersion;
		return this.#history.can_undo();
	});

	readonly canRedo = $derived.by(() => {
		void this.#historyVersion;
		return this.#history.can_redo();
	});

	readonly zoomPercent = $derived(Math.round(this.viewportState.viewport.zoom * 100));

	readonly #wasmForegroundColor = $derived(
		new WasmColor(
			this.foregroundColor.r,
			this.foregroundColor.g,
			this.foregroundColor.b,
			this.foregroundColor.a
		)
	);

	readonly #wasmBackgroundColor = $derived(
		new WasmColor(
			this.backgroundColor.r,
			this.backgroundColor.g,
			this.backgroundColor.b,
			this.backgroundColor.a
		)
	);

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

	readonly #tools: Record<ToolType, DrawTool> = {
		pencil: pencilTool,
		eraser: eraserTool,
		line: createShapeTool(WasmToolType.Line, wasm_interpolate_pixels, constrainLine),
		rectangle: createShapeTool(WasmToolType.Rectangle, wasm_rectangle_outline, constrainSquare),
		ellipse: createShapeTool(WasmToolType.Ellipse, wasm_ellipse_outline, constrainSquare),
		floodfill: floodfillTool,
		eyedropper: eyedropperTool,
		move: createMoveTool()
	};
	#lastDrawCurrent: CanvasCoords | null = null;

	#buildContext(): ToolContext {
		return {
			canvas: this.pixelCanvas,
			drawColor: this.#activeDrawColor!,
			drawButton: this.#drawButton,
			isShiftHeld: () => this.#keyboard.isShiftHeld,
			foregroundColor: this.foregroundColor,
			backgroundColor: this.backgroundColor
		};
	}

	#applyDrawResult(result: DrawResult): void {
		if (result.canvasChanged) this.renderVersion++;
		if (result.colorPick) {
			if (result.colorPick.target === 'foreground') {
				this.foregroundColor = result.colorPick.color;
			} else {
				this.backgroundColor = result.colorPick.color;
			}
		}
		if (result.addRecentColor) {
			this.recentColors = addRecentColor(this.recentColors, result.addRecentColor);
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
		this.#keyboard = createKeyboardInput({
			isDrawing: () => this.#isDrawing,
			getActiveTool: () => this.activeTool,
			setActiveTool: (tool) => {
				this.activeTool = tool;
			},
			undo: () => this.handleUndo(),
			redo: () => this.handleRedo(),
			toggleGrid: () => this.handleGridToggle(),
			swapColors: () => this.swapColors(),
			notifyModifierChange: () => {
				if (this.#isDrawing && this.#lastDrawCurrent) {
					const tool = this.#tools[this.activeTool];
					if (tool.onModifierChange) {
						this.#applyDrawResult(
							tool.onModifierChange(this.#buildContext(), this.#lastDrawCurrent)
						);
					}
				}
			}
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
		this.#isDrawing = true;
		this.#drawButton = button;
		this.#lastDrawCurrent = null;

		const isRightClick = button === 2;
		this.#activeDrawColor = isRightClick ? this.#wasmBackgroundColor : this.#wasmForegroundColor;

		const tool = this.#tools[this.activeTool];
		if (tool.capturesHistory) {
			this.#history.push_snapshot(this.pixelCanvas.width, this.pixelCanvas.height, this.pixelCanvas.pixels());
			this.#historyVersion++;
		}
		this.#applyDrawResult(tool.onDrawStart(this.#buildContext()));
	};

	handleDrawEnd = (): void => {
		this.#tools[this.activeTool].onDrawEnd(this.#buildContext());
		this.#isDrawing = false;
		this.#drawButton = 0;
		this.#activeDrawColor = null;
		this.#lastDrawCurrent = null;
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
		if (this.#isDrawing) return;
		const snapshot = this.#history.undo(this.pixelCanvas.width, this.pixelCanvas.height, this.pixelCanvas.pixels());
		if (snapshot) this.#applySnapshot(snapshot);
	};

	handleRedo = (): void => {
		if (this.#isDrawing) return;
		const snapshot = this.#history.redo(this.pixelCanvas.width, this.pixelCanvas.height, this.pixelCanvas.pixels());
		if (snapshot) this.#applySnapshot(snapshot);
	};

	#applySnapshot(snapshot: { width: number; height: number; pixels(): Uint8Array }): void {
		const hasDimensionsChanged =
			snapshot.width !== this.pixelCanvas.width || snapshot.height !== this.pixelCanvas.height;
		if (hasDimensionsChanged) {
			this.pixelCanvas = WasmPixelCanvas.from_pixels(snapshot.width, snapshot.height, snapshot.pixels());
			const clamped = this.viewportState.viewport.clamp_pan(
				snapshot.width,
				snapshot.height,
				this.viewportSize.width,
				this.viewportSize.height
			);
			this.viewportState = { ...this.viewportState, viewport: clamped };
		} else {
			this.pixelCanvas.restore_pixels(snapshot.pixels());
		}
		this.renderVersion++;
		this.#historyVersion++;
	}

	handleClear = (): void => {
		this.#history.push_snapshot(this.pixelCanvas.width, this.pixelCanvas.height, this.pixelCanvas.pixels());
		this.#historyVersion++;
		this.pixelCanvas.clear();
		this.renderVersion++;
	};

	handleDraw = (current: CanvasCoords, previous: CanvasCoords | null): void => {
		if (this.#keyboard.isShortcutHintsVisible) return;
		this.#lastDrawCurrent = current;
		this.#applyDrawResult(this.#tools[this.activeTool].onDraw(this.#buildContext(), current, previous));
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
		this.#history.push_snapshot(this.pixelCanvas.width, this.pixelCanvas.height, this.pixelCanvas.pixels());
		this.#historyVersion++;
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
