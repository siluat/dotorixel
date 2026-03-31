<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ColorsContent from './ColorsContent.svelte';

	const { Story } = defineMeta({});
</script>

<Story name="Default">
	<div style="width: 390px; height: 700px; background: var(--ds-bg-base);">
		<ColorsContent
			foregroundColor="#2D210F"
			backgroundColor="#FFFFFF"
			onForegroundColorChange={() => {}}
			onBackgroundColorChange={() => {}}
			onSwapColors={() => {}}
		/>
	</div>
</Story>
