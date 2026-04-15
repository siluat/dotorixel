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
		<a
			class="github-link"
			href="https://github.com/siluat/dotorixel"
			target="_blank"
			rel="noopener noreferrer"
			aria-label="GitHub repository"
		>
			<svg
				viewBox="0 0 24 24"
				width="18"
				height="18"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path
					d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"
				/>
				<path d="M9 18c-4.51 2-5-2-7-2" />
			</svg>
		</a>
	</nav>

	<main class="hero">
		<h1 class="app-name">DOTORIXEL</h1>
		<p class="tagline">{m.landing_tagline()}</p>
		<p class="description">{m.landing_description()}</p>
		<a class="cta" href={localizeHref('/editor')}>{m.landing_cta()}</a>
	</main>
</div>

<style>
	.landing {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 100dvh;
		background-color: var(--ds-bg-base);
		color: var(--ds-text-primary);
		font-family: var(--ds-font-body);
		padding-left: env(safe-area-inset-left, 0px);
		padding-right: env(safe-area-inset-right, 0px);
	}

	.lang-nav {
		padding: calc(24px + env(safe-area-inset-top, 0px)) 24px 24px;
		font-size: 14px;
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.lang-nav a {
		color: var(--ds-text-secondary);
		text-decoration: none;
	}

	.lang-nav a:hover {
		color: var(--ds-text-primary);
	}

	.lang-nav strong {
		font-family: var(--ds-font-heading);
		color: var(--ds-text-primary);
	}

	.separator {
		color: var(--ds-text-tertiary);
	}

	.github-link {
		display: inline-flex;
		align-items: center;
		color: var(--ds-text-tertiary);
		margin-left: 8px;
	}

	.github-link:hover {
		color: var(--ds-text-primary);
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
		font-family: var(--ds-font-mono);
		font-size: 48px;
		font-weight: 800;
		letter-spacing: 2px;
		margin: 0;
		color: var(--ds-accent-text);
	}

	.tagline {
		font-size: 20px;
		color: var(--ds-text-secondary);
		margin: 0;
	}

	.description {
		font-size: 16px;
		color: var(--ds-text-secondary);
		margin: 0 0 24px;
		max-width: 400px;
	}

	.cta {
		display: inline-block;
		padding: 14px 36px;
		background-color: var(--ds-accent);
		color: white;
		font-family: var(--ds-font-heading);
		font-size: 16px;
		font-weight: 700;
		text-decoration: none;
		border-radius: var(--ds-radius-md);
		transition: background-color 0.15s;
	}

	.cta:hover {
		background-color: color-mix(in oklch, var(--ds-accent) 85%, black);
	}
</style>
