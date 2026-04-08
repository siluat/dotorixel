<script lang="ts">
	import type { ResizeAnchor } from '$lib/canvas/canvas-types';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		selected: ResizeAnchor;
		onSelect: (anchor: ResizeAnchor) => void;
	}

	let { selected, onSelect }: Props = $props();

	const GRID: { anchor: ResizeAnchor; label: () => string }[] = [
		{ anchor: 'top-left', label: m.anchor_topLeft },
		{ anchor: 'top-center', label: m.anchor_topCenter },
		{ anchor: 'top-right', label: m.anchor_topRight },
		{ anchor: 'middle-left', label: m.anchor_middleLeft },
		{ anchor: 'center', label: m.anchor_center },
		{ anchor: 'middle-right', label: m.anchor_middleRight },
		{ anchor: 'bottom-left', label: m.anchor_bottomLeft },
		{ anchor: 'bottom-center', label: m.anchor_bottomCenter },
		{ anchor: 'bottom-right', label: m.anchor_bottomRight }
	];

	// Arrow rotation angles for each anchor position (pointing from center toward anchor)
	const ARROW_ROTATION: Record<ResizeAnchor, number | null> = {
		'top-left': -135,
		'top-center': -90,
		'top-right': -45,
		'middle-left': 180,
		'center': null,
		'middle-right': 0,
		'bottom-left': 135,
		'bottom-center': 90,
		'bottom-right': 45
	};
</script>

<div class="anchor-section">
	<span class="anchor-label">{m.label_anchor()}</span>
	<div class="anchor-grid" role="radiogroup" aria-label={m.label_anchor()}>
		{#each GRID as { anchor, label }}
			{@const isSelected = selected === anchor}
			{@const rotation = ARROW_ROTATION[anchor]}
			<button
				type="button"
				class="anchor-cell"
				class:selected={isSelected}
				role="radio"
				aria-checked={isSelected}
				aria-label={label()}
				onclick={() => onSelect(anchor)}
			>
				{#if rotation !== null}
					<svg class="anchor-icon" viewBox="0 0 12 12" fill="none">
						<g transform="rotate({rotation} 6 6)">
							<path d="M3 6h6M7 4l2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
						</g>
					</svg>
				{:else}
					<svg class="anchor-icon" viewBox="0 0 12 12" fill="none">
						<circle cx="6" cy="6" r="2" fill="currentColor" />
					</svg>
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.anchor-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.anchor-label {
		font-family: var(--ds-font-body);
		font-size: 12px;
		color: var(--ds-text-secondary);
	}

	.anchor-grid {
		display: grid;
		grid-template-columns: repeat(3, 36px);
		gap: 4px;
	}

	.anchor-cell {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 6px;
		background: var(--ds-bg-hover);
		color: var(--ds-text-tertiary);
		cursor: pointer;
		padding: 0;
		transition: background 0.1s, color 0.1s;
	}

	.anchor-cell:hover:not(.selected) {
		background: var(--ds-bg-active);
		color: var(--ds-text-secondary);
	}

	.anchor-cell.selected {
		background: var(--ds-accent);
		color: #ffffff;
	}

	.anchor-icon {
		width: 14px;
		height: 14px;
	}

	@media (min-width: 1024px) {
		.anchor-label {
			font-size: var(--ds-font-size-sm);
		}

		.anchor-grid {
			grid-template-columns: repeat(3, 24px);
			gap: 2px;
		}

		.anchor-cell {
			width: 24px;
			height: 24px;
			border-radius: 4px;
		}

		.anchor-icon {
			width: 12px;
			height: 12px;
		}
	}
</style>
