<script lang="ts">
	import { ChevronDown, ChevronUp, X } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';
	import type { ReferenceImage } from './reference-image-types';
	import { computeResize } from './compute-resize';
	import { windowToImageCoords } from './window-to-image-coords';
	import { MIN_WINDOW_EDGE } from './reference-window-constants';
	import {
		createLongPressDetector,
		type LongPressDetector,
		type PointerSnapshot
	} from '$lib/gestures/long-press';

	interface Props {
		reference: ReferenceImage;
		x: number;
		y: number;
		width: number;
		height: number;
		isActive: boolean;
		minimized?: boolean;
		onClose: () => void;
		onMove?: (x: number, y: number) => void;
		onMoveCommit?: () => void;
		onResize?: (width: number, height: number) => void;
		onResizeCommit?: () => void;
		onMinimizeChange?: (next: boolean) => void;
		onActivate?: () => void;
		onSamplePixelAt?: (imageX: number, imageY: number) => void;
		onSampleStart?: (imageX: number, imageY: number) => void;
		onSampleMove?: (imageX: number, imageY: number) => void;
		onSampleEnd?: (imageX: number, imageY: number) => void;
	}

	let {
		reference,
		x,
		y,
		width,
		height,
		isActive,
		minimized = false,
		onClose,
		onMove,
		onMoveCommit,
		onResize,
		onResizeCommit,
		onMinimizeChange,
		onActivate,
		onSamplePixelAt,
		onSampleStart,
		onSampleMove,
		onSampleEnd
	}: Props = $props();

	let dragOrigin: { startX: number; startY: number; pointerX: number; pointerY: number } | null =
		null;

	function handleTitleBarPointerDown(e: PointerEvent) {
		if (!onMove) return;
		if ((e.target as HTMLElement).closest('button')) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		dragOrigin = { startX: x, startY: y, pointerX: e.clientX, pointerY: e.clientY };
	}

	function handleTitleBarPointerMove(e: PointerEvent) {
		if (!dragOrigin || !onMove) return;
		const nextX = dragOrigin.startX + (e.clientX - dragOrigin.pointerX);
		const nextY = dragOrigin.startY + (e.clientY - dragOrigin.pointerY);
		onMove(nextX, nextY);
	}

	function handleTitleBarPointerUp() {
		releaseTitleBarDrag();
	}

	function handleTitleBarLostCapture() {
		releaseTitleBarDrag();
	}

	function handleTitleBarDblClick(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('button')) return;
		onMinimizeChange?.(!minimized);
	}

	function releaseTitleBarDrag() {
		if (dragOrigin) {
			dragOrigin = null;
			onMoveCommit?.();
		}
	}

	let resizeOrigin: {
		startWidth: number;
		startHeight: number;
		pointerX: number;
		pointerY: number;
	} | null = null;

	function handleWindowPointerDown(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('.title-bar-button')) return;
		onActivate?.();
	}

	function handleResizePointerDown(e: PointerEvent) {
		if (!onResize) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		resizeOrigin = {
			startWidth: width,
			startHeight: height,
			pointerX: e.clientX,
			pointerY: e.clientY
		};
	}

	function handleResizePointerMove(e: PointerEvent) {
		if (!resizeOrigin || !onResize) return;
		const next = computeResize({
			startWidth: resizeOrigin.startWidth,
			startHeight: resizeOrigin.startHeight,
			deltaX: e.clientX - resizeOrigin.pointerX,
			deltaY: e.clientY - resizeOrigin.pointerY,
			minSize: MIN_WINDOW_EDGE
		});
		onResize(next.width, next.height);
	}

	function handleResizePointerUp() {
		releaseResize();
	}

	function handleResizeLostCapture() {
		releaseResize();
	}

	function releaseResize() {
		if (resizeOrigin) {
			resizeOrigin = null;
			onResizeCommit?.();
		}
	}

	let imageEl = $state<HTMLImageElement | null>(null);
	let detector: LongPressDetector | null = null;
	let pendingTapCoords: { x: number; y: number } | null = null;

	$effect(() => {
		return () => detector?.dispose();
	});

	function snapshotToImageCoords(p: PointerSnapshot): { x: number; y: number } | null {
		if (!imageEl) return null;
		const rect = imageEl.getBoundingClientRect();
		return windowToImageCoords({
			localX: p.x - rect.left,
			localY: p.y - rect.top,
			displayedWidth: rect.width,
			displayedHeight: rect.height,
			naturalWidth: reference.naturalWidth,
			naturalHeight: reference.naturalHeight
		});
	}

	function ensureDetector(): LongPressDetector {
		if (detector) return detector;
		detector = createLongPressDetector({
			onFire(p) {
				const c = snapshotToImageCoords(p);
				if (c) onSampleStart?.(c.x, c.y);
			},
			onMove(p) {
				const c = snapshotToImageCoords(p);
				if (c) onSampleMove?.(c.x, c.y);
			},
			onEnd(p) {
				const c = snapshotToImageCoords(p);
				if (c) onSampleEnd?.(c.x, c.y);
			},
			onCancel() {
				if (pendingTapCoords) {
					onSamplePixelAt?.(pendingTapCoords.x, pendingTapCoords.y);
				}
				pendingTapCoords = null;
			}
		});
		return detector;
	}

	function isLongPressPointer(e: PointerEvent): boolean {
		return e.pointerType === 'touch' || e.pointerType === 'pen';
	}

	function handleImagePointerDown(e: PointerEvent) {
		if (!isLongPressPointer(e)) {
			if (!onSamplePixelAt) return;
			const c = snapshotToImageCoords({ pointerId: e.pointerId, x: e.clientX, y: e.clientY });
			if (c) onSamplePixelAt(c.x, c.y);
			return;
		}
		const c = snapshotToImageCoords({ pointerId: e.pointerId, x: e.clientX, y: e.clientY });
		pendingTapCoords = c;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		ensureDetector().pointerDown({ pointerId: e.pointerId, x: e.clientX, y: e.clientY });
	}

	function handleImagePointerMove(e: PointerEvent) {
		if (!isLongPressPointer(e)) return;
		detector?.pointerMove({ pointerId: e.pointerId, x: e.clientX, y: e.clientY });
	}

	function handleImagePointerUp(e: PointerEvent) {
		if (!isLongPressPointer(e)) return;
		detector?.pointerUp({ pointerId: e.pointerId, x: e.clientX, y: e.clientY });
	}

	function handleImagePointerCancel(e: PointerEvent) {
		if (!isLongPressPointer(e)) return;
		detector?.pointerCancel({ pointerId: e.pointerId, x: e.clientX, y: e.clientY });
	}

	function objectUrl(node: HTMLImageElement, blob: Blob) {
		let url = URL.createObjectURL(blob);
		node.src = url;
		return {
			update(newBlob: Blob) {
				URL.revokeObjectURL(url);
				url = URL.createObjectURL(newBlob);
				node.src = url;
			},
			destroy() {
				URL.revokeObjectURL(url);
			}
		};
	}
</script>

<div
	class="window"
	role="dialog"
	aria-label={reference.filename}
	tabindex="-1"
	data-active={isActive ? 'true' : 'false'}
	data-minimized={minimized ? 'true' : 'false'}
	style:left="{x}px"
	style:top="{y}px"
	style:width="{width}px"
	style:height={minimized ? 'auto' : `${height}px`}
	style:pointer-events="auto"
	onpointerdown={handleWindowPointerDown}
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="title-bar"
		onpointerdown={handleTitleBarPointerDown}
		onpointermove={handleTitleBarPointerMove}
		onpointerup={handleTitleBarPointerUp}
		onlostpointercapture={handleTitleBarLostCapture}
		ondblclick={handleTitleBarDblClick}
	>
		<span class="title">{reference.filename}</span>
		<div class="title-bar-controls">
			<button
				class="title-bar-button"
				onclick={() => onMinimizeChange?.(!minimized)}
				aria-label={minimized
					? m.references_window_restore({ name: reference.filename })
					: m.references_window_minimize({ name: reference.filename })}
			>
				{#if minimized}
					<ChevronDown size={14} />
				{:else}
					<ChevronUp size={14} />
				{/if}
			</button>
			<button
				class="title-bar-button"
				onclick={onClose}
				aria-label={m.references_window_close({ name: reference.filename })}
			>
				<X size={14} />
			</button>
		</div>
	</div>
	{#if !minimized}
		<div class="body">
			<img
				class="image"
				alt={reference.filename}
				bind:this={imageEl}
				use:objectUrl={reference.blob}
				onpointerdown={handleImagePointerDown}
				onpointermove={handleImagePointerMove}
				onpointerup={handleImagePointerUp}
				onpointercancel={handleImagePointerCancel}
			/>
		</div>
		<button
			type="button"
			class="resize-handle"
			aria-label={m.references_window_resize({ name: reference.filename })}
			onpointerdown={handleResizePointerDown}
			onpointermove={handleResizePointerMove}
			onpointerup={handleResizePointerUp}
			onlostpointercapture={handleResizeLostCapture}
		></button>
	{/if}
</div>

<style>
	.window {
		position: absolute;
		display: flex;
		flex-direction: column;
		background: var(--ds-bg-elevated);
		border: 1px solid var(--ds-border-subtle);
		border-radius: 8px;
		overflow: hidden;
		box-shadow: var(--ds-shadow-sm);
	}

	.window[data-active='true'] {
		box-shadow: var(--ds-shadow-md);
	}

	.title-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		height: 28px;
		padding: 0 6px 0 10px;
		background: var(--ds-bg-subtle);
		border-bottom: 1px solid var(--ds-border-subtle);
		flex-shrink: 0;
	}

	.window[data-minimized='true'] .title-bar {
		border-bottom: none;
	}

	.title {
		font-family: var(--ds-font-body-sm);
		font-size: var(--ds-font-size-sm);
		color: var(--ds-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.title-bar-controls {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}

	.title-bar-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: none;
		background: transparent;
		border-radius: 4px;
		color: var(--ds-text-tertiary);
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
	}

	.title-bar-button:hover {
		color: var(--ds-text-primary);
		background: var(--ds-bg-hover);
	}

	.body {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f5f0eb;
		overflow: hidden;
	}

	.image {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		display: block;
		touch-action: none;
	}

	.window[data-active='false'] .image {
		opacity: 0.85;
	}

	.title-bar {
		cursor: grab;
		touch-action: none;
	}

	.title-bar:active {
		cursor: grabbing;
	}

	.resize-handle {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 16px;
		height: 16px;
		padding: 0;
		border: none;
		background: transparent;
		cursor: nwse-resize;
		touch-action: none;
	}

	.resize-handle::before {
		content: '';
		position: absolute;
		inset: -28px 0 0 -28px;
	}

	.resize-handle::after {
		content: '';
		position: absolute;
		right: 3px;
		bottom: 3px;
		width: 10px;
		height: 10px;
		background-image: linear-gradient(
			135deg,
			transparent 0%,
			transparent 30%,
			var(--ds-text-tertiary) 30%,
			var(--ds-text-tertiary) 42%,
			transparent 42%,
			transparent 58%,
			var(--ds-text-tertiary) 58%,
			var(--ds-text-tertiary) 70%,
			transparent 70%
		);
		opacity: 0.7;
		pointer-events: none;
	}

	.resize-handle:hover::after {
		opacity: 1;
	}
</style>
