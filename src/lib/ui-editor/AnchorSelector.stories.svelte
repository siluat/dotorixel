<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AnchorSelector from './AnchorSelector.svelte';

	const { Story } = defineMeta({});

	const noop = () => {};
</script>

<Story name="TopLeftSelected">
	<div class="editor-story-bg">
		<AnchorSelector selected="top-left" onSelect={noop} />
	</div>
</Story>

<Story name="CenterSelected">
	<div class="editor-story-bg">
		<AnchorSelector selected="center" onSelect={noop} />
	</div>
</Story>

<Story name="BottomRightSelected">
	<div class="editor-story-bg">
		<AnchorSelector selected="bottom-right" onSelect={noop} />
	</div>
</Story>

<style>
	.editor-story-bg {
		background: var(--ds-bg-base);
		padding: 40px;
	}
</style>
