<script lang="ts">
	import { getLocale } from '$lib/paraglide/runtime';
	import { isAnalyticsEnabled, getUmamiConfig, initUmami } from '$lib/analytics/umami';
	import '../styles/global.css';

	let { children } = $props();

	$effect(() => {
		document.documentElement.lang = getLocale();
	});

	$effect(() => {
		if (!isAnalyticsEnabled()) return;
		const config = getUmamiConfig();
		const script = document.createElement('script');
		script.async = true;
		script.src = config.src;
		script.dataset.websiteId = config.websiteId;
		document.head.appendChild(script);
		initUmami();
		return () => {
			document.head.removeChild(script);
		};
	});
</script>

{@render children()}
