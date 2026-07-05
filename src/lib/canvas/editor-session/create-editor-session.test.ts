// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
	createEditorSession,
	type CreateEditorSessionOptions
} from './create-editor-session';
import { createFakeDirtyNotifier } from './fake-dirty-notifier';
import type { CanvasCoords } from '../canvas-model';
import type { Color } from '../color';

const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const RED: Color = { r: 255, g: 0, b: 0, a: 255 };
const TRANSPARENT: Color = { r: 0, g: 0, b: 0, a: 0 };

function makeSession(overrides: Partial<CreateEditorSessionOptions> = {}) {
	return createEditorSession({ notifier: createFakeDirtyNotifier(), ...overrides });
}

type Session = ReturnType<typeof makeSession>;

function getPixel({ workspace }: Session, x: number, y: number): Color {
	const tab = workspace.activeTab;
	const pixels = tab.document.composite();
	const i = (y * tab.canvasWidth + x) * 4;
	return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], a: pixels[i + 3] };
}

function drawLine({ workspace, input }: Session, from: CanvasCoords, to: CanvasCoords) {
	workspace.setActiveTool('line');
	input.handleDrawStart(0, 'mouse');
	input.handleDraw(from, null);
	input.handleDraw(to, from);
	input.handleDrawEnd();
}

describe('createEditorSession — wiring', () => {
	it('returns a workspace and input pipeline bound to the same session', () => {
		const session = makeSession({ initialForegroundColor: RED, gridColor: '#ECE5D9' });

		expect(session.workspace.shared.foregroundColor).toEqual(RED);
		expect(session.workspace.activeTab.viewport.gridColor).toBe('#ECE5D9');

		// A stroke through the pipeline lands in the returned workspace.
		drawLine(session, { x: 0, y: 0 }, { x: 3, y: 0 });
		expect(session.workspace.activeTab.canUndo).toBe(true);
		expect(getPixel(session, 3, 0)).toEqual(RED);
	});

	it('routes keyboard shortcuts to the workspace through the host closure (keyboard ↔ tool-runner cycle)', () => {
		const session = makeSession();
		session.workspace.setActiveTool('pencil');

		session.input.handleKeyDown(new KeyboardEvent('keydown', { code: 'AltLeft' }));
		expect(session.workspace.shared.activeTool).toBe('eyedropper');
		session.input.handleKeyUp(new KeyboardEvent('keyup', { code: 'AltLeft' }));

		drawLine(session, { x: 0, y: 0 }, { x: 3, y: 0 });
		expect(session.workspace.activeTab.canUndo).toBe(true);

		session.input.handleKeyDown(
			new KeyboardEvent('keydown', { code: 'KeyZ', key: 'z', metaKey: true })
		);
		expect(session.workspace.activeTab.canUndo).toBe(false);
	});

	it('constrains a stroke when the Constrain latch alone is on (Shift ‖ latch OR-combine)', () => {
		const session = makeSession();
		session.input.toggleConstrain();

		drawLine(session, { x: 1, y: 1 }, { x: 6, y: 3 });

		// constrainLine({1,1},{6,3}) snaps East to {6,1}: the constrained
		// endpoint is painted and the free endpoint is left untouched.
		expect(getPixel(session, 6, 1)).toEqual(BLACK);
		expect(getPixel(session, 6, 3)).toEqual(TRANSPARENT);
	});

	it('constrains a stroke when keyboard Shift alone is held', () => {
		const session = makeSession();
		session.input.handleKeyDown(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));

		drawLine(session, { x: 1, y: 1 }, { x: 6, y: 3 });

		expect(getPixel(session, 6, 1)).toEqual(BLACK);
		expect(getPixel(session, 6, 3)).toEqual(TRANSPARENT);
	});

	it('starts the latch off when rebuilt from a snapshot taken while armed', () => {
		const session = makeSession();
		session.input.toggleConstrain();
		expect(session.input.isConstrainActive).toBe(true);

		// The latch is session-transient — never persisted — so the rebuilt
		// session must start off, drawing free-form absent a physical Shift.
		const snapshot = session.workspace.toSnapshot();
		const restored = makeSession({ restored: snapshot });

		expect(restored.input.isConstrainActive).toBe(false);
		drawLine(restored, { x: 1, y: 1 }, { x: 6, y: 3 });
		expect(getPixel(restored, 6, 3)).toEqual(BLACK);
	});
});
