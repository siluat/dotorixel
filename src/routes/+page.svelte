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

	<section class="mockup">
		<picture>
			<source srcset="/landing/editor-desktop.webp" media="(min-width: 600px)" />
			<img class="editor-mockup" src="/landing/editor-mobile.webp" alt={m.landing_mockup_alt()} />
		</picture>
	</section>

	<section class="features">
		<h2 class="section-title">{m.landing_section_features()}</h2>
		<div class="card-grid">
			<article class="card">
				<div class="card-icon">
					<svg
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="10" />
						<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
						<path d="M2 12h20" />
					</svg>
				</div>
				<h3 class="card-title">{m.landing_feature_browser_title()}</h3>
				<p class="card-desc">{m.landing_feature_browser_desc()}</p>
			</article>
			<article class="card">
				<div class="card-icon">
					<svg
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path
							d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
						/>
						<path d="m15 5 4 4" />
					</svg>
				</div>
				<h3 class="card-title">{m.landing_feature_tools_title()}</h3>
				<p class="card-desc">{m.landing_feature_tools_desc()}</p>
			</article>
			<article class="card">
				<div class="card-icon">
					<svg
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path
							d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
						/>
						<path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
						<path d="M7 3v4a1 1 0 0 0 1 1h7" />
					</svg>
				</div>
				<h3 class="card-title">{m.landing_feature_autosave_title()}</h3>
				<p class="card-desc">{m.landing_feature_autosave_desc()}</p>
			</article>
		</div>
	</section>

	<section class="roadmap">
		<h2 class="section-title">{m.landing_section_roadmap()}</h2>
		<div class="card-grid">
			<article class="card">
				<div class="card-icon">
					<svg
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path
							d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"
						/>
						<path
							d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"
						/>
						<path
							d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"
						/>
					</svg>
				</div>
				<h3 class="card-title">{m.landing_roadmap_layers_title()}</h3>
				<p class="card-desc">{m.landing_roadmap_layers_desc()}</p>
			</article>
			<article class="card">
				<div class="card-icon">
					<svg
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M12 22v-5" />
						<path d="M9 8V2" />
						<path d="M15 8V2" />
						<path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
					</svg>
				</div>
				<h3 class="card-title">{m.landing_roadmap_integrations_title()}</h3>
				<p class="card-desc">{m.landing_roadmap_integrations_desc()}</p>
			</article>
			<article class="card">
				<div class="card-icon">
					<svg
						viewBox="0 0 24 24"
						width="22"
						height="22"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M12 20h.01" />
						<path d="M8.5 16.429a5 5 0 0 1 7 0" />
						<path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
						<path d="M19 12.859a10 10 0 0 0-2.007-1.523" />
						<path d="M2 8.82a15 15 0 0 1 4.177-2.643" />
						<path d="M22 8.82a15 15 0 0 0-11.288-3.764" />
						<path d="m2 2 20 20" />
					</svg>
				</div>
				<h3 class="card-title">{m.landing_roadmap_offline_title()}</h3>
				<p class="card-desc">{m.landing_roadmap_offline_desc()}</p>
			</article>
		</div>
	</section>
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
		width: 100%;
		max-width: 1200px;
		box-sizing: border-box;
		padding: calc(24px + env(safe-area-inset-top, 0px)) 24px 24px;
		font-size: 14px;
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		align-items: center;
	}

	@media (min-width: 600px) {
		.lang-nav {
			padding-left: 48px;
			padding-right: 48px;
		}
	}

	@media (min-width: 1024px) {
		.lang-nav {
			padding-left: 120px;
			padding-right: 120px;
		}
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

	.github-link svg {
		/* Flex centering aligns geometric centers, but text's optical center
		   sits above its line-box center (descenders pull the bbox down).
		   Nudge the icon up so it lines up with the visual midline of the
		   adjacent language text. */
		transform: translateY(-1px);
	}

	.github-link:hover {
		color: var(--ds-text-primary);
	}

	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 48px 24px 64px;
		gap: 8px;
	}

	@media (min-width: 600px) {
		.hero {
			padding: 96px 24px 96px;
		}
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

	.mockup {
		width: 100%;
		max-width: 1200px;
		padding: 0 24px 40px;
		display: flex;
		justify-content: center;
	}

	.editor-mockup {
		display: block;
		width: 100%;
		max-width: 960px;
		height: auto;
	}

	@media (min-width: 600px) {
		.mockup {
			padding: 0 48px 80px;
		}
	}

	@media (min-width: 1024px) {
		.mockup {
			padding: 0 120px 80px;
		}
	}

	.features,
	.roadmap {
		width: 100%;
		max-width: 1200px;
		padding: 0 24px 60px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
	}

	.section-title {
		font-family: var(--ds-font-heading);
		font-size: 22px;
		font-weight: 700;
		margin: 0;
		color: var(--ds-text-primary);
		text-align: center;
	}

	.card-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 16px;
		width: 100%;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 24px;
		background-color: var(--ds-bg-surface);
		border-radius: var(--ds-radius-md);
	}

	.card-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: var(--ds-radius-full);
		background-color: var(--ds-accent-subtle);
		color: var(--ds-accent);
	}

	.card-title {
		font-family: var(--ds-font-heading);
		font-size: 16px;
		font-weight: 600;
		margin: 0;
		color: var(--ds-text-primary);
	}

	.card-desc {
		font-size: 13px;
		line-height: 1.5;
		margin: 0;
		color: var(--ds-text-secondary);
	}

	@media (min-width: 600px) {
		.features,
		.roadmap {
			padding: 0 48px 80px;
			gap: 32px;
		}

		.section-title {
			font-size: 28px;
		}

		.card-grid {
			max-width: 560px;
			gap: 20px;
		}

		.card {
			gap: 16px;
			padding: 32px;
		}

		.card-icon {
			width: 44px;
			height: 44px;
		}

		.card-title {
			font-size: 18px;
		}

		.card-desc {
			font-size: 14px;
		}
	}

	@media (min-width: 1024px) {
		.features,
		.roadmap {
			padding: 0 120px 100px;
			gap: 40px;
		}

		.card-grid {
			grid-template-columns: repeat(3, 1fr);
			max-width: none;
			gap: 24px;
		}
	}
</style>
