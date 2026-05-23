<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { createModal } from '$lib/ui/modal.svelte';

	interface Props {
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { onConfirm, onCancel }: Props = $props();

	const modal = createModal({ onClose: () => onCancel() });

	function autoFocus(node: HTMLElement) {
		node.focus();
	}
</script>

<svelte:window onkeydown={modal.handleKeyDown} />

<div
	class="replace-dialog-backdrop"
	onmousedown={modal.handleBackdropClick}
	role="presentation"
>
	<div
		class="replace-dialog"
		bind:this={modal.containerEl}
		onmousedown={(event) => event.stopPropagation()}
		role="alertdialog"
		aria-labelledby="reference-replace-title"
		aria-describedby="reference-replace-message"
		aria-modal="true"
		tabindex="-1"
	>
		<h2 id="reference-replace-title" class="title">{m.reference_layer_replace_title()}</h2>
		<p id="reference-replace-message" class="message">{m.reference_layer_replace_message()}</p>
		<div class="actions">
			<button type="button" class="btn btn-cancel" onclick={onCancel} use:autoFocus>
				{m.reference_layer_replace_cancel()}
			</button>
			<button type="button" class="btn btn-confirm" onclick={onConfirm}>
				{m.reference_layer_replace_confirm()}
			</button>
		</div>
	</div>
</div>

<style>
	.replace-dialog-backdrop {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: rgba(0, 0, 0, 0.4);
		z-index: 210;
	}

	.replace-dialog {
		width: 360px;
		max-width: 100%;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		background: var(--ds-bg-elevated);
		border: var(--ds-border-width) solid var(--ds-border-subtle);
		border-radius: var(--ds-radius-md);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
	}

	.title,
	.message {
		margin: 0;
		font-family: var(--ds-font-body);
	}

	.title {
		font-size: var(--ds-font-size-lg);
		font-weight: 600;
		color: var(--ds-text-primary);
	}

	.message {
		font-size: var(--ds-font-size-md);
		line-height: 1.45;
		color: var(--ds-text-secondary);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--ds-space-2);
	}

	.btn {
		height: 36px;
		padding: 0 14px;
		border: none;
		border-radius: var(--ds-radius-sm);
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-md);
		font-weight: 600;
		cursor: pointer;
	}

	.btn-cancel {
		background: transparent;
		color: var(--ds-text-secondary);
	}

	.btn-cancel:hover {
		background: var(--ds-bg-hover);
	}

	.btn-confirm {
		background: var(--ds-accent);
		color: #ffffff;
	}

	.btn-confirm:hover {
		background: color-mix(in srgb, var(--ds-accent) 85%, black);
	}
</style>
