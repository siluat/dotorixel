import {
	WasmPixelCanvas,
	WasmViewport,
	WasmHistoryManager,
	WasmColor,
	WasmToolType,
	WasmResizeAnchor,
	apply_tool,
	wasm_interpolate_pixels,
	wasm_rectangle_outline,
	wasm_ellipse_outline,
	wasm_flood_fill
} from '$wasm/dotorixel_wasm';
import type { CanvasCoords, ResizeAnchor, ViewportSize, ViewportState } from './view-types';
import { TOOL_CURSORS, type ToolType } from './tool-types';
import { colorToHex, hexToColor, addRecentColor, type Color } from './color';
import { exportAsPng } from './export';
import { ShapeHandler } from './shape-handler';
import { constrainLine, constrainSquare } from './constrain';
import { shiftPixels } from './shift-pixels';
import { TOOL_SHORTCUT_KEYS } from './shortcut-display';
import type { DrawTool, DrawResult, ToolContext } from './draw-tool';
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

// Derived from TOOL_SHORTCUT_KEYS: maps KeyboardEvent.code → ToolType
const TOOL_SHORTCUTS: Record<string, ToolType> = Object.fromEntries(
	Object.entries(TOOL_SHORTCUT_KEYS).map(([tool, key]) => [`Key${key}`, tool])
) as Record<string, ToolType>;

type ShapeToolType = 'line' | 'rectangle' | 'ellipse';

function isShapeTool(tool: ToolType): tool is ShapeToolType {
	return tool === 'line' || tool === 'rectangle' || tool === 'ellipse';
}

function isTextInputTarget(target: EventTarget | null): boolean {
	if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
	return target.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"])') !== null;
}

export interface EditorOptions {
	canvasWidth?: number;
	canvasHeight?: number;
	foregroundColor?: Color;
	backgroundColor?: Color;
	gridColor?: string;
}

export class EditorState {
	pixelCanvas = $state<WasmPixelCanvas>(null!);
	viewportSize = $state<ViewportSize>({ width: 512, height: 512 });
	viewportState = $state<ViewportState>(null!);
	activeTool = $state<ToolType>('pencil');
	renderVersion = $state(0);
	foregroundColor = $state<Color>({ r: 0, g: 0, b: 0, a: 255 });
	backgroundColor = $state<Color>({ r: 255, g: 255, b: 255, a: 255 });
	recentColors = $state<string[]>([]);
	resizeAnchor = $state<ResizeAnchor>('top-left');

	#history = WasmHistoryManager.default_manager();
	#historyVersion = $state(0);
	#isDrawing = $state(false);
	#drawButton = 0;
	#activeDrawColor: WasmColor | null = null;
	#toolBeforeModifier = $state<ToolType | null>(null);
	#isAltHeld = $state(false);
	#isSpaceHeld = $state(false);
	#isShiftHeld = $state(false);
	#shortcutHintsVisible = $state(false);

	get isSpaceHeld(): boolean {
		return this.#isSpaceHeld;
	}

	get isShiftHeld(): boolean {
		return this.#isShiftHeld;
	}

	get shortcutHintsVisible(): boolean {
		return this.#shortcutHintsVisible;
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
			isShiftHeld: () => this.#isShiftHeld,
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
		const cw = options.canvasWidth ?? 16;
		const ch = options.canvasHeight ?? 16;
		this.pixelCanvas = new WasmPixelCanvas(cw, ch);
		this.viewportState = {
			viewport: WasmViewport.for_canvas(cw, ch),
			showGrid: true,
			gridColor: options.gridColor ?? '#cccccc'
		};
		if (options.foregroundColor) {
			this.foregroundColor = options.foregroundColor;
		}
		if (options.backgroundColor) {
			this.backgroundColor = options.backgroundColor;
		}
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
		if (this.#shortcutHintsVisible) return;
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
		if (this.#toolBeforeModifier !== null && !this.#isAltHeld) {
			this.activeTool = this.#toolBeforeModifier;
			this.#toolBeforeModifier = null;
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
		if (this.#shortcutHintsVisible) return;
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
		if (isTextInputTarget(event.target)) return;

		if (event.code === 'Slash') {
			event.preventDefault();
			if (event.repeat) return;
			if (this.#isDrawing) return;
			this.#shortcutHintsVisible = true;
			return;
		}

		if (event.code === 'AltLeft' || event.code === 'AltRight') {
			if (event.repeat) return;
			this.#isAltHeld = true;
			if (this.#isDrawing) return;
			if (this.activeTool === 'eyedropper') return;
			this.#toolBeforeModifier = this.activeTool;
			this.activeTool = 'eyedropper';
			return;
		}

		if (event.code === 'Space') {
			event.preventDefault();
			if (event.repeat) return;
			if (this.#isDrawing) return;
			this.#isSpaceHeld = true;
			return;
		}

		if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
			if (event.repeat) return;
			this.#isShiftHeld = true;
			if (this.#isDrawing && isShapeTool(this.activeTool) && this.#lastDrawCurrent) {
				this.handleDraw(this.#lastDrawCurrent, this.#lastDrawCurrent);
			}
			return;
		}

		const isCtrlOrCmd = event.ctrlKey || event.metaKey;
		const isZKey = event.key.toLowerCase() === 'z';
		const isYKey = event.key.toLowerCase() === 'y';
		if (isCtrlOrCmd && isZKey && !event.shiftKey) {
			event.preventDefault();
			this.handleUndo();
		} else if ((isCtrlOrCmd && isZKey && event.shiftKey) || (isCtrlOrCmd && isYKey)) {
			event.preventDefault();
			this.handleRedo();
		}

		if (isCtrlOrCmd || event.altKey || event.shiftKey) return;

		if (event.code === 'KeyG') {
			if (event.repeat) return;
			this.handleGridToggle();
			return;
		}

		if (event.code === 'KeyX') {
			if (event.repeat) return;
			this.swapColors();
			return;
		}

		if (this.#isDrawing) return;
		const tool = TOOL_SHORTCUTS[event.code];
		if (tool) {
			this.activeTool = tool;
		}
	};

	handleKeyUp = (event: KeyboardEvent): void => {
		if (event.code === 'Slash') {
			this.#shortcutHintsVisible = false;
			return;
		}

		if (event.code === 'Space') {
			this.#isSpaceHeld = false;
		}

		if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
			this.#isShiftHeld = false;
			if (this.#isDrawing && isShapeTool(this.activeTool) && this.#lastDrawCurrent) {
				this.handleDraw(this.#lastDrawCurrent, this.#lastDrawCurrent);
			}
		}

		if (event.code === 'AltLeft' || event.code === 'AltRight') {
			this.#isAltHeld = false;
			if (this.#isDrawing) return;
			if (this.#toolBeforeModifier !== null) {
				this.activeTool = this.#toolBeforeModifier;
				this.#toolBeforeModifier = null;
			}
		}
	};

	handleBlur = (): void => {
		this.#isAltHeld = false;
		this.#isSpaceHeld = false;
		this.#isShiftHeld = false;
		this.#shortcutHintsVisible = false;
		if (this.#toolBeforeModifier !== null) {
			this.activeTool = this.#toolBeforeModifier;
			this.#toolBeforeModifier = null;
		}
	};
}
