<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import RightPanel from './RightPanel.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div style="height: 700px; width: 240px;">
		<RightPanel
			foregroundColor="#2D210F"
			backgroundColor="#FFFFFF"
			recentColors={['#2D210F', '#EF4444', '#3B82F6']}
			canvasWidth={32}
			canvasHeight={32}
			onForegroundColorChange={() => {}}
			onBackgroundColorChange={() => {}}
			onSwapColors={() => {}}
			onResize={() => {}}
			onClear={() => {}}
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
			onForegroundColorChange={() => {}}
			onBackgroundColorChange={() => {}}
			onSwapColors={() => {}}
			onResize={() => {}}
			onClear={() => {}}
		/>
	</div>
</Story>
