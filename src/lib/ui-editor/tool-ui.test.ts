import { describe, it, expect } from 'vitest';
import { TOOL_ENTRIES, toolRadiogroupAction } from './tool-ui';

const first = TOOL_ENTRIES[0].type;
const second = TOOL_ENTRIES[1].type;
const last = TOOL_ENTRIES[TOOL_ENTRIES.length - 1].type;

describe('toolRadiogroupAction', () => {
	it('maps Arrow Right/Down to selecting the next tool', () => {
		expect(toolRadiogroupAction('ArrowRight', first)).toEqual({ kind: 'select', tool: second });
		expect(toolRadiogroupAction('ArrowDown', first)).toEqual({ kind: 'select', tool: second });
	});

	it('maps Arrow Left/Up to selecting the previous tool', () => {
		expect(toolRadiogroupAction('ArrowLeft', second)).toEqual({ kind: 'select', tool: first });
		expect(toolRadiogroupAction('ArrowUp', second)).toEqual({ kind: 'select', tool: first });
	});

	it('wraps forward off the last tool and backward off the first', () => {
		expect(toolRadiogroupAction('ArrowRight', last)).toEqual({ kind: 'select', tool: first });
		expect(toolRadiogroupAction('ArrowLeft', first)).toEqual({ kind: 'select', tool: last });
	});

	it('maps Space and Enter to activating the focused tool', () => {
		expect(toolRadiogroupAction(' ', first)).toEqual({ kind: 'activate' });
		expect(toolRadiogroupAction('Enter', first)).toEqual({ kind: 'activate' });
	});

	it('ignores keys it does not handle', () => {
		expect(toolRadiogroupAction('Tab', first)).toBeNull();
		expect(toolRadiogroupAction('a', first)).toBeNull();
	});
});
