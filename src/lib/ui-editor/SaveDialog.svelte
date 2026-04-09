<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { createModal } from '$lib/ui/modal.svelte';

	interface Props {
		documentName: string;
		onSave: (name: string) => void;
		onDelete: () => void;
		onCancel: () => void;
	}

	let { documentName, onSave, onDelete, onCancel }: Props = $props();

	// svelte-ignore state_referenced_locally — intentional one-time copy for user editing
	let name = $state(documentName);

	const modal = createModal({ onClose: () => onCancel() });

	function focusAndSelect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') {
			onSave(name);
		} else {
			modal.handleKeyDown(event);
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<div
	class="save-dialog-backdrop"
	onmousedown={modal.handleBackdropClick}
	role="presentation"
>
	<div
		class="save-dialog"
		bind:this={modal.containerEl}
		onmousedown={(e) => e.stopPropagation()}
		role="dialog"
		aria-labelledby="save-dialog-title"
		aria-modal="true"
		tabindex="-1"
	>
		<h2 id="save-dialog-title" class="title">{m.save_dialog_title()}</h2>

		<div class="field">
			<label class="field-label" for="save-dialog-name">{m.save_dialog_name_label()}</label>
			<input
				id="save-dialog-name"
				type="text"
				class="name-input"
				bind:value={name}
				use:focusAndSelect
			/>
		</div>

		<div class="actions">
			<button class="btn btn-cancel" onclick={onCancel}>
				{m.save_dialog_cancel()}
			</button>
			<button class="btn btn-delete" onclick={onDelete}>
				{m.save_dialog_delete()}
			</button>
			<button class="btn btn-save" onclick={() => onSave(name)}>
				{m.save_dialog_save()}
			</button>
		</div>
	</div>
</div>

<style>
	.save-dialog-backdrop {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.4);
		z-index: 200;
	}

	.save-dialog {
		width: 360px;
		max-width: calc(100vw - 32px);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		background: var(--ds-bg-elevated);
		border: 1px solid var(--ds-border-subtle);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
	}

	.title {
		margin: 0;
		font-family: var(--ds-font-body);
		font-size: 16px;
		font-weight: 600;
		color: var(--ds-text-primary);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-family: var(--ds-font-body);
		font-size: 12px;
		font-weight: 600;
		color: var(--ds-text-secondary);
	}

	.name-input {
		width: 100%;
		height: 36px;
		padding: 0 12px;
		border: 1px solid var(--ds-border);
		border-radius: 6px;
		background: var(--ds-bg-surface);
		color: var(--ds-text-primary);
		font-family: var(--ds-font-body);
		font-size: 14px;
		outline: none;
		box-sizing: border-box;
	}

	.name-input:focus {
		border-color: var(--ds-accent);
	}

	.actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.btn {
		height: 36px;
		padding: 0 16px;
		border: none;
		border-radius: 6px;
		font-family: var(--ds-font-body);
		font-size: 13px;
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

	.btn-delete {
		--_destructive: #c0392b;

		background: transparent;
		color: var(--_destructive);
	}

	.btn-delete:hover {
		background: color-mix(in srgb, var(--_destructive) 10%, transparent);
	}

	.btn-save {
		background: var(--ds-accent);
		color: #ffffff;
	}

	.btn-save:hover {
		background: color-mix(in srgb, var(--ds-accent) 85%, black);
	}
</style>
