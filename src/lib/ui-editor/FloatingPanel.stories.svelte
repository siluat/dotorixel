<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FloatingPanel from './FloatingPanel.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div class="editor-story-bg">
		<FloatingPanel>
			<span style="color: var(--ds-text-primary); font-size: var(--ds-font-size-md);">Panel content</span>
		</FloatingPanel>
	</div>
</Story>

<Story name="CustomClass">
	<div class="editor-story-bg">
		<FloatingPanel class="custom">
			<span style="color: var(--ds-text-primary); font-size: var(--ds-font-size-md);">With custom class</span>
		</FloatingPanel>
	</div>
</Story>

<style>
	.editor-story-bg {
		background: var(--ds-bg-base);
		padding: 40px;
	}
</style>
