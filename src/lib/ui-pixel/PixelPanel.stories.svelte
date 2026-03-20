<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PixelPanel from './PixelPanel.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div class="pixel-editor pixel-story-bg">
		<PixelPanel>
			<p class="demo-text">Default panel — flat border, neutral surface.</p>
		</PixelPanel>
	</div>
</Story>

<Story name="Inset">
	<div class="pixel-editor pixel-story-bg">
		<PixelPanel variant="inset">
			<p class="demo-text">Inset panel — shadow on top-left, looks pressed in.</p>
		</PixelPanel>
	</div>
</Story>

<Story name="Raised">
	<div class="pixel-editor pixel-story-bg">
		<PixelPanel variant="raised">
			<p class="demo-text">Raised panel — highlight on top-left, looks elevated.</p>
		</PixelPanel>
	</div>
</Story>

<Story name="AllVariants">
	<div class="pixel-editor pixel-story-bg">
		<div class="variant-grid">
			<div class="variant-item">
				<span class="variant-label">default</span>
				<PixelPanel>
					<p class="demo-text">Default</p>
				</PixelPanel>
			</div>
			<div class="variant-item">
				<span class="variant-label">inset</span>
				<PixelPanel variant="inset">
					<p class="demo-text">Inset</p>
				</PixelPanel>
			</div>
			<div class="variant-item">
				<span class="variant-label">raised</span>
				<PixelPanel variant="raised">
					<p class="demo-text">Raised</p>
				</PixelPanel>
			</div>
		</div>
	</div>
</Story>

<style>
	.pixel-story-bg {
		background: oklch(0.96 0.02 75);
		padding: 16px;
	}

	.demo-text {
		margin: 0;
		font-family: var(--font-body);
		font-size: 16px;
	}

	.variant-grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		max-width: 400px;
	}

	.variant-item {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.variant-label {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-muted-fg);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
