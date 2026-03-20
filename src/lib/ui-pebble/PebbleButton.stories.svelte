<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PebbleButton from './PebbleButton.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div class="pebble-editor pebble-story-bg">
		<PebbleButton title="Undo">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h13a4 4 0 0 1 0 8H7"/><path d="m3 10 4-4"/><path d="m3 10 4 4"/></svg>
		</PebbleButton>
	</div>
</Story>

<Story name="Active">
	<div class="pebble-editor pebble-story-bg">
		<PebbleButton active title="Pen (active)">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352 4.352-1.32a2 2 0 0 0 .83-.497z"/></svg>
		</PebbleButton>
	</div>
</Story>

<Story name="Disabled">
	<div class="pebble-editor pebble-story-bg">
		<PebbleButton disabled title="Disabled">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h13a4 4 0 0 1 0 8H7"/><path d="m3 10 4-4"/><path d="m3 10 4 4"/></svg>
		</PebbleButton>
	</div>
</Story>

<Story name="AllStates">
	<div class="pebble-editor pebble-story-bg">
		<div class="button-row">
			<PebbleButton title="Default">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h13a4 4 0 0 1 0 8H7"/></svg>
			</PebbleButton>
			<PebbleButton active title="Active">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352 4.352-1.32a2 2 0 0 0 .83-.497z"/></svg>
			</PebbleButton>
			<PebbleButton disabled title="Disabled">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h13a4 4 0 0 1 0 8H7"/></svg>
			</PebbleButton>
		</div>
	</div>
</Story>

<style>
	.pebble-story-bg {
		background: #EFECE8;
		padding: 40px;
	}

	.button-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}
</style>
