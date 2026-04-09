<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import type { SavedDocumentSummary } from '$lib/session/session-storage-types';
	import SavedWorkCardGrid from './SavedWorkCardGrid.svelte';
	import BottomSheet from '$lib/ui/BottomSheet.svelte';

	interface Props {
		open: boolean;
		documents: SavedDocumentSummary[];
		onSelect: (doc: SavedDocumentSummary) => void;
		onDelete: (id: string) => void | Promise<void>;
		onClose: () => void;
	}

	let { open, documents, onSelect, onDelete, onClose }: Props = $props();
</script>

<BottomSheet {open} onclose={onClose}>
	<div class="browser-sheet">
		<div class="drag-handle"></div>
		<h2 class="browser-sheet-title">{m.browser_title()}</h2>

		<div class="browser-sheet-body">
			<SavedWorkCardGrid
				{documents}
				{onSelect}
				{onDelete}
			/>
		</div>
	</div>
</BottomSheet>

<style>
	.browser-sheet {
		display: flex;
		flex-direction: column;
		background: var(--ds-bg-elevated);
		border-radius: 16px 16px 0 0;
		max-height: 85vh;
		padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
	}

	.browser-sheet-title {
		margin: 0;
		padding: 0 20px;
		font-family: var(--ds-font-body);
		font-size: 16px;
		font-weight: 600;
		color: var(--ds-text-primary);
	}

	.drag-handle {
		width: 36px;
		height: 4px;
		margin: 12px auto 16px;
		border-radius: 2px;
		background: var(--ds-border);
		flex-shrink: 0;
	}

	.browser-sheet-body {
		overflow-y: auto;
		padding: 16px 20px 0;
		flex: 1;
		min-height: 0;
	}
</style>
