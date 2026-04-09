<script lang="ts">
	import { tick } from 'svelte';
	import { ImageIcon, Trash2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import type { SavedDocumentSummary } from '$lib/session/session-storage-types';
	import { trapFocus } from '$lib/ui/trap-focus';

	interface Props {
		documents: SavedDocumentSummary[];
		onSelect: (doc: SavedDocumentSummary) => void;
		onDelete: (id: string) => void | Promise<void>;
	}

	let { documents, onSelect, onDelete }: Props = $props();
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

	async function requestDelete(event: MouseEvent, doc: SavedDocumentSummary) {
		event.stopPropagation();
		const card = (event.currentTarget as HTMLElement).closest('.card');
		returnFocusEl = card?.querySelector<HTMLElement>('.card-open') ?? null;
		deleteTarget = { id: doc.id, name: doc.name };
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
			console.error('Failed to delete document:', err);
		}
	}

	function formatRelativeTime(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMinutes = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMinutes / 60);
		const diffDays = Math.floor(diffHours / 24);

		const lang = getLocale();
		const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });

		if (diffMinutes < 1) return rtf.format(0, 'minute');
		if (diffHours < 1) return rtf.format(-diffMinutes, 'minute');
		if (diffDays < 1) return rtf.format(-diffHours, 'hour');
		if (diffDays < 30) return rtf.format(-diffDays, 'day');

		return date.toLocaleDateString(lang, { month: 'short', day: 'numeric' });
	}

	function thumbnail(canvas: HTMLCanvasElement, doc: { width: number; height: number; pixels: Uint8Array }) {
		let currentDoc = doc;
		const redraw = () => renderThumbnail(canvas, currentDoc);
		redraw();

		const ro = new ResizeObserver(redraw);
		ro.observe(canvas);

		return {
			update(newDoc: typeof doc) {
				currentDoc = newDoc;
				redraw();
			},
			destroy() {
				ro.disconnect();
			}
		};
	}

	function renderThumbnail(canvas: HTMLCanvasElement, doc: { width: number; height: number; pixels: Uint8Array }) {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const containerWidth = canvas.clientWidth;
		const containerHeight = canvas.clientHeight;
		if (containerWidth === 0 || containerHeight === 0) return;

		const dpr = window.devicePixelRatio ?? 1;
		canvas.width = containerWidth * dpr;
		canvas.height = containerHeight * dpr;
		ctx.scale(dpr, dpr);

		ctx.fillStyle = '#f5f0eb';
		ctx.fillRect(0, 0, containerWidth, containerHeight);

		ctx.imageSmoothingEnabled = false;

		const scale = Math.min(containerWidth / doc.width, containerHeight / doc.height);
		const scaledW = doc.width * scale;
		const scaledH = doc.height * scale;
		const offsetX = (containerWidth - scaledW) / 2;
		const offsetY = (containerHeight - scaledH) / 2;

		const imageData = new ImageData(new Uint8ClampedArray(doc.pixels), doc.width, doc.height);
		const temp = document.createElement('canvas');
		temp.width = doc.width;
		temp.height = doc.height;
		temp.getContext('2d')!.putImageData(imageData, 0, 0);

		ctx.drawImage(temp, offsetX, offsetY, scaledW, scaledH);
	}
</script>

{#if documents.length === 0}
	<div class="empty-state">
		<ImageIcon size={40} />
		<p class="empty-title">{m.browser_empty_title()}</p>
		<p class="empty-desc">{m.browser_empty_desc()}</p>
	</div>
{:else}
	<div class="card-grid">
	{#each documents as doc (doc.id)}
		<div class="card">
			<button class="card-open" onclick={() => onSelect(doc)}>
				<canvas
					class="card-thumb"
					use:thumbnail={{ width: doc.width, height: doc.height, pixels: doc.pixels }}
				></canvas>
				<div class="card-text">
					<span class="card-name">{doc.name}</span>
					<span class="card-meta">{doc.width} × {doc.height} · {formatRelativeTime(doc.updatedAt)}</span>
				</div>
			</button>
			<div class="card-actions">
				<button
					class="card-delete"
					onclick={(e) => requestDelete(e, doc)}
					aria-label={m.aria_deleteDocument({ name: doc.name })}
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
			aria-labelledby="delete-dialog-title"
			aria-describedby="delete-dialog-message"
			aria-modal="true"
			tabindex="-1"
		>
			<h3 id="delete-dialog-title" class="delete-title">
				{m.browser_delete_title({ name: deleteTarget.name })}
			</h3>
			<p id="delete-dialog-message" class="delete-message">
				{m.browser_delete_message()}
			</p>
			<div class="delete-actions">
				<button class="btn btn-cancel" onclick={dismissDeleteDialog}>
					{m.browser_cancel()}
				</button>
				<button class="btn btn-delete" onclick={confirmDelete}>
					{m.browser_delete_confirm()}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Empty state */
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

	/* Card grid */
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

	/* Delete confirmation */
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
		--_destructive: #ef4444;

		background: var(--_destructive);
		color: #ffffff;
	}

	.btn-delete:hover {
		background: color-mix(in srgb, var(--_destructive) 85%, black);
	}
</style>
