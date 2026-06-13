<script lang="ts">
	import {
		Check,
		ClipboardPaste,
		Copy,
		CopyPlus,
		FlipHorizontal,
		FlipVertical,
		Scissors,
		SquareDashedMousePointer,
		Trash2,
		X
	} from 'lucide-svelte';
	import type { ComponentType } from 'svelte';
	import * as m from '$lib/paraglide/messages';
	import { tooltip } from '$lib/tooltip';
	import type { MarqueeRegion } from './canvas-model';
	import { effectivePixelSize, type ViewportData, type ViewportSize } from './viewport';

	const ACTION_BAR_GAP = 8;
	const ACTION_BAR_HEIGHT = 44;
	const ACTION_BAR_EDGE_MARGIN = 8;
	const ACTION_BAR_PADDING_X = 8;
	const ACTION_BAR_BORDER_X = 2;
	const ACTION_BUTTON_GAP = 2;
	const COMPACT_ACTION_BUTTON_WIDTH = 36;
	const ACTION_ICON_WIDTH = 16;
	const ACTION_LABEL_GAP = 4;
	const ACTION_BUTTON_PADDING_X = 8;
	const ACTION_LABEL_CHARACTER_WIDTH = 10;
	const WIDE_VIEWPORT_MIN_WIDTH = 1024;
	const MEDIUM_VIEWPORT_MIN_WIDTH = 600;

	interface Props {
		marquee?: MarqueeRegion | null;
		floatingSelectionOffset?: { readonly dx: number; readonly dy: number } | null;
		canvasWidth: number;
		canvasHeight: number;
		viewport: ViewportData;
		viewportSize?: ViewportSize;
		canPaste?: boolean;
		isDragging?: boolean;
		onCopySelection?: () => void;
		onCutSelection?: () => void;
		onPasteSelectionClipboard?: () => void;
		onDeleteMarqueePixels?: () => void;
		onClearMarqueeOrFloating?: () => void;
		onCommitFloatingSelection?: () => void;
		onDuplicateFloatingSelection?: () => void;
		onFlipHorizontal?: () => void;
		onFlipVertical?: () => void;
	}

	let {
		marquee,
		floatingSelectionOffset,
		canvasWidth,
		canvasHeight,
		viewport,
		viewportSize = { width: 0, height: 0 },
		canPaste = false,
		isDragging = false,
		onCopySelection,
		onCutSelection,
		onPasteSelectionClipboard,
		onDeleteMarqueePixels,
		onClearMarqueeOrFloating,
		onCommitFloatingSelection,
		onDuplicateFloatingSelection,
		onFlipHorizontal,
		onFlipVertical
	}: Props = $props();

	type Rect = {
		readonly left: number;
		readonly top: number;
		readonly width: number;
		readonly height: number;
	};

	type SelectionAction = {
		readonly label: string;
		readonly icon: ComponentType;
		readonly handler: (() => void) | undefined;
		readonly disabled?: boolean;
		readonly variant?: 'danger';
	};

	const projectedRect = $derived.by(() => {
		if (!marquee) return null;

		const offset = floatingSelectionOffset ?? { dx: 0, dy: 0 };
		const marqueeX = marquee.x + offset.dx;
		const marqueeY = marquee.y + offset.dy;
		const left = Math.max(0, marqueeX);
		const top = Math.max(0, marqueeY);
		const right = Math.min(canvasWidth, marqueeX + marquee.width);
		const bottom = Math.min(canvasHeight, marqueeY + marquee.height);
		if (left >= right || top >= bottom) return null;

		const scaledPixel = effectivePixelSize(viewport);
		if (!Number.isFinite(scaledPixel) || scaledPixel < 1) return null;
		return {
			left: Math.round(viewport.panX) + left * scaledPixel,
			top: Math.round(viewport.panY) + top * scaledPixel,
			width: (right - left) * scaledPixel,
			height: (bottom - top) * scaledPixel
		};
	});

	const showLabel = $derived(viewportSize.width >= MEDIUM_VIEWPORT_MIN_WIDTH);
	const showTooltip = $derived(viewportSize.width >= WIDE_VIEWPORT_MIN_WIDTH);
	const idleActions = $derived<SelectionAction[]>([
		{
			label: m.action_selectionCopy(),
			icon: Copy,
			handler: onCopySelection
		},
		{
			label: m.action_selectionCut(),
			icon: Scissors,
			handler: onCutSelection
		},
		{
			label: m.action_selectionPaste(),
			icon: ClipboardPaste,
			handler: canPaste ? onPasteSelectionClipboard : undefined,
			disabled: !canPaste
		},
		{
			label: m.action_transformFlipHorizontal(),
			icon: FlipHorizontal,
			handler: onFlipHorizontal
		},
		{
			label: m.action_transformFlipVertical(),
			icon: FlipVertical,
			handler: onFlipVertical
		},
		{
			label: m.action_selectionDelete(),
			icon: Trash2,
			handler: onDeleteMarqueePixels,
			variant: 'danger'
		},
		{
			label: m.action_selectionDeselect(),
			icon: SquareDashedMousePointer,
			handler: onClearMarqueeOrFloating
		}
	]);
	const floatingActions = $derived<SelectionAction[]>([
		{
			label: m.action_selectionDone(),
			icon: Check,
			handler: onCommitFloatingSelection
		},
		{
			label: m.action_selectionCancel(),
			icon: X,
			handler: onClearMarqueeOrFloating
		},
		{
			label: m.action_selectionDuplicate(),
			icon: CopyPlus,
			handler: onDuplicateFloatingSelection
		}
	]);
	const actions = $derived(floatingSelectionOffset ? floatingActions : idleActions);
	const estimatedActionBarWidth = $derived(estimateActionBarWidth(actions, showLabel));
	let actionBarEl: HTMLDivElement | undefined = $state();
	let measuredActionBarWidth = $state(0);
	const actionBarWidth = $derived(measuredActionBarWidth || estimatedActionBarWidth);
	const position = $derived(
		projectedRect ? actionBarPosition(projectedRect, viewportSize, actionBarWidth) : null
	);

	$effect(() => {
		const currentEl = actionBarEl;
		if (!currentEl) {
			measuredActionBarWidth = 0;
			return;
		}

		void estimatedActionBarWidth;

		function updateWidth(el: HTMLDivElement): void {
			const measured = el.getBoundingClientRect().width;
			measuredActionBarWidth = measured > 0 ? measured : estimatedActionBarWidth;
		}

		updateWidth(currentEl);

		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(() => updateWidth(currentEl));
		observer.observe(currentEl);
		return () => observer.disconnect();
	});

	function estimateActionBarWidth(selectionActions: SelectionAction[], includesLabels: boolean): number {
		const buttonWidth = selectionActions.reduce(
			(sum, action) => sum + estimateActionButtonWidth(action.label, includesLabels),
			0
		);
		const gaps = Math.max(0, selectionActions.length - 1) * ACTION_BUTTON_GAP;
		return ACTION_BAR_PADDING_X + ACTION_BAR_BORDER_X + buttonWidth + gaps;
	}

	function estimateActionButtonWidth(label: string, includesLabel: boolean): number {
		if (!includesLabel) return COMPACT_ACTION_BUTTON_WIDTH;
		const labelWidth = Array.from(label).length * ACTION_LABEL_CHARACTER_WIDTH;
		return Math.max(
			COMPACT_ACTION_BUTTON_WIDTH,
			ACTION_ICON_WIDTH + ACTION_LABEL_GAP + labelWidth + ACTION_BUTTON_PADDING_X
		);
	}

	function actionBarPosition(
		rect: Rect,
		size: ViewportSize,
		barWidth: number
	): { left: number; top: number } {
		const centerX = rect.left + rect.width / 2;
		const maxLeft = Math.max(ACTION_BAR_EDGE_MARGIN, size.width - barWidth - ACTION_BAR_EDGE_MARGIN);
		const left = clamp(centerX - barWidth / 2, ACTION_BAR_EDGE_MARGIN, maxLeft);
		const aboveTop = rect.top - ACTION_BAR_GAP - ACTION_BAR_HEIGHT;
		if (aboveTop >= 0) return { left, top: aboveTop };

		const belowTop = rect.top + rect.height + ACTION_BAR_GAP;
		if (belowTop + ACTION_BAR_HEIGHT <= size.height) return { left, top: belowTop };

		const topSpace = Math.max(0, rect.top);
		const bottomSpace = Math.max(0, size.height - (rect.top + rect.height));
		const stickyTop = topSpace <= bottomSpace ? 0 : Math.max(0, size.height - ACTION_BAR_HEIGHT);
		return { left, top: stickyTop };
	}

	function runAction(action: SelectionAction): void {
		if (action.disabled) return;
		action.handler?.();
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.min(Math.max(value, min), max);
	}
</script>

{#if position}
	<div
		bind:this={actionBarEl}
		class="selection-action-bar"
		class:selection-action-bar--hidden={isDragging}
		role="group"
		aria-label={m.aria_selectionActions()}
		data-testid="selection-action-bar"
		style:left={`${position.left}px`}
		style:top={`${position.top}px`}
	>
		{#each actions as action}
			{@const Icon = action.icon}
			<button
				type="button"
				class="selection-action"
				class:selection-action--danger={action.variant === 'danger'}
				disabled={action.disabled}
				aria-label={action.label}
				onclick={() => runAction(action)}
				use:tooltip={showTooltip ? action.label : undefined}
			>
				<Icon size={16} aria-hidden={true} />
				{#if showLabel}
					<span>{action.label}</span>
				{/if}
			</button>
		{/each}
	</div>
{/if}

<style>
	.selection-action-bar {
		position: absolute;
		z-index: 18;
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		gap: 2px;
		max-width: calc(100% - 16px);
		height: 44px;
		padding: 4px;
		border: 1px solid var(--ds-border);
		border-radius: var(--ds-radius-sm);
		background: var(--ds-bg-elevated);
		box-shadow: var(--ds-shadow-md);
		opacity: 1;
		transition: opacity 120ms ease-out;
		touch-action: none;
	}

	.selection-action-bar--hidden {
		pointer-events: none;
		opacity: 0;
		transition-duration: 100ms;
	}

	.selection-action {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--ds-space-1);
		min-width: 36px;
		height: 36px;
		padding: 0 var(--ds-space-2);
		border: 1px solid transparent;
		border-radius: var(--ds-radius-sm);
		background: transparent;
		color: var(--ds-text-secondary);
		font: 600 12px/1 var(--ds-font-body);
		white-space: nowrap;
		cursor: pointer;
	}

	.selection-action:hover:not(:disabled) {
		background: var(--ds-bg-hover);
		color: var(--ds-text-primary);
	}

	.selection-action--danger {
		color: var(--ds-danger);
	}

	.selection-action:disabled {
		opacity: 0.38;
		cursor: default;
	}

	.selection-action::before {
		content: '';
		position: absolute;
		width: 44px;
		height: 44px;
	}

	@media (max-width: 599px) {
		.selection-action {
			width: 36px;
			padding: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.selection-action-bar,
		.selection-action-bar--hidden {
			transition: none;
		}
	}
</style>
