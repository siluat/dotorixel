<script lang="ts">
	import { Undo2, Redo2, Grid3X3 } from 'lucide-svelte';
	import { formatShortcut } from '$lib/canvas/shortcut-display';
	import FloatingPanel from './FloatingPanel.svelte';
	import PebbleButton from './PebbleButton.svelte';

	interface Props {
		canUndo: boolean;
		canRedo: boolean;
		showGrid: boolean;
		showShortcutHints?: boolean;
		onUndo: () => void;
		onRedo: () => void;
		onGridToggle: () => void;
	}

	let { canUndo, canRedo, showGrid, showShortcutHints = false, onUndo, onRedo, onGridToggle }: Props = $props();
</script>

<div class="top-controls-left">
	<FloatingPanel>
		<PebbleButton title="Undo" disabled={!canUndo} shortcutHint={showShortcutHints ? formatShortcut('Z', { ctrl: true }) : undefined} onclick={onUndo}>
			<Undo2 size={18} />
		</PebbleButton>
		<PebbleButton title="Redo" disabled={!canRedo} shortcutHint={showShortcutHints ? formatShortcut('Y', { ctrl: true }) : undefined} onclick={onRedo}>
			<Redo2 size={18} />
		</PebbleButton>
		<PebbleButton title="Toggle Grid (G)" active={showGrid} shortcutHint={showShortcutHints ? 'G' : undefined} onclick={onGridToggle}>
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
