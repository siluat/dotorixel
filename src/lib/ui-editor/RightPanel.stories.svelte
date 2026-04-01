<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import RightPanel from './RightPanel.svelte';

	const { Story } = defineMeta({});

	const noop = () => {};
</script>

<Story name="Default">
	<div style="height: 700px; width: 240px;">
		<RightPanel
			foregroundColor="#2D210F"
			backgroundColor="#FFFFFF"
			recentColors={['#2D210F', '#EF4444', '#3B82F6']}
			canvasWidth={32}
			canvasHeight={32}
			resizeAnchor="top-left"
			onForegroundColorChange={noop}
			onBackgroundColorChange={noop}
			onSwapColors={noop}
			onResize={noop}
			onClear={noop}
			onAnchorChange={noop}
		/>
	</div>
</Story>

<Story name="NarrowPanel">
	<div style="height: 700px; width: 200px;">
		<RightPanel
			foregroundColor="#E84393"
			backgroundColor="#1E1E28"
			recentColors={[]}
			canvasWidth={16}
			canvasHeight={16}
			resizeAnchor="center"
			onForegroundColorChange={noop}
			onBackgroundColorChange={noop}
			onSwapColors={noop}
			onResize={noop}
			onClear={noop}
			onAnchorChange={noop}
		/>
	</div>
</Story>
