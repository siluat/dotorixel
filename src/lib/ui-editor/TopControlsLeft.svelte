<script lang="ts">
	import { Undo2, Redo2, Grid3X3 } from 'lucide-svelte';
	import { formatShortcut } from '$lib/canvas/shortcut-display';
	import * as m from '$lib/paraglide/messages';
	import FloatingPanel from './FloatingPanel.svelte';
	import EditorButton from './EditorButton.svelte';

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
		<EditorButton title={m.action_undo()} disabled={!canUndo} shortcutHint={showShortcutHints ? formatShortcut('Z', { ctrl: true }) : undefined} onclick={onUndo}>
			<Undo2 size={18} />
		</EditorButton>
		<EditorButton title={m.action_redo()} disabled={!canRedo} shortcutHint={showShortcutHints ? formatShortcut('Y', { ctrl: true }) : undefined} onclick={onRedo}>
			<Redo2 size={18} />
		</EditorButton>
		<EditorButton title={`${m.action_toggleGrid()} (G)`} active={showGrid} shortcutHint={showShortcutHints ? 'G' : undefined} onclick={onGridToggle}>
			<Grid3X3 size={18} />
		</EditorButton>
	</FloatingPanel>
</div>

<style>
	.top-controls-left {
		position: absolute;
		top: var(--ds-space-5);
		left: var(--ds-space-5);
		z-index: 10;
	}
</style>
