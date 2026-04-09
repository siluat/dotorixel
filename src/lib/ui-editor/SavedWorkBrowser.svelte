<script lang="ts">
	import { onMount } from 'svelte';
	import { X, ImageIcon, Trash2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import type { SavedDocumentSummary } from '$lib/session/session-storage-types';

	interface Props {
		documents: SavedDocumentSummary[];
		onSelect: (doc: SavedDocumentSummary) => void;
		onDelete: (id: string) => void | Promise<void>;
		onClose: () => void;
	}

	let { documents, onSelect, onDelete, onClose }: Props = $props();
	let deleteTarget: { id: string; name: string } | null = $state(null);
	let modalEl = $state<HTMLDivElement>();
	let deleteDialogEl = $state<HTMLDivElement>();

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
			if (deleteTarget) {
				deleteTarget = null;
			} else {
				onClose();
			}
		} else if (event.key === 'Tab') {
			const container = deleteTarget ? deleteDialogEl : modalEl;
			if (container) trapFocus(event, container);
		}
	}

	function trapFocus(event: KeyboardEvent, container: HTMLElement) {
		const focusable = [...container.querySelectorAll<HTMLElement>(
			'button:not([disabled]), [role="button"][tabindex="0"]'
		)];
		if (focusable.length === 0) return;

		const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
		event.preventDefault();

		if (event.shiftKey) {
			const prev = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
			focusable[prev].focus();
		} else {
			const next = currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1;
			focusable[next].focus();
		}
	}

	function requestDelete(event: MouseEvent, doc: SavedDocumentSummary) {
		event.stopPropagation();
		deleteTarget = { id: doc.id, name: doc.name };
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		await onDelete(deleteTarget.id);
		deleteTarget = null;
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
		renderThumbnail(canvas, doc);
		return {
			update(newDoc: typeof doc) {
				renderThumbnail(canvas, newDoc);
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

		// Warm background matching Pebble UI theme
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
		aria-modal="true"
		tabindex="-1"
	>
		<div class="browser-header">
			<h2 id="browser-title" class="title">{m.browser_title()}</h2>
			<button class="close-btn" onclick={onClose} aria-label={m.action_close()}>
				<X size={16} />
			</button>
		</div>

		<div class="browser-content">
			{#if documents.length === 0}
				<div class="empty-state">
					<ImageIcon size={40} />
					<p class="empty-title">{m.browser_empty_title()}</p>
					<p class="empty-desc">{m.browser_empty_desc()}</p>
				</div>
			{:else}
				<div class="card-grid">
				{#each documents as doc (doc.id)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="card"
						onclick={() => onSelect(doc)}
						onkeydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onSelect(doc); } }}
						role="button"
						tabindex="0"
					>
						<canvas
							class="card-thumb"
							use:thumbnail={{ width: doc.width, height: doc.height, pixels: doc.pixels }}
						></canvas>
						<div class="card-info">
							<div class="card-text">
								<span class="card-name">{doc.name}</span>
								<span class="card-meta">{doc.width} × {doc.height} · {formatRelativeTime(doc.updatedAt)}</span>
							</div>
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
		</div>
	</div>
</div>

{#if deleteTarget}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="delete-backdrop" onmousedown={() => (deleteTarget = null)}>
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
				<button class="btn btn-cancel" onclick={() => (deleteTarget = null)}>
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
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}

	.card {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--ds-border-subtle);
		border-radius: 8px;
		overflow: hidden;
		cursor: pointer;
		background: var(--ds-bg-elevated);
		padding: 0;
		text-align: left;
	}

	.card:hover,
	.card:focus-visible {
		border-color: var(--ds-accent);
	}

	.card:focus-visible {
		outline: none;
	}

	.card-thumb {
		width: 100%;
		height: 120px;
		display: block;
	}

	.card-info {
		display: flex;
		align-items: flex-start;
		gap: 4px;
		padding: 8px 10px;
	}

	.card-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
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
