import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, cleanup } from '@testing-library/svelte';
import * as m from '$lib/paraglide/messages';
import { TOOL_ENTRIES } from '$lib/ui-editor/tool-ui';
import { isConstrainableTool } from '$lib/canvas/tool-registry';

/**
 * The render a toolbar spec hands the contract: it applies its component's
 * default props, layers the contract's overrides (active tool + spied
 * callbacks) on top, and returns the rendered container.
 */
export type ToolbarRenderer = (props?: Record<string, unknown>) => { container: HTMLElement };

/** Each toolbar surface names the same re-activation differently ("click" vs "tap"). */
type ActivationVerb = 'click' | 'tap';
const GERUND: Record<ActivationVerb, string> = { click: 'clicking', tap: 'tapping' };

/** Derived from the registry so the contract can never drift from production classification. */
const CONSTRAINABLE = TOOL_ENTRIES.filter((entry) => isConstrainableTool(entry.type));
const NON_CONSTRAINABLE = TOOL_ENTRIES.filter((entry) => !isConstrainableTool(entry.type));
const constrainLabel = (label: string) => `${label} (${m.modifier_constrain()})`;

// A registry reclassification that empties either group would silently turn it.each()
// into zero cases — a green run that verifies nothing. Fail at load instead so the gap
// surfaces immediately. (≥2 constrainable: a primary + a secondary tool are exercised;
// ≥1 non-constrainable: the latch-rejection cases need a probe tool.)
if (CONSTRAINABLE.length < 2 || NON_CONSTRAINABLE.length < 1) {
	throw new Error(
		'Toolbar Constrain-latch contract needs ≥2 constrainable and ≥1 non-constrainable tool — check tool-registry classification'
	);
}

/** Tool button lookup tolerant of the latched label suffix, e.g. "Line (Constrain)". */
function findToolButton(container: HTMLElement, label: string): HTMLButtonElement | null {
	return container.querySelector<HTMLButtonElement>(`button[aria-label^="${label}"]`);
}

/**
 * The shared Constrain-latch behavioral contract for a toolbar surface. The touch
 * ToolStrip and the docked LeftToolbar render different markup but must honour the
 * same re-tap semantics; each spec invokes this against its own render so the two
 * surfaces cannot drift apart behaviorally.
 */
export function describeToolbarConstrainLatch(
	name: string,
	verb: ActivationVerb,
	renderToolbar: ToolbarRenderer
): void {
	const gerund = GERUND[verb];
	const [primary, secondary] = CONSTRAINABLE;
	const [probe] = NON_CONSTRAINABLE;

	describe(`${name} — Constrain latch via re-${verb}`, () => {
		afterEach(() => {
			cleanup();
		});

		it.each(CONSTRAINABLE.map((entry) => [entry.type, entry.label()] as const))(
			`re-${gerund} the active %s tool toggles the Constrain latch instead of re-selecting`,
			async (activeTool, label) => {
				const onToggleConstrain = vi.fn();
				const onToolChange = vi.fn();
				const { container } = renderToolbar({ activeTool, onToggleConstrain, onToolChange });

				await fireEvent.click(findToolButton(container, label)!);

				expect(onToggleConstrain).toHaveBeenCalledOnce();
				expect(onToolChange).not.toHaveBeenCalled();
			}
		);

		it(`${gerund} an inactive tool switches tools without touching the latch`, async () => {
			const onToggleConstrain = vi.fn();
			const onToolChange = vi.fn();
			const { container } = renderToolbar({
				activeTool: primary.type,
				onToggleConstrain,
				onToolChange
			});

			await fireEvent.click(findToolButton(container, secondary.label())!);

			expect(onToolChange).toHaveBeenCalledWith(secondary.type);
			expect(onToggleConstrain).not.toHaveBeenCalled();
		});

		it(`re-${gerund} the active non-constrainable ${probe.type} tool never toggles the latch`, async () => {
			const onToggleConstrain = vi.fn();
			const onToolChange = vi.fn();
			const { container } = renderToolbar({
				activeTool: probe.type,
				onToggleConstrain,
				onToolChange
			});

			await fireEvent.click(findToolButton(container, probe.label())!);

			expect(onToggleConstrain).not.toHaveBeenCalled();
			expect(onToolChange).toHaveBeenCalledWith(probe.type);
		});

		it('announces the Constrain state on the active tool while the latch is on', () => {
			const { container } = renderToolbar({ activeTool: primary.type, constrainActive: true });

			expect(
				container.querySelector(`button[aria-label="${constrainLabel(primary.label())}"]`)
			).toBeTruthy();
		});

		it('announces the plain tool label while the latch is off', () => {
			const { container } = renderToolbar({ activeTool: primary.type, constrainActive: false });

			expect(container.querySelector(`button[aria-label="${primary.label()}"]`)).toBeTruthy();
			expect(
				container.querySelector(`button[aria-label="${constrainLabel(primary.label())}"]`)
			).toBeNull();
		});

		it('does not announce Constrain on a non-constrainable active tool even while the latch is on', () => {
			const { container } = renderToolbar({ activeTool: probe.type, constrainActive: true });

			expect(container.querySelector(`button[aria-label="${probe.label()}"]`)).toBeTruthy();
			expect(
				container.querySelector(`button[aria-label="${constrainLabel(probe.label())}"]`)
			).toBeNull();
		});

		it('does not announce Constrain on inactive constrainable tools while the latch is on', () => {
			const { container } = renderToolbar({ activeTool: primary.type, constrainActive: true });

			expect(container.querySelector(`button[aria-label="${secondary.label()}"]`)).toBeTruthy();
			expect(
				container.querySelector(`button[aria-label="${constrainLabel(secondary.label())}"]`)
			).toBeNull();
		});
	});
}
