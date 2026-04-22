import type { CanvasCoords, ResizeAnchor } from '../canvas-model';
import type { ViewportData, ViewportSize } from '../viewport';
import type { PixelCanvas } from '../canvas-model';
import type { Color } from '../color';
import { colorToHex, hexToColor } from '../color';
import { TOOL_CURSORS, type ToolType } from '../tool-registry';
import type { KeyboardInput } from '../keyboard-input.svelte';
import type { SamplingSession } from '../sampling-session.svelte';
import type { PointerType } from '../canvas-interaction.svelte';
import type { Workspace } from './workspace.svelte';

/**
 * UI facade for the editor session. Templates bind to `EditorController`
 * for the common path reads (`editor.activeTool`, `editor.canUndo`) and
 * call setter methods or handler delegators for writes.
 *
 * Ownership layering:
 * - Per-tab state lives on `workspace.activeTab` (canvas, viewport, history).
 * - Workspace-shared state lives on `workspace.shared` (active tool, colors).
 * - Keyboard lifecycle is owned by the controller via `keyboard`.
 *
 * The underlying instances are exposed as `readonly` fields so callers that
 * genuinely need ownership-aware access (persistence, tests, gestures) can
 * reach through: `editor.workspace.shared.X`, `editor.workspace.activeTab.X`,
 * `editor.keyboard.X`.
 */
export class EditorController {
	constructor(
		readonly workspace: Workspace,
		readonly keyboard: KeyboardInput
	) {}

	// Shared-state projections
	get activeTool(): ToolType {
		return this.workspace.shared.activeTool;
	}
	get foregroundColor(): Color {
		return this.workspace.shared.foregroundColor;
	}
	get backgroundColor(): Color {
		return this.workspace.shared.backgroundColor;
	}
	get foregroundColorHex(): string {
		return colorToHex(this.workspace.shared.foregroundColor);
	}
	get backgroundColorHex(): string {
		return colorToHex(this.workspace.shared.backgroundColor);
	}
	get recentColors(): string[] {
		return this.workspace.shared.recentColors;
	}
	get pixelPerfect(): boolean {
		return this.workspace.shared.pixelPerfect;
	}
	get toolCursor(): string {
		return TOOL_CURSORS[this.workspace.shared.activeTool];
	}

	// Active-tab projections
	get pixelCanvas(): PixelCanvas {
		return this.workspace.activeTab.pixelCanvas;
	}
	get viewport(): ViewportData {
		return this.workspace.activeTab.viewport;
	}
	get viewportSize(): ViewportSize {
		return this.workspace.activeTab.viewportSize;
	}
	get renderVersion(): number {
		return this.workspace.activeTab.renderVersion;
	}
	get resizeAnchor(): ResizeAnchor {
		return this.workspace.activeTab.resizeAnchor;
	}
	get isExportUIOpen(): boolean {
		return this.workspace.activeTab.isExportUIOpen;
	}
	get samplingSession(): SamplingSession {
		return this.workspace.activeTab.samplingSession;
	}
	get canUndo(): boolean {
		return this.workspace.activeTab.canUndo;
	}
	get canRedo(): boolean {
		return this.workspace.activeTab.canRedo;
	}
	get zoomPercent(): number {
		return this.workspace.activeTab.zoomPercent;
	}

	// Keyboard projections
	get isSpaceHeld(): boolean {
		return this.keyboard.isSpaceHeld;
	}
	get isShiftHeld(): boolean {
		return this.keyboard.isShiftHeld;
	}
	get isShortcutHintsVisible(): boolean {
		return this.keyboard.isShortcutHintsVisible;
	}

	// Explicit setters (route through workspace so dirty notifications fire)
	setTool(tool: ToolType): void {
		this.workspace.setActiveTool(tool);
	}
	setForegroundColor(color: Color): void {
		this.workspace.setForegroundColor(color);
	}
	setBackgroundColor(color: Color): void {
		this.workspace.setBackgroundColor(color);
	}
	togglePixelPerfect(): void {
		this.workspace.togglePixelPerfect();
	}

	// Drawing handlers
	handleDrawStart = (button: number, pointerType: PointerType): void => {
		if (this.keyboard.isShortcutHintsVisible) return;
		this.workspace.activeTab.drawStart(button, pointerType);
	};

	handleDraw = (current: CanvasCoords, previous: CanvasCoords | null): void => {
		if (this.keyboard.isShortcutHintsVisible) return;
		this.workspace.activeTab.draw(current, previous);
	};

	handleDrawEnd = (): void => {
		this.workspace.activeTab.drawEnd();
		const restored = this.keyboard.consumePendingToolRestore();
		if (restored !== null) {
			this.setTool(restored);
		}
	};

	// Sampling handlers
	handleSampleStart = (
		coords: CanvasCoords,
		button: number,
		pointerType: PointerType
	): boolean => {
		return this.workspace.activeTab.sampleStart(coords, button, pointerType);
	};

	handleSampleUpdate = (coords: CanvasCoords): void => {
		this.workspace.activeTab.sampleUpdate(coords);
	};

	handleSampleEnd = (): void => {
		this.workspace.activeTab.sampleEnd();
	};

	// History handlers
	handleUndo = (): void => {
		this.workspace.activeTab.undo();
	};

	handleRedo = (): void => {
		this.workspace.activeTab.redo();
	};

	handleClear = (): void => {
		this.workspace.activeTab.clear();
	};

	// Viewport handlers
	handleViewportChange = (newViewport: ViewportData): void => {
		this.workspace.activeTab.setViewport(newViewport);
	};

	handleZoomIn = (): void => {
		this.workspace.activeTab.zoomIn();
	};

	handleZoomOut = (): void => {
		this.workspace.activeTab.zoomOut();
	};

	handleZoomReset = (): void => {
		this.workspace.activeTab.zoomReset();
	};

	handleFit = (maxZoom: number = Infinity): void => {
		this.workspace.activeTab.zoomFit(maxZoom);
	};

	handleGridToggle = (): void => {
		this.workspace.activeTab.toggleGrid();
	};

	// Canvas handlers
	handleResize = (newWidth: number, newHeight: number): void => {
		this.workspace.activeTab.resize(newWidth, newHeight);
	};

	// Color handlers (hex adapters over the Color-typed setters)
	handleForegroundColorChange = (hex: string): void => {
		this.setForegroundColor(hexToColor(hex));
	};

	handleBackgroundColorChange = (hex: string): void => {
		this.setBackgroundColor(hexToColor(hex));
	};

	swapColors = (): void => {
		this.workspace.swapColors();
	};

	// Export handlers
	toggleExportUI = (): void => {
		this.workspace.activeTab.toggleExportUI();
	};

	handleExportPng = (): void => {
		this.workspace.activeTab.exportPng();
	};

	// Keyboard handlers (forward to keyboard input)
	handleKeyDown = (event: KeyboardEvent): void => {
		this.keyboard.handleKeyDown(event);
	};

	handleKeyUp = (event: KeyboardEvent): void => {
		this.keyboard.handleKeyUp(event);
	};

	handleBlur = (): void => {
		this.keyboard.handleBlur();
	};
}
