<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorState } from '$lib/canvas/editor-state.svelte';
	import PixelCanvasView from '$lib/canvas/PixelCanvasView.svelte';
	import { createLayoutMode } from '$lib/ui-editor/layout-mode.svelte';
	import TopBar from '$lib/ui-editor/TopBar.svelte';
	import LeftToolbar from '$lib/ui-editor/LeftToolbar.svelte';
	import RightPanel from '$lib/ui-editor/RightPanel.svelte';
	import StatusBar from '$lib/ui-editor/StatusBar.svelte';
	import AppBar from '$lib/ui-editor/AppBar.svelte';
	import ToolStrip from '$lib/ui-editor/ToolStrip.svelte';
	import ColorBar from '$lib/ui-editor/ColorBar.svelte';
	import TabBar from '$lib/ui-editor/TabBar.svelte';
	import ColorsContent from '$lib/ui-editor/ColorsContent.svelte';
	import SettingsContent from '$lib/ui-editor/SettingsContent.svelte';
	import {
		trackEditorOpen,
		trackToolUsage,
		trackExport,
		trackCanvasSize,
		trackSessionEnd
	} from '$lib/analytics/events';

	type MobileTab = 'draw' | 'colors' | 'settings';

	const editor = new EditorState({
		foregroundColor: { r: 45, g: 45, b: 45, a: 255 },
		gridColor: '#ECE5D9'
	});

	const layout = createLayoutMode();
	let activeTab: MobileTab = $state('draw');
	let canvasContainerEl: HTMLDivElement | undefined = $state();
	let needsInitialFit = true;

	onMount(() => {
		trackEditorOpen('editor');
		const sessionStart = Date.now();
		return () => {
			trackSessionEnd((Date.now() - sessionStart) / 1000);
		};
	});

	let prevTool: string | undefined;
	$effect(() => {
		const tool = editor.activeTool;
		if (prevTool !== undefined && prevTool !== tool) {
			trackToolUsage(tool);
		}
		prevTool = tool;
	});

	$effect(() => {
		if (!canvasContainerEl) return;
		const ro = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			const { width, height } = entry.contentRect;
			const w = Math.round(width);
			const h = Math.round(height);
			editor.viewportSize = { width: w, height: h };
			if (needsInitialFit) {
				needsInitialFit = false;
				editor.handleFit(1.0);
			}
		});
		ro.observe(canvasContainerEl);
		return () => ro.disconnect();
	});

	function handleResize(w: number, h: number) {
		editor.handleResize(w, h);
		trackCanvasSize(w, h);
	}

	function handleExport() {
		editor.handleExportPng();
		trackExport(editor.pixelCanvas.width, editor.pixelCanvas.height);
	}
</script>

<svelte:window onkeydown={editor.handleKeyDown} onkeyup={editor.handleKeyUp} onblur={editor.handleBlur} />

{#if layout.isDocked}
	<div class="editor-docked">
		<TopBar
			zoomPercent={editor.zoomPercent}
			showGrid={editor.viewportState.showGrid}
			onZoomIn={editor.handleZoomIn}
			onZoomOut={editor.handleZoomOut}
			onZoomReset={editor.handleZoomReset}
			onFit={editor.handleFit}
			onGridToggle={editor.handleGridToggle}
			onExport={handleExport}
		/>

		<LeftToolbar
			activeTool={editor.activeTool}
			canUndo={editor.canUndo}
			canRedo={editor.canRedo}
			onToolChange={(tool) => (editor.activeTool = tool)}
			onUndo={editor.handleUndo}
			onRedo={editor.handleRedo}
		/>

		<div class="canvas-area" bind:this={canvasContainerEl}>
			<PixelCanvasView
				pixelCanvas={editor.pixelCanvas}
				viewportState={editor.viewportState}
				viewportSize={editor.viewportSize}
				renderVersion={editor.renderVersion}
				renderViewport={editor.renderViewport}
				onDraw={editor.handleDraw}
				onDrawStart={editor.handleDrawStart}
				onDrawEnd={editor.handleDrawEnd}
				onViewportChange={editor.handleViewportChange}
				isSpaceHeld={editor.isSpaceHeld}
			/>
		</div>

		<RightPanel
			foregroundColor={editor.foregroundColorHex}
			backgroundColor={editor.backgroundColorHex}
			recentColors={editor.recentColors}
			canvasWidth={editor.pixelCanvas.width}
			canvasHeight={editor.pixelCanvas.height}
			onForegroundColorChange={editor.handleForegroundColorChange}
			onBackgroundColorChange={editor.handleBackgroundColorChange}
			onSwapColors={editor.swapColors}
			onResize={handleResize}
			onClear={editor.handleClear}
		/>

		<StatusBar
			canvasWidth={editor.pixelCanvas.width}
			canvasHeight={editor.pixelCanvas.height}
			activeTool={editor.activeTool}
		/>
	</div>
{:else}
	<div class="editor-tabs">
		<AppBar
			activeTab={activeTab}
			showGrid={editor.viewportState.showGrid}
			zoomPercent={editor.zoomPercent}
			onGridToggle={editor.handleGridToggle}
			onExport={handleExport}
			onZoomIn={editor.handleZoomIn}
			onZoomOut={editor.handleZoomOut}
			onZoomReset={editor.handleZoomReset}
		/>

		<div class="content-area">
			{#if activeTab === 'draw'}
				<div class="canvas-area" bind:this={canvasContainerEl}>
					<PixelCanvasView
						pixelCanvas={editor.pixelCanvas}
						viewportState={editor.viewportState}
						viewportSize={editor.viewportSize}
						renderVersion={editor.renderVersion}
						renderViewport={editor.renderViewport}
						onDraw={editor.handleDraw}
						onDrawStart={editor.handleDrawStart}
						onDrawEnd={editor.handleDrawEnd}
						onViewportChange={editor.handleViewportChange}
						isSpaceHeld={editor.isSpaceHeld}
					/>
				</div>
			{:else if activeTab === 'colors'}
				<ColorsContent
					foregroundColor={editor.foregroundColorHex}
					backgroundColor={editor.backgroundColorHex}
					onForegroundColorChange={editor.handleForegroundColorChange}
					onBackgroundColorChange={editor.handleBackgroundColorChange}
					onSwapColors={editor.swapColors}
				/>
			{:else}
				<SettingsContent
					canvasWidth={editor.pixelCanvas.width}
					canvasHeight={editor.pixelCanvas.height}
					showGrid={editor.viewportState.showGrid}
					onResize={handleResize}
					onExport={handleExport}
					onClear={editor.handleClear}
					onGridToggle={editor.handleGridToggle}
				/>
			{/if}
		</div>

		{#if activeTab === 'draw'}
			<ToolStrip
				activeTool={editor.activeTool}
				canUndo={editor.canUndo}
				canRedo={editor.canRedo}
				onToolChange={(tool) => (editor.activeTool = tool)}
				onUndo={editor.handleUndo}
				onRedo={editor.handleRedo}
			/>
			<ColorBar
				foregroundColor={editor.foregroundColorHex}
				backgroundColor={editor.backgroundColorHex}
				recentColors={editor.recentColors}
				onForegroundColorChange={editor.handleForegroundColorChange}
			/>
		{/if}

		<TabBar
			activeTab={activeTab}
			onTabChange={(tab) => (activeTab = tab)}
		/>
	</div>
{/if}

<style>
	/* === Docked layout (≥1024px) === */
	.editor-docked {
		display: grid;
		width: 100%;
		height: 100vh;
		height: 100dvh;
		background: var(--ds-bg-base);
		font-family: var(--ds-font-body);
		overflow: hidden;
		user-select: none;
		grid-template:
			'topbar  topbar  topbar'  calc(44px + env(safe-area-inset-top, 0px))
			'toolbar canvas  panel'   1fr
			'status  status  status'  calc(28px + env(safe-area-inset-bottom, 0px))
			/ 44px   1fr     200px;
	}

	@media (min-width: 1440px) {
		.editor-docked {
			grid-template:
				'topbar  topbar  topbar'  calc(48px + env(safe-area-inset-top, 0px))
				'toolbar canvas  panel'   1fr
				'status  status  status'  calc(28px + env(safe-area-inset-bottom, 0px))
				/ 48px   1fr     240px;
		}
	}

	.editor-docked > :global(.top-bar) {
		grid-area: topbar;
	}

	.editor-docked > :global(.left-toolbar) {
		grid-area: toolbar;
	}

	.editor-docked > .canvas-area {
		grid-area: canvas;
		position: relative;
		overflow: hidden;
	}

	.editor-docked > :global(.right-panel) {
		grid-area: panel;
	}

	.editor-docked > :global(.status-bar) {
		grid-area: status;
	}

	/* === Tab layout (<1024px) === */
	.editor-tabs {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100vh;
		height: 100dvh;
		background: var(--ds-bg-base);
		font-family: var(--ds-font-body);
		overflow: hidden;
		user-select: none;
		padding-left: env(safe-area-inset-left, 0px);
		padding-right: env(safe-area-inset-right, 0px);
	}

	.editor-tabs .content-area {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	.editor-tabs .canvas-area {
		position: absolute;
		inset: 0;
	}

	.editor-docked :global(input),
	.editor-tabs :global(input) {
		user-select: text;
	}
</style>
