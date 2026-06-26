<script lang="ts">
	import { Play, Pause, Repeat } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		isPlaying: boolean;
		isLooping: boolean;
		/** 1-based ordinal shown in the readout (playhead while playing, else active frame). */
		position: number;
		/** Total frame count (the readout's denominator). */
		frameCount: number;
		onTogglePlay: () => void;
		onToggleLoop: () => void;
	}

	let { isPlaying, isLooping, position, frameCount, onTogglePlay, onToggleLoop }: Props = $props();

	// Nothing to animate with a single frame, so both transport controls are inert
	// (the 200 design's disabled state). Playback can never be running here either —
	// the controller stops on the structural change that drops the count to one.
	const isSingleFrame = $derived(frameCount <= 1);
</script>

<div class="transport-bar" role="toolbar" aria-label={m.aria_playbackToolbar()} data-transport-bar>
	<button
		type="button"
		class="transport-btn transport-btn--play"
		data-transport-play
		aria-label={isPlaying ? m.aria_pause() : m.aria_play()}
		aria-pressed={isPlaying}
		disabled={isSingleFrame}
		onclick={onTogglePlay}
	>
		{#if isPlaying}
			<Pause size={16} strokeWidth={2} aria-hidden="true" />
		{:else}
			<Play size={16} strokeWidth={2} aria-hidden="true" />
		{/if}
	</button>
	<button
		type="button"
		class="transport-btn transport-btn--loop"
		class:transport-btn--loop-on={isLooping}
		data-transport-loop
		aria-label={m.aria_toggleLoop()}
		aria-pressed={isLooping}
		disabled={isSingleFrame}
		onclick={onToggleLoop}
	>
		<Repeat size={16} strokeWidth={2} aria-hidden="true" />
	</button>
	<span class="transport-position" data-transport-position>{position} / {frameCount}</span>
</div>

<style>
	.transport-bar {
		--transport-btn-size: 28px;
		--transport-height: 40px;

		display: flex;
		align-items: center;
		gap: var(--ds-space-4);
		height: var(--transport-height);
		padding: 0 var(--ds-space-4);
		flex: none;
		background: var(--ds-bg-elevated);
		border-bottom: var(--ds-border-width) solid var(--ds-border-subtle);
	}

	/* Mobile (Timeline tab takeover): play/loop grow to the ≥44px touch target and
	   the bar grows to seat them (web-styling.md; 200 §5). Matches the TimelinePanel
	   tab-takeover breakpoint. */
	@media (max-width: 1023px) {
		.transport-bar {
			--transport-btn-size: var(--ds-touch-target-min);
			--transport-height: 56px;
		}
	}

	.transport-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--transport-btn-size);
		height: var(--transport-btn-size);
		padding: 0;
		border: none;
		border-radius: var(--ds-radius-sm);
		background: none;
		cursor: pointer;
	}

	.transport-btn:focus-visible {
		outline: var(--ds-border-width-thick) solid var(--ds-accent);
		outline-offset: 1px;
	}

	.transport-btn--play {
		background: var(--ds-accent);
		color: #FFFFFF;
	}

	.transport-btn--loop {
		color: var(--ds-text-secondary);
	}

	.transport-btn--loop:hover {
		background: var(--ds-bg-hover);
		color: var(--ds-text-primary);
	}

	/* Two-channel on-state (color-blind safe): accent-subtle fill + an accent
	   outline, with the icon in accent-text — readable without relying on hue. */
	.transport-btn--loop-on,
	.transport-btn--loop-on:hover {
		background: var(--ds-accent-subtle);
		color: var(--ds-accent-text);
		box-shadow: inset 0 0 0 var(--ds-border-width) var(--ds-accent);
	}

	/* Single-frame disabled state, last so it overrides both variants in source
	   order too (its class+pseudo specificity already wins): the controls drop to a
	   muted, inert treatment — the play button loses its accent fill — per 200. */
	.transport-btn:disabled {
		background: var(--ds-bg-hover);
		color: var(--ds-text-tertiary);
		cursor: default;
		box-shadow: none;
	}

	/* Right-aligned position readout (playhead while playing, else the active
	   frame ordinal). Tabular figures keep the n/N width stable as it advances. */
	.transport-position {
		margin-left: auto;
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-md);
		color: var(--ds-text-tertiary);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
