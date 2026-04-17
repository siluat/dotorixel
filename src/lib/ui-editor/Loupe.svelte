<script lang="ts">
	import type { Color } from '$lib/canvas/color';
	import { colorToHex } from '$lib/canvas/color';
	import {
		computeLoupePosition,
		type LoupeInputSource
	} from '$lib/canvas/loupe-position';

	// Loupe outer dimensions (border-box) derived from the design spec.
	// Each building block names a single CSS value below — change one here and
	// in the CSS together; the totals re-derive automatically.
	const CELL_SIZE_PX = 24; // .cell width/height
	const GRID_COLUMNS = 9; // .grid grid-template-columns repeat count
	const CELL_GAP_PX = 1; // .grid `gap`
	const PADDING_PX = 8; // .loupe `padding` (= --ds-space-3)
	const BORDER_PX = 1; // .loupe `border` width (= --ds-border-width)
	const GRID_CHIP_GAP_PX = 8; // .loupe `gap` between grid and chip (= --ds-space-3)
	const CHIP_HEIGHT_PX = 24; // .chip height: 4px×2 padding + 16px swatch
	const GRID_PIXELS = CELL_SIZE_PX * GRID_COLUMNS + CELL_GAP_PX * (GRID_COLUMNS - 1);
	const LOUPE_WIDTH = GRID_PIXELS + PADDING_PX * 2 + BORDER_PX * 2;
	const LOUPE_HEIGHT =
		GRID_PIXELS + GRID_CHIP_GAP_PX + CHIP_HEIGHT_PX + PADDING_PX * 2 + BORDER_PX * 2;
	const MOUSE_OFFSET = 20;
	const TOUCH_OFFSET = 80;

	interface Props {
		/**
		 * 9×9 row-major grid of sampled colors (81 entries). Cells whose
		 * canvas coordinates fall outside the canvas are `null`; transparent
		 * pixels are a `Color` with `a === 0`.
		 */
		grid: readonly (Color | null)[];
		/** Pointer position in viewport coordinates; `null` hides the loupe. */
		screenPointer: { x: number; y: number } | null;
		/**
		 * Visible viewport dimensions in pixels (typically `window.innerWidth`
		 * × `window.innerHeight`). Used to flip/clamp the loupe so it stays
		 * fully on-screen near viewport edges.
		 */
		viewport: { width: number; height: number };
		/** Picks between the mouse (20px symmetric) and touch (80px vertical, centered horizontally) offset presets. */
		inputSource: LoupeInputSource;
	}

	let { grid, screenPointer, viewport, inputSource }: Props = $props();

	const centerIndex = $derived((grid.length - 1) / 2);
	// The chip reflects the CURRENT center cell, not the session's preserved
	// last-opaque color. This keeps the em-dash + patterned swatch honest when
	// a drag drifts onto null/transparent pixels.
	const centerCell = $derived<Color | null>(grid[centerIndex] ?? null);
	const EM_DASH = '—';

	// The authoritative "commit eligible" check lives in sampling-session;
	// `alpha > 0` is a sufficient UI approximation for the hex chip.
	const canonicalHex = $derived(
		centerCell && centerCell.a > 0 ? colorToHex(centerCell) : null
	);
	const displayHex = $derived(canonicalHex ? canonicalHex.toUpperCase() : null);

	const position = $derived(
		screenPointer
			? computeLoupePosition({
					pointer: screenPointer,
					viewport,
					loupe: { width: LOUPE_WIDTH, height: LOUPE_HEIGHT },
					mouseOffset: MOUSE_OFFSET,
					touchOffset: TOUCH_OFFSET,
					inputSource
				})
			: null
	);
</script>

{#if screenPointer && position}
	<div
		class="loupe"
		data-testid="loupe-root"
		role="presentation"
		style:left="{position.x}px"
		style:top="{position.y}px"
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
{/if}

<style>
	.loupe {
		/* `left` / `top` are set inline from `computeLoupePosition` (positions
		   the loupe to stay fully on-screen even near viewport edges). */
		--cell-size: 24px;
		--grid-columns: 9;

		position: fixed;
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
		padding: 4px 8px;
		border-radius: var(--ds-radius-sm);
		background: var(--ds-bg-surface);
	}

	.swatch {
		--swatch-size: 16px;
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
		/* Locks to 16px (matches .swatch height) so CHIP_HEIGHT_PX = 24 stays
		   accurate — default normal line-height (~17px) would add a 1px drift
		   through the positioning math. */
		line-height: 16px;
		color: var(--ds-text-primary);
	}

	.hex--muted {
		color: var(--ds-text-tertiary);
	}
</style>
