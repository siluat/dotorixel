import { describe, it, expect } from 'vitest';
import { ConstrainLatch } from './constrain-latch.svelte';

describe('ConstrainLatch', () => {
	it('starts inactive', () => {
		const latch = new ConstrainLatch();
		expect(latch.isActive).toBe(false);
	});

	it('toggle turns the latch on, then off again', () => {
		const latch = new ConstrainLatch();

		latch.toggle();
		expect(latch.isActive).toBe(true);

		latch.toggle();
		expect(latch.isActive).toBe(false);
	});
});
