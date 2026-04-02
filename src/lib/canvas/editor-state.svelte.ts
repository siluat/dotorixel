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
import type { ToolType } from './tool-types';
import { colorToHex, hexToColor, addRecentColor, type Color } from './color';
import { exportAsPng } from './export';
import { ShapeHandler } from './shape-handler';
import { constrainLine, constrainSquare } from './constrain';
import { shiftPixels } from './shift-pixels';

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

const TOOL_SHORTCUTS: Record<string, ToolType> = {
	KeyP: 'pencil',
	KeyE: 'eraser',
	KeyL: 'line',
	KeyR: 'rectangle',
	KeyC: 'ellipse',
	KeyF: 'floodfill',
	KeyI: 'eyedropper',
	KeyM: 'move'
};

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
	#lastShapeDrawCurrent: CanvasCoords | null = null;
	#moveStart: CanvasCoords | null = null;
	#moveSnapshot: Uint8Array | null = null;

	get isSpaceHeld(): boolean {
		return this.#isSpaceHeld;
	}

	get isShiftHeld(): boolean {
		return this.#isShiftHeld;
	}

	get shortcutHintsVisible(): boolean {
		return this.#shortcutHintsVisible;
	}

	#shapeHandlers: Record<ShapeToolType, ShapeHandler> = {
		line: new ShapeHandler(WasmToolType.Line, wasm_interpolate_pixels, constrainLine),
		rectangle: new ShapeHandler(WasmToolType.Rectangle, wasm_rectangle_outline, constrainSquare),
		ellipse: new ShapeHandler(WasmToolType.Ellipse, wasm_ellipse_outline, constrainSquare)
	};

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

	readonly foregroundColorHex = $derived(colorToHex(this.foregroundColor));
	readonly backgroundColorHex = $derived(colorToHex(this.backgroundColor));

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
		this.#lastShapeDrawCurrent = null;

		const isRightClick = button === 2;
		this.#activeDrawColor = isRightClick ? this.#wasmBackgroundColor : this.#wasmForegroundColor;

		if (this.activeTool === 'eyedropper') return;
		this.#history.push_snapshot(this.pixelCanvas.width, this.pixelCanvas.height, this.pixelCanvas.pixels());
		this.#historyVersion++;
		if (this.activeTool !== 'eraser' && this.activeTool !== 'move') {
			const activeColor = isRightClick ? this.backgroundColor : this.foregroundColor;
			this.recentColors = addRecentColor(this.recentColors, colorToHex(activeColor));
		}
		if (isShapeTool(this.activeTool)) {
			this.#shapeHandlers[this.activeTool].captureSnapshot(this.pixelCanvas);
		}
		if (this.activeTool === 'move') {
			this.#moveSnapshot = new Uint8Array(this.pixelCanvas.pixels());
		}
	};

	handleDrawEnd = (): void => {
		this.#isDrawing = false;
		this.#drawButton = 0;
		this.#activeDrawColor = null;
		this.#lastShapeDrawCurrent = null;
		if (isShapeTool(this.activeTool)) {
			this.#shapeHandlers[this.activeTool].reset();
		}
		if (this.activeTool === 'move') {
			this.#moveStart = null;
			this.#moveSnapshot = null;
		}
		if (this.#toolBeforeModifier !== null && !this.#isAltHeld) {
			this.activeTool = this.#toolBeforeModifier;
			this.#toolBeforeModifier = null;
		}
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
		const drawColor = this.#activeDrawColor!;
		if (isShapeTool(this.activeTool)) {
			this.#lastShapeDrawCurrent = current;
			if (
				this.#shapeHandlers[this.activeTool].draw(
					this.pixelCanvas,
					current,
					previous,
					drawColor,
					this.#isShiftHeld
				)
			) {
				this.renderVersion++;
			}
			return;
		}
		if (this.activeTool === 'move') {
			if (previous === null) {
				this.#moveStart = current;
				return;
			}
			if (!this.#moveStart || !this.#moveSnapshot) return;
			const dx = current.x - this.#moveStart.x;
			const dy = current.y - this.#moveStart.y;
			const shifted = shiftPixels(
				this.#moveSnapshot,
				this.pixelCanvas.width,
				this.pixelCanvas.height,
				dx,
				dy
			);
			this.pixelCanvas.restore_pixels(shifted);
			this.renderVersion++;
			return;
		}
		if (this.activeTool === 'floodfill') {
			if (previous !== null) return;
			if (wasm_flood_fill(this.pixelCanvas, current.x, current.y, drawColor)) {
				this.renderVersion++;
			}
			return;
		}
		if (this.activeTool === 'eyedropper') {
			if (previous !== null) return;
			const pixel = this.pixelCanvas.get_pixel(current.x, current.y);
			if (pixel.a === 0) return;
			const pickedColor = { r: pixel.r, g: pixel.g, b: pixel.b, a: pixel.a };
			const isRightClick = this.#drawButton === 2;
			if (isRightClick) {
				this.backgroundColor = pickedColor;
			} else {
				this.foregroundColor = pickedColor;
			}
			this.recentColors = addRecentColor(this.recentColors, colorToHex(pickedColor));
			return;
		}

		const wasmTool = this.activeTool === 'pencil' ? WasmToolType.Pencil : WasmToolType.Eraser;
		let changed = false;

		if (previous) {
			const flat = wasm_interpolate_pixels(previous.x, previous.y, current.x, current.y);
			for (let i = 0; i < flat.length; i += 2) {
				if (apply_tool(this.pixelCanvas, flat[i], flat[i + 1], wasmTool, drawColor)) {
					changed = true;
				}
			}
		} else {
			if (apply_tool(this.pixelCanvas, current.x, current.y, wasmTool, drawColor)) {
				changed = true;
			}
		}

		if (changed) this.renderVersion++;
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
			if (this.#isDrawing && isShapeTool(this.activeTool) && this.#lastShapeDrawCurrent) {
				this.handleDraw(this.#lastShapeDrawCurrent, this.#lastShapeDrawCurrent);
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
			if (this.#isDrawing && isShapeTool(this.activeTool) && this.#lastShapeDrawCurrent) {
				this.handleDraw(this.#lastShapeDrawCurrent, this.#lastShapeDrawCurrent);
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
