import {
	WasmPixelCanvas,
	WasmViewport,
	WasmHistoryManager,
	WasmColor,
	WasmToolType,
	apply_tool,
	wasm_interpolate_pixels
} from '$wasm/dotorixel_wasm';
import type { CanvasCoords, ViewportSize, ViewportState } from './view-types';
import type { ToolType } from './tool-types';
import { colorToHex, hexToColor, addRecentColor, type Color } from './color';
import { exportAsPng } from './export';

const WASM_TOOL_MAP = {
	pencil: WasmToolType.Pencil,
	eraser: WasmToolType.Eraser,
	line: WasmToolType.Line
} as const;

function isInteractiveTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		target.closest('button, input, select, textarea, [contenteditable="true"]') !== null
	);
}

export interface EditorOptions {
	canvasWidth?: number;
	canvasHeight?: number;
	foregroundColor?: Color;
	gridColor?: string;
}

export class EditorState {
	pixelCanvas = $state<WasmPixelCanvas>(null!);
	viewportSize = $state<ViewportSize>({ width: 512, height: 512 });
	viewportState = $state<ViewportState>(null!);
	activeTool = $state<ToolType>('pencil');
	renderVersion = $state(0);
	foregroundColor = $state<Color>({ r: 0, g: 0, b: 0, a: 255 });
	recentColors = $state<string[]>([]);

	#history = WasmHistoryManager.default_manager();
	#historyVersion = $state(0);
	#isDrawing = $state(false);
	#lineStart: CanvasCoords | null = null;
	#previewSnapshot: Uint8Array | null = null;

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

	readonly selectedColorHex = $derived(colorToHex(this.foregroundColor));

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
		this.#history.push_snapshot(this.pixelCanvas.pixels());
		this.#historyVersion++;
		if (this.activeTool === 'pencil' || this.activeTool === 'line') {
			this.recentColors = addRecentColor(this.recentColors, colorToHex(this.foregroundColor));
		}
		if (this.activeTool === 'line') {
			this.#previewSnapshot = new Uint8Array(this.pixelCanvas.pixels());
		}
	};

	handleDrawEnd = (): void => {
		this.#isDrawing = false;
		this.#lineStart = null;
		this.#previewSnapshot = null;
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
		if (this.activeTool === 'line') {
			this.#handleLineDraw(current, previous);
			return;
		}

		const wasmTool = WASM_TOOL_MAP[this.activeTool];
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

	#handleLineDraw(current: CanvasCoords, previous: CanvasCoords | null): void {
		if (previous === null) {
			this.#lineStart = current;
			if (
				apply_tool(
					this.pixelCanvas,
					current.x,
					current.y,
					WasmToolType.Line,
					this.#wasmForegroundColor
				)
			) {
				this.renderVersion++;
			}
			return;
		}

		if (!this.#lineStart || !this.#previewSnapshot) return;

		this.pixelCanvas.restore_pixels(this.#previewSnapshot);

		const flat = wasm_interpolate_pixels(
			this.#lineStart.x,
			this.#lineStart.y,
			current.x,
			current.y
		);
		for (let i = 0; i < flat.length; i += 2) {
			apply_tool(
				this.pixelCanvas,
				flat[i],
				flat[i + 1],
				WasmToolType.Line,
				this.#wasmForegroundColor
			);
		}
		this.renderVersion++;
	}

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

	handleColorChange = (hex: string): void => {
		this.foregroundColor = hexToColor(hex);
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

		const isCtrlOrCmd = event.ctrlKey || event.metaKey;
		const isZKey = event.key.toLowerCase() === 'z';
		if (isCtrlOrCmd && isZKey && !event.shiftKey) {
			event.preventDefault();
			this.handleUndo();
		} else if (isCtrlOrCmd && isZKey && event.shiftKey) {
			event.preventDefault();
			this.handleRedo();
		}
	};
}
