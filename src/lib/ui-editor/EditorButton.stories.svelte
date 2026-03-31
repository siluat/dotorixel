<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import EditorButton from './EditorButton.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div class="editor-story-bg">
		<EditorButton title="Undo">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h13a4 4 0 0 1 0 8H7"/><path d="m3 10 4-4"/><path d="m3 10 4 4"/></svg>
		</EditorButton>
	</div>
</Story>

<Story name="Active">
	<div class="editor-story-bg">
		<EditorButton active title="Pen (active)">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352 4.352-1.32a2 2 0 0 0 .83-.497z"/></svg>
		</EditorButton>
	</div>
</Story>

<Story name="Disabled">
	<div class="editor-story-bg">
		<EditorButton disabled title="Disabled">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h13a4 4 0 0 1 0 8H7"/><path d="m3 10 4-4"/><path d="m3 10 4 4"/></svg>
		</EditorButton>
	</div>
</Story>

<Story name="AllStates">
	<div class="editor-story-bg">
		<div class="button-row">
			<EditorButton title="Default">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h13a4 4 0 0 1 0 8H7"/></svg>
			</EditorButton>
			<EditorButton active title="Active">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352 4.352-1.32a2 2 0 0 0 .83-.497z"/></svg>
			</EditorButton>
			<EditorButton disabled title="Disabled">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h13a4 4 0 0 1 0 8H7"/></svg>
			</EditorButton>
		</div>
	</div>
</Story>

<style>
	.editor-story-bg {
		background: var(--ds-bg-base);
		padding: 40px;
	}

	.button-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}
</style>
