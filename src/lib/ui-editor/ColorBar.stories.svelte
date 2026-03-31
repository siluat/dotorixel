<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ColorBar from './ColorBar.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="WithRecent">
	<div style="width: 390px;">
		<ColorBar
			foregroundColor="#2D210F"
			backgroundColor="#FFFFFF"
			recentColors={['#EF4444', '#22C55E', '#3B82F6', '#8B5CF6', '#F59E0B']}
			onForegroundColorChange={() => {}}
		/>
	</div>
</Story>

<Story name="Empty">
	<div style="width: 390px;">
		<ColorBar
			foregroundColor="#E84393"
			backgroundColor="#1E1E28"
			recentColors={[]}
			onForegroundColorChange={() => {}}
		/>
	</div>
</Story>

<Story name="Medium">
	<div style="width: 768px;">
		<ColorBar
			foregroundColor="#2D210F"
			backgroundColor="#FFFFFF"
			recentColors={['#EF4444', '#22C55E', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#000000']}
			onForegroundColorChange={() => {}}
		/>
	</div>
</Story>
