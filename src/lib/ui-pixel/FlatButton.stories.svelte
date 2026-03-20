<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FlatButton from './FlatButton.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div class="pixel-editor pixel-story-bg">
		<FlatButton>Default</FlatButton>
	</div>
</Story>

<Story name="Primary">
	<div class="pixel-editor pixel-story-bg">
		<FlatButton variant="primary">Primary</FlatButton>
	</div>
</Story>

<Story name="Secondary">
	<div class="pixel-editor pixel-story-bg">
		<FlatButton variant="secondary">Secondary</FlatButton>
	</div>
</Story>

<Story name="NoShadow">
	<div class="pixel-editor pixel-story-bg">
		<div class="button-row">
			<FlatButton shadow={false}>Default</FlatButton>
			<FlatButton shadow={false} variant="primary">Primary</FlatButton>
			<FlatButton shadow={false} variant="secondary">Secondary</FlatButton>
		</div>
	</div>
</Story>

<Story name="Active">
	<div class="pixel-editor pixel-story-bg">
		<div class="button-row">
			<FlatButton active>Active Default</FlatButton>
			<FlatButton variant="primary" active>Active Primary</FlatButton>
			<FlatButton variant="secondary" active>Active Secondary</FlatButton>
		</div>
	</div>
</Story>

<Story name="Sizes">
	<div class="pixel-editor pixel-story-bg">
		<div class="button-row">
			<FlatButton size="sm">Small</FlatButton>
			<FlatButton size="md">Medium</FlatButton>
			<FlatButton size="icon">✎</FlatButton>
		</div>
	</div>
</Story>

<Story name="Disabled">
	<div class="pixel-editor pixel-story-bg">
		<div class="button-row">
			<FlatButton disabled>Disabled</FlatButton>
			<FlatButton variant="primary" disabled>Disabled</FlatButton>
			<FlatButton variant="secondary" disabled>Disabled</FlatButton>
		</div>
	</div>
</Story>

<Story name="AllVariants">
	<div class="pixel-editor pixel-story-bg">
		<div class="variant-grid">
			<div class="variant-row">
				<span class="variant-label">default</span>
				<FlatButton>Default</FlatButton>
				<FlatButton active>Active</FlatButton>
				<FlatButton disabled>Disabled</FlatButton>
			</div>
			<div class="variant-row">
				<span class="variant-label">primary</span>
				<FlatButton variant="primary">Primary</FlatButton>
				<FlatButton variant="primary" active>Active</FlatButton>
				<FlatButton variant="primary" disabled>Disabled</FlatButton>
			</div>
			<div class="variant-row">
				<span class="variant-label">secondary</span>
				<FlatButton variant="secondary">Secondary</FlatButton>
				<FlatButton variant="secondary" active>Active</FlatButton>
				<FlatButton variant="secondary" disabled>Disabled</FlatButton>
			</div>
			<div class="variant-row">
				<span class="variant-label">no shadow</span>
				<FlatButton shadow={false}>Default</FlatButton>
				<FlatButton shadow={false} active>Active</FlatButton>
				<FlatButton shadow={false} disabled>Disabled</FlatButton>
			</div>
			<div class="variant-row">
				<span class="variant-label">no-sh pri</span>
				<FlatButton shadow={false} variant="primary">Primary</FlatButton>
				<FlatButton shadow={false} variant="primary" active>Active</FlatButton>
				<FlatButton shadow={false} variant="primary" disabled>Disabled</FlatButton>
			</div>
			<div class="variant-row">
				<span class="variant-label">no-sh sec</span>
				<FlatButton shadow={false} variant="secondary">Secondary</FlatButton>
				<FlatButton shadow={false} variant="secondary" active>Active</FlatButton>
				<FlatButton shadow={false} variant="secondary" disabled>Disabled</FlatButton>
			</div>
			<div class="variant-row">
				<span class="variant-label">sizes</span>
				<FlatButton size="sm">SM</FlatButton>
				<FlatButton size="md">MD</FlatButton>
				<FlatButton size="icon">✎</FlatButton>
			</div>
		</div>
	</div>
</Story>

<style>
	.pixel-story-bg {
		background: oklch(0.96 0.02 75);
		padding: 16px;
	}

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
