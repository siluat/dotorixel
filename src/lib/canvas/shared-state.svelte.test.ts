// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { SharedState } from './shared-state.svelte';

describe('SharedState', () => {
	it('has correct default values', () => {
		const shared = new SharedState();

		expect(shared.activeTool).toBe('pencil');
		expect(shared.foregroundColor).toEqual({ r: 0, g: 0, b: 0, a: 255 });
		expect(shared.backgroundColor).toEqual({ r: 255, g: 255, b: 255, a: 255 });
		expect(shared.recentColors).toEqual([]);
		expect(shared.pixelPerfect).toBe(true);
	});
});
