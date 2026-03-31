<script lang="ts">
	interface Props {
		foregroundColor: string;
		backgroundColor: string;
		recentColors: string[];
		onForegroundColorChange: (hex: string) => void;
	}

	let { foregroundColor, backgroundColor, recentColors, onForegroundColorChange }: Props = $props();
</script>

<div class="color-bar">
	<div class="fg-swatch" style:background={foregroundColor}></div>
	<div class="bg-swatch" style:background={backgroundColor}></div>

	{#if recentColors.length > 0}
		<div class="separator"></div>

		<div class="swatches">
			{#each recentColors as color}
				<button
					class="swatch"
					style:background={color}
					class:white={color.toLowerCase() === '#ffffff'}
					onclick={() => onForegroundColorChange(color)}
					aria-label="Recent color {color}"
				></button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.color-bar {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 48px;
		padding: 0 12px;
		background: var(--ds-bg-surface);
		flex-shrink: 0;
	}

	@media (min-width: 600px) {
		.color-bar {
			height: 52px;
			padding: 0 16px;
			gap: 8px;
		}
	}

	.fg-swatch {
		width: 32px;
		height: 32px;
		border-radius: 6px;
		border: 2px solid var(--ds-accent);
		padding: 0;
		flex-shrink: 0;
	}

	@media (min-width: 600px) {
		.fg-swatch {
			width: 36px;
			height: 36px;
		}
	}

	.bg-swatch {
		width: 32px;
		height: 32px;
		border-radius: 6px;
		border: 1px solid var(--ds-border);
		padding: 0;
		flex-shrink: 0;
	}

	@media (min-width: 600px) {
		.bg-swatch {
			width: 36px;
			height: 36px;
		}
	}

	.separator {
		width: 1px;
		height: 28px;
		background: var(--ds-border-subtle);
		flex-shrink: 0;
	}

	@media (min-width: 600px) {
		.separator {
			height: 32px;
		}
	}

	.swatches {
		display: flex;
		gap: 6px;
		overflow: visible;
	}

	@media (min-width: 600px) {
		.swatches {
			gap: 8px;
		}
	}

	.swatch {
		width: 26px;
		height: 26px;
		border-radius: 4px;
		border: none;
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
	}

	@media (min-width: 600px) {
		.swatch {
			width: 30px;
			height: 30px;
		}
	}

	.swatch.white {
		border: 1px solid var(--ds-border);
	}

	.swatch:hover {
		transform: scale(1.1);
	}
</style>
