<script lang="ts">
	import type { Color } from '$lib/canvas/color';
	import { colorToHex } from '$lib/canvas/color';

	interface Props {
		/** 9×9 row-major grid of sampled colors (81 entries). */
		grid: readonly Color[];
		/** Color at the sample target; `null` when the target is out of canvas. */
		centerColor: Color | null;
		/** Pointer position in viewport coordinates; `null` hides the loupe. */
		screenPointer: { x: number; y: number } | null;
	}

	let { grid, centerColor, screenPointer }: Props = $props();

	const centerIndex = $derived((grid.length - 1) / 2);
	const EM_DASH = '—';

	// The authoritative "commit eligible" check lives in sampling-session;
	// `alpha > 0` is a sufficient UI approximation for the hex chip.
	const canonicalHex = $derived(
		centerColor && centerColor.a > 0 ? colorToHex(centerColor) : null
	);
	const displayHex = $derived(canonicalHex ? canonicalHex.toUpperCase() : null);

	/**
	 * Dedicated checkerboard/hatch styling for transparent (a=0) and
	 * out-of-canvas cells lands in issue 066. This tracer slice falls back
	 * to the surface tone so the cell still holds its grid position.
	 */
	function cellFill(color: Color): string {
		if (color.a === 0) return 'var(--ds-bg-surface)';
		return `rgb(${color.r}, ${color.g}, ${color.b})`;
	}
</script>

{#if screenPointer}
	<div
		class="loupe"
		data-testid="loupe-root"
		role="presentation"
		style:--pointer-x="{screenPointer.x}px"
		style:--pointer-y="{screenPointer.y}px"
	>
		<div class="grid" role="presentation">
			{#each grid as color, i (i)}
				<div
					class="cell"
					class:cell--center={i === centerIndex}
					style:background-color={cellFill(color)}
				></div>
			{/each}
		</div>
		<div class="chip" data-testid="loupe-hex-chip">
			<!-- swatch--empty is a hook for issue 066 (checkerboard/hatch fill for
			     transparent and out-of-canvas center pixels). -->
			<div
				class="swatch"
				class:swatch--empty={canonicalHex === null}
				style:background-color={canonicalHex ?? 'var(--ds-bg-surface)'}
			></div>
			<span class="hex" class:hex--muted={displayHex === null} data-testid="loupe-hex-text">
				{displayHex ?? EM_DASH}
			</span>
		</div>
	</div>
{/if}

<style>
	.loupe {
		/* Fixed upper-right quadrant offset from pointer. Quadrant flip lands
		   in issue 067; a touch-specific offset lands in issue 068. */
		--cell-size: 24px;
		--grid-columns: 9;
		--pointer-offset: 20px;

		position: fixed;
		left: var(--pointer-x);
		top: var(--pointer-y);
		transform: translate(var(--pointer-offset), calc(-100% - var(--pointer-offset)));
		pointer-events: none;
		z-index: 1000;

		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--ds-space-3);
		padding: var(--ds-space-3);

		background: var(--ds-bg-elevated);
		border: 1px solid var(--ds-border);
		border-radius: var(--ds-radius-md);
		box-shadow: var(--ds-shadow-md);
	}

	.grid {
		/* Gridlines are rendered by the gap showing through the --ds-border background. */
		display: grid;
		grid-template-columns: repeat(var(--grid-columns), var(--cell-size));
		grid-template-rows: repeat(var(--grid-columns), var(--cell-size));
		gap: 1px;
		background: var(--ds-border);
	}

	.cell {
		width: var(--cell-size);
		height: var(--cell-size);
	}

	/* White inner + black outer ring. Uses literal #000/#FFF (not theme tokens)
	   so contrast holds against any sampled cell color. */
	.cell--center {
		position: relative;
		z-index: 1; /* lift the rings above sibling cells */
	}

	.cell--center::before,
	.cell--center::after {
		content: '';
		position: absolute;
		pointer-events: none;
		box-sizing: border-box;
	}

	/* Outer black ring: sits 4px..2px outside the cell edge. */
	.cell--center::before {
		inset: -4px;
		border: 2px solid #000;
	}

	/* Inner white ring: sits 2px..0px outside the cell edge (flush with it). */
	.cell--center::after {
		inset: -2px;
		border: 2px solid #fff;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		border-radius: var(--ds-radius-sm);
		background: var(--ds-bg-surface);
	}

	.swatch {
		width: 16px;
		height: 16px;
		border-radius: 3px;
		border: 1px solid var(--ds-border);
		box-sizing: border-box;
	}

	.hex {
		font-family: var(--ds-font-mono);
		font-size: var(--ds-font-size-sm);
		color: var(--ds-text-primary);
	}

	.hex--muted {
		color: var(--ds-text-tertiary);
	}
</style>
