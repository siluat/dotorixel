<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FgBgPreview from './FgBgPreview.svelte';

	const { Story } = defineMeta({});
</script>

<script lang="ts">
	let interactiveFg = $state('#000000');
	let interactiveBg = $state('#ffffff');

	function handleSwap(): void {
		const temp = interactiveFg;
		interactiveFg = interactiveBg;
		interactiveBg = temp;
	}
</script>

<Story name="Default">
	<div class="story-bg">
		<FgBgPreview foregroundColor="#000000" backgroundColor="#ffffff" />
	</div>
</Story>

<Story name="WithSwapButton">
	<div class="story-bg">
		<FgBgPreview foregroundColor="#ff0000" backgroundColor="#0000ff" onSwapColors={() => {}} />
	</div>
</Story>

<Story name="PixelTheme">
	<div class="story-bg pixel-theme">
		<FgBgPreview foregroundColor="#1e90ff" backgroundColor="#ffd700" onSwapColors={() => {}} />
	</div>
</Story>

<Story name="PebbleTheme">
	<div class="story-bg pebble-theme">
		<FgBgPreview foregroundColor="#2d2d2d" backgroundColor="#ffffff" onSwapColors={() => {}} />
	</div>
</Story>

<Story name="Interactive">
	<div class="story-bg">
		<FgBgPreview foregroundColor={interactiveFg} backgroundColor={interactiveBg} onSwapColors={handleSwap} />
		<div class="label">FG: {interactiveFg} / BG: {interactiveBg}</div>
	</div>
</Story>

<style>
	.story-bg {
		background: #e0e0e0;
		padding: 24px;
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.label {
		font-family: monospace;
		font-size: 12px;
		color: #333;
	}

	.pixel-theme {
		--fgbg-size: 50px;
		--fgbg-swatch-size: 30px;
		--fgbg-border-color: #666;
		--fgbg-swatch-border-width: 1px 2px 2px 1px;
		--fgbg-swap-size: 18px;
		--fgbg-swap-bg: #d4d0c8;
		--fgbg-swap-border-width: 1px;
		--fgbg-swap-color: #333;
		--fgbg-swap-hover-bg: #c0bdb5;
	}

	.pebble-theme {
		background: #efece8;
		--fgbg-size: 44px;
		--fgbg-swatch-size: 28px;
		--fgbg-border-color: #c8c4be;
		--fgbg-swatch-radius: 6px;
		--fgbg-swap-size: 20px;
		--fgbg-swap-inset: -2px;
		--fgbg-swap-radius: 50%;
		--fgbg-swap-border-width: 1px;
		--fgbg-swap-bg: #f5f2ee;
		--fgbg-swap-color: #5c5549;
		--fgbg-swap-hover-bg: rgba(0, 0, 0, 0.05);
	}
</style>
