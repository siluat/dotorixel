<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TabStrip from './TabStrip.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="SingleTab">
	<TabStrip
		tabs={[{ name: 'Untitled 1' }]}
		activeTabIndex={0}
		onTabClick={() => {}}
		onTabClose={() => {}}
		onNewTab={() => {}}
	/>
</Story>

<Story name="MultipleTabs">
	<TabStrip
		tabs={[{ name: 'Untitled 1' }, { name: 'Untitled 2' }, { name: 'Untitled 3' }]}
		activeTabIndex={1}
		onTabClick={() => {}}
		onTabClose={() => {}}
		onNewTab={() => {}}
	/>
</Story>

<Story name="ManyTabs">
	<div style="width: 400px;">
		<TabStrip
			tabs={[
				{ name: 'Untitled 1' },
				{ name: 'Untitled 2' },
				{ name: 'Untitled 3' },
				{ name: 'Untitled 4' },
				{ name: 'Untitled 5' },
				{ name: 'Untitled 6' },
				{ name: 'Untitled 7' },
				{ name: 'Untitled 8' }
			]}
			activeTabIndex={5}
			onTabClick={() => {}}
			onTabClose={() => {}}
			onNewTab={() => {}}
		/>
	</div>
</Story>
