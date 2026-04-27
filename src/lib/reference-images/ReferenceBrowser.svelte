<script lang="ts">
	import { X, Plus } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import { createModal } from '$lib/ui/modal.svelte';
	import ReferenceGalleryGrid from './ReferenceGalleryGrid.svelte';
	import type { ReferenceImage } from './reference-image-types';

	interface Props {
		references: readonly ReferenceImage[];
		displayedRefIds?: ReadonlySet<string>;
		errors: readonly string[];
		onSelect: (ref: ReferenceImage) => void;
		onDelete: (id: string) => void | Promise<void>;
		onToggleDisplay?: (ref: ReferenceImage) => void;
		onAddRequest: () => void;
		onDismissError: (index: number) => void;
		onClose: () => void;
	}

	let {
		references,
		displayedRefIds,
		errors,
		onSelect,
		onDelete,
		onToggleDisplay,
		onAddRequest,
		onDismissError,
		onClose
	}: Props = $props();
	let cardGrid = $state<ReferenceGalleryGrid>();

	const modal = createModal({
		onClose: () => onClose(),
		focusTrap: false,
		escapeGuard: () => cardGrid?.handleEscape() ?? false
	});

	function autoFocus(node: HTMLElement) {
		node.focus();
	}
</script>

<svelte:window onkeydown={modal.handleKeyDown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="browser-backdrop" onmousedown={modal.handleBackdropClick}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="browser-modal"
		bind:this={modal.containerEl}
		onmousedown={(e) => e.stopPropagation()}
		use:autoFocus
		role="dialog"
		aria-labelledby="ref-browser-title"
		tabindex="-1"
	>
		<div class="browser-header">
			<h2 id="ref-browser-title" class="title">{m.references_title()}</h2>
			<div class="header-actions">
				<button class="add-btn" onclick={onAddRequest} aria-label={m.references_add()}>
					<Plus size={14} />
					<span>{m.references_add()}</span>
				</button>
				<button class="close-btn" onclick={onClose} aria-label={m.action_close()}>
					<X size={16} />
				</button>
			</div>
		</div>

		{#if errors.length > 0}
			<div class="error-banner" role="alert">
				<ul>
					{#each errors as msg, i (i)}
						<li>
							<span>{msg}</span>
							<button
								class="dismiss"
								onclick={() => onDismissError(i)}
								aria-label={m.references_error_dismiss()}
							>
								<X size={12} />
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<div class="browser-content">
			{#if references.length === 0}
				<button class="empty-trigger" onclick={onAddRequest}>
					<ReferenceGalleryGrid
						bind:this={cardGrid}
						{references}
						{displayedRefIds}
						{onSelect}
						{onDelete}
						{onToggleDisplay}
					/>
				</button>
			{:else}
				<ReferenceGalleryGrid
					bind:this={cardGrid}
					{references}
					{displayedRefIds}
					{onSelect}
					{onDelete}
					{onToggleDisplay}
				/>
			{/if}
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
		gap: 16px;
		background: var(--ds-bg-elevated);
		border: 1px solid var(--ds-border-subtle);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
		overflow: hidden;
	}

	.browser-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.title {
		margin: 0;
		font-family: var(--ds-font-body-sm);
		font-size: 16px;
		font-weight: 600;
		color: var(--ds-text-primary);
	}

	.add-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 10px;
		border: 1px solid var(--ds-border-subtle);
		background: transparent;
		border-radius: 6px;
		color: var(--ds-text-primary);
		font-family: var(--ds-font-body-sm);
		font-size: 12px;
		cursor: pointer;
	}

	.add-btn:hover {
		background: var(--ds-bg-hover);
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

	.browser-content {
		overflow-y: auto;
		flex: 1;
		min-height: 0;
	}

	.empty-trigger {
		display: block;
		width: 100%;
		border: 1px dashed var(--ds-border-subtle);
		border-radius: 8px;
		background: transparent;
		padding: 0;
		cursor: pointer;
		text-align: inherit;
		color: inherit;
		font: inherit;
	}

	.empty-trigger:hover {
		border-color: var(--ds-accent);
	}

	.error-banner {
		background: color-mix(in srgb, var(--ds-danger) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--ds-danger) 30%, transparent);
		border-radius: 8px;
		padding: 8px 12px;
	}

	.error-banner ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.error-banner li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-family: var(--ds-font-body);
		font-size: 12px;
		color: var(--ds-text-primary);
	}

	.dismiss {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: none;
		background: transparent;
		border-radius: 4px;
		color: var(--ds-text-tertiary);
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
	}

	.dismiss:hover {
		background: var(--ds-bg-hover);
	}
</style>
