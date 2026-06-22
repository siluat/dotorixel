// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { Workspace, type WorkspaceDeps } from './workspace.svelte';
import { marqueeRegionFromDrag, singleLayerDocument } from '../wasm-backend';
import { createFakeDirtyNotifier } from './fake-dirty-notifier';
import type { TabSnapshot, WorkspaceSnapshot } from '../workspace-snapshot';
import { tabSnapshotFixture as makeTabSnap } from '../workspace-snapshot-fixtures';
import { DEFAULT_FRAME_DURATION_MS } from '$lib/session/session-storage-types';

// A stand-in frame id for the single-frame snapshots these openSnapshot tests
// hand-build. Valid UUID form, and shared because each snapshot is a separate
// document (frame ids are per-document, so reuse across tests is harmless).
const SNAP_FRAME_ID = '00000000-0000-4000-8000-0000000000f1';

function makeWorkspace(overrides: Omit<Partial<WorkspaceDeps>, 'notifier'> = {}) {
	const notifier = createFakeDirtyNotifier();
	const workspace = new Workspace({
		notifier,
		keyboard: { getShiftHeld: () => false },
		...overrides
	});
	return { workspace, notifier };
}

function rgba(values: readonly number[]): Uint8Array {
	return new Uint8Array(values);
}

function pixelAt(document: ReturnType<typeof singleLayerDocument>, x: number, y: number) {
	const pixels = document.composite();
	const i = (y * document.width + x) * 4;
	return Array.from(pixels.slice(i, i + 4));
}

describe('Workspace — initialization', () => {
	it('starts with a single "Untitled 1" tab', () => {
		const { workspace } = makeWorkspace();

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeIndex).toBe(0);
		expect(workspace.activeTab).toBe(workspace.tabs[0]);
		expect(workspace.activeTab.name).toBe('Untitled 1');
	});

	it('forwards initialForegroundColor to the first tab', () => {
		const customColor = { r: 45, g: 45, b: 45, a: 255 };
		const { workspace } = makeWorkspace({ initialForegroundColor: customColor });

		expect(workspace.shared.foregroundColor).toEqual(customColor);
	});

	it('forwards gridColor to the initial tab', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });

		expect(workspace.activeTab.viewport.gridColor).toBe('#ECE5D9');
	});
});

describe('Workspace — tab lifecycle', () => {
	it('addTab creates a new tab with the next Untitled number and activates it', () => {
		const { workspace } = makeWorkspace();

		workspace.addTab();

		expect(workspace.tabs).toHaveLength(2);
		expect(workspace.activeIndex).toBe(1);
		expect(workspace.activeTab.name).toBe('Untitled 2');
	});

	it('new tabs inherit the configured gridColor', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });

		workspace.addTab();

		expect(workspace.tabs[1].viewport.gridColor).toBe('#ECE5D9');
	});

	it('closing the active tab activates the right neighbor', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();
		workspace.addTab();
		workspace.setActiveTab(1);

		workspace.closeTab(1);

		expect(workspace.tabs).toHaveLength(2);
		expect(workspace.activeTab.name).toBe('Untitled 3');
	});

	it('closing the rightmost active tab activates the left neighbor', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();

		workspace.closeTab(1);

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeTab.name).toBe('Untitled 1');
	});

	it('closing the last remaining tab is a no-op', () => {
		const { workspace } = makeWorkspace();

		workspace.closeTab(0);

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeTab.name).toBe('Untitled 1');
	});

	it('closing a non-active tab preserves the current active tab', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();
		workspace.addTab();

		workspace.closeTab(0);

		expect(workspace.tabs).toHaveLength(2);
		expect(workspace.activeTab.name).toBe('Untitled 3');
	});

	it('setActiveTab switches the active tab', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();

		workspace.setActiveTab(0);

		expect(workspace.activeTab.name).toBe('Untitled 1');
	});

	it('switching tabs preserves each tab Marquee', () => {
		const { workspace } = makeWorkspace();
		workspace.activeTab.document.set_marquee(marqueeRegionFromDrag(1, 1, 3, 3));
		workspace.addTab();
		workspace.activeTab.document.set_marquee(marqueeRegionFromDrag(4, 0, 5, 2));

		workspace.setActiveTab(0);
		expect(workspace.activeTab.document.marquee()).toMatchObject({
			x: 1,
			y: 1,
			width: 3,
			height: 3
		});

		workspace.setActiveTab(1);
		expect(workspace.activeTab.document.marquee()).toMatchObject({
			x: 4,
			y: 0,
			width: 2,
			height: 3
		});
	});

	it('reuses the smallest available number after closing a tab', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();
		workspace.closeTab(1);

		workspace.addTab();

		expect(workspace.activeTab.name).toBe('Untitled 2');
	});

	it('fills gaps in tab numbering', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();
		workspace.addTab();
		workspace.closeTab(1);

		workspace.addTab();

		expect(workspace.activeTab.name).toBe('Untitled 2');
	});
});

describe('Workspace — shared state propagation', () => {
	it('all tabs share the same SharedState reference', () => {
		const { workspace } = makeWorkspace();
		workspace.addTab();

		workspace.shared.activeTool = 'eraser';

		expect(workspace.tabs[0].shared.activeTool).toBe('eraser');
		expect(workspace.tabs[1].shared.activeTool).toBe('eraser');
	});

	it('copySelection stores the active Marquee pixels in the shared Selection Clipboard', () => {
		const source = rgba([
			1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255,
			4, 0, 0, 255, 5, 0, 0, 255, 6, 0, 0, 255
		]);
		const { workspace, notifier } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'copy-doc',
			name: 'Copy',
			width: 3,
			height: 2,
			pixels: source.slice()
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 0, 2, 1));
		notifier.reset();

		workspace.copySelection();

		expect(workspace.shared.selectionClipboard).toEqual({
			pixels: rgba([2, 0, 0, 255, 3, 0, 0, 255, 5, 0, 0, 255, 6, 0, 0, 255]),
			width: 2,
			height: 2
		});
		expect(tab.document.layer_pixels_at(0)).toEqual(source);
		expect(notifier.dirtyCalls).toEqual(['copy-doc']);
	});

	it('copySelection stores Floating Selection pixels after an uncommitted nudge', () => {
		const source = new Uint8Array(5 * 5 * 4);
		source.set(rgba([255, 0, 0, 255]), (1 * 5 + 1) * 4);
		source.set(rgba([0, 255, 0, 255]), (1 * 5 + 2) * 4);
		const { workspace, notifier } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'copy-floating-doc',
			name: 'Copy Floating',
			width: 5,
			height: 5,
			pixels: source
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		tab.nudgeMarquee(1, 1);
		notifier.reset();

		workspace.copySelection();

		expect(workspace.shared.selectionClipboard).toEqual({
			pixels: rgba([255, 0, 0, 255, 0, 255, 0, 255]),
			width: 2,
			height: 1
		});
		expect(tab.floatingSelectionOffset).toEqual({ dx: 1, dy: 1 });
		expect(pixelAt(tab.document, 1, 1)).toEqual([0, 0, 0, 0]);
		expect(pixelAt(tab.document, 2, 2)).toEqual([0, 0, 0, 0]);
		expect(notifier.dirtyCalls).toEqual(['copy-floating-doc']);
	});

	it('switching tabs preserves the shared Selection Clipboard', () => {
		const source = rgba([1, 0, 0, 255, 2, 0, 0, 255]);
		const { workspace } = makeWorkspace();
		workspace.openDocument({
			id: 'copy-source',
			name: 'Copy Source',
			width: 2,
			height: 1,
			pixels: source
		});
		workspace.activeTab.document.set_marquee(marqueeRegionFromDrag(0, 0, 1, 0));
		workspace.copySelection();
		workspace.addTab();

		expect(workspace.shared.selectionClipboard).toEqual({
			pixels: source,
			width: 2,
			height: 1
		});

		workspace.setActiveTab(1);

		expect(workspace.shared.selectionClipboard).toEqual({
			pixels: source,
			width: 2,
			height: 1
		});
	});

	it('copySelection is a silent no-op when no Marquee exists', () => {
		const { workspace, notifier } = makeWorkspace();
		const existing = {
			pixels: rgba([9, 0, 0, 255]),
			width: 1,
			height: 1
		};
		workspace.setSelectionClipboard(existing);
		notifier.reset();

		workspace.copySelection();

		expect(workspace.shared.selectionClipboard).toEqual(existing);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('copySelection is a silent no-op on a Reference-active document', () => {
		const { workspace, notifier } = makeWorkspace();
		const referenceId = crypto.randomUUID();
		const pixelId = crypto.randomUUID();
		const existing = {
			pixels: rgba([9, 0, 0, 255]),
			width: 1,
			height: 1
		};
		workspace.setSelectionClipboard(existing);
		workspace.openSnapshot({
			id: 'reference-active-doc',
			name: 'Reference Active',
			frames: [{ id: SNAP_FRAME_ID, durationMs: DEFAULT_FRAME_DURATION_MS }],
			activeFrameId: SNAP_FRAME_ID,
			width: 2,
			height: 2,
			marquee: null,
			layers: [
				{
					kind: 'reference',
					id: referenceId,
					name: 'Reference',
					visible: true,
					opacity: 1,
					sourceBlob: new Blob([new ArrayBuffer(4)], { type: 'image/png' }),
					sourceRgba: rgba([1, 2, 3, 4]),
					naturalWidth: 1,
					naturalHeight: 1,
					placement: { x: 0, y: 0, scale: 1 }
				},
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					cels: [{ frameId: SNAP_FRAME_ID, pixels: new Uint8Array(2 * 2 * 4) }],
					visible: true,
					opacity: 1
				}
			],
			activeLayerId: referenceId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false,
			viewport: {
				pixelSize: 32,
				zoom: 1,
				panX: 0,
				panY: 0,
				showGrid: true,
				gridColor: '#cccccc'
			}
		});
		workspace.activeTab.document.set_marquee(marqueeRegionFromDrag(0, 0, 1, 1));
		notifier.reset();

		workspace.copySelection();

		expect(workspace.shared.selectionClipboard).toEqual(existing);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('cutSelection stores the active Marquee pixels in the clipboard and clears them from the layer', () => {
		const source = rgba([
			1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255,
			4, 0, 0, 255, 5, 0, 0, 255, 6, 0, 0, 255
		]);
		const { workspace, notifier } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'cut-doc',
			name: 'Cut',
			width: 3,
			height: 2,
			pixels: source.slice()
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 0, 2, 1));
		notifier.reset();

		workspace.cutSelection();

		expect(workspace.shared.selectionClipboard).toEqual({
			pixels: rgba([2, 0, 0, 255, 3, 0, 0, 255, 5, 0, 0, 255, 6, 0, 0, 255]),
			width: 2,
			height: 2
		});
		expect(tab.document.layer_pixels_at(0)).toEqual(
			rgba([
				1, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0,
				4, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0
			])
		);
		expect(notifier.dirtyCalls).toEqual(['cut-doc', 'cut-doc']);
	});

	it('undo after cutSelection restores the cleared pixels without reverting the clipboard', () => {
		const source = rgba([
			1, 0, 0, 255, 2, 0, 0, 255,
			3, 0, 0, 255, 4, 0, 0, 255
		]);
		const previousClipboard = {
			pixels: rgba([9, 0, 0, 255]),
			width: 1,
			height: 1
		};
		const { workspace } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'cut-undo-doc',
			name: 'Cut Undo',
			width: 2,
			height: 2,
			pixels: source.slice()
		});
		workspace.setSelectionClipboard(previousClipboard);
		tab.document.set_marquee(marqueeRegionFromDrag(0, 0, 1, 0));

		workspace.cutSelection();
		tab.undo();

		expect(tab.document.layer_pixels_at(0)).toEqual(source);
		expect(workspace.shared.selectionClipboard).toEqual({
			pixels: rgba([1, 0, 0, 255, 2, 0, 0, 255]),
			width: 2,
			height: 1
		});
	});

	it('cutSelection commits a Floating Selection before copying from the moved Marquee', () => {
		const source = new Uint8Array(3 * 3 * 4);
		source.set(rgba([255, 0, 0, 255]), (1 * 3 + 1) * 4);
		source.set(rgba([0, 255, 0, 255]), (1 * 3 + 2) * 4);
		const { workspace, notifier } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'cut-floating-doc',
			name: 'Cut Floating',
			width: 3,
			height: 3,
			pixels: source
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		tab.nudgeMarquee(-2, 0);
		notifier.reset();

		workspace.cutSelection();

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(tab.document.marquee()).toMatchObject({ x: -1, y: 1, width: 2, height: 1 });
		expect(workspace.shared.selectionClipboard).toEqual({
			pixels: rgba([0, 0, 0, 0, 0, 255, 0, 255]),
			width: 2,
			height: 1
		});
		expect(pixelAt(tab.document, 0, 1)).toEqual([0, 0, 0, 0]);
		expect(pixelAt(tab.document, 1, 1)).toEqual([0, 0, 0, 0]);
		expect(pixelAt(tab.document, 2, 1)).toEqual([0, 0, 0, 0]);
		expect(notifier.dirtyCalls).toEqual(['cut-floating-doc', 'cut-floating-doc', 'cut-floating-doc']);
	});

	it('cutSelection clears the clipboard without a second history entry when the moved Marquee is off-canvas', () => {
		const source = new Uint8Array(3 * 3 * 4);
		source.set(rgba([255, 0, 0, 255]), (1 * 3 + 1) * 4);
		source.set(rgba([0, 255, 0, 255]), (1 * 3 + 2) * 4);
		const existing = {
			pixels: rgba([9, 0, 0, 255]),
			width: 1,
			height: 1
		};
		const { workspace, notifier } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'cut-floating-empty-doc',
			name: 'Cut Floating Empty',
			width: 3,
			height: 3,
			pixels: source
		});
		workspace.setSelectionClipboard(existing);
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		tab.nudgeMarquee(-3, 0);
		notifier.reset();

		workspace.cutSelection();

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(tab.document.marquee()).toMatchObject({ x: -2, y: 1, width: 2, height: 1 });
		expect(workspace.shared.selectionClipboard).toBeNull();
		expect(pixelAt(tab.document, 0, 1)).toEqual([0, 0, 0, 0]);
		expect(pixelAt(tab.document, 1, 1)).toEqual([0, 0, 0, 0]);
		expect(pixelAt(tab.document, 2, 1)).toEqual([0, 0, 0, 0]);
		expect(notifier.dirtyCalls).toEqual(['cut-floating-empty-doc', 'cut-floating-empty-doc']);

		tab.undo();

		expect(pixelAt(tab.document, 1, 1)).toEqual([255, 0, 0, 255]);
		expect(pixelAt(tab.document, 2, 1)).toEqual([0, 255, 0, 255]);
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
	});

	it('cutSelection is a silent no-op when no Marquee exists', () => {
		const { workspace, notifier } = makeWorkspace();
		const existing = {
			pixels: rgba([9, 0, 0, 255]),
			width: 1,
			height: 1
		};
		workspace.setSelectionClipboard(existing);
		notifier.reset();

		workspace.cutSelection();

		expect(workspace.shared.selectionClipboard).toEqual(existing);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('cutSelection is a silent no-op on a Reference-active document', () => {
		const { workspace, notifier } = makeWorkspace();
		const referenceId = crypto.randomUUID();
		const pixelId = crypto.randomUUID();
		const existing = {
			pixels: rgba([9, 0, 0, 255]),
			width: 1,
			height: 1
		};
		workspace.setSelectionClipboard(existing);
		workspace.openSnapshot({
			id: 'cut-reference-active-doc',
			name: 'Cut Reference Active',
			frames: [{ id: SNAP_FRAME_ID, durationMs: DEFAULT_FRAME_DURATION_MS }],
			activeFrameId: SNAP_FRAME_ID,
			width: 2,
			height: 2,
			marquee: null,
			layers: [
				{
					kind: 'reference',
					id: referenceId,
					name: 'Reference',
					visible: true,
					opacity: 1,
					sourceBlob: new Blob([new ArrayBuffer(4)], { type: 'image/png' }),
					sourceRgba: rgba([1, 2, 3, 4]),
					naturalWidth: 1,
					naturalHeight: 1,
					placement: { x: 0, y: 0, scale: 1 }
				},
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					cels: [{ frameId: SNAP_FRAME_ID, pixels: rgba([
						1, 0, 0, 255, 2, 0, 0, 255,
						3, 0, 0, 255, 4, 0, 0, 255
					]) }],
					visible: true,
					opacity: 1
				}
			],
			activeLayerId: referenceId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false,
			viewport: {
				pixelSize: 32,
				zoom: 1,
				panX: 0,
				panY: 0,
				showGrid: true,
				gridColor: '#cccccc'
			}
		});
		workspace.activeTab.document.set_marquee(marqueeRegionFromDrag(0, 0, 1, 1));
		notifier.reset();

		workspace.cutSelection();

		expect(workspace.shared.selectionClipboard).toEqual(existing);
		expect(workspace.activeTab.document.layer_pixels_at(1)).toEqual(
			rgba([
				1, 0, 0, 255, 2, 0, 0, 255,
				3, 0, 0, 255, 4, 0, 0, 255
			])
		);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('pasteSelectionClipboard starts a Floating Selection centered on the visible canvas area', () => {
		const source = new Uint8Array(8 * 8 * 4);
		const clipboard = {
			pixels: rgba([
				255, 0, 0, 255, 0, 255, 0, 255,
				0, 0, 255, 255, 255, 255, 0, 255
			]),
			width: 2,
			height: 2
		};
		const { workspace, notifier } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'paste-doc',
			name: 'Paste',
			width: 8,
			height: 8,
			pixels: source.slice()
		});
		workspace.setSelectionClipboard(clipboard);
		tab.setViewportSize({ width: 40, height: 40 });
		tab.setViewport({
			pixelSize: 10,
			zoom: 1,
			panX: -20,
			panY: -10,
			showGrid: true,
			gridColor: '#cccccc'
		});
		notifier.reset();

		workspace.pasteSelectionClipboard();

		expect(tab.floatingSelectionOffset).toEqual({ dx: 0, dy: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: 3, y: 2, width: 2, height: 2 });
		expect(tab.document.layer_pixels_at(0)).toEqual(source);
		const preview = tab.compositeBuffer.pixels();
		expect(Array.from(preview.slice((2 * 8 + 3) * 4, (2 * 8 + 5) * 4))).toEqual(
			Array.from(clipboard.pixels.slice(0, 8))
		);
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('undo after committing a pasted Floating Selection restores pre-paste pixels and Marquee', () => {
		const source = new Uint8Array(4 * 4 * 4);
		source.set(rgba([255, 0, 0, 255]), (1 * 4 + 1) * 4);
		const { workspace } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'paste-undo-doc',
			name: 'Paste Undo',
			width: 4,
			height: 4,
			pixels: source.slice()
		});
		tab.document.set_marquee(marqueeRegionFromDrag(0, 0, 0, 0));
		workspace.setSelectionClipboard({
			pixels: rgba([0, 255, 0, 255, 0, 0, 255, 255]),
			width: 2,
			height: 1
		});

		workspace.pasteSelectionClipboard();
		tab.commitFloatingSelection();

		expect(pixelAt(tab.document, 1, 1)).toEqual([0, 255, 0, 255]);
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });

		tab.undo();

		expect(tab.document.layer_pixels_at(0)).toEqual(source);
		expect(tab.document.marquee()).toMatchObject({ x: 0, y: 0, width: 1, height: 1 });
	});

	it('undo after committing a paste restores the absence of a pre-paste Marquee', () => {
		const source = new Uint8Array(4 * 4 * 4);
		const { workspace } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'paste-undo-no-marquee-doc',
			name: 'Paste Undo Without Marquee',
			width: 4,
			height: 4,
			pixels: source.slice()
		});
		workspace.setSelectionClipboard({
			pixels: rgba([0, 255, 0, 255, 0, 0, 255, 255]),
			width: 2,
			height: 1
		});

		workspace.pasteSelectionClipboard();
		tab.commitFloatingSelection();

		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });

		tab.undo();

		expect(tab.document.layer_pixels_at(0)).toEqual(source);
		expect(tab.document.marquee()).toBeUndefined();
	});

	it('canceling a pasted Floating Selection restores pre-paste pixels and Marquee', () => {
		const source = new Uint8Array(4 * 4 * 4);
		source.set(rgba([255, 0, 0, 255]), (1 * 4 + 1) * 4);
		const { workspace } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'paste-cancel-doc',
			name: 'Paste Cancel',
			width: 4,
			height: 4,
			pixels: source.slice()
		});
		tab.document.set_marquee(marqueeRegionFromDrag(0, 0, 0, 0));
		workspace.setSelectionClipboard({
			pixels: rgba([0, 255, 0, 255]),
			width: 1,
			height: 1
		});

		workspace.pasteSelectionClipboard();
		tab.clearMarqueeOrFloating();

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(tab.document.layer_pixels_at(0)).toEqual(source);
		expect(tab.document.marquee()).toMatchObject({ x: 0, y: 0, width: 1, height: 1 });
	});

	it('pasteSelectionClipboard falls back to canvas center when the viewport misses the canvas', () => {
		const layerId = crypto.randomUUID();
		const { workspace } = makeWorkspace();
		workspace.openSnapshot({
			id: 'paste-offscreen-doc',
			name: 'Paste Offscreen',
			frames: [{ id: SNAP_FRAME_ID, durationMs: DEFAULT_FRAME_DURATION_MS }],
			activeFrameId: SNAP_FRAME_ID,
			width: 8,
			height: 8,
			marquee: null,
			layers: [
				{
					kind: 'pixel',
					id: layerId,
					name: 'Layer 1',
					cels: [{ frameId: SNAP_FRAME_ID, pixels: new Uint8Array(8 * 8 * 4) }],
					visible: true,
					opacity: 1
				}
			],
			activeLayerId: layerId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false,
			viewport: {
				pixelSize: 10,
				zoom: 1,
				panX: 1000,
				panY: 1000,
				showGrid: true,
				gridColor: '#cccccc'
			}
		});
		workspace.setSelectionClipboard({
			pixels: rgba([
				255, 0, 0, 255, 0, 255, 0, 255,
				0, 0, 255, 255, 255, 255, 0, 255
			]),
			width: 2,
			height: 2
		});

		workspace.pasteSelectionClipboard();

		expect(workspace.activeTab.document.marquee()).toMatchObject({
			x: 3,
			y: 3,
			width: 2,
			height: 2
		});
	});

	it('pasteSelectionClipboard commits an active Floating Selection before pasting', () => {
		const source = new Uint8Array(5 * 5 * 4);
		source.set(rgba([255, 0, 0, 255]), (1 * 5 + 1) * 4);
		source.set(rgba([0, 255, 0, 255]), (1 * 5 + 2) * 4);
		const { workspace } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'paste-after-floating-doc',
			name: 'Paste After Floating',
			width: 5,
			height: 5,
			pixels: source
		});
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		tab.nudgeMarquee(1, 1);
		workspace.setSelectionClipboard({
			pixels: rgba([255, 255, 0, 255]),
			width: 1,
			height: 1
		});

		workspace.pasteSelectionClipboard();

		expect(pixelAt(tab.document, 2, 2)).toEqual([255, 0, 0, 255]);
		expect(pixelAt(tab.document, 3, 2)).toEqual([0, 255, 0, 255]);
		expect(tab.floatingSelectionOffset).toEqual({ dx: 0, dy: 0 });
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 2, width: 1, height: 1 });
	});

	it('pasteSelectionClipboard is a silent no-op when the Selection Clipboard is empty', () => {
		const source = new Uint8Array(4 * 4 * 4);
		source.set(rgba([255, 0, 0, 255]), 0);
		const { workspace, notifier } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'paste-empty-doc',
			name: 'Paste Empty',
			width: 4,
			height: 4,
			pixels: source.slice()
		});
		tab.document.set_marquee(marqueeRegionFromDrag(0, 0, 0, 0));
		notifier.reset();

		workspace.pasteSelectionClipboard();

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(tab.document.layer_pixels_at(0)).toEqual(source);
		expect(tab.document.marquee()).toMatchObject({ x: 0, y: 0, width: 1, height: 1 });
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('pasteSelectionClipboard is a silent no-op on a Reference-active document', () => {
		const referenceId = crypto.randomUUID();
		const pixelId = crypto.randomUUID();
		const pixelLayer = rgba([
			1, 0, 0, 255, 2, 0, 0, 255,
			3, 0, 0, 255, 4, 0, 0, 255
		]);
		const clipboard = {
			pixels: rgba([9, 0, 0, 255]),
			width: 1,
			height: 1
		};
		const { workspace, notifier } = makeWorkspace();
		workspace.openSnapshot({
			id: 'paste-reference-active-doc',
			name: 'Paste Reference Active',
			frames: [{ id: SNAP_FRAME_ID, durationMs: DEFAULT_FRAME_DURATION_MS }],
			activeFrameId: SNAP_FRAME_ID,
			width: 2,
			height: 2,
			marquee: null,
			layers: [
				{
					kind: 'reference',
					id: referenceId,
					name: 'Reference',
					visible: true,
					opacity: 1,
					sourceBlob: new Blob([new ArrayBuffer(4)], { type: 'image/png' }),
					sourceRgba: rgba([1, 2, 3, 4]),
					naturalWidth: 1,
					naturalHeight: 1,
					placement: { x: 0, y: 0, scale: 1 }
				},
				{
					kind: 'pixel',
					id: pixelId,
					name: 'Paint',
					cels: [{ frameId: SNAP_FRAME_ID, pixels: pixelLayer.slice() }],
					visible: true,
					opacity: 1
				}
			],
			activeLayerId: referenceId,
			nextLayerNumber: 2,
			timelinePanelCollapsed: false,
			viewport: {
				pixelSize: 32,
				zoom: 1,
				panX: 0,
				panY: 0,
				showGrid: true,
				gridColor: '#cccccc'
			}
		});
		workspace.setSelectionClipboard(clipboard);
		workspace.activeTab.document.set_marquee(marqueeRegionFromDrag(0, 0, 0, 0));
		notifier.reset();

		workspace.pasteSelectionClipboard();

		expect(workspace.shared.selectionClipboard).toEqual(clipboard);
		expect(workspace.activeTab.floatingSelectionOffset).toBeUndefined();
		expect(workspace.activeTab.document.layer_pixels_at(1)).toEqual(pixelLayer);
		expect(workspace.activeTab.document.marquee()).toMatchObject({ x: 0, y: 0, width: 1, height: 1 });
		expect(notifier.dirtyCalls).toEqual([]);
	});

	it('committing an off-canvas pasted Floating Selection clips to the canvas bounds', () => {
		const clipboardPixels = new Uint8Array(4 * 4 * 4);
		for (let index = 0; index < 16; index++) {
			clipboardPixels.set(rgba([index, 0, 0, 255]), index * 4);
		}
		const { workspace } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'paste-off-canvas-doc',
			name: 'Paste Off Canvas',
			width: 3,
			height: 3,
			pixels: new Uint8Array(3 * 3 * 4)
		});
		workspace.setSelectionClipboard({
			pixels: clipboardPixels,
			width: 4,
			height: 4
		});

		workspace.pasteSelectionClipboard();
		tab.commitFloatingSelection();

		expect(tab.document.marquee()).toMatchObject({ x: -1, y: -1, width: 4, height: 4 });
		expect(pixelAt(tab.document, 0, 0)).toEqual([5, 0, 0, 255]);
		expect(pixelAt(tab.document, 2, 2)).toEqual([15, 0, 0, 255]);
	});

	it('setActiveTool commits an active Floating Selection nudge as one undoable document change', () => {
		const source = new Uint8Array(5 * 5 * 4);
		source.set(rgba([255, 0, 0, 255]), (1 * 5 + 1) * 4);
		source.set(rgba([0, 255, 0, 255]), (1 * 5 + 2) * 4);
		const { workspace, notifier } = makeWorkspace();
		const tab = workspace.openDocument({
			id: 'nudge-doc',
			name: 'Nudge',
			width: 5,
			height: 5,
			pixels: source
		});
		workspace.setActiveTool('selection');
		tab.document.set_marquee(marqueeRegionFromDrag(1, 1, 2, 1));
		notifier.reset();

		tab.nudgeMarquee(1, 0);
		tab.nudgeMarquee(0, 1);
		workspace.setActiveTool('pencil');

		expect(tab.floatingSelectionOffset).toBeUndefined();
		expect(pixelAt(tab.document, 2, 2)).toEqual([255, 0, 0, 255]);
		expect(pixelAt(tab.document, 3, 2)).toEqual([0, 255, 0, 255]);
		expect(tab.document.marquee()).toMatchObject({ x: 2, y: 2, width: 2, height: 1 });

		tab.undo();

		expect(pixelAt(tab.document, 1, 1)).toEqual([255, 0, 0, 255]);
		expect(pixelAt(tab.document, 2, 1)).toEqual([0, 255, 0, 255]);
		expect(pixelAt(tab.document, 2, 2)).toEqual([0, 0, 0, 0]);
		expect(tab.document.marquee()).toMatchObject({ x: 1, y: 1, width: 2, height: 1 });
		expect(notifier.dirtyCalls.length).toBeGreaterThan(0);
	});
});

describe('Workspace — openDocument', () => {
	it('creates a tab from saved data and activates it', () => {
		const { workspace } = makeWorkspace();
		const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);

		workspace.openDocument({
			id: 'saved-doc',
			name: 'My Art',
			width: 2,
			height: 1,
			pixels
		});

		expect(workspace.tabs).toHaveLength(2);
		expect(workspace.activeIndex).toBe(1);
		expect(workspace.activeTab.name).toBe('My Art');
		expect(workspace.activeTab.documentId).toBe('saved-doc');
		expect(workspace.activeTab.document.width).toBe(2);
		expect(workspace.activeTab.document.height).toBe(1);
		expect(workspace.activeTab.document.composite()).toEqual(pixels);
	});

	it('opens a full tab snapshot without flattening layers', () => {
		const { workspace } = makeWorkspace();
		const bottomId = crypto.randomUUID();
		const topId = crypto.randomUUID();
		const bottomPixels = new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0]);
		const topPixels = new Uint8Array([0, 0, 0, 0, 0, 255, 0, 255]);
		const snapshot: TabSnapshot = {
			id: 'layered-doc',
			name: 'Layered',
			frames: [{ id: SNAP_FRAME_ID, durationMs: DEFAULT_FRAME_DURATION_MS }],
			activeFrameId: SNAP_FRAME_ID,
			width: 2,
			height: 1,
			layers: [
				{ kind: 'pixel', id: bottomId, name: 'Paint', cels: [{ frameId: SNAP_FRAME_ID, pixels: bottomPixels }], visible: true, opacity: 1 },
				{ kind: 'pixel', id: topId, name: 'Ink', cels: [{ frameId: SNAP_FRAME_ID, pixels: topPixels }], visible: true, opacity: 1 }
			],
			activeLayerId: topId,
			nextLayerNumber: 4,
			timelinePanelCollapsed: true,
			viewport: {
				pixelSize: 32,
				zoom: 1.0,
				panX: 0,
				panY: 0,
				showGrid: true,
				gridColor: '#cccccc'
			}
		};

		workspace.openSnapshot(snapshot);

		const opened = workspace.activeTab.document;
		expect(workspace.activeTab.documentId).toBe('layered-doc');
		expect(opened.layer_count()).toBe(2);
		expect(opened.active_layer_id()).toBe(topId);
		expect(opened.next_layer_number()).toBe(4);
		expect(opened.is_timeline_panel_collapsed()).toBe(true);
		expect(opened.layer_pixels_at(0)).toEqual(bottomPixels);
		expect(opened.layer_pixels_at(1)).toEqual(topPixels);
	});
});

describe('Workspace — hydration', () => {
	it('restores tabs and shared state from a snapshot', () => {
		const pixels = new Uint8Array([255, 0, 0, 255]);
		const restored: WorkspaceSnapshot = {
			tabs: [
				makeTabSnap({
					id: 'doc-1',
					name: 'My Sprite',
					pixels,
					viewport: {
						pixelSize: 32,
						zoom: 2.0,
						panX: 10,
						panY: 20,
						showGrid: true,
						gridColor: '#ECE5D9'
					}
				})
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'eraser',
				foregroundColor: { r: 255, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 0, g: 0, b: 255, a: 255 },
				recentColors: ['#ff0000']
			}
		};

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.tabs).toHaveLength(1);
		expect(workspace.activeTab.name).toBe('My Sprite');
		expect(workspace.activeTab.document.composite()).toEqual(pixels);
		expect(workspace.shared.activeTool).toBe('eraser');
		expect(workspace.shared.foregroundColor).toEqual({ r: 255, g: 0, b: 0, a: 255 });
		expect(workspace.shared.recentColors).toEqual(['#ff0000']);
	});

	it('new tabs after hydration do not duplicate restored tab numbers', () => {
		const restored: WorkspaceSnapshot = {
			tabs: [
				makeTabSnap({
					id: 'doc-1',
					name: 'Untitled 2',
					pixels: new Uint8Array([0, 0, 0, 255])
				})
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		};

		const { workspace } = makeWorkspace({ restored });
		workspace.addTab();

		expect(workspace.tabs[1].name).toBe('Untitled 1');
	});

	it('hydration does NOT emit dirty notifications', () => {
		const restored: WorkspaceSnapshot = {
			tabs: [
				makeTabSnap({
					id: 'doc-restored',
					name: 'Restored',
					pixels: new Uint8Array([0, 0, 0, 255])
				})
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		};

		const { notifier } = makeWorkspace({ restored });

		expect(notifier.dirtyCalls).toEqual([]);
		expect(notifier.tabRemovedCalls).toEqual([]);
	});

	it('restores pixelPerfect from a snapshot', () => {
		const restored: WorkspaceSnapshot = {
			tabs: [
				makeTabSnap({
					id: 'doc-1',
					name: 'Tab 1',
					pixels: new Uint8Array([0, 0, 0, 255])
				})
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: [],
				pixelPerfect: false
			}
		};

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.shared.pixelPerfect).toBe(false);
	});

	it('restores the shared Selection Clipboard from a snapshot', () => {
		const clipboard = {
			pixels: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
			width: 2,
			height: 1
		};
		const restored: WorkspaceSnapshot = {
			tabs: [
				makeTabSnap({
					id: 'doc-1',
					name: 'Tab 1',
					pixels: new Uint8Array([0, 0, 0, 255])
				})
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: [],
				selectionClipboard: clipboard
			}
		};

		const { workspace } = makeWorkspace({ restored });
		clipboard.pixels[0] = 0;

		expect(workspace.shared.selectionClipboard).toEqual({
			pixels: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
			width: 2,
			height: 1
		});
	});

	it('hydrates a restored Marquee into the active tab Document', () => {
		const marquee = { x: 1, y: 2, width: 3, height: 4 };
		const restored: WorkspaceSnapshot = {
			tabs: [
				{
					...makeTabSnap({
						id: 'doc-1',
						name: 'Tab 1',
						width: 8,
						height: 8
					}),
					marquee
				}
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		};

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.activeTab.document.marquee()).toMatchObject(marquee);
	});

	it('clips a restored Marquee to the tab canvas bounds', () => {
		const restored: WorkspaceSnapshot = {
			tabs: [
				{
					...makeTabSnap({
						id: 'doc-1',
						name: 'Tab 1',
						width: 8,
						height: 8
					}),
					marquee: { x: 6, y: 5, width: 4, height: 5 }
				}
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		};

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.activeTab.document.marquee()).toMatchObject({
			x: 6,
			y: 5,
			width: 2,
			height: 3
		});
	});

	it('clears a restored zero-sized Marquee', () => {
		const restored: WorkspaceSnapshot = {
			tabs: [
				{
					...makeTabSnap({
						id: 'doc-1',
						name: 'Tab 1',
						width: 8,
						height: 8
					}),
					marquee: { x: 1, y: 2, width: 0, height: 3 }
				}
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		};

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.activeTab.document.marquee()).toBeUndefined();
	});

	it('clears a restored Marquee when it no longer overlaps the tab canvas', () => {
		const restored: WorkspaceSnapshot = {
			tabs: [
				{
					...makeTabSnap({
						id: 'doc-1',
						name: 'Tab 1',
						width: 8,
						height: 8
					}),
					marquee: { x: 8, y: 2, width: 3, height: 3 }
				}
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		};

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.activeTab.document.marquee()).toBeUndefined();
	});

	it('defaults pixelPerfect to true when absent from a legacy snapshot', () => {
		const restored: WorkspaceSnapshot = {
			tabs: [
				makeTabSnap({
					id: 'doc-1',
					name: 'Tab 1',
					pixels: new Uint8Array([0, 0, 0, 255])
				})
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		};

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.shared.pixelPerfect).toBe(true);
	});

	it('clamps an out-of-range activeTabIndex to the last tab', () => {
		const restored: WorkspaceSnapshot = {
			tabs: [
				makeTabSnap({ id: 'doc-a', pixels: new Uint8Array([0, 0, 0, 255]) }),
				makeTabSnap({ id: 'doc-b', pixels: new Uint8Array([0, 0, 0, 255]) })
			],
			activeTabIndex: 5,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		};

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.activeIndex).toBe(1);
		expect(workspace.activeTab.name).toBe('doc-b');
	});

	it('clamps a negative activeTabIndex to the first tab', () => {
		const restored: WorkspaceSnapshot = {
			tabs: [
				makeTabSnap({ id: 'doc-a', pixels: new Uint8Array([0, 0, 0, 255]) }),
				makeTabSnap({ id: 'doc-b', pixels: new Uint8Array([0, 0, 0, 255]) })
			],
			activeTabIndex: -1,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		};

		const { workspace } = makeWorkspace({ restored });

		expect(workspace.activeIndex).toBe(0);
		expect(workspace.activeTab.name).toBe('doc-a');
	});
});

describe('Workspace — toSnapshot', () => {
	it('captures a single-tab workspace', () => {
		const { workspace } = makeWorkspace({
			initialForegroundColor: { r: 200, g: 50, b: 30, a: 255 },
			gridColor: '#ECE5D9'
		});
		workspace.shared.activeTool = 'line';

		const snapshot: WorkspaceSnapshot = workspace.toSnapshot();

		expect(snapshot.tabs).toHaveLength(1);
		expect(snapshot.activeTabIndex).toBe(0);
		expect(snapshot.tabs[0].id).toBe(workspace.tabs[0].documentId);
		expect(snapshot.tabs[0].name).toBe('Untitled 1');
		expect(snapshot.tabs[0].width).toBe(16);
		expect(snapshot.tabs[0].height).toBe(16);
		expect(snapshot.sharedState.activeTool).toBe('line');
		expect(snapshot.sharedState.foregroundColor).toEqual({ r: 200, g: 50, b: 30, a: 255 });
	});

	it('captures a multi-tab workspace with the correct active index', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });
		workspace.addTab();
		workspace.setActiveTab(0);

		const snapshot = workspace.toSnapshot();

		expect(snapshot.tabs).toHaveLength(2);
		expect(snapshot.activeTabIndex).toBe(0);
		expect(snapshot.tabs[0].name).toBe('Untitled 1');
		expect(snapshot.tabs[1].name).toBe('Untitled 2');
	});

	it('captures per-tab viewport state', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });
		workspace.activeTab.setViewport({
			pixelSize: 32,
			zoom: 3.0,
			panX: 100,
			panY: -50,
			showGrid: false,
			gridColor: '#ECE5D9'
		});

		const snapshot = workspace.toSnapshot();

		expect(snapshot.tabs[0].viewport).toEqual(workspace.activeTab.viewport);
		expect(snapshot.tabs[0].viewport.zoom).toBe(3.0);
		expect(snapshot.tabs[0].viewport.showGrid).toBe(false);
	});

	it('captures the pixelPerfect preference', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });
		workspace.shared.pixelPerfect = false;

		const snapshot = workspace.toSnapshot();

		expect(snapshot.sharedState.pixelPerfect).toBe(false);
	});

	it('captures the shared Selection Clipboard as plain snapshot data', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });
		workspace.setSelectionClipboard({
			pixels: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
			width: 2,
			height: 1
		});

		const snapshot = workspace.toSnapshot();
		workspace.shared.selectionClipboard!.pixels[0] = 0;

		expect(snapshot.sharedState.selectionClipboard).toEqual({
			pixels: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
			width: 2,
			height: 1
		});
	});

	it('captures the active tab Marquee as plain snapshot data', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });
		workspace.activeTab.document.set_marquee(marqueeRegionFromDrag(1, 2, 3, 5));

		const snapshot = workspace.toSnapshot();

		expect(snapshot.tabs[0].marquee).toEqual({ x: 1, y: 2, width: 3, height: 4 });
	});

	it('snapshot arrays are copies independent from workspace state', () => {
		const { workspace } = makeWorkspace({ gridColor: '#ECE5D9' });

		const snapshot = workspace.toSnapshot();

		expect(snapshot.sharedState.recentColors).not.toBe(workspace.shared.recentColors);
	});
});

describe('Workspace — reference images', () => {
	function makeRef(id: string) {
		return {
			id,
			filename: `${id}.png`,
			blob: new Blob([new Uint8Array([0])], { type: 'image/png' }),
			thumbnail: new Blob([new Uint8Array([0])], { type: 'image/png' }),
			mimeType: 'image/png',
			naturalWidth: 100,
			naturalHeight: 100,
			byteSize: 1,
			addedAt: new Date('2026-04-26T00:00:00Z')
		};
	}

	it('exposes a reference-images store from the start', () => {
		const { workspace } = makeWorkspace();

		expect(workspace.references.forDoc(workspace.activeTab.documentId)).toEqual([]);
	});

	it('snapshot includes references added to a tab', () => {
		const { workspace } = makeWorkspace();
		const docId = workspace.activeTab.documentId;
		workspace.references.add(makeRef('ref-a'), docId);

		const snapshot = workspace.toSnapshot();

		expect(snapshot.references).toBeDefined();
		expect(snapshot.references![docId]).toHaveLength(1);
		expect(snapshot.references![docId][0].id).toBe('ref-a');
	});
});

describe('Workspace — dirty notifications', () => {
	it('construction emits markDirty for the initial tab', () => {
		const { workspace, notifier } = makeWorkspace();
		expect(notifier.dirtyCalls).toEqual([workspace.tabs[0].documentId]);
	});

	it('addTab emits markDirty for the new tab', () => {
		const { workspace, notifier } = makeWorkspace();
		notifier.reset();

		workspace.addTab();

		expect(notifier.dirtyCalls).toEqual([workspace.tabs[1].documentId]);
	});

	it('openDocument emits markDirty for the opened document id', () => {
		const { workspace, notifier } = makeWorkspace();
		notifier.reset();

		workspace.openDocument({
			id: 'opened-doc',
			name: 'Opened',
			width: 1,
			height: 1,
			pixels: new Uint8Array([0, 0, 0, 255])
		});

		expect(notifier.dirtyCalls).toEqual(['opened-doc']);
	});

	it('openSnapshot emits markDirty for the opened document id', () => {
		const { workspace, notifier } = makeWorkspace();
		notifier.reset();

		workspace.openSnapshot(makeTabSnap({ id: 'opened-layered-doc', name: 'Opened' }));

		expect(notifier.dirtyCalls).toEqual(['opened-layered-doc']);
	});

	it('closeTab emits notifyTabRemoved with the removed tab documentId', () => {
		const { workspace, notifier } = makeWorkspace();
		workspace.addTab();
		const removedId = workspace.tabs[1].documentId;
		notifier.reset();

		workspace.closeTab(1);

		expect(notifier.tabRemovedCalls).toEqual([removedId]);
	});

	it('closeTab on the last tab does NOT emit notifyTabRemoved', () => {
		const { workspace, notifier } = makeWorkspace();
		notifier.reset();

		workspace.closeTab(0);

		expect(notifier.tabRemovedCalls).toEqual([]);
		expect(workspace.tabs).toHaveLength(1);
	});

	it('setActiveTool emits markDirty for the active tab', () => {
		const { workspace, notifier } = makeWorkspace();
		notifier.reset();

		workspace.setActiveTool('line');

		expect(workspace.shared.activeTool).toBe('line');
		expect(notifier.dirtyCalls).toEqual([workspace.activeTab.documentId]);
	});

	it('setForegroundColor emits markDirty for the active tab', () => {
		const { workspace, notifier } = makeWorkspace();
		notifier.reset();

		workspace.setForegroundColor({ r: 10, g: 20, b: 30, a: 255 });

		expect(workspace.shared.foregroundColor).toEqual({ r: 10, g: 20, b: 30, a: 255 });
		expect(notifier.dirtyCalls).toEqual([workspace.activeTab.documentId]);
	});

	it('setBackgroundColor emits markDirty for the active tab', () => {
		const { workspace, notifier } = makeWorkspace();
		notifier.reset();

		workspace.setBackgroundColor({ r: 200, g: 200, b: 200, a: 255 });

		expect(workspace.shared.backgroundColor).toEqual({ r: 200, g: 200, b: 200, a: 255 });
		expect(notifier.dirtyCalls).toEqual([workspace.activeTab.documentId]);
	});

	it('togglePixelPerfect emits markDirty for the active tab', () => {
		const { workspace, notifier } = makeWorkspace();
		const initial = workspace.shared.pixelPerfect;
		notifier.reset();

		workspace.togglePixelPerfect();

		expect(workspace.shared.pixelPerfect).toBe(!initial);
		expect(notifier.dirtyCalls).toEqual([workspace.activeTab.documentId]);
	});

	it('swapColors emits markDirty for the active tab', () => {
		const { workspace, notifier } = makeWorkspace();
		const fg = workspace.shared.foregroundColor;
		const bg = workspace.shared.backgroundColor;
		notifier.reset();

		workspace.swapColors();

		expect(workspace.shared.foregroundColor).toEqual(bg);
		expect(workspace.shared.backgroundColor).toEqual(fg);
		expect(notifier.dirtyCalls).toEqual([workspace.activeTab.documentId]);
	});

	it('setActiveTab does NOT emit markDirty', () => {
		const { workspace, notifier } = makeWorkspace();
		workspace.addTab();
		notifier.reset();

		workspace.setActiveTab(0);

		expect(notifier.dirtyCalls).toEqual([]);
	});
});

describe('Workspace — load path constructs Document', () => {
	it('createTab forwards a passed document to the new TabState', () => {
		const { workspace } = makeWorkspace();
		const w = 4;
		const h = 4;
		const pixels = new Uint8Array(w * h * 4);
		pixels[0] = 255;
		pixels[3] = 255;
		const doc = singleLayerDocument(w, h, pixels);

		const tab = workspace.createTab({
			documentId: 'd1',
			name: 'X',
			document: doc
		});

		expect(tab.document).toBe(doc);
	});

	it('hydration constructs the active-layer document directly from snapshot pixels', () => {
		const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
		const restored: WorkspaceSnapshot = {
			tabs: [
				makeTabSnap({
					id: 'doc-1',
					name: 'My Sprite',
					width: 2,
					height: 1,
					pixels
				})
			],
			activeTabIndex: 0,
			sharedState: {
				activeTool: 'pencil',
				foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
				backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
				recentColors: []
			}
		};

		const { workspace } = makeWorkspace({ restored });

		const tab = workspace.tabs[0];
		expect(tab.document.width).toBe(2);
		expect(tab.document.height).toBe(1);
		const layer = tab.document.layer_pixels_at(0)!;
		expect(Array.from(layer)).toEqual(Array.from(pixels));
	});
});
