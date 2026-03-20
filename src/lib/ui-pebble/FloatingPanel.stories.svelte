<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import FloatingPanel from './FloatingPanel.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div class="pebble-editor pebble-story-bg">
		<FloatingPanel>
			<span style="color: #2D2D2D; font-size: 14px;">Panel content</span>
		</FloatingPanel>
	</div>
</Story>

<Story name="CustomClass">
	<div class="pebble-editor pebble-story-bg">
		<FloatingPanel class="custom">
			<span style="color: #2D2D2D; font-size: 14px;">With custom class</span>
		</FloatingPanel>
	</div>
</Story>

<style>
	.pebble-story-bg {
		background: #EFECE8;
		padding: 40px;
	}
</style>
