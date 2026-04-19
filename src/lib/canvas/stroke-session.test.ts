import { describe, expect, it } from 'vitest';
import { createStrokeSessions, type StrokeDeps } from './stroke-session';
import { createFakeDrawingOps, WHITE } from './fake-drawing-ops';
import type { ContinuousTool, ToolContext } from './draw-tool';
import type { PixelCanvas } from './canvas-model';
import type { SamplingSession } from './sampling-session.svelte';

function fakeDeps(): StrokeDeps {
	const baseOps = createFakeDrawingOps(8, 8, WHITE);
	const pixelCanvas = {} as PixelCanvas;
	return {
		host: {
			pixelCanvas,
			foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
			backgroundColor: { r: 255, g: 255, b: 255, a: 255 }
		},
		baseOps,
		history: { pushSnapshot: () => {} },
		sampling: {} as SamplingSession,
		isShiftHeld: () => false,
		pixelPerfect: () => false
	};
}

function fakeContinuousTool(): ContinuousTool {
	return {
		kind: 'continuous',
		addsActiveColor: true,
		supportsPixelPerfect: true,
		apply: (_ctx: ToolContext) => false
	};
}

describe('createStrokeSessions', () => {
	it('returns an object with the five typed opener methods', () => {
		const sessions = createStrokeSessions(fakeDeps());
		expect(typeof sessions.continuous).toBe('function');
		expect(typeof sessions.oneShot).toBe('function');
		expect(typeof sessions.shapePreview).toBe('function');
		expect(typeof sessions.dragTransform).toBe('function');
		expect(typeof sessions.liveSample).toBe('function');
	});

	it('throws until openers are implemented', () => {
		const sessions = createStrokeSessions(fakeDeps());
		const spec = {
			tool: fakeContinuousTool(),
			drawColor: { r: 0, g: 0, b: 0, a: 255 },
			drawButton: 0
		};
		expect(() => sessions.continuous(spec)).toThrow(/not yet implemented/);
	});
});
