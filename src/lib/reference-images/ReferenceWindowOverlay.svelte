<script lang="ts">
	import ReferenceWindow from './ReferenceWindow.svelte';
	import type { ReferenceImagesStore } from './reference-images-store.svelte';
	import { clampPosition } from './compute-position-clamp';

	interface Props {
		store: ReferenceImagesStore;
		docId: string;
		viewportWidth?: number;
		viewportHeight?: number;
	}

	let { store, docId, viewportWidth, viewportHeight }: Props = $props();

	const visibleStates = $derived(
		store.displayStatesForDoc(docId).filter((s) => s.visible)
	);

	const sortedStates = $derived([...visibleStates].sort((a, b) => a.zOrder - b.zOrder));

	const maxZ = $derived(
		visibleStates.reduce((max, s) => Math.max(max, s.zOrder), -Infinity)
	);

	function refFor(refId: string) {
		return store.forDoc(docId).find((r) => r.id === refId);
	}

	function fit(stateW: number, stateH: number, stateX: number, stateY: number) {
		if (viewportWidth === undefined || viewportHeight === undefined) {
			return { x: stateX, y: stateY, width: stateW, height: stateH };
		}
		const width = Math.min(stateW, viewportWidth);
		const height = Math.min(stateH, viewportHeight);
		const x = clamp(stateX, 0, Math.max(0, viewportWidth - width));
		const y = clamp(stateY, 0, Math.max(0, viewportHeight - height));
		return { x, y, width, height };
	}

	function clamp(value: number, min: number, max: number): number {
		return Math.min(Math.max(value, min), max);
	}

	function commitPosition(refId: string) {
		if (viewportWidth === undefined || viewportHeight === undefined) return;
		const state = store.displayStateFor(refId, docId);
		if (!state) return;
		const next = clampPosition({
			x: state.x,
			y: state.y,
			width: state.width,
			height: state.height,
			viewportWidth,
			viewportHeight
		});
		if (next.x !== state.x || next.y !== state.y) {
			store.setDisplayPosition(refId, docId, next.x, next.y);
		}
	}
</script>

<div class="overlay">
	{#each sortedStates as state (state.refId)}
		{@const ref = refFor(state.refId)}
		{#if ref}
			{@const r = fit(state.width, state.height, state.x, state.y)}
			<ReferenceWindow
				reference={ref}
				x={r.x}
				y={r.y}
				width={r.width}
				height={r.height}
				isActive={state.zOrder === maxZ}
				onClose={() => store.close(state.refId, docId)}
				onMove={(x, y) => store.setDisplayPosition(state.refId, docId, x, y)}
				onMoveCommit={() => commitPosition(state.refId)}
				onResize={(width, height) => store.setDisplaySize(state.refId, docId, width, height)}
			/>
		{/if}
	{/each}
</div>

<style>
	.overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 50;
	}
</style>
