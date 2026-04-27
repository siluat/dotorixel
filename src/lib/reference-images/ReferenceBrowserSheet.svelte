<script lang="ts">
	import { Plus, X } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import BottomSheet from '$lib/ui/BottomSheet.svelte';
	import ReferenceGalleryGrid from './ReferenceGalleryGrid.svelte';
	import type { ReferenceImage } from './reference-image-types';

	interface Props {
		open: boolean;
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
		open,
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
</script>

<BottomSheet {open} onclose={onClose}>
	<div class="browser-sheet">
		<div class="drag-handle"></div>
		<div class="sheet-header">
			<h2 class="title">{m.references_title()}</h2>
			<button class="add-btn" onclick={onAddRequest} aria-label={m.references_add()}>
				<Plus size={14} />
				<span>{m.references_add()}</span>
			</button>
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

		<div class="sheet-body">
			{#if references.length === 0}
				<button class="empty-trigger" onclick={onAddRequest}>
					<ReferenceGalleryGrid
						{references}
						{displayedRefIds}
						{onSelect}
						{onDelete}
						{onToggleDisplay}
					/>
				</button>
			{:else}
				<ReferenceGalleryGrid
					{references}
					{displayedRefIds}
					{onSelect}
					{onDelete}
					{onToggleDisplay}
				/>
			{/if}
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

	.drag-handle {
		width: 36px;
		height: 4px;
		margin: 12px auto 16px;
		border-radius: 2px;
		background: var(--ds-border);
		flex-shrink: 0;
	}

	.sheet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 20px;
	}

	.title {
		margin: 0;
		font-family: var(--ds-font-body);
		font-size: 16px;
		font-weight: 600;
		color: var(--ds-text-primary);
	}

	.add-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 32px;
		padding: 0 12px;
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

	.error-banner {
		margin: 12px 20px 0;
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

	.sheet-body {
		overflow-y: auto;
		padding: 16px 20px 0;
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
</style>
