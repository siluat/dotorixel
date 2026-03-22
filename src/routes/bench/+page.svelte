<script lang="ts">
	import { renderPixelCanvas } from '$lib/canvas/renderer';

	const CANVAS_SIZES = [8, 16, 32, 64, 128];
	const ZOOM_LEVELS = [1, 8, 16];
	const TARGET_DISPLAY_SIZE = 512;
	const WARMUP_FRAMES = 10;
	const MEASURE_FRAMES = 100;
	const VIEWPORT_SIZE = { width: 512, height: 512 };

	interface BenchmarkResult {
		canvasSize: number;
		zoom: number;
		effectivePixelSize: number;
		medianMs: number;
		p95Ms: number;
		theoreticalFps: number;
	}

	let results = $state<BenchmarkResult[]>([]);
	let isRunning = $state(false);
	let progress = $state('');
	let copied = $state(false);

	function createMockCanvas(size: number) {
		const pixelData = new Uint8Array(size * size * 4);
		for (let i = 0; i < pixelData.length; i += 4) {
			pixelData[i] = 128;
			pixelData[i + 1] = 64;
			pixelData[i + 2] = 192;
			pixelData[i + 3] = 180;
		}
		return {
			width: size,
			height: size,
			pixels: () => pixelData
		};
	}

	function createViewport(canvasSize: number, zoom: number) {
		const pixelSize = Math.floor(TARGET_DISPLAY_SIZE / canvasSize);
		return {
			pixelSize,
			zoom,
			panX: 0,
			panY: 0,
			showGrid: true,
			gridColor: '#cccccc'
		};
	}

	function median(arr: number[]): number {
		const sorted = [...arr].sort((a, b) => a - b);
		const mid = Math.floor(sorted.length / 2);
		return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
	}

	function percentile95(arr: number[]): number {
		const sorted = [...arr].sort((a, b) => a - b);
		return sorted[Math.ceil(sorted.length * 0.95) - 1];
	}

	async function runBenchmark() {
		isRunning = true;
		results = [];
		copied = false;

		const canvas = document.createElement('canvas');
		canvas.width = VIEWPORT_SIZE.width;
		canvas.height = VIEWPORT_SIZE.height;
		const ctx = canvas.getContext('2d')!;

		for (const size of CANVAS_SIZES) {
			const mockCanvas = createMockCanvas(size);

			for (const zoom of ZOOM_LEVELS) {
				const viewport = createViewport(size, zoom);
				const eps = Math.round(viewport.pixelSize * zoom);
				progress = `${size}\u00d7${size} @ ${zoom}\u00d7 (effective pixel: ${eps}px)...`;

				// Yield to let the UI update
				await new Promise((r) => setTimeout(r, 0));

				// Warmup
				for (let i = 0; i < WARMUP_FRAMES; i++) {
					renderPixelCanvas(ctx, mockCanvas, viewport, VIEWPORT_SIZE);
				}

				// Measure
				const times: number[] = [];
				for (let i = 0; i < MEASURE_FRAMES; i++) {
					const start = performance.now();
					renderPixelCanvas(ctx, mockCanvas, viewport, VIEWPORT_SIZE);
					const end = performance.now();
					times.push(end - start);
				}

				const med = median(times);
				results = [
					...results,
					{
						canvasSize: size,
						zoom,
						effectivePixelSize: eps,
						medianMs: med,
						p95Ms: percentile95(times),
						theoreticalFps: med > 0 ? Math.round(1000 / med) : Infinity
					}
				];
			}
		}

		progress = 'Done!';
		isRunning = false;
	}

	function resultsAsMarkdown(): string {
		let md = '| Canvas | Zoom | Effective px | Median (ms) | P95 (ms) | Max FPS |\n';
		md += '|--------|------|-------------|-------------|----------|----------|\n';
		for (const r of results) {
			const fps = r.theoreticalFps === Infinity ? '>10000' : String(r.theoreticalFps);
			md += `| ${r.canvasSize}\u00d7${r.canvasSize} | ${r.zoom}\u00d7 | ${r.effectivePixelSize} | ${r.medianMs.toFixed(3)} | ${r.p95Ms.toFixed(3)} | ${fps} |\n`;
		}
		return md;
	}

	async function copyAsMarkdown() {
		await navigator.clipboard.writeText(resultsAsMarkdown());
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="bench-page">
	<h1>Canvas2D Rendering Benchmark</h1>
	<p class="description">
		Measures <code>renderPixelCanvas()</code> frame time across canvas sizes and zoom levels.
		Viewport: {VIEWPORT_SIZE.width}&times;{VIEWPORT_SIZE.height}, grid: on, all pixels: semi-transparent.
		Warmup: {WARMUP_FRAMES} frames, measured: {MEASURE_FRAMES} frames.
	</p>

	<div class="controls">
		<button onclick={runBenchmark} disabled={isRunning}>
			{isRunning ? 'Running...' : 'Run Benchmark'}
		</button>
		{#if results.length > 0}
			<button onclick={copyAsMarkdown} disabled={isRunning}>
				{copied ? 'Copied!' : 'Copy as Markdown'}
			</button>
		{/if}
	</div>

	{#if progress}
		<p class="progress">{progress}</p>
	{/if}

	{#if results.length > 0}
		<table>
			<thead>
				<tr>
					<th>Canvas</th>
					<th>Zoom</th>
					<th>Effective px</th>
					<th>Median (ms)</th>
					<th>P95 (ms)</th>
					<th>Max FPS</th>
				</tr>
			</thead>
			<tbody>
				{#each results as r}
					<tr>
						<td>{r.canvasSize}&times;{r.canvasSize}</td>
						<td>{r.zoom}&times;</td>
						<td>{r.effectivePixelSize}</td>
						<td>{r.medianMs.toFixed(3)}</td>
						<td>{r.p95Ms.toFixed(3)}</td>
						<td>{r.theoreticalFps === Infinity ? '>10000' : r.theoreticalFps}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.bench-page {
		max-width: 800px;
		margin: 2rem auto;
		padding: 1rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	h1 {
		font-size: 1.5rem;
		margin-bottom: 0.5rem;
	}

	.description {
		color: #666;
		font-size: 0.875rem;
		margin-bottom: 1.5rem;
	}

	.controls {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	button {
		padding: 0.5rem 1rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		background: #fff;
		cursor: pointer;
		font-size: 0.875rem;
	}

	button:hover:not(:disabled) {
		background: #f0f0f0;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.progress {
		font-size: 0.875rem;
		color: #333;
		margin-bottom: 1rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	th,
	td {
		padding: 0.5rem;
		border: 1px solid #ddd;
		text-align: right;
	}

	th {
		background: #f5f5f5;
		font-weight: 600;
		text-align: center;
	}

	td:first-child,
	td:nth-child(2) {
		text-align: center;
	}
</style>
