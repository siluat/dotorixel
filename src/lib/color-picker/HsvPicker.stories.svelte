<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import HsvPicker from './HsvPicker.svelte';

	const { Story } = defineMeta({});
</script>

<script lang="ts">
	let defaultColor = $state('#ff0000');
	let redColor = $state('#ff0000');
	let grayColor = $state('#808080');
</script>

<Story name="Default">
	<div class="story-bg">
		<HsvPicker selectedColor={defaultColor} onColorChange={(c) => (defaultColor = c)} />
		<div class="preview" style:background-color={defaultColor}>
			<span>{defaultColor}</span>
		</div>
	</div>
</Story>

<Story name="RedSelected">
	<div class="story-bg">
		<HsvPicker selectedColor={redColor} onColorChange={(c) => (redColor = c)} />
		<div class="preview" style:background-color={redColor}>
			<span>{redColor}</span>
		</div>
	</div>
</Story>

<Story name="GraySelected">
	<div class="story-bg">
		<HsvPicker selectedColor={grayColor} onColorChange={(c) => (grayColor = c)} />
		<div class="preview" style:background-color={grayColor}>
			<span>{grayColor}</span>
		</div>
	</div>
</Story>

<style>
	.story-bg {
		background: #2a2a2a;
		padding: 24px;
		display: flex;
		align-items: flex-start;
		gap: 16px;
	}

	.preview {
		width: 60px;
		height: 60px;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 4px;
		display: flex;
		align-items: flex-end;
		padding: 4px;
	}

	.preview span {
		font-family: monospace;
		font-size: 10px;
		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
	}
</style>
