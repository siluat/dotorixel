<script lang="ts">
	interface Props {
		size?: number;
	}

	let { size = 16 }: Props = $props();
</script>

<svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
	<rect x="0" y="0" width="4" height="4" />
	<rect x="4" y="4" width="4" height="4" />
	<rect x="8" y="8" width="4" height="4" />
	<rect x="12" y="12" width="4" height="4" />
</svg>
