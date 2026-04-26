<script lang="ts">
	import { tick } from 'svelte';
	import { Trash2, ImageIcon } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import { trapFocus } from '$lib/ui/trap-focus';
	import type { ReferenceImage } from './reference-image-types';

	interface Props {
		references: readonly ReferenceImage[];
		onSelect: (ref: ReferenceImage) => void;
		onDelete: (id: string) => void | Promise<void>;
	}

	let { references, onSelect, onDelete }: Props = $props();

	let deleteTarget: { id: string; name: string } | null = $state(null);
	let deleteDialogEl = $state<HTMLDivElement>();
	let returnFocusEl: HTMLElement | null = null;

	async function dismissDeleteDialog() {
		deleteTarget = null;
		await tick();
		returnFocusEl?.focus();
		returnFocusEl = null;
	}

	export function handleEscape(): boolean {
		if (deleteTarget) {
			dismissDeleteDialog();
			return true;
		}
		return false;
	}

	function handleDeleteDialogKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			dismissDeleteDialog();
			event.stopPropagation();
		} else if (event.key === 'Tab' && deleteDialogEl) {
			trapFocus(event, deleteDialogEl);
			event.stopPropagation();
		}
	}

	async function requestDelete(event: MouseEvent, ref: ReferenceImage) {
		event.stopPropagation();
		const card = (event.currentTarget as HTMLElement).closest('.card');
		returnFocusEl = card?.querySelector<HTMLElement>('.card-open') ?? null;
		deleteTarget = { id: ref.id, name: ref.filename };
		await tick();
		deleteDialogEl?.querySelector<HTMLButtonElement>('.btn-cancel')?.focus();
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		const id = deleteTarget.id;
		deleteTarget = null;
		returnFocusEl = null;
		try {
			await onDelete(id);
		} catch (err) {
			console.error('Failed to delete reference:', err);
		}
	}

	function objectUrl(node: HTMLImageElement, blob: Blob) {
		let url = URL.createObjectURL(blob);
		node.src = url;
		return {
			update(newBlob: Blob) {
				URL.revokeObjectURL(url);
				url = URL.createObjectURL(newBlob);
				node.src = url;
			},
			destroy() {
				URL.revokeObjectURL(url);
			}
		};
	}
</script>

{#if references.length === 0}
	<div class="empty-state">
		<ImageIcon size={40} />
		<p class="empty-title">{m.references_empty_title()}</p>
		<p class="empty-desc">{m.references_empty_desc()}</p>
	</div>
{:else}
	<div class="card-grid">
		{#each references as ref (ref.id)}
			<div class="card">
				<button class="card-open" onclick={() => onSelect(ref)}>
					<img class="card-thumb" alt="" use:objectUrl={ref.thumbnail} />
					<div class="card-text">
						<span class="card-name">{ref.filename}</span>
						<span class="card-meta">{ref.naturalWidth} × {ref.naturalHeight}</span>
					</div>
				</button>
				<div class="card-actions">
					<button
						class="card-delete"
						onclick={(e) => requestDelete(e, ref)}
						aria-label={m.aria_deleteReference({ name: ref.filename })}
					>
						<Trash2 size={14} />
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}

{#if deleteTarget}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="delete-backdrop" onmousedown={dismissDeleteDialog} onkeydown={handleDeleteDialogKeyDown}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="delete-dialog"
			bind:this={deleteDialogEl}
			onmousedown={(e) => e.stopPropagation()}
			role="alertdialog"
			aria-labelledby="ref-delete-title"
			aria-describedby="ref-delete-message"
			aria-modal="true"
			tabindex="-1"
		>
			<h3 id="ref-delete-title" class="delete-title">
				{m.references_delete_title({ name: deleteTarget.name })}
			</h3>
			<p id="ref-delete-message" class="delete-message">
				{m.references_delete_message()}
			</p>
			<div class="delete-actions">
				<button class="btn btn-cancel" onclick={dismissDeleteDialog}>
					{m.references_cancel()}
				</button>
				<button class="btn btn-delete" onclick={confirmDelete}>
					{m.references_delete_confirm()}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 240px;
		color: var(--ds-text-tertiary);
	}

	.empty-title {
		margin: 0;
		font-family: var(--ds-font-body);
		font-size: 14px;
		font-weight: 600;
		color: var(--ds-text-primary);
	}

	.empty-desc {
		margin: 0;
		font-family: var(--ds-font-body);
		font-size: 12px;
		color: var(--ds-text-secondary);
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
	}

	@media (min-width: 600px) {
		.card-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	.card {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--ds-border-subtle);
		border-radius: 8px;
		overflow: hidden;
		background: var(--ds-bg-elevated);
	}

	.card:has(.card-open:hover),
	.card:has(.card-open:focus-visible) {
		border-color: var(--ds-accent);
	}

	.card-open {
		display: flex;
		flex-direction: column;
		border: none;
		background: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
	}

	.card-open:focus-visible {
		outline: none;
	}

	.card-thumb {
		width: 100%;
		height: 120px;
		object-fit: contain;
		background: #f5f0eb;
		display: block;
	}

	.card-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 10px;
		min-width: 0;
	}

	.card-actions {
		display: flex;
		justify-content: flex-end;
		padding: 0 10px 8px;
	}

	.card-name {
		font-family: var(--ds-font-body-sm);
		font-size: 12px;
		font-weight: 600;
		color: var(--ds-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card-meta {
		font-family: var(--ds-font-body);
		font-size: 11px;
		color: var(--ds-text-tertiary);
		white-space: nowrap;
	}

	.card-delete {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		background: transparent;
		border-radius: 4px;
		color: var(--ds-text-tertiary);
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
	}

	.card-delete:hover {
		--_destructive: #c0392b;

		color: var(--_destructive);
		background: color-mix(in srgb, var(--_destructive) 10%, transparent);
	}

	.delete-backdrop {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.4);
		z-index: 300;
	}

	.delete-dialog {
		width: 320px;
		max-width: calc(100vw - 32px);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		background: var(--ds-bg-elevated);
		border: 1px solid var(--ds-border-subtle);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
	}

	.delete-title {
		margin: 0;
		font-family: var(--ds-font-body);
		font-size: 14px;
		font-weight: 600;
		color: var(--ds-text-primary);
	}

	.delete-message {
		margin: 0;
		font-family: var(--ds-font-body);
		font-size: 12px;
		color: var(--ds-text-secondary);
		line-height: 1.5;
	}

	.delete-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.btn {
		height: 32px;
		padding: 0 16px;
		border: none;
		border-radius: 6px;
		font-family: var(--ds-font-body);
		font-size: 12px;
		cursor: pointer;
	}

	.btn-cancel {
		background: transparent;
		color: var(--ds-text-primary);
		border: 1px solid var(--ds-border-subtle);
	}

	.btn-cancel:hover {
		background: var(--ds-bg-hover);
	}

	.btn-delete {
		background: var(--ds-danger);
		color: #ffffff;
	}

	.btn-delete:hover {
		background: color-mix(in srgb, var(--ds-danger) 85%, black);
	}
</style>
