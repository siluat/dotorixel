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
	function frame(id: string, occupied: string[] = []) {
		return { id, occupiedLayerIds: new Set(occupied) };
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
		onSelectCel: noop
	};

	// Panel order = top→bottom; a Reference Layer always sits at the bottom.
	const pixelLayers = [pixel('hero', 'Hero'), pixel('hills', 'Hills'), pixel('sky', 'Sky')];
	const fourFrames = [
		frame('f1', ['sky', 'hills']),
		frame('f2', ['sky', 'hills', 'hero']),
		frame('f3', ['sky', 'hero']),
		frame('f4', ['sky'])
	];
</script>

<!-- The multi-frame grid only exists in stories until frame-add UI lands in 192;
     these states are how the column layout, dots, active highlight, and the
     Reference spanning bar are reviewed. -->

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
