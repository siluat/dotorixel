<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import BevelButton from './BevelButton.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<BevelButton>Default</BevelButton>
</Story>

<Story name="Primary">
	<BevelButton variant="primary">Primary</BevelButton>
</Story>

<Story name="Secondary">
	<BevelButton variant="secondary">Secondary</BevelButton>
</Story>

<Story name="Active">
	<div class="button-row">
		<BevelButton active>Active Default</BevelButton>
		<BevelButton variant="primary" active>Active Primary</BevelButton>
	</div>
</Story>

<Story name="Sizes">
	<div class="button-row">
		<BevelButton size="sm">Small</BevelButton>
		<BevelButton size="md">Medium</BevelButton>
		<BevelButton size="icon">✎</BevelButton>
	</div>
</Story>

<Story name="Disabled">
	<div class="button-row">
		<BevelButton disabled>Disabled</BevelButton>
		<BevelButton variant="primary" disabled>Disabled</BevelButton>
		<BevelButton variant="secondary" disabled>Disabled</BevelButton>
	</div>
</Story>

<Story name="AllVariants">
	<div class="variant-grid">
		<div class="variant-row">
			<span class="variant-label">default</span>
			<BevelButton>Default</BevelButton>
			<BevelButton active>Active</BevelButton>
			<BevelButton disabled>Disabled</BevelButton>
		</div>
		<div class="variant-row">
			<span class="variant-label">primary</span>
			<BevelButton variant="primary">Primary</BevelButton>
			<BevelButton variant="primary" active>Active</BevelButton>
			<BevelButton variant="primary" disabled>Disabled</BevelButton>
		</div>
		<div class="variant-row">
			<span class="variant-label">secondary</span>
			<BevelButton variant="secondary">Secondary</BevelButton>
			<BevelButton variant="secondary" active>Active</BevelButton>
			<BevelButton variant="secondary" disabled>Disabled</BevelButton>
		</div>
		<div class="variant-row">
			<span class="variant-label">sizes</span>
			<BevelButton size="sm">SM</BevelButton>
			<BevelButton size="md">MD</BevelButton>
			<BevelButton size="icon">✎</BevelButton>
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
