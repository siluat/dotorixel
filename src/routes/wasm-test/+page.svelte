<script lang="ts">
	import init, {
		core_version,
		WasmColor,
		WasmPixelCanvas,
		WasmToolType,
		apply_tool,
	} from '$wasm/dotorixel_wasm';

	let status = $state('Loading WASM...');
	let results = $state<string[]>([]);

	async function runTests() {
		try {
			await init();
			results.push('WASM initialized');

			// core_version
			const version = core_version();
			results.push(`Core version: ${version}`);

			// Color
			const red = new WasmColor(255, 0, 0, 255);
			results.push(`Color: rgba(${red.r}, ${red.g}, ${red.b}, ${red.a}) → ${red.to_hex()}`);

			const parsed = WasmColor.from_hex('#00ff80');
			results.push(`from_hex('#00ff80'): rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${parsed.a})`);

			// Canvas
			const canvas = new WasmPixelCanvas(8, 8);
			results.push(`Canvas: ${canvas.width}×${canvas.height}, pixels: ${canvas.pixels().length} bytes`);

			// Tool
			const color = new WasmColor(255, 128, 0, 255);
			apply_tool(canvas, 3, 4, WasmToolType.Pencil, color);
			const pixel = canvas.get_pixel(3, 4);
			results.push(`Pencil at (3,4): rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a})`);

			status = 'All checks passed';
		} catch (e) {
			status = `Error: ${e}`;
		}
	}

	runTests();
</script>

<h1>WASM Integration Test</h1>
<p><strong>Status:</strong> {status}</p>
<ul>
	{#each results as result}
		<li>{result}</li>
	{/each}
</ul>
