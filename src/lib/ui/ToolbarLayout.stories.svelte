<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ToolbarLayout from './ToolbarLayout.svelte';
	import BevelButton from './BevelButton.svelte';
	import FlatButton from './FlatButton.svelte';
	import type { ToolbarItem } from './toolbar-types';
	import { Pencil, Eraser, Undo2, Redo2, ZoomOut, ZoomIn } from 'lucide-svelte';

	const { Story } = defineMeta({});

	const noop = () => {};

	function createSampleItems(overrides: { activeTool?: string } = {}): ToolbarItem[] {
		const { activeTool = 'pencil' } = overrides;
		return [
			{
				kind: 'button',
				icon: Pencil,
				label: 'Pencil',
				active: activeTool === 'pencil',
				onclick: noop
			},
			{
				kind: 'button',
				icon: Eraser,
				label: 'Eraser',
				active: activeTool === 'eraser',
				onclick: noop
			},
			{ kind: 'separator' },
			{ kind: 'button', icon: Undo2, label: 'Undo', disabled: true, onclick: noop },
			{ kind: 'button', icon: Redo2, label: 'Redo', disabled: true, onclick: noop },
			{ kind: 'separator' },
			{ kind: 'button', icon: ZoomOut, label: 'Zoom Out', onclick: noop },
			{ kind: 'label', text: '100%' },
			{ kind: 'button', icon: ZoomIn, label: 'Zoom In', onclick: noop }
		];
	}
</script>

<Story name="WithBevelButton">
	<ToolbarLayout Button={BevelButton} items={createSampleItems()} />
</Story>

<Story name="WithFlatButton">
	<ToolbarLayout Button={FlatButton} items={createSampleItems()} />
</Story>

<Story name="EmptyItems">
	<ToolbarLayout Button={BevelButton} items={[]} />
</Story>
