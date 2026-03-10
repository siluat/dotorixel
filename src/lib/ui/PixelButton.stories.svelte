<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PixelButton from './PixelButton.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<PixelButton>Default</PixelButton>
</Story>

<Story name="Primary">
	<PixelButton variant="primary">Primary</PixelButton>
</Story>

<Story name="Secondary">
	<PixelButton variant="secondary">Secondary</PixelButton>
</Story>

<Story name="Active">
	<div class="button-row">
		<PixelButton active>Active Default</PixelButton>
		<PixelButton variant="primary" active>Active Primary</PixelButton>
	</div>
</Story>

<Story name="Sizes">
	<div class="button-row">
		<PixelButton size="sm">Small</PixelButton>
		<PixelButton size="md">Medium</PixelButton>
		<PixelButton size="icon">✎</PixelButton>
	</div>
</Story>

<Story name="Disabled">
	<div class="button-row">
		<PixelButton disabled>Disabled</PixelButton>
		<PixelButton variant="primary" disabled>Disabled</PixelButton>
		<PixelButton variant="secondary" disabled>Disabled</PixelButton>
	</div>
</Story>

<Story name="AllVariants">
	<div class="variant-grid">
		<div class="variant-row">
			<span class="variant-label">default</span>
			<PixelButton>Default</PixelButton>
			<PixelButton active>Active</PixelButton>
			<PixelButton disabled>Disabled</PixelButton>
		</div>
		<div class="variant-row">
			<span class="variant-label">primary</span>
			<PixelButton variant="primary">Primary</PixelButton>
			<PixelButton variant="primary" active>Active</PixelButton>
			<PixelButton variant="primary" disabled>Disabled</PixelButton>
		</div>
		<div class="variant-row">
			<span class="variant-label">secondary</span>
			<PixelButton variant="secondary">Secondary</PixelButton>
			<PixelButton variant="secondary" active>Active</PixelButton>
			<PixelButton variant="secondary" disabled>Disabled</PixelButton>
		</div>
		<div class="variant-row">
			<span class="variant-label">sizes</span>
			<PixelButton size="sm">SM</PixelButton>
			<PixelButton size="md">MD</PixelButton>
			<PixelButton size="icon">✎</PixelButton>
		</div>
	</div>
</Story>

<style>
	.button-row {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.variant-grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.variant-row {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.variant-label {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--color-muted-fg);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		width: 80px;
		flex-shrink: 0;
	}
</style>
