<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import { trapFocus } from './trap-focus';

	interface Props {
		open: boolean;
		onclose: () => void;
		children: Snippet;
	}

	let { open, onclose, children }: Props = $props();

	const VELOCITY_THRESHOLD = 0.4;
	const CLOSE_THRESHOLD = 0.25;
	const DRAG_THRESHOLD = 6;
	const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
	const DURATION_MS = 500;
	const TRANSITION = `transform ${DURATION_MS}ms ${EASING}`;
	const OVERLAY_TRANSITION = `opacity ${DURATION_MS}ms ${EASING}`;

	let visible = $state(false);
	let translateY = $state('100%');
	let overlayOpacity = $state(0);
	let contentEl = $state<HTMLDivElement>();

	let isDragging = $state(false);
	let tracking = false;
	let dragStartY = 0;
	let dragStartTime = 0;
	let dragDeltaY = $state(0);

	$effect(() => {
		if (open) {
			const wasVisible = untrack(() => visible);
			if (!wasVisible) {
				visible = true;
				document.body.style.overflow = 'hidden';
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						translateY = '0';
						overlayOpacity = 1;
					});
				});
			} else {
				translateY = '0';
				overlayOpacity = 1;
			}
		} else {
			if (untrack(() => visible)) {
				translateY = '100%';
				overlayOpacity = 0;
			}
		}
	});

	function handleTransitionEnd(e: TransitionEvent) {
		if (e.propertyName === 'transform' && !open && !isDragging) {
			visible = false;
			dragDeltaY = 0;
			document.body.style.overflow = '';
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!visible) return;
		if (e.key === 'Escape') onclose();
		else if (e.key === 'Tab' && contentEl) trapFocus(e, contentEl);
	}

	function handlePointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		tracking = true;
		dragStartY = e.clientY;
		dragStartTime = Date.now();
		window.addEventListener('pointermove', handlePointerMove);
		window.addEventListener('pointerup', handlePointerUp);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!tracking) return;
		const delta = e.clientY - dragStartY;

		if (!isDragging) {
			if (delta < DRAG_THRESHOLD) return;
			isDragging = true;
			dragStartY = e.clientY;
			dragStartTime = Date.now();
			return;
		}

		dragDeltaY = Math.max(0, e.clientY - dragStartY);
		const height = contentEl?.offsetHeight ?? 1;
		overlayOpacity = Math.max(0, 1 - dragDeltaY / height);
	}

	function handlePointerUp() {
		window.removeEventListener('pointermove', handlePointerMove);
		window.removeEventListener('pointerup', handlePointerUp);

		if (!isDragging) {
			tracking = false;
			return;
		}

		const height = contentEl?.offsetHeight ?? 1;
		const elapsed = Date.now() - dragStartTime;
		const velocity = dragDeltaY / elapsed;
		const percent = dragDeltaY / height;

		isDragging = false;
		tracking = false;
		dragDeltaY = 0;

		if (velocity > VELOCITY_THRESHOLD || percent > CLOSE_THRESHOLD) {
			onclose();
		} else {
			overlayOpacity = 1;
		}
	}

	const contentTransform = $derived(
		isDragging
			? `translate3d(0, ${dragDeltaY}px, 0)`
			: `translate3d(0, ${translateY}, 0)`
	);

	const contentTransition = $derived(isDragging ? 'none' : TRANSITION);
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if visible}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="bottom-sheet-overlay"
		style:opacity={overlayOpacity}
		style:transition={OVERLAY_TRANSITION}
		onmousedown={onclose}
		role="presentation"
	></div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="bottom-sheet-content"
		bind:this={contentEl}
		style:transform={contentTransform}
		style:transition={contentTransition}
		ontransitionend={handleTransitionEnd}
		onpointerdown={handlePointerDown}
		role="dialog"
		aria-modal="true"
	>
		{@render children()}
	</div>
{/if}

<style>
	.bottom-sheet-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 200;
	}

	.bottom-sheet-content {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 201;
		touch-action: none;
	}
</style>
