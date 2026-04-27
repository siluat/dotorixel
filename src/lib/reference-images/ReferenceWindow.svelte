<script lang="ts">
	import { X } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import type { ReferenceImage } from './reference-image-types';

	interface Props {
		reference: ReferenceImage;
		x: number;
		y: number;
		width: number;
		height: number;
		isActive: boolean;
		onClose: () => void;
	}

	let { reference, x, y, width, height, isActive, onClose }: Props = $props();

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

<div
	class="window"
	role="dialog"
	aria-label={reference.filename}
	data-active={isActive ? 'true' : 'false'}
	style:left="{x}px"
	style:top="{y}px"
	style:width="{width}px"
	style:height="{height}px"
>
	<div class="title-bar">
		<span class="title">{reference.filename}</span>
		<button
			class="close-button"
			onclick={onClose}
			aria-label={m.references_window_close({ name: reference.filename })}
		>
			<X size={14} />
		</button>
	</div>
	<div class="body">
		<img class="image" alt={reference.filename} use:objectUrl={reference.blob} />
	</div>
</div>

<style>
	.window {
		position: absolute;
		display: flex;
		flex-direction: column;
		background: var(--ds-bg-elevated);
		border: 1px solid var(--ds-border-subtle);
		border-radius: 8px;
		overflow: hidden;
		pointer-events: auto;
		box-shadow: var(--ds-shadow-sm);
	}

	.window[data-active='true'] {
		box-shadow: var(--ds-shadow-md);
	}

	.title-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		height: 28px;
		padding: 0 6px 0 10px;
		background: var(--ds-bg-subtle);
		border-bottom: 1px solid var(--ds-border-subtle);
		flex-shrink: 0;
	}

	.title {
		font-family: var(--ds-font-body-sm);
		font-size: var(--ds-font-size-sm);
		color: var(--ds-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.close-button {
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

	.close-button:hover {
		color: var(--ds-text-primary);
		background: var(--ds-bg-hover);
	}

	.body {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f5f0eb;
		overflow: hidden;
	}

	.image {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		display: block;
	}

	.window[data-active='false'] .image {
		opacity: 0.85;
	}
</style>
