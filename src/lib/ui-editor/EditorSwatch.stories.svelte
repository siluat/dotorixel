<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import EditorSwatch from './EditorSwatch.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div class="editor-story-bg">
		<EditorSwatch color="#E8729A" />
	</div>
</Story>

<Story name="Selected">
	<div class="editor-story-bg">
		<EditorSwatch color="#E8729A" selected />
	</div>
</Story>

<Story name="Sizes">
	<div class="editor-story-bg">
		<div class="swatch-row">
			<EditorSwatch color="#F4A7B9" size="sm" />
			<EditorSwatch color="#F4A7B9" size="lg" />
		</div>
	</div>
</Story>

<Story name="WhiteBorder">
	<div class="editor-story-bg">
		<div class="swatch-row">
			<EditorSwatch color="#FFFFFF" />
			<EditorSwatch color="#FFFFFF" selected />
		</div>
	</div>
</Story>

<Story name="PalettePreview">
	<div class="editor-story-bg">
		<div class="swatch-grid">
			<EditorSwatch color="#2D2D2D" />
			<EditorSwatch color="#FFFFFF" />
			<EditorSwatch color="#E8729A" selected />
			<EditorSwatch color="#F4A7B9" />
			<EditorSwatch color="#FDDDE6" />
			<EditorSwatch color="#FFC0CB" />
			<EditorSwatch color="#FF8A65" />
			<EditorSwatch color="#FFD54F" />
			<EditorSwatch color="#FFEE58" />
		</div>
	</div>
</Story>

<style>
	.editor-story-bg {
		background: var(--ds-bg-base);
		padding: 40px;
	}

	.swatch-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.swatch-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
</style>
