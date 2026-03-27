<script lang="ts">
	import { getLocale } from '$lib/paraglide/runtime';
	import '../styles/global.css';

	let { children } = $props();

	$effect(() => {
		document.documentElement.lang = getLocale();
	});
</script>

{@render children()}
