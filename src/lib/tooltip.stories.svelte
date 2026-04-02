<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';

	const { Story } = defineMeta({});
</script>

<script>
	import { tooltip } from '$lib/tooltip';
</script>

<Story name="WithShortcut">
	<div class="tooltip-story-bg">
		<button type="button" class="demo-btn" use:tooltip={'Pencil (P)'} aria-label="Pencil (P)">Hover me</button>
	</div>
</Story>

<Story name="WithoutShortcut">
	<div class="tooltip-story-bg">
		<button type="button" class="demo-btn" use:tooltip={'Zoom Out'} aria-label="Zoom Out">Hover me</button>
	</div>
</Story>

<Story name="WithModifier">
	<div class="tooltip-story-bg">
		<button type="button" class="demo-btn" use:tooltip={'Undo (⌘Z)'} aria-label="Undo (⌘Z)">Hover me</button>
	</div>
</Story>

<Story name="ButtonRow">
	<div class="tooltip-story-bg">
		<div class="button-row">
			<button type="button" class="demo-btn" use:tooltip={'Pencil (P)'} aria-label="Pencil (P)">P</button>
			<button type="button" class="demo-btn" use:tooltip={'Line (L)'} aria-label="Line (L)">L</button>
			<button type="button" class="demo-btn" use:tooltip={'Eraser (E)'} aria-label="Eraser (E)">E</button>
			<button type="button" class="demo-btn" use:tooltip={'Zoom Out'} aria-label="Zoom Out">-</button>
		</div>
	</div>
</Story>

<style>
	.tooltip-story-bg {
		background: var(--ds-bg-base, #FDFBF8);
		padding: 60px 40px;
	}

	.demo-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 1px solid var(--ds-border, #D8CFC2);
		border-radius: 6px;
		background: var(--ds-bg-elevated, #FFFFFF);
		color: var(--ds-text-secondary, #7B6D59);
		font-family: var(--ds-font-body, system-ui, sans-serif);
		font-size: 13px;
		cursor: pointer;
	}

	.demo-btn:hover {
		background: var(--ds-bg-hover, #EDE8DF);
	}

	.button-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
</style>
