<script lang="ts">
	import { hexToColor, colorToHex, rgbToHsv, hsvToRgb, type HsvColor } from '$lib/canvas/color';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		selectedColor: string;
		onColorChange: (hex: string) => void;
		width?: number;
		height?: number;
	}

	let { selectedColor, onColorChange, width = 200, height = 200 }: Props = $props();

	const hueStripWidth = 20;
	const gap = 8;
	let svWidth = $derived(width - hueStripWidth - gap);

	let svCanvas: HTMLCanvasElement | undefined = $state();
	let hueCanvas: HTMLCanvasElement | undefined = $state();
	let isHueRendered = false;

	let hsv: HsvColor = $state({ h: 0, s: 1, v: 1 });
	let isDraggingSv = $state(false);
	let isDraggingHue = $state(false);

	/** Track the last hex we synced from to avoid overwriting internal state */
	let lastSyncedHex = $state('');

	$effect(() => {
		if (selectedColor !== lastSyncedHex) {
			const color = hexToColor(selectedColor);
			const newHsv = rgbToHsv(color);
			// Preserve hue when color is achromatic (s=0 or v=0)
			const preserveHue = newHsv.s === 0 || newHsv.v === 0;
			hsv = { h: preserveHue ? hsv.h : newHsv.h, s: newHsv.s, v: newHsv.v };
			lastSyncedHex = selectedColor;
		}
	});

	$effect(() => {
		if (!svCanvas) return;
		renderSvCanvas(svCanvas, hsv.h, svWidth, height);
	});

	$effect(() => {
		if (!hueCanvas || isHueRendered) return;
		renderHueCanvas(hueCanvas, hueStripWidth, height);
		isHueRendered = true;
	});

	function renderSvCanvas(canvas: HTMLCanvasElement, hue: number, w: number, h: number): void {
		const ctx = canvas.getContext('2d')!;
		canvas.width = w;
		canvas.height = h;

		// Horizontal: white → pure hue
		const hGrad = ctx.createLinearGradient(0, 0, w, 0);
		hGrad.addColorStop(0, '#ffffff');
		const pureColor = colorToHex(hsvToRgb({ h: hue, s: 1, v: 1 }));
		hGrad.addColorStop(1, pureColor);
		ctx.fillStyle = hGrad;
		ctx.fillRect(0, 0, w, h);

		// Vertical: transparent → black
		const vGrad = ctx.createLinearGradient(0, 0, 0, h);
		vGrad.addColorStop(0, 'rgba(0,0,0,0)');
		vGrad.addColorStop(1, '#000000');
		ctx.fillStyle = vGrad;
		ctx.fillRect(0, 0, w, h);
	}

	function renderHueCanvas(canvas: HTMLCanvasElement, w: number, h: number): void {
		const ctx = canvas.getContext('2d')!;
		canvas.width = w;
		canvas.height = h;

		const grad = ctx.createLinearGradient(0, 0, 0, h);
		const stops = [0, 60, 120, 180, 240, 300, 360];
		for (const deg of stops) {
			const color = colorToHex(hsvToRgb({ h: deg % 360, s: 1, v: 1 }));
			grad.addColorStop(deg / 360, color);
		}
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, w, h);
	}

	function emitColor(): void {
		const rgb = hsvToRgb(hsv);
		const newHex = colorToHex(rgb);
		lastSyncedHex = newHex;
		onColorChange(newHex);
	}

	function handleSvPointerDown(e: PointerEvent): void {
		isDraggingSv = true;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		updateSvFromEvent(e);
	}

	function handleSvPointerMove(e: PointerEvent): void {
		if (!isDraggingSv) return;
		updateSvFromEvent(e);
	}

	function handleSvPointerUp(): void {
		isDraggingSv = false;
	}

	function updateSvFromEvent(e: PointerEvent): void {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
		const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
		hsv = { h: hsv.h, s, v };
		emitColor();
	}

	function handleHuePointerDown(e: PointerEvent): void {
		isDraggingHue = true;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		updateHueFromEvent(e);
	}

	function handleHuePointerMove(e: PointerEvent): void {
		if (!isDraggingHue) return;
		updateHueFromEvent(e);
	}

	function handleHuePointerUp(): void {
		isDraggingHue = false;
	}

	function updateHueFromEvent(e: PointerEvent): void {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const t = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
		const h = t * 360;
		hsv = { h, s: hsv.s, v: hsv.v };
		emitColor();
	}

	let svIndicatorX = $derived(hsv.s * 100);
	let svIndicatorY = $derived((1 - hsv.v) * 100);
	let hueIndicatorY = $derived((hsv.h / 360) * 100);
</script>

<div class="hsv-picker" style:width="{width}px" style:height="{height}px">
	<div
		class="sv-area"
		style:width="{svWidth}px"
		style:height="{height}px"
		role="slider"
		aria-label={m.color_saturationBrightness()}
		aria-valuenow={Math.round(hsv.s * 100)}
		aria-valuetext={m.aria_saturationValue({ s: Math.round(hsv.s * 100), v: Math.round(hsv.v * 100) })}
		tabindex="0"
		onpointerdown={handleSvPointerDown}
		onpointermove={handleSvPointerMove}
		onpointerup={handleSvPointerUp}
	>
		<canvas bind:this={svCanvas}></canvas>
		<div
			class="sv-indicator"
			style:left="{svIndicatorX}%"
			style:top="{svIndicatorY}%"
		></div>
	</div>

	<div
		class="hue-strip"
		style:width="{hueStripWidth}px"
		style:height="{height}px"
		role="slider"
		aria-label={m.color_hue()}
		aria-valuemin={0}
		aria-valuemax={360}
		aria-valuenow={Math.round(hsv.h)}
		tabindex="0"
		onpointerdown={handleHuePointerDown}
		onpointermove={handleHuePointerMove}
		onpointerup={handleHuePointerUp}
	>
		<canvas bind:this={hueCanvas}></canvas>
		<div
			class="hue-indicator"
			style:top="{hueIndicatorY}%"
		></div>
	</div>
</div>

<style>
	.hsv-picker {
		display: flex;
		gap: 8px;
		user-select: none;
		touch-action: none;
	}

	.sv-area {
		position: relative;
		cursor: crosshair;
		border-radius: var(--picker-border-radius, 0);
		overflow: hidden;
	}

	.sv-area canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.sv-indicator {
		position: absolute;
		width: 12px;
		height: 12px;
		border: 2px solid white;
		border-radius: 50%;
		box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	.hue-strip {
		position: relative;
		cursor: pointer;
		border-radius: var(--picker-border-radius, 0);
		overflow: hidden;
	}

	.hue-strip canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.hue-indicator {
		position: absolute;
		left: -2px;
		right: -2px;
		height: 4px;
		border: 2px solid white;
		border-radius: 2px;
		box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
		transform: translateY(-50%);
		pointer-events: none;
	}
</style>
