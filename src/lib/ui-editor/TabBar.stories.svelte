<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TabBar from './TabBar.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="DrawActive">
	<div style="width: 390px;">
		<TabBar activeTab="draw" onTabChange={() => {}} />
	</div>
</Story>

<Story name="ColorsActive">
	<div style="width: 390px;">
		<TabBar activeTab="colors" onTabChange={() => {}} />
	</div>
</Story>

<Story name="SettingsActive">
	<div style="width: 390px;">
		<TabBar activeTab="settings" onTabChange={() => {}} />
	</div>
</Story>
