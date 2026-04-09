<script lang="ts">
	import { onMount } from 'svelte';
	import { X } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import type { SavedDocumentSummary } from '$lib/session/session-storage-types';
	import SavedWorkCardGrid from './SavedWorkCardGrid.svelte';

	interface Props {
		documents: SavedDocumentSummary[];
		onSelect: (doc: SavedDocumentSummary) => void;
		onDelete: (id: string) => void | Promise<void>;
		onClose: () => void;
	}

	let { documents, onSelect, onDelete, onClose }: Props = $props();
	let modalEl = $state<HTMLDivElement>();
	let cardGrid = $state<SavedWorkCardGrid>();

	onMount(() => {
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		modalEl?.focus();
		return () => {
			document.body.style.overflow = originalOverflow;
		};
	});

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (cardGrid?.handleEscape()) return;
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="browser-backdrop" onmousedown={onClose}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="browser-modal"
		bind:this={modalEl}
		onmousedown={(e) => e.stopPropagation()}
		role="dialog"
		aria-labelledby="browser-title"
		tabindex="-1"
	>
		<div class="browser-header">
			<h2 id="browser-title" class="title">{m.browser_title()}</h2>
			<button class="close-btn" onclick={onClose} aria-label={m.action_close()}>
				<X size={16} />
			</button>
		</div>

		<div class="browser-content">
			<SavedWorkCardGrid
				bind:this={cardGrid}
				{documents}
				{onSelect}
				{onDelete}
			/>
		</div>
	</div>
</div>

<style>
	.browser-backdrop {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.4);
		z-index: 200;
	}

	.browser-modal {
		width: 640px;
		max-width: calc(100vw - 32px);
		max-height: calc(100vh - 64px);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		background: var(--ds-bg-elevated);
		border: 1px solid var(--ds-border-subtle);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
		overflow: hidden;
	}

	.browser-content {
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}

	.browser-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.title {
		margin: 0;
		font-family: var(--ds-font-body-sm);
		font-size: 16px;
		font-weight: 600;
		color: var(--ds-text-primary);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: transparent;
		border-radius: 6px;
		color: var(--ds-text-secondary);
		cursor: pointer;
		padding: 0;
	}

	.close-btn:hover {
		background: var(--ds-bg-hover);
	}
</style>
