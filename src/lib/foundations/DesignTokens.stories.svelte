<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({});
</script>

<script lang="ts">
	const colorPairs = [
		{ name: 'Background', bg: '--color-bg', fg: '--color-fg' },
		{ name: 'Surface', bg: '--color-surface', fg: '--color-surface-fg' },
		{ name: 'Primary', bg: '--color-primary', fg: '--color-primary-fg' },
		{ name: 'Secondary', bg: '--color-secondary', fg: '--color-secondary-fg' },
		{ name: 'Muted', bg: '--color-muted', fg: '--color-muted-fg' },
		{ name: 'Accent', bg: '--color-accent', fg: '--color-accent-fg' },
		{ name: 'Destructive', bg: '--color-destructive', fg: '--color-destructive-fg' }
	];

	const borderColors = [
		{ name: 'Border', token: '--color-border' },
		{ name: 'Highlight', token: '--color-border-highlight' },
		{ name: 'Shadow', token: '--color-border-shadow' }
	];

	const utilityColors = [
		{ name: 'Input', token: '--color-input' },
		{ name: 'Ring', token: '--color-ring' }
	];

	const spacingTokens = [
		{ name: '--space-1', value: '2px' },
		{ name: '--space-2', value: '4px' },
		{ name: '--space-3', value: '8px' },
		{ name: '--space-4', value: '12px' },
		{ name: '--space-5', value: '16px' },
		{ name: '--space-6', value: '24px' },
		{ name: '--space-7', value: '32px' },
		{ name: '--space-8', value: '48px' }
	];
</script>

<Story name="Colors">
	<div class="catalog">
		<h2 class="section-title">Color Pairs</h2>
		<p class="section-desc">Each pair shows a background color with its matching foreground.</p>
		<div class="swatch-grid">
			{#each colorPairs as pair}
				<div class="swatch-card">
					<div class="swatch" style="background: var({pair.bg}); color: var({pair.fg});">
						Aa
					</div>
					<div class="swatch-info">
						<strong>{pair.name}</strong>
						<code>{pair.bg}</code>
						<code>{pair.fg}</code>
					</div>
				</div>
			{/each}
		</div>

		<h2 class="section-title">Border Colors</h2>
		<p class="section-desc">
			Used for 3D beveled effects. Highlight = top-left edge, Shadow = bottom-right edge.
		</p>
		<div class="swatch-grid">
			{#each borderColors as color}
				<div class="swatch-card">
					<div class="swatch swatch--solid" style="background: var({color.token});">
					</div>
					<div class="swatch-info">
						<strong>{color.name}</strong>
						<code>{color.token}</code>
					</div>
				</div>
			{/each}
		</div>

		<h2 class="section-title">Utility Colors</h2>
		<div class="swatch-grid">
			{#each utilityColors as color}
				<div class="swatch-card">
					<div class="swatch swatch--solid" style="background: var({color.token});">
					</div>
					<div class="swatch-info">
						<strong>{color.name}</strong>
						<code>{color.token}</code>
					</div>
				</div>
			{/each}
		</div>
	</div>
</Story>

<Story name="Typography">
	<div class="catalog">
		<h2 class="section-title">Heading Font — Galmuri14</h2>
		<p class="section-desc">
			<code>--font-heading</code>: Galmuri14 — Nintendo DS inspired pixel font for titles and
			labels. Supports Korean, English, Japanese kana, CJK ideographs.
		</p>
		<div class="type-samples">
			<p class="type-sample" style="font-family: var(--font-heading); font-size: 14px;">
				14px — DOTORIXEL 도토리셀 픽셀 아트 에디터
			</p>
			<p class="type-sample" style="font-family: var(--font-heading); font-size: 16px;">
				16px — DOTORIXEL 도토리셀 픽셀 아트 에디터
			</p>
			<p class="type-sample" style="font-family: var(--font-heading); font-size: 28px;">
				28px — DOTORIXEL 도토리셀
			</p>
		</div>

		<h2 class="section-title">Body Font — Galmuri11</h2>
		<p class="section-desc">
			<code>--font-body</code>: Galmuri11 — proportional pixel font for interface text.
			Has Bold (700) and Condensed variants.
		</p>
		<div class="type-samples">
			<p class="type-sample" style="font-family: var(--font-body); font-size: 11px;">
				11px — The quick brown fox jumps over the lazy dog. 다람쥐 헌 쳇바퀴에 타고파.
			</p>
			<p class="type-sample" style="font-family: var(--font-body); font-size: 16px;">
				16px — The quick brown fox jumps over the lazy dog. 다람쥐 헌 쳇바퀴에 타고파.
			</p>
			<p class="type-sample" style="font-family: var(--font-body); font-size: 22px;">
				22px — The quick brown fox jumps over the lazy dog. 다람쥐 헌 쳇바퀴에 타고파.
			</p>
			<p class="type-sample" style="font-family: var(--font-body); font-size: 22px; font-weight: 700;">
				22px Bold — The quick brown fox. 다람쥐 헌 쳇바퀴에 타고파.
			</p>
		</div>

		<h2 class="section-title">Mono Font — GalmuriMono11</h2>
		<p class="section-desc">
			<code>--font-mono</code>: GalmuriMono11 — fixed-width variant for numbers and code.
		</p>
		<div class="type-samples">
			<p class="type-sample" style="font-family: var(--font-mono); font-size: 11px;">
				11px — 0123456789 Zoom: 400% Canvas: 16×16
			</p>
			<p class="type-sample" style="font-family: var(--font-mono); font-size: 16px;">
				16px — 0123456789 Zoom: 400% Canvas: 16×16
			</p>
			<p class="type-sample" style="font-family: var(--font-mono); font-size: 22px;">
				22px — 0123456789 Zoom: 400% Canvas: 16×16
			</p>
		</div>
	</div>
</Story>

<Story name="Spacing">
	<div class="catalog">
		<h2 class="section-title">Spacing Scale</h2>
		<p class="section-desc">Consistent spacing values used for padding, margins, and gaps.</p>
		<div class="spacing-list">
			{#each spacingTokens as token}
				<div class="spacing-row">
					<code class="spacing-label">{token.name}</code>
					<div class="spacing-bar" style="width: var({token.name});"></div>
					<span class="spacing-value">{token.value}</span>
				</div>
			{/each}
		</div>
	</div>
</Story>

<Story name="Borders">
	<div class="catalog">
		<h2 class="section-title">Border Styles</h2>
		<p class="section-desc">
			Pixel art UI uses beveled borders for a retro 3D effect. <code>--border-width</code>:
			2px, <code>--border-width-thick</code>: 4px.
		</p>
		<div class="border-demos">
			<div class="border-demo border-demo--flat">
				<span>Flat</span>
				<code>border: var(--border-width) solid var(--color-border)</code>
			</div>
			<div class="border-demo border-demo--raised">
				<span>Raised</span>
				<code>highlight top-left, shadow bottom-right</code>
			</div>
			<div class="border-demo border-demo--inset">
				<span>Inset</span>
				<code>shadow top-left, highlight bottom-right</code>
			</div>
		</div>
	</div>
</Story>

<style>
	.catalog {
		padding: var(--space-6);
		max-width: 720px;
	}

	.section-title {
		font-family: var(--font-heading);
		font-size: 12px;
		margin-bottom: var(--space-3);
		margin-top: var(--space-7);
	}

	.section-title:first-child {
		margin-top: 0;
	}

	.section-desc {
		font-family: var(--font-body);
		font-size: 18px;
		color: var(--color-muted-fg);
		margin-bottom: var(--space-5);
	}

	.section-desc code {
		font-family: var(--font-body);
		background: var(--color-muted);
		padding: 1px var(--space-2);
	}

	/* ── Color Swatches ── */

	.swatch-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--space-4);
		margin-bottom: var(--space-5);
	}

	.swatch-card {
		display: flex;
		flex-direction: column;
	}

	.swatch {
		width: 100%;
		height: 72px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-heading);
		font-size: 20px;
		border: var(--border-width) solid var(--color-border);
	}

	.swatch--solid {
		height: 48px;
	}

	.swatch-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-top: var(--space-2);
	}

	.swatch-info strong {
		font-family: var(--font-body);
		font-size: 18px;
	}

	.swatch-info code {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--color-muted-fg);
	}

	/* ── Typography Samples ── */

	.type-samples {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin-bottom: var(--space-5);
	}

	.type-sample {
		margin: 0;
		padding: var(--space-3);
		background: var(--color-surface);
		border: var(--border-width) solid var(--color-border);
	}

	/* ── Spacing Scale ── */

	.spacing-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.spacing-row {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.spacing-label {
		font-family: var(--font-body);
		font-size: 16px;
		width: 80px;
		flex-shrink: 0;
		text-align: right;
	}

	.spacing-bar {
		height: 20px;
		background: var(--color-primary);
		border: var(--border-width) solid var(--color-border-shadow);
	}

	.spacing-value {
		font-family: var(--font-body);
		font-size: 16px;
		color: var(--color-muted-fg);
		flex-shrink: 0;
	}

	/* ── Border Demos ── */

	.border-demos {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.border-demo {
		padding: var(--space-5);
		background: var(--color-surface);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.border-demo span {
		font-family: var(--font-heading);
		font-size: 10px;
	}

	.border-demo code {
		font-family: var(--font-body);
		font-size: 16px;
		color: var(--color-muted-fg);
	}

	.border-demo--flat {
		border: var(--border-width) solid var(--color-border);
	}

	.border-demo--raised {
		border: var(--border-width) solid var(--color-border);
		border-top-color: var(--color-border-highlight);
		border-left-color: var(--color-border-highlight);
		border-bottom-color: var(--color-border-shadow);
		border-right-color: var(--color-border-shadow);
		border-bottom-width: var(--border-width-thick);
		border-right-width: var(--border-width-thick);
	}

	.border-demo--inset {
		border: var(--border-width) solid var(--color-border);
		border-top-color: var(--color-border-shadow);
		border-left-color: var(--color-border-shadow);
		border-bottom-color: var(--color-border-highlight);
		border-right-color: var(--color-border-highlight);
		border-top-width: var(--border-width-thick);
		border-left-width: var(--border-width-thick);
	}
</style>
