import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, createEvent, cleanup } from '@testing-library/svelte';
import * as m from '$lib/paraglide/messages';
import { TOOL_ENTRIES, type ToolType } from '$lib/ui-editor/tool-ui';
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

const ORDER = TOOL_ENTRIES.map((entry) => entry.type);
const nextTool = (tool: ToolType) => ORDER[(ORDER.indexOf(tool) + 1) % ORDER.length];
const prevTool = (tool: ToolType) => ORDER[(ORDER.indexOf(tool) - 1 + ORDER.length) % ORDER.length];

// A registry reclassification that empties either group would silently turn it.each()
// into zero cases — a green run that verifies nothing. Fail at load instead so the gap
// surfaces immediately. (≥2 constrainable: a primary + a secondary tool are exercised;
// ≥1 non-constrainable: the latch-rejection cases need a probe tool.)
if (CONSTRAINABLE.length < 2 || NON_CONSTRAINABLE.length < 1) {
	throw new Error(
		'Toolbar Constrain-latch contract needs ≥2 constrainable and ≥1 non-constrainable tool — check tool-registry classification'
	);
}

/** Tool radio lookup by accessible name (now always the plain tool label). */
function findToolButton(container: HTMLElement, label: string): HTMLButtonElement | null {
	return container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

function activeRadio(container: HTMLElement): HTMLButtonElement {
	return container.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')!;
}

/**
 * The shared Constrain-latch behavioral contract for a toolbar surface. The touch
 * ToolStrip and the docked LeftToolbar render different markup but must honour the
 * same re-tap semantics, radiogroup structure, and keyboard model; each spec invokes
 * this against its own render so the two surfaces cannot drift apart behaviorally.
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

		describe('radiogroup semantics', () => {
			it('exposes the tools as a labeled radiogroup of checkable radios', () => {
				const { container } = renderToolbar({ activeTool: primary.type });

				const group = container.querySelector('[role="radiogroup"]');
				expect(group).toBeTruthy();
				expect(group!.getAttribute('aria-label')).toBe(m.aria_toolSelection());

				const radios = container.querySelectorAll('[role="radio"]');
				expect(radios.length).toBe(TOOL_ENTRIES.length);
			});

			it('marks the active tool as checked and never uses aria-pressed', () => {
				const { container } = renderToolbar({ activeTool: primary.type });

				expect(activeRadio(container).getAttribute('aria-label')).toBe(primary.label());
				expect(findToolButton(container, secondary.label())!.getAttribute('aria-checked')).toBe(
					'false'
				);
				expect(container.querySelector('[aria-pressed]')).toBeNull();
			});

			it('keeps only the active tool in the tab order (roving tabindex)', () => {
				const { container } = renderToolbar({ activeTool: primary.type });

				expect(findToolButton(container, primary.label())!.getAttribute('tabindex')).toBe('0');
				expect(findToolButton(container, secondary.label())!.getAttribute('tabindex')).toBe('-1');
				expect(findToolButton(container, probe.label())!.getAttribute('tabindex')).toBe('-1');
			});

			it('keeps the accessible name a plain tool label even while the latch is on', () => {
				const { container } = renderToolbar({ activeTool: primary.type, constrainActive: true });

				expect(findToolButton(container, primary.label())).toBeTruthy();
				expect(
					container.querySelector(`button[aria-label="${primary.label()} (${m.modifier_constrain()})"]`)
				).toBeNull();
			});
		});

		describe('live-region announcements', () => {
			it('announces the on-state through a polite status region the active radio describes', () => {
				const { container } = renderToolbar({ activeTool: primary.type, constrainActive: true });

				const describedBy = activeRadio(container).getAttribute('aria-describedby');
				expect(describedBy).toBeTruthy();
				const status = container.querySelector(`#${CSS.escape(describedBy!)}`)!;
				expect(status.getAttribute('role')).toBe('status');
				expect(status.getAttribute('aria-live')).toBe('polite');
				expect(status.textContent).toBe(m.aria_constrainStatusOn());
			});

			it('announces the off-state through the same status channel', () => {
				const { container } = renderToolbar({ activeTool: primary.type, constrainActive: false });

				const status = container.querySelector('[role="status"]')!;
				expect(status.textContent).toBe(m.aria_constrainStatusOff());
			});

			it('exposes no status region or describedby on a non-constrainable active tool', () => {
				const { container } = renderToolbar({ activeTool: probe.type, constrainActive: true });

				expect(container.querySelector('[role="status"]')).toBeNull();
				expect(activeRadio(container).getAttribute('aria-describedby')).toBeNull();
			});

			it('gives separately-mounted toolbars distinct status-region ids', () => {
				const a = renderToolbar({ activeTool: primary.type });
				const b = renderToolbar({ activeTool: primary.type });

				const idA = a.container.querySelector('[role="status"]')!.id;
				const idB = b.container.querySelector('[role="status"]')!.id;
				expect(idA).toBeTruthy();
				expect(idA).not.toBe(idB);
			});
		});

		describe('keyboard navigation', () => {
			it('moves selection to the next tool on Arrow Right/Down, wrapping at the end', () => {
				for (const key of ['ArrowRight', 'ArrowDown']) {
					const onToolChange = vi.fn();
					const { container } = renderToolbar({ activeTool: primary.type, onToolChange });

					fireEvent.keyDown(activeRadio(container), { key });

					expect(onToolChange).toHaveBeenCalledWith(nextTool(primary.type));
					cleanup();
				}
			});

			it('moves selection to the previous tool on Arrow Left/Up, wrapping at the start', () => {
				for (const key of ['ArrowLeft', 'ArrowUp']) {
					const onToolChange = vi.fn();
					const { container } = renderToolbar({ activeTool: primary.type, onToolChange });

					fireEvent.keyDown(activeRadio(container), { key });

					expect(onToolChange).toHaveBeenCalledWith(prevTool(primary.type));
					cleanup();
				}
			});

			it.each([' ', 'Enter'])(
				'toggles the latch (not a re-select) when "%s" activates the active constrainable tool',
				(key) => {
					const onToggleConstrain = vi.fn();
					const onToolChange = vi.fn();
					const { container } = renderToolbar({
						activeTool: primary.type,
						onToggleConstrain,
						onToolChange
					});

					fireEvent.keyDown(activeRadio(container), { key });

					expect(onToggleConstrain).toHaveBeenCalledOnce();
					expect(onToolChange).not.toHaveBeenCalled();
				}
			);

			it('re-selects (never toggles the latch) when Space activates a non-constrainable tool', () => {
				const onToggleConstrain = vi.fn();
				const onToolChange = vi.fn();
				const { container } = renderToolbar({
					activeTool: probe.type,
					onToggleConstrain,
					onToolChange
				});

				fireEvent.keyDown(activeRadio(container), { key: ' ' });

				expect(onToolChange).toHaveBeenCalledWith(probe.type);
				expect(onToggleConstrain).not.toHaveBeenCalled();
			});

			it('prevents default on handled keys so they do not leak into global shortcuts', () => {
				const { container } = renderToolbar({ activeTool: primary.type });
				const radio = activeRadio(container);

				for (const key of ['ArrowRight', 'ArrowLeft', ' ', 'Enter']) {
					const event = createEvent.keyDown(radio, { key });
					fireEvent(radio, event);
					expect(event.defaultPrevented).toBe(true);
				}
			});

			it('leaves keys it does not handle for global shortcuts', () => {
				const { container } = renderToolbar({ activeTool: primary.type });
				const radio = activeRadio(container);

				const event = createEvent.keyDown(radio, { key: 'a' });
				fireEvent(radio, event);
				expect(event.defaultPrevented).toBe(false);
			});
		});
	});
}
