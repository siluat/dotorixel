<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TimelinePanel from './TimelinePanel.svelte';

	const { Story } = defineMeta({});

	function pixel(id: string, name: string, visible = true) {
		return { id, name, kind: 'pixel' as const, visible };
	}
	function reference(id: string, name: string) {
		return { id, name, kind: 'reference' as const, visible: true };
	}
	function frame(id: string, occupied: string[] = [], durationMs = 100) {
		return { id, occupiedLayerIds: new Set(occupied), durationMs };
	}

	const noop = () => {};
	const handlers = {
		onAddLayer: noop,
		onAddReferenceLayer: noop,
		onActivateLayer: noop,
		onRemoveLayer: noop,
		onReorderLayer: noop,
		onToggleLayerVisibility: noop,
		onToggleCollapsed: noop,
		onFitReferenceLayerToCanvas: noop,
		onSelectFrame: noop,
		onSelectCel: noop,
		onAddFrame: noop,
		onDuplicateFrame: noop,
		onRemoveFrame: noop,
		onReorderFrame: noop,
		onSetFrameDuration: noop
	};

	// Panel order = top→bottom; a Reference Layer always sits at the bottom.
	const pixelLayers = [pixel('hero', 'Hero'), pixel('hills', 'Hills'), pixel('sky', 'Sky')];
	const fourFrames = [
		frame('f1', ['sky', 'hills'], 100),
		frame('f2', ['sky', 'hills', 'hero'], 250),
		frame('f3', ['sky', 'hero'], 500),
		frame('f4', ['sky'], 1000)
	];
</script>

<!-- These states exercise the Layer × Frame grid — column layout, occupancy dots,
     active highlight, the Reference spanning bar, and the header frame-action group
     (add / duplicate / delete). Ruler-cell drag-reorder is reviewed live here too. -->

<Story name="MultiFrame">
	<div style="width: 720px;">
		<TimelinePanel
			layers={pixelLayers}
			activeLayerId="hero"
			frames={fourFrames}
			activeFrameId="f2"
			collapsed={false}
			{...handlers}
		/>
	</div>
</Story>

<Story name="WithReferenceLayer">
	<div style="width: 720px;">
		<!-- Two pixel rows + the Reference row fit the 180px panel without scrolling,
		     so the discrete-dots vs continuous-bar contrast is visible at a glance. -->
		<TimelinePanel
			layers={[pixel('hero', 'Hero'), pixel('sky', 'Sky'), reference('ref', 'Sketch reference')]}
			activeLayerId="hero"
			frames={fourFrames}
			activeFrameId="f3"
			collapsed={false}
			{...handlers}
		/>
	</div>
</Story>

<Story name="ManyFramesScroll">
	<div style="width: 520px;">
		<TimelinePanel
			layers={pixelLayers}
			activeLayerId="sky"
			frames={Array.from({ length: 16 }, (_, i) =>
				frame(`f${i + 1}`, i % 2 === 0 ? ['sky', 'hero'] : ['sky'])
			)}
			activeFrameId="f9"
			collapsed={false}
			{...handlers}
		/>
	</div>
</Story>

<Story name="SingleFrame">
	<div style="width: 720px;">
		<TimelinePanel
			layers={pixelLayers}
			activeLayerId="hero"
			frames={[frame('f1', ['sky', 'hills', 'hero'])]}
			activeFrameId="f1"
			collapsed={false}
			{...handlers}
		/>
	</div>
</Story>

<Story name="Playing">
	<div style="width: 720px;">
		<!-- Playback running: the Play button shows pause, Loop is on, and the ▼ marker
		     sits over the Playhead frame (f3) — a channel distinct from the Active-Frame
		     highlight (f2), which never moves during playback. -->
		<TimelinePanel
			layers={pixelLayers}
			activeLayerId="hero"
			frames={fourFrames}
			activeFrameId="f2"
			collapsed={false}
			isPlaying={true}
			isLooping={true}
			playheadFrameId="f3"
			{...handlers}
		/>
	</div>
</Story>

<Story name="Collapsed">
	<div style="width: 720px;">
		<TimelinePanel
			layers={pixelLayers}
			activeLayerId="hills"
			frames={fourFrames}
			activeFrameId="f2"
			collapsed={true}
			{...handlers}
		/>
	</div>
</Story>
