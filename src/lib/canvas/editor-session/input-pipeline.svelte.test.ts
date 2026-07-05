// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createEditorSession } from './create-editor-session';
import { createFakeDirtyNotifier } from './fake-dirty-notifier';
import type { Color } from '../color';

const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

function makeSession() {
	return createEditorSession({ notifier: createFakeDirtyNotifier() });
}

function getPixel(workspace: ReturnType<typeof makeSession>['workspace'], x: number, y: number): Color {
	const tab = workspace.activeTab;
	const pixels = tab.document.composite();
	const i = (y * tab.canvasWidth + x) * 4;
	return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], a: pixels[i + 3] };
}

describe('InputPipeline — shortcut-hints admission', () => {
	it('admits a draw stroke while the shortcut hints overlay is hidden', () => {
		const { workspace, input } = makeSession();
		workspace.setActiveTool('pencil');

		input.handleDrawStart(0, 'mouse');
		input.handleDraw({ x: 1, y: 1 }, null);
		input.handleDrawEnd();

		expect(workspace.activeTab.canUndo).toBe(true);
	});

	it('blocks a draw stroke while the shortcut hints overlay is visible', () => {
		const { workspace, input } = makeSession();
		workspace.setActiveTool('pencil');
		input.handleKeyDown(new KeyboardEvent('keydown', { code: 'Slash' }));

		input.handleDrawStart(0, 'mouse');
		input.handleDraw({ x: 1, y: 1 }, null);
		input.handleDrawEnd();

		expect(workspace.activeTab.canUndo).toBe(false);
	});
});

describe('InputPipeline — canvas sampling admission', () => {
	/** Paint RED at (1,1), then switch the foreground slot to BLACK. */
	function paintRedPixelThenResetForeground(
		workspace: ReturnType<typeof makeSession>['workspace'],
		input: ReturnType<typeof makeSession>['input']
	) {
		workspace.setForegroundColor(RED);
		workspace.setActiveTool('pencil');
		input.handleDrawStart(0, 'mouse');
		input.handleDraw({ x: 1, y: 1 }, null);
		input.handleDrawEnd();
		workspace.setForegroundColor(BLACK);
	}

	it('admits canvas sampling while the shortcut hints overlay is hidden', () => {
		const { workspace, input } = makeSession();
		paintRedPixelThenResetForeground(workspace, input);

		const started = input.handleSampleStart({ x: 1, y: 1 }, 0, 'mouse');
		input.handleSampleUpdate({ x: 1, y: 1 });
		input.handleSampleEnd();

		expect(started).toBe(true);
		expect(workspace.shared.foregroundColor).toEqual(RED);
	});

	it('blocks canvas sampling while the shortcut hints overlay is visible', () => {
		// Draw and sampling share one admission gate: while the hints overlay is
		// up, neither may mutate editor state (color slots sit outside History,
		// so a silent sample would be unrecoverable).
		const { workspace, input } = makeSession();
		paintRedPixelThenResetForeground(workspace, input);
		input.handleKeyDown(new KeyboardEvent('keydown', { code: 'Slash' }));

		const started = input.handleSampleStart({ x: 1, y: 1 }, 0, 'mouse');
		input.handleSampleUpdate({ x: 1, y: 1 });
		input.handleSampleEnd();

		expect(started).toBe(false);
		expect(workspace.shared.foregroundColor).toEqual(BLACK);
	});
});

describe('InputPipeline — temporary-tool restore', () => {
	it('restores the pre-Alt tool when the stroke ends', () => {
		const { workspace, input } = makeSession();
		workspace.setActiveTool('pencil');

		input.handleKeyDown(new KeyboardEvent('keydown', { code: 'AltLeft' }));
		expect(workspace.shared.activeTool).toBe('eyedropper');

		input.handleDrawStart(0, 'mouse');
		input.handleDraw({ x: 0, y: 0 }, null);
		input.handleKeyUp(new KeyboardEvent('keyup', { code: 'AltLeft' }));
		input.handleDrawEnd();

		expect(workspace.shared.activeTool).toBe('pencil');
	});

	it('restores the pre-Alt tool when the stroke cancels', () => {
		const { workspace, input } = makeSession();
		workspace.setActiveTool('pencil');

		input.handleKeyDown(new KeyboardEvent('keydown', { code: 'AltLeft' }));
		input.handleDrawStart(0, 'mouse');
		input.handleDraw({ x: 0, y: 0 }, null);
		input.handleKeyUp(new KeyboardEvent('keyup', { code: 'AltLeft' }));
		input.handleDrawCancel();

		expect(workspace.shared.activeTool).toBe('pencil');
	});
});

describe('InputPipeline — Constrain latch', () => {
	it('toggling Constrain mid-stroke snaps the in-flight line with the pointer stationary', () => {
		const { workspace, input } = makeSession();
		workspace.setActiveTool('line');
		input.handleDrawStart(0, 'mouse');
		input.handleDraw({ x: 1, y: 1 }, null);
		input.handleDraw({ x: 6, y: 3 }, { x: 1, y: 1 });

		// Tools live-read the constrain state only on draw samples, so without
		// the parity notification a stationary pointer would not reflect the
		// toggle until the next move.
		input.toggleConstrain();
		expect(input.isConstrainActive).toBe(true);
		input.handleDrawEnd();

		// constrainLine({1,1},{6,3}) snaps East to {6,1}: the constrained
		// endpoint is painted and the free endpoint is left untouched.
		expect(getPixel(workspace, 6, 1)).toEqual(BLACK);
		expect(getPixel(workspace, 6, 3)).toEqual(TRANSPARENT);
	});
});

describe('InputPipeline — keyboard lifecycle', () => {
	it('projects Space and Shift held state and clears both on window blur', () => {
		const { input } = makeSession();
		expect(input.isSpaceHeld).toBe(false);
		expect(input.isShiftHeld).toBe(false);

		input.handleKeyDown(new KeyboardEvent('keydown', { code: 'Space' }));
		input.handleKeyDown(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
		expect(input.isSpaceHeld).toBe(true);
		expect(input.isShiftHeld).toBe(true);

		input.handleBlur();
		expect(input.isSpaceHeld).toBe(false);
		expect(input.isShiftHeld).toBe(false);
	});

	it('projects shortcut-hints visibility across Slash press, release, and blur', () => {
		const { input } = makeSession();
		expect(input.isShortcutHintsVisible).toBe(false);

		input.handleKeyDown(new KeyboardEvent('keydown', { code: 'Slash' }));
		expect(input.isShortcutHintsVisible).toBe(true);

		input.handleKeyUp(new KeyboardEvent('keyup', { code: 'Slash' }));
		expect(input.isShortcutHintsVisible).toBe(false);

		input.handleKeyDown(new KeyboardEvent('keydown', { code: 'Slash' }));
		input.handleBlur();
		expect(input.isShortcutHintsVisible).toBe(false);
	});
});
