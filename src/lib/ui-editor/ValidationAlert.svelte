<script lang="ts">
	import { AlertTriangle } from 'lucide-svelte';

	interface Props {
		message: string;
	}

	let { message }: Props = $props();
</script>

<div class="validation-alert" role="alert">
	<AlertTriangle class="alert-icon" />
	<span class="alert-message">{message}</span>
</div>

<style>
	.validation-alert {
		--_error-color: #B0503A;

		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--_error-color) 8%, transparent);
	}

	.validation-alert :global(.alert-icon) {
		flex-shrink: 0;
		width: 14px;
		height: 14px;
		color: var(--_error-color);
	}

	.alert-message {
		font-family: var(--ds-font-body);
		font-size: 12px;
		color: var(--_error-color);
		line-height: 1.4;
	}

	@media (min-width: 1024px) {
		.validation-alert {
			padding: 6px 8px;
			border-radius: 4px;
		}

		.validation-alert :global(.alert-icon) {
			width: 12px;
			height: 12px;
		}

		.alert-message {
			font-size: 10px;
		}
	}
</style>
