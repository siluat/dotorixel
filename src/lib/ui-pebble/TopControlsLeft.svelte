<script lang="ts">
	import { Undo2, Redo2, Grid3X3 } from 'lucide-svelte';
	import FloatingPanel from './FloatingPanel.svelte';
	import PebbleButton from './PebbleButton.svelte';

	interface Props {
		canUndo: boolean;
		canRedo: boolean;
		showGrid: boolean;
		onUndo: () => void;
		onRedo: () => void;
		onGridToggle: () => void;
	}

	let { canUndo, canRedo, showGrid, onUndo, onRedo, onGridToggle }: Props = $props();
</script>

<div class="top-controls-left">
	<FloatingPanel>
		<PebbleButton title="Undo" disabled={!canUndo} onclick={onUndo}>
			<Undo2 size={18} />
		</PebbleButton>
		<PebbleButton title="Redo" disabled={!canRedo} onclick={onRedo}>
			<Redo2 size={18} />
		</PebbleButton>
		<PebbleButton title="Toggle Grid" active={showGrid} onclick={onGridToggle}>
			<Grid3X3 size={18} />
		</PebbleButton>
	</FloatingPanel>
</div>

<style>
	.top-controls-left {
		position: absolute;
		top: var(--pebble-edge-gap);
		left: var(--pebble-edge-gap);
		z-index: 10;
	}
</style>
