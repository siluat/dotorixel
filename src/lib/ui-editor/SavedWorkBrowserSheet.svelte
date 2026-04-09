<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import * as m from '$lib/paraglide/messages';
	import type { SavedDocumentSummary } from '$lib/session/session-storage-types';
	import SavedWorkCardGrid from './SavedWorkCardGrid.svelte';

	interface Props {
		open: boolean;
		documents: SavedDocumentSummary[];
		onSelect: (doc: SavedDocumentSummary) => void;
		onDelete: (id: string) => void | Promise<void>;
		onClose: () => void;
	}

	let { open, documents, onSelect, onDelete, onClose }: Props = $props();

	let drawerOpen = $state(false);
	const CLOSE_ANIMATION_MS = 500;
	let pendingClose: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (open) {
			drawerOpen = true;
		} else if (drawerOpen) {
			drawerOpen = false;
		}
	});

	function handleOpenChange(isOpen: boolean) {
		if (pendingClose) {
			clearTimeout(pendingClose);
			pendingClose = undefined;
		}
		if (isOpen) {
			drawerOpen = true;
		} else {
			pendingClose = setTimeout(() => {
				pendingClose = undefined;
				drawerOpen = false;
				onClose();
			}, CLOSE_ANIMATION_MS);
		}
	}
</script>

<Drawer.Root open={drawerOpen} onOpenChange={handleOpenChange}>
	<Drawer.Portal>
		<Drawer.Overlay class="browser-sheet-overlay" />
		<Drawer.Content class="browser-sheet-content">
			<div class="drag-handle"></div>
			<Drawer.Title class="browser-sheet-title">{m.browser_title()}</Drawer.Title>

			<div class="browser-sheet-body">
				<SavedWorkCardGrid
					{documents}
					{onSelect}
					{onDelete}
				/>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>

<style>
	:global(.browser-sheet-overlay) {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 200;
		animation: sheet-fade-in 0.5s cubic-bezier(0.32, 0.72, 0, 1);
	}

	:global(.browser-sheet-content) {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 201;
		display: flex;
		flex-direction: column;
		background: var(--ds-bg-elevated);
		border-radius: 16px 16px 0 0;
		max-height: 85vh;
		padding-bottom: max(16px, env(safe-area-inset-bottom, 0px));
		animation: sheet-slide-up 0.5s cubic-bezier(0.32, 0.72, 0, 1);
	}

	@keyframes sheet-slide-up {
		from {
			transform: translate3d(0, 100%, 0);
		}
	}

	@keyframes sheet-fade-in {
		from {
			opacity: 0;
		}
	}

	:global(.browser-sheet-title) {
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
