import { describe, expect, it, vi } from 'vitest';
import type { Document, MarqueeRegion } from '../canvas-model';
import type { SessionHost, StrokeSpec } from '../tool-authoring';
import { selectionTool } from './selection-tool';

function createHost(options: { readonly activeLayerKind?: 'pixel' | 'reference' } = {}): {
	readonly host: SessionHost;
	readonly setMarquee: ReturnType<typeof vi.fn>;
	currentMarquee: MarqueeRegion | undefined;
} {
	const state: { currentMarquee: MarqueeRegion | undefined } = { currentMarquee: undefined };
	const setMarquee = vi.fn((region: MarqueeRegion | null | undefined) => {
		state.currentMarquee = region ?? undefined;
	});
	const activeLayerKind = options.activeLayerKind ?? 'pixel';
	const document = {
		width: 8,
		height: 8,
		active_layer_id: () => 'layer-1',
		layer_count: () => 1,
		layer_id_at: () => 'layer-1',
		layer_kind_at: () => activeLayerKind,
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

function region(x: number, y: number, width: number, height: number): MarqueeRegion {
	return {
		x,
		y,
		width,
		height,
		contains(targetX: number, targetY: number) {
			return targetX >= x && targetY >= y && targetX < x + width && targetY < y + height;
		},
		translate(dx: number, dy: number) {
			return region(x + dx, y + dy, width, height);
		},
		clip_to() {
			return this;
		}
	};
}

describe('selectionTool', () => {
	it('previews a clipped Marquee while dragging and commits it as an undoable effect on release', () => {
		const ctx = createHost();
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);

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

	it('silently no-ops while dragging with a Reference Layer active', () => {
		const initial = region(1, 1, 2, 2);
		const ctx = createHost({ activeLayerKind: 'reference' });
		ctx.currentMarquee = initial;
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		expect(session.draw({ x: 0, y: 0 }, null)).toEqual([]);
		expect(session.draw({ x: 4, y: 4 }, { x: 0, y: 0 })).toEqual([]);

		expect(ctx.currentMarquee).toBe(initial);
		expect(ctx.setMarquee).not.toHaveBeenCalled();
		expect(session.end()).toEqual([]);
	});

	it('does not commit a Marquee for a click without a drag sample', () => {
		const ctx = createHost();
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		expect(session.draw({ x: 2, y: 2 }, null)).toEqual([]);

		expect(session.end()).toEqual([]);
		expect(ctx.setMarquee).not.toHaveBeenCalled();
	});

	it('clears the existing Marquee when clicking outside it without dragging', () => {
		const initial = region(1, 1, 2, 2);
		const ctx = createHost();
		ctx.currentMarquee = initial;
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		expect(session.draw({ x: 5, y: 5 }, null)).toEqual([]);

		expect(session.end()).toEqual([{ type: 'setMarquee', region: null }]);
		expect(ctx.currentMarquee).toBe(initial);
	});

	it('keeps the existing Marquee when clicking inside it without dragging', () => {
		const initial = region(1, 1, 2, 2);
		const ctx = createHost();
		ctx.currentMarquee = initial;
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		expect(session.draw({ x: 2, y: 2 }, null)).toEqual([]);

		expect(session.end()).toEqual([]);
		expect(ctx.setMarquee).not.toHaveBeenCalled();
		expect(ctx.currentMarquee).toBe(initial);
	});

	it('starts a Floating Selection when dragging inside the existing Marquee', () => {
		const initial = region(1, 1, 3, 2);
		const ctx = createHost();
		ctx.currentMarquee = initial;
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		expect(session.draw({ x: 2, y: 1 }, null)).toEqual([]);

		expect(session.draw({ x: 4, y: 2 }, { x: 2, y: 1 })).toEqual([
			{ type: 'beginFloatingSelection', sourceRegion: initial },
			{ type: 'moveFloatingSelection', offset: { dx: 2, dy: 1 } }
		]);
		expect(ctx.setMarquee).not.toHaveBeenCalled();

		expect(session.end()).toEqual([{ type: 'commitFloatingSelection' }]);
	});

	it('cancels a Floating Selection drag without emitting a commit effect', () => {
		const initial = region(1, 1, 3, 2);
		const ctx = createHost();
		ctx.currentMarquee = initial;
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		expect(session.draw({ x: 2, y: 1 }, null)).toEqual([]);
		expect(session.draw({ x: 4, y: 2 }, { x: 2, y: 1 })).toEqual([
			{ type: 'beginFloatingSelection', sourceRegion: initial },
			{ type: 'moveFloatingSelection', offset: { dx: 2, dy: 1 } }
		]);

		expect(session.cancel()).toEqual([{ type: 'cancelFloatingSelection' }]);
		expect(session.end()).toEqual([]);
	});

	it('defines a new Marquee when dragging at least one document pixel outside the existing Marquee', () => {
		const initial = region(1, 1, 2, 2);
		const ctx = createHost();
		ctx.currentMarquee = initial;
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		expect(session.draw({ x: 5, y: 5 }, null)).toEqual([]);
		expect(session.draw({ x: 6, y: 5 }, { x: 5, y: 5 })).toEqual([
			{ type: 'marqueePreviewChanged' }
		]);

		const effects = session.end();

		expect(ctx.currentMarquee).toMatchObject({ x: 1, y: 1, width: 2, height: 2 });
		expect(effects).toEqual([
			{
				type: 'setMarquee',
				region: expect.objectContaining({ x: 5, y: 5, width: 2, height: 1 })
			}
		]);
	});

	it('updates the draft Marquee when a drag returns to the anchor pixel', () => {
		const ctx = createHost();
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		expect(session.draw({ x: 5, y: 5 }, null)).toEqual([]);
		expect(session.draw({ x: 6, y: 5 }, { x: 5, y: 5 })).toEqual([
			{ type: 'marqueePreviewChanged' }
		]);
		expect(ctx.currentMarquee).toMatchObject({ x: 5, y: 5, width: 2, height: 1 });
		expect(session.draw({ x: 5, y: 5 }, { x: 6, y: 5 })).toEqual([
			{ type: 'marqueePreviewChanged' }
		]);

		const effects = session.end();

		expect(effects).toEqual([
			{
				type: 'setMarquee',
				region: expect.objectContaining({ x: 5, y: 5, width: 1, height: 1 })
			}
		]);
	});

	it('cancels a drag preview by restoring the initial Marquee without committing', () => {
		const initial = region(1, 1, 2, 2);
		const ctx = createHost();
		ctx.currentMarquee = initial;
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		session.draw({ x: 0, y: 0 }, null);
		session.draw({ x: 4, y: 4 }, { x: 0, y: 0 });
		expect(ctx.currentMarquee).toMatchObject({ x: 0, y: 0, width: 5, height: 5 });

		expect(session.cancel()).toEqual([{ type: 'marqueePreviewChanged' }]);

		expect(ctx.currentMarquee).toMatchObject({ x: 1, y: 1, width: 2, height: 2 });
		expect(session.end()).toEqual([]);
	});

	it('restores the initial Marquee without committing when drag stays outside the canvas', () => {
		const initial = region(1, 1, 2, 2);
		const ctx = createHost();
		ctx.currentMarquee = initial;
		const session = selectionTool.open(ctx.host, strokeSpec);

		expect(session.start()).toEqual([]);
		session.draw({ x: -5, y: -5 }, null);
		session.draw({ x: -2, y: -2 }, { x: -5, y: -5 });
		expect(ctx.currentMarquee).toBeUndefined();

		expect(session.end()).toEqual([{ type: 'marqueePreviewChanged' }]);

		expect(ctx.currentMarquee).toMatchObject({ x: 1, y: 1, width: 2, height: 2 });
	});
});
