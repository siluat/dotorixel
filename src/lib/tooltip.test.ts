import { describe, it, expect } from 'vitest';
import { parseTitle } from './tooltip';

describe('parseTitle', () => {
	it('extracts name and single-letter shortcut', () => {
		expect(parseTitle('Pencil (P)')).toEqual({ name: 'Pencil', shortcut: 'P' });
	});

	it('extracts name with spaces and shortcut', () => {
		expect(parseTitle('Toggle Grid (G)')).toEqual({ name: 'Toggle Grid', shortcut: 'G' });
	});

	it('extracts modifier shortcut', () => {
		expect(parseTitle('Undo (⌘Z)')).toEqual({ name: 'Undo', shortcut: '⌘Z' });
	});

	it('extracts multi-key modifier shortcut', () => {
		expect(parseTitle('Redo (Ctrl+Y)')).toEqual({ name: 'Redo', shortcut: 'Ctrl+Y' });
	});

	it('returns name only when no parenthesized shortcut', () => {
		expect(parseTitle('Zoom Out')).toEqual({ name: 'Zoom Out' });
	});

	it('returns name only for single word without shortcut', () => {
		expect(parseTitle('Undo')).toEqual({ name: 'Undo' });
	});

	it('handles empty string', () => {
		expect(parseTitle('')).toEqual({ name: '' });
	});
});
