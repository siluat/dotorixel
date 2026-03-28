<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { getLocale, locales, localizeHref } from '$lib/paraglide/runtime';

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
		background-color: var(--pebble-bg);
		color: var(--pebble-text-primary);
		font-family: 'Galmuri11', system-ui, sans-serif;
	}

	.lang-nav {
		padding: 24px;
		font-size: 14px;
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.lang-nav a {
		color: var(--pebble-text-secondary);
		text-decoration: none;
	}

	.lang-nav a:hover {
		color: var(--pebble-text-primary);
	}

	.lang-nav strong {
		font-family: 'Galmuri14', monospace;
		color: var(--pebble-text-primary);
	}

	.separator {
		color: var(--pebble-text-muted);
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
		font-family: 'GalmuriMono11', monospace;
		font-size: 48px;
		font-weight: 800;
		letter-spacing: 2px;
		margin: 0;
		color: var(--pebble-accent-dark);
	}

	.tagline {
		font-size: 20px;
		color: var(--pebble-text-secondary);
		margin: 0;
	}

	.description {
		font-size: 16px;
		color: var(--pebble-text-secondary);
		margin: 0 0 24px;
		max-width: 400px;
	}

	.cta {
		display: inline-block;
		padding: 14px 36px;
		background-color: var(--pebble-accent);
		color: white;
		font-family: 'Galmuri14', monospace;
		font-size: 16px;
		font-weight: 700;
		text-decoration: none;
		border-radius: 12px;
		transition: background-color 0.15s;
	}

	.cta:hover {
		background-color: var(--pebble-accent-dark);
	}
</style>
