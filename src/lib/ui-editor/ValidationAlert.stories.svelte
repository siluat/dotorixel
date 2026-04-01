<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ValidationAlert from './ValidationAlert.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div class="editor-story-bg">
		<div class="story-container">
			<ValidationAlert message="Must be between 1 and 128" />
		</div>
	</div>
</Story>

<Story name="LongMessage">
	<div class="editor-story-bg">
		<div class="story-container">
			<ValidationAlert message="The value you entered exceeds the maximum allowed canvas dimension of 128 pixels" />
		</div>
	</div>
</Story>

<style>
	.editor-story-bg {
		background: var(--ds-bg-base);
		padding: 40px;
	}

	.story-container {
		max-width: 320px;
	}
</style>
