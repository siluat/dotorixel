import { describe, it, expect } from 'vitest';
import { DEFAULT_ONION_SKIN_CONFIG, onionSkinGhosts } from './onion-skin';

describe('onionSkinGhosts', () => {
	it('yields a previous and a next ghost for a middle frame', () => {
		const ghosts = onionSkinGhosts(['f1', 'f2', 'f3'], 'f2', DEFAULT_ONION_SKIN_CONFIG);

		expect(ghosts).toEqual([
			{ frameId: 'f1', kind: 'previous', distance: 1 },
			{ frameId: 'f3', kind: 'next', distance: 1 }
		]);
	});

	it('clamps to the next side only on the first frame, never wrapping to the end', () => {
		const ghosts = onionSkinGhosts(['f1', 'f2', 'f3'], 'f1', DEFAULT_ONION_SKIN_CONFIG);

		expect(ghosts).toEqual([{ frameId: 'f2', kind: 'next', distance: 1 }]);
	});

	it('clamps to the previous side only on the last frame, never wrapping to the start', () => {
		const ghosts = onionSkinGhosts(['f1', 'f2', 'f3'], 'f3', DEFAULT_ONION_SKIN_CONFIG);

		expect(ghosts).toEqual([{ frameId: 'f2', kind: 'previous', distance: 1 }]);
	});

	it('yields no ghosts for a single-frame axis', () => {
		const ghosts = onionSkinGhosts(['f1'], 'f1', DEFAULT_ONION_SKIN_CONFIG);

		expect(ghosts).toEqual([]);
	});

	it('takes per-side counts from the config, in axis order (farthest previous first)', () => {
		const ghosts = onionSkinGhosts(['f1', 'f2', 'f3', 'f4', 'f5'], 'f3', {
			previousCount: 2,
			nextCount: 1
		});

		expect(ghosts).toEqual([
			{ frameId: 'f1', kind: 'previous', distance: 2 },
			{ frameId: 'f2', kind: 'previous', distance: 1 },
			{ frameId: 'f4', kind: 'next', distance: 1 }
		]);
	});

	it('clamps a config count that overruns the axis end instead of wrapping', () => {
		const ghosts = onionSkinGhosts(['f1', 'f2', 'f3'], 'f2', {
			previousCount: 3,
			nextCount: 3
		});

		expect(ghosts).toEqual([
			{ frameId: 'f1', kind: 'previous', distance: 1 },
			{ frameId: 'f3', kind: 'next', distance: 1 }
		]);
	});
});
