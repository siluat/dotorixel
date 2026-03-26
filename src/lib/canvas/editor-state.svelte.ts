import {
	WasmPixelCanvas,
	WasmViewport,
	WasmHistoryManager,
	WasmColor,
	WasmToolType,
	apply_tool,
	wasm_interpolate_pixels,
	wasm_rectangle_outline,
	wasm_ellipse_outline,
	wasm_flood_fill
} from '$wasm/dotorixel_wasm';
import type { CanvasCoords, ViewportSize, ViewportState } from './view-types';
import type { ToolType } from './tool-types';
import { colorToHex, hexToColor, addRecentColor, type Color } from './color';
import { exportAsPng } from './export';
import { ShapeHandler } from './shape-handler';

const TOOL_SHORTCUTS: Record<string, ToolType> = {
	KeyP: 'pencil',
	KeyE: 'eraser',
	KeyL: 'line',
	KeyR: 'rectangle',
	KeyC: 'ellipse',
	KeyF: 'floodfill',
	KeyI: 'eyedropper'
};

type ShapeToolType = 'line' | 'rectangle' | 'ellipse';

function isShapeTool(tool: ToolType): tool is ShapeToolType {
	return tool === 'line' || tool === 'rectangle' || tool === 'ellipse';
}

function isInteractiveTarget(target: EventTarget | null): boolean {
	if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
	return target.closest('button, input, select, textarea, [contenteditable="true"]') !== null;
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

	#history = WasmHistoryManager.default_manager();
	#historyVersion = $state(0);
	#isDrawing = $state(false);
	#toolBeforeModifier = $state<ToolType | null>(null);
	#isAltHeld = $state(false);
	#isSpaceHeld = $state(false);

	get isSpaceHeld(): boolean {
		return this.#isSpaceHeld;
	}

	#shapeHandlers: Record<ShapeToolType, ShapeHandler> = {
		line: new ShapeHandler(WasmToolType.Line, wasm_interpolate_pixels),
		rectangle: new ShapeHandler(WasmToolType.Rectangle, wasm_rectangle_outline),
		ellipse: new ShapeHandler(WasmToolType.Ellipse, wasm_ellipse_outline)
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

	handleDrawStart = (): void => {
		this.#isDrawing = true;
		if (this.activeTool === 'eyedropper') return;
		this.#history.push_snapshot(this.pixelCanvas.pixels());
		this.#historyVersion++;
		if (this.activeTool !== 'eraser') {
			this.recentColors = addRecentColor(this.recentColors, colorToHex(this.foregroundColor));
		}
		if (isShapeTool(this.activeTool)) {
			this.#shapeHandlers[this.activeTool].captureSnapshot(this.pixelCanvas);
		}
	};

	handleDrawEnd = (): void => {
		this.#isDrawing = false;
		if (isShapeTool(this.activeTool)) {
			this.#shapeHandlers[this.activeTool].reset();
		}
		if (this.#toolBeforeModifier !== null && !this.#isAltHeld) {
			this.activeTool = this.#toolBeforeModifier;
			this.#toolBeforeModifier = null;
		}
	};

	handleUndo = (): void => {
		if (this.#isDrawing) return;
		const snapshot = this.#history.undo(this.pixelCanvas.pixels());
		if (snapshot) {
			this.pixelCanvas.restore_pixels(snapshot);
			this.renderVersion++;
			this.#historyVersion++;
		}
	};

	handleRedo = (): void => {
		if (this.#isDrawing) return;
		const snapshot = this.#history.redo(this.pixelCanvas.pixels());
		if (snapshot) {
			this.pixelCanvas.restore_pixels(snapshot);
			this.renderVersion++;
			this.#historyVersion++;
		}
	};

	handleClear = (): void => {
		this.#history.push_snapshot(this.pixelCanvas.pixels());
		this.#historyVersion++;
		this.pixelCanvas.clear();
		this.renderVersion++;
	};

	handleDraw = (current: CanvasCoords, previous: CanvasCoords | null): void => {
		if (isShapeTool(this.activeTool)) {
			if (
				this.#shapeHandlers[this.activeTool].draw(
					this.pixelCanvas,
					current,
					previous,
					this.#wasmForegroundColor
				)
			) {
				this.renderVersion++;
			}
			return;
		}
		if (this.activeTool === 'floodfill') {
			if (previous !== null) return;
			if (wasm_flood_fill(this.pixelCanvas, current.x, current.y, this.#wasmForegroundColor)) {
				this.renderVersion++;
			}
			return;
		}
		if (this.activeTool === 'eyedropper') {
			if (previous !== null) return;
			const pixel = this.pixelCanvas.get_pixel(current.x, current.y);
			if (pixel.a === 0) return;
			this.foregroundColor = { r: pixel.r, g: pixel.g, b: pixel.b, a: pixel.a };
			this.recentColors = addRecentColor(this.recentColors, colorToHex(this.foregroundColor));
			return;
		}

		const wasmTool = this.activeTool === 'pencil' ? WasmToolType.Pencil : WasmToolType.Eraser;
		let changed = false;

		if (previous) {
			const flat = wasm_interpolate_pixels(previous.x, previous.y, current.x, current.y);
			for (let i = 0; i < flat.length; i += 2) {
				if (
					apply_tool(this.pixelCanvas, flat[i], flat[i + 1], wasmTool, this.#wasmForegroundColor)
				) {
					changed = true;
				}
			}
		} else {
			if (
				apply_tool(this.pixelCanvas, current.x, current.y, wasmTool, this.#wasmForegroundColor)
			) {
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

	handleFit = (): void => {
		const fitted = this.viewportState.viewport.fit_to_viewport(
			this.pixelCanvas.width,
			this.pixelCanvas.height,
			this.viewportSize.width,
			this.viewportSize.height
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
		this.pixelCanvas = this.pixelCanvas.resize(newWidth, newHeight);
		const clamped = this.viewportState.viewport.clamp_pan(
			newWidth,
			newHeight,
			this.viewportSize.width,
			this.viewportSize.height
		);
		this.viewportState = { ...this.viewportState, viewport: clamped };
		// Resize changes canvas dimensions, invalidating previous pixel-coordinate snapshots
		this.#history.clear();
		this.#historyVersion++;
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
		if (isInteractiveTarget(event.target)) return;

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
		if (event.code === 'Space') {
			this.#isSpaceHeld = false;
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
		if (this.#toolBeforeModifier !== null) {
			this.activeTool = this.#toolBeforeModifier;
			this.#toolBeforeModifier = null;
		}
	};
}
