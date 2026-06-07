<script lang="ts">
	import type { Color } from '$lib/canvas/color';
	import { colorToHex } from '$lib/canvas/color';
	import {
		BORDER_PX,
		CELL_GAP_PX,
		CELL_SIZE_PX,
		CHIP_PADDING_Y_PX,
		GRID_CHIP_GAP_PX,
		GRID_SIZE,
		PADDING_PX,
		SWATCH_SIZE_PX
	} from '$lib/canvas/sampling/loupe-config';

	interface Props {
		/**
		 * 9×9 row-major grid of sampled colors (81 entries). Cells whose
		 * canvas coordinates fall outside the canvas are `null`; transparent
		 * pixels are a `Color` with `a === 0`.
		 */
		grid: readonly (Color | null)[];
		/** Window-coord top-left of the loupe overlay, already flipped/clamped by the sampling session. */
		position: { x: number; y: number };
	}

	let { grid, position }: Props = $props();

	const centerIndex = $derived((grid.length - 1) / 2);
	// The chip reflects the CURRENT center cell, not the session's preserved
	// last-opaque color. This keeps the em-dash + patterned swatch honest when
	// a drag drifts onto null/transparent pixels.
	const centerCell = $derived<Color | null>(grid[centerIndex] ?? null);
	const EM_DASH = '—';

	// The authoritative "commit eligible" check lives in `sampling/session`;
	// `alpha > 0` is a sufficient UI approximation for the hex chip.
	const canonicalHex = $derived(
		centerCell && centerCell.a > 0 ? colorToHex(centerCell) : null
	);
	const displayHex = $derived(canonicalHex ? canonicalHex.toUpperCase() : null);
</script>

<div
	class="loupe"
	data-testid="loupe-root"
	role="presentation"
	style:left="{position.x}px"
	style:top="{position.y}px"
	style:--cell-size="{CELL_SIZE_PX}px"
	style:--grid-columns={GRID_SIZE}
	style:--cell-gap="{CELL_GAP_PX}px"
	style:--loupe-border-width="{BORDER_PX}px"
	style:--loupe-padding="{PADDING_PX}px"
	style:--grid-chip-gap="{GRID_CHIP_GAP_PX}px"
	style:--swatch-size="{SWATCH_SIZE_PX}px"
	style:--chip-padding-y="{CHIP_PADDING_Y_PX}px"
>
	<div class="grid" role="presentation">
		{#each grid as color, i (i)}
			<div
				class="cell"
				class:cell--center={i === centerIndex}
				class:cell--out-of-canvas={color === null}
				class:cell--transparent={color !== null && color.a === 0}
				style:background-color={color !== null && color.a > 0
					? `rgb(${color.r}, ${color.g}, ${color.b})`
					: null}
			></div>
		{/each}
	</div>
	<div class="chip" data-testid="loupe-hex-chip">
		<div
			class="swatch"
			class:swatch--out-of-canvas={centerCell === null}
			class:swatch--transparent={centerCell !== null && centerCell.a === 0}
			style:background-color={canonicalHex}
		></div>
		<span class="hex" class:hex--muted={displayHex === null} data-testid="loupe-hex-text">
			{displayHex ?? EM_DASH}
		</span>
	</div>
</div>

<style>
	.loupe {
		/* `left` / `top` and every `--*` geometry token are set inline (see the
		   `style:` bindings above) from `loupe-config.ts`, so the rendered box
		   and the position math's LOUPE_WIDTH/HEIGHT share one source. */
		position: fixed;
		pointer-events: none;
		z-index: 1000;

		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--grid-chip-gap);
		padding: var(--loupe-padding);

		background: var(--ds-bg-elevated);
		border: var(--loupe-border-width) solid var(--ds-border);
		border-radius: var(--ds-radius-md);
		box-shadow: var(--ds-shadow-md);
	}

	.grid {
		/* Gridlines are rendered by the gap showing through the --ds-border background. */
		display: grid;
		grid-template-columns: repeat(var(--grid-columns), var(--cell-size));
		grid-template-rows: repeat(var(--grid-columns), var(--cell-size));
		gap: var(--cell-gap);
		background: var(--ds-border);
	}

	.cell {
		width: var(--cell-size);
		height: var(--cell-size);
	}

	/* Out-of-canvas cells: diagonal hatch (45°) over surface tone so the
	   user can tell "no pixel here" from "transparent pixel". */
	.cell--out-of-canvas {
		background-color: var(--ds-bg-surface);
		background-image: repeating-linear-gradient(
			45deg,
			var(--ds-text-tertiary) 0 2px,
			transparent 2px 6px
		);
	}

	/* Transparent pixels: 2×2 checkerboard of 12px sub-cells (half of cell
	   size). Literals #FFFFFF / #E0E0E0 match the canvas renderer's checker
	   so the transparency signal is consistent across the app. */
	.cell--transparent {
		background-color: #ffffff;
		background-image:
			linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%),
			linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%);
		background-size: var(--cell-size) var(--cell-size);
		background-position:
			0 0,
			calc(var(--cell-size) / 2) calc(var(--cell-size) / 2);
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
		/* Vertical padding feeds CHIP_HEIGHT_PX (and thus LOUPE_HEIGHT), so it
		   comes from loupe-config; horizontal padding is free spacing on the
		   shared --ds-space-3 token. */
		padding: var(--chip-padding-y) var(--ds-space-3);
		border-radius: var(--ds-radius-sm);
		background: var(--ds-bg-surface);
	}

	.swatch {
		/* `--swatch-size` is inherited from `.loupe` (set inline from loupe-config). */
		width: var(--swatch-size);
		height: var(--swatch-size);
		border-radius: 3px;
		border: 1px solid var(--ds-border);
		box-sizing: border-box;
	}

	/* Swatch patterns mirror the corresponding cell patterns so the chip
	   tells the user which kind of "no color" state the center is in. */
	.swatch--out-of-canvas {
		background-color: var(--ds-bg-surface);
		background-image: repeating-linear-gradient(
			45deg,
			var(--ds-text-tertiary) 0 1px,
			transparent 1px 3px
		);
	}

	.swatch--transparent {
		background-color: #ffffff;
		background-image:
			linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%),
			linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%);
		background-size: var(--swatch-size) var(--swatch-size);
		background-position:
			0 0,
			calc(var(--swatch-size) / 2) calc(var(--swatch-size) / 2);
	}

	.hex {
		font-family: var(--ds-font-mono);
		font-size: var(--ds-font-size-sm);
		/* Locked to the swatch height so the chip row stays exactly
		   CHIP_HEIGHT_PX — a default normal line-height (~17px) would add ~1px
		   of drift into the positioning math. */
		line-height: var(--swatch-size);
		color: var(--ds-text-primary);
	}

	.hex--muted {
		color: var(--ds-text-tertiary);
	}
</style>
