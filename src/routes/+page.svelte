<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale, locales, baseLocale, localizeHref } from '$lib/paraglide/runtime';

	const localeLabels: Record<string, string> = {
		en: 'English',
		ko: '한국어',
		ja: '日本語',
	};
</script>

<div class="landing">
	<nav class="lang-nav">
		{#each locales as locale, i}
			{#if i > 0}<span class="separator">·</span>{/if}
			{#if locale === getLocale()}
				<strong>{localeLabels[locale]}</strong>
			{:else}
				<a href={localizeHref('/', { locale })} data-sveltekit-reload>{localeLabels[locale]}</a>
			{/if}
		{/each}
	</nav>

	<main class="hero">
		<h1 class="app-name">DOTORIXEL</h1>
		<p class="tagline">{m.landing_tagline()}</p>
		<p class="description">{m.landing_description()}</p>
		<a class="cta" href={localizeHref('/pebble')}>{m.landing_cta()}</a>
	</main>
</div>

<style>
	.landing {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 100dvh;
		background-color: #efece8;
		color: #2d2d2d;
		font-family: system-ui, sans-serif;
	}

	.lang-nav {
		padding: 24px;
		font-size: 14px;
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.lang-nav a {
		color: #8a8a8a;
		text-decoration: none;
	}

	.lang-nav a:hover {
		color: #2d2d2d;
	}

	.separator {
		color: #aaa5a0;
	}

	.hero {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 0 24px;
		gap: 8px;
	}

	.app-name {
		font-size: 48px;
		font-weight: 800;
		letter-spacing: 2px;
		margin: 0;
		color: oklch(0.45 0.17 45);
	}

	.tagline {
		font-size: 20px;
		color: #8a8a8a;
		margin: 0;
	}

	.description {
		font-size: 16px;
		color: #8a8a8a;
		margin: 0 0 24px;
		max-width: 400px;
	}

	.cta {
		display: inline-block;
		padding: 14px 36px;
		background-color: oklch(0.55 0.15 45);
		color: white;
		font-size: 16px;
		font-weight: 600;
		text-decoration: none;
		border-radius: 12px;
		box-shadow: 0 2px 16px rgba(0, 0, 0, 0.07);
		transition: background-color 0.15s;
	}

	.cta:hover {
		background-color: oklch(0.45 0.17 45);
	}
</style>
