<script lang="ts">
	import ReferenceWindow from './ReferenceWindow.svelte';
	import type { References } from './references.svelte';
	import { commitMove } from './reference-window-placement';
	import type { LoupeInputSource } from '../canvas/sampling/types';

	interface Props {
		store: References;
		docId: string;
		viewportWidth: number;
		viewportHeight: number;
		/**
		 * When true, mouse press-and-drag and touch short-tap on the reference
		 * image route through the sampling lifecycle. Touch/pen long-press
		 * sampling stays unconditional (tool-independent global gesture).
		 */
		quickSamplingEnabled?: boolean;
		onSampleStart?: (
			blob: Blob,
			imageX: number,
			imageY: number,
			inputSource: LoupeInputSource
		) => void;
		onSampleMove?: (imageX: number, imageY: number) => void;
		onSampleEnd?: (imageX: number, imageY: number) => void;
	}

	let {
		store,
		docId,
		viewportWidth,
		viewportHeight,
		quickSamplingEnabled = false,
		onSampleStart,
		onSampleMove,
		onSampleEnd
	}: Props = $props();

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

	function commitPosition(refId: string) {
		const state = store.displayStateFor(refId, docId);
		if (!state) return;
		const next = commitMove(
			{ x: state.x, y: state.y, width: state.width, height: state.height },
			state.x,
			state.y,
			{ width: viewportWidth, height: viewportHeight }
		);
		if (next.x !== state.x || next.y !== state.y) {
			store.setDisplayPosition(refId, docId, next.x, next.y);
		}
	}
</script>

<div class="overlay">
	{#each sortedStates as state (state.refId)}
		{@const ref = refFor(state.refId)}
		{#if ref}
			<ReferenceWindow
				reference={ref}
				x={state.x}
				y={state.y}
				width={state.width}
				height={state.height}
				{viewportWidth}
				{viewportHeight}
				isActive={state.zOrder === maxZ}
				minimized={state.minimized}
				onClose={() => store.close(state.refId, docId)}
				onMove={(x, y) => store.setDisplayPosition(state.refId, docId, x, y)}
				onMoveCommit={() => commitPosition(state.refId)}
				onResize={(width, height) => store.setDisplaySize(state.refId, docId, width, height)}
				onMinimizeChange={(next) => store.setMinimized(state.refId, docId, next)}
				onActivate={() => {
					if (state.zOrder !== maxZ) store.show(state.refId, docId);
				}}
				{quickSamplingEnabled}
				onSampleStart={onSampleStart
					? (imageX, imageY, inputSource) =>
							onSampleStart(ref.blob, imageX, imageY, inputSource)
					: undefined}
				{onSampleMove}
				{onSampleEnd}
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
