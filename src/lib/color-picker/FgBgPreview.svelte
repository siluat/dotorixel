<script lang="ts">
	interface Props {
		foregroundColor: string;
		backgroundColor: string;
		onSwapColors?: () => void;
		onForegroundClick?: () => void;
		onBackgroundClick?: () => void;
	}

	let { foregroundColor, backgroundColor, onSwapColors, onForegroundClick, onBackgroundClick }: Props = $props();
</script>

<div
	class="fg-bg-preview"
	role="group"
	aria-label={`Foreground color ${foregroundColor}, background color ${backgroundColor}`}
>
	{#if onBackgroundClick}
		<button
			class="swatch swatch-bg checkerboard swatch-bg-button"
			aria-label="Open background color picker"
			onclick={onBackgroundClick}
		>
			<div class="swatch-fill" style:background-color={backgroundColor}></div>
		</button>
	{:else}
		<div class="swatch swatch-bg checkerboard">
			<div class="swatch-fill" style:background-color={backgroundColor}></div>
		</div>
	{/if}
	{#if onForegroundClick}
		<button
			class="swatch swatch-fg checkerboard swatch-fg-button"
			aria-label="Open foreground color picker"
			onclick={onForegroundClick}
		>
			<div class="swatch-fill" style:background-color={foregroundColor}></div>
		</button>
	{:else}
		<div class="swatch swatch-fg checkerboard">
			<div class="swatch-fill" style:background-color={foregroundColor}></div>
		</div>
	{/if}
	{#if onSwapColors}
		<button
			class="swap-button"
			aria-label="Swap foreground and background colors"
			onclick={onSwapColors}
		>
			<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
				<path d="M1 4h8L7 2M11 8H3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		</button>
	{/if}
</div>

<style>
	.fg-bg-preview {
		position: relative;
		width: var(--fgbg-size, 50px);
		height: var(--fgbg-size, 50px);
		flex-shrink: 0;
	}

	.checkerboard {
		background-image:
			linear-gradient(45deg, var(--fgbg-checker-color, #ccc) 25%, transparent 25%),
			linear-gradient(-45deg, var(--fgbg-checker-color, #ccc) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, var(--fgbg-checker-color, #ccc) 75%),
			linear-gradient(-45deg, transparent 75%, var(--fgbg-checker-color, #ccc) 75%);
		background-size: 8px 8px;
		background-position: 0 0, 0 4px, 4px -4px, -4px 0;
	}

	.swatch-fill {
		width: 100%;
		height: 100%;
	}

	.swatch {
		position: absolute;
		width: var(--fgbg-swatch-size, 30px);
		height: var(--fgbg-swatch-size, 30px);
		border-style: solid;
		border-color: var(--fgbg-border-color, currentColor);
		border-width: var(--fgbg-swatch-border-width, 1px);
		border-radius: var(--fgbg-swatch-radius, 0);
		overflow: hidden;
	}

	.swatch-fg {
		top: 0;
		left: 0;
		z-index: 1;
	}

	.swatch-fg-button,
	.swatch-bg-button {
		background-color: transparent;
		padding: 0;
		font: inherit;
		cursor: pointer;
	}

	.swatch-bg {
		bottom: 0;
		right: 0;
	}

	.swap-button {
		position: absolute;
		top: var(--fgbg-swap-inset, 0);
		right: var(--fgbg-swap-inset, 0);
		width: var(--fgbg-swap-size, 18px);
		height: var(--fgbg-swap-size, 18px);
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--fgbg-swap-bg, white);
		border-style: solid;
		border-width: var(--fgbg-swap-border-width, 1px);
		border-color: var(--fgbg-border-color, currentColor);
		border-radius: var(--fgbg-swap-radius, 0);
		color: var(--fgbg-swap-color, currentColor);
		cursor: pointer;
		z-index: 2;
		transition: background 0.12s ease;
	}

	.swap-button:hover {
		background: var(--fgbg-swap-hover-bg, #eee);
	}
</style>
