<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({
		title: 'Fonts/Galmuri'
	});

	const sampleTexts = {
		en: 'DOTORIXEL — Start Drawing',
		ko: '도토릭셀 — 그리기 시작',
		ja: 'ドトリクセル — はじめる'
	};

	const fonts = [
		'Galmuri7',
		'Galmuri9',
		'Galmuri11',
		'Galmuri14',
		'GalmuriMono7',
		'GalmuriMono9',
		'GalmuriMono11'
	];

	const weights = [400, 700];

	const sizes = [12, 16, 20, 24, 32, 48];
</script>

<Story name="Weight Comparison">
	<div class="container">
		<h2>Galmuri Font — Weight Comparison (400 vs 700)</h2>
		<p class="note">Galmuri11 Bold(700) does not include Japanese glyphs. Check which variants render Japanese correctly at bold weight.</p>

		{#each fonts as font}
			<section class="font-section">
				<h3 class="font-name">{font}</h3>
				<div class="weight-grid">
					{#each weights as weight}
						<div class="weight-column">
							<div class="weight-label">{weight}</div>
							{#each Object.entries(sampleTexts) as [lang, text]}
								<p class="sample" style="font-family: '{font}', monospace; font-weight: {weight};">
									<span class="lang-tag">{lang}</span> {text}
								</p>
							{/each}
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</Story>

<Story name="Size Comparison">
	<div class="container">
		<h2>Galmuri Font — Size Comparison</h2>
		<p class="note">Bitmap fonts look best at native size or integer multiples. Native sizes: Galmuri7=8px, Galmuri9=10px, Galmuri11=12px, Galmuri14=15px</p>

		{#each fonts as font}
			<section class="font-section">
				<h3 class="font-name">{font}</h3>
				{#each sizes as size}
					<div class="size-row">
						<span class="size-label">{size}px</span>
						<div class="size-samples">
							{#each Object.entries(sampleTexts) as [lang, text]}
								<p class="sample" style="font-family: '{font}', monospace; font-size: {size}px;">
									<span class="lang-tag">{lang}</span> {text}
								</p>
							{/each}
						</div>
					</div>
				{/each}
			</section>
		{/each}
	</div>
</Story>

<style>
	.container {
		padding: 24px;
		max-width: 960px;
		font-family: system-ui, sans-serif;
	}

	h2 {
		font-size: 20px;
		margin: 0 0 4px;
	}

	.note {
		color: #888;
		font-size: 13px;
		margin: 0 0 24px;
	}

	.font-section {
		margin-bottom: 32px;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 16px;
	}

	.font-name {
		font-family: system-ui, sans-serif;
		font-size: 14px;
		font-weight: 600;
		color: #555;
		margin: 0 0 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid #eee;
	}

	.weight-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.weight-column {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.weight-label {
		font-family: system-ui, sans-serif;
		font-size: 11px;
		font-weight: 700;
		color: #aaa;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-bottom: 4px;
	}

	.sample {
		margin: 0;
		line-height: 1.6;
		font-size: 16px;
	}

	.lang-tag {
		display: inline-block;
		font-family: system-ui, sans-serif;
		font-size: 10px;
		font-weight: 400;
		color: #999;
		background: #f5f5f5;
		padding: 1px 4px;
		border-radius: 3px;
		vertical-align: middle;
		margin-right: 4px;
	}

	.size-row {
		display: flex;
		gap: 12px;
		align-items: baseline;
		margin-bottom: 8px;
	}

	.size-label {
		font-family: system-ui, sans-serif;
		font-size: 11px;
		color: #aaa;
		min-width: 36px;
		text-align: right;
	}

	.size-samples {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
</style>
