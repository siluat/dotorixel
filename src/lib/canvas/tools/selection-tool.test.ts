import { describe, expect, it, vi } from 'vitest';
import type { Document, MarqueeRegion } from '../canvas-model';
import type { SessionHost, StrokeSpec } from '../tool-authoring';
import { selectionTool } from './selection-tool';

function createHost(): {
	readonly host: SessionHost;
	readonly setMarquee: ReturnType<typeof vi.fn>;
	currentMarquee: MarqueeRegion | undefined;
} {
	const state: { currentMarquee: MarqueeRegion | undefined } = { currentMarquee: undefined };
	const setMarquee = vi.fn((region: MarqueeRegion | null | undefined) => {
		state.currentMarquee = region ?? undefined;
	});
	const document = {
		width: 8,
		height: 8,
		marquee: () => state.currentMarquee,
		set_marquee: setMarquee
	} as unknown as Document;

	return {
		get currentMarquee() {
			return state.currentMarquee;
		},
		set currentMarquee(region: MarqueeRegion | undefined) {
			state.currentMarquee = region;
		},
		setMarquee,
		host: {
			document,
			foregroundColor: { r: 0, g: 0, b: 0, a: 255 },
			backgroundColor: { r: 255, g: 255, b: 255, a: 255 },
			baseOps: {} as SessionHost['baseOps'],
			history: { pushSnapshot: vi.fn() },
			sampling: {} as SessionHost['sampling'],
			isShiftHeld: () => false,
			pixelPerfect: false
		}
	};
}

const strokeSpec: StrokeSpec = {
	drawColor: { r: 0, g: 0, b: 0, a: 255 },
	drawButton: 0,
	inputSource: 'mouse'
};

describe('selectionTool', () => {
	it('previews a clipped Marquee while dragging and commits it as an undoable effect on release', () => {
		const ctx = createHost();
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		expect(ctx.host.history.pushSnapshot).not.toHaveBeenCalled();

		expect(session.draw({ x: -2, y: 1 }, null)).toEqual([]);
		expect(ctx.currentMarquee).toBeUndefined();

		expect(session.draw({ x: 3, y: 4 }, { x: -2, y: 1 })).toEqual([
			{ type: 'marqueePreviewChanged' }
		]);
		expect(ctx.currentMarquee).toMatchObject({ x: 0, y: 1, width: 4, height: 4 });

		const effects = session.end();

		expect(ctx.currentMarquee).toBeUndefined();
		expect(effects).toEqual([
			{
				type: 'setMarquee',
				region: expect.objectContaining({ x: 0, y: 1, width: 4, height: 4 })
			}
		]);
	});

	it('does not commit a Marquee for a click without a drag sample', () => {
		const ctx = createHost();
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		expect(session.draw({ x: 2, y: 2 }, null)).toEqual([]);

		expect(session.end()).toEqual([]);
		expect(ctx.setMarquee).not.toHaveBeenCalled();
		expect(ctx.host.history.pushSnapshot).not.toHaveBeenCalled();
	});

	it('cancels a drag preview by restoring the initial Marquee without committing', () => {
		const initial = { x: 1, y: 1, width: 2, height: 2 } as MarqueeRegion;
		const ctx = createHost();
		ctx.currentMarquee = initial;
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		session.draw({ x: 0, y: 0 }, null);
		session.draw({ x: 4, y: 4 }, { x: 0, y: 0 });
		expect(ctx.currentMarquee).toMatchObject({ x: 0, y: 0, width: 5, height: 5 });

		expect(session.cancel()).toEqual([{ type: 'marqueePreviewChanged' }]);

		expect(ctx.currentMarquee).toMatchObject(initial);
		expect(session.end()).toEqual([]);
		expect(ctx.host.history.pushSnapshot).not.toHaveBeenCalled();
	});

	it('restores the initial Marquee without committing when drag stays outside the canvas', () => {
		const initial = { x: 1, y: 1, width: 2, height: 2 } as MarqueeRegion;
		const ctx = createHost();
		ctx.currentMarquee = initial;
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		session.draw({ x: -5, y: -5 }, null);
		session.draw({ x: -2, y: -2 }, { x: -5, y: -5 });
		expect(ctx.currentMarquee).toBeUndefined();

		expect(session.end()).toEqual([{ type: 'marqueePreviewChanged' }]);

		expect(ctx.currentMarquee).toMatchObject(initial);
		expect(ctx.host.history.pushSnapshot).not.toHaveBeenCalled();
	});
});
