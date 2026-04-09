<script lang="ts">
	import { onMount } from 'svelte';
	import { Workspace } from '$lib/canvas/workspace.svelte';
	import type { EditorState } from '$lib/canvas/editor-state.svelte';
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
	import TabStrip from '$lib/ui-editor/TabStrip.svelte';
	import ColorsContent from '$lib/ui-editor/ColorsContent.svelte';
	import SettingsContent from '$lib/ui-editor/SettingsContent.svelte';
	import ExportBottomSheet from '$lib/ui-editor/ExportBottomSheet.svelte';
	import SaveDialog from '$lib/ui-editor/SaveDialog.svelte';
	import SavedWorkBrowser from '$lib/ui-editor/SavedWorkBrowser.svelte';
	import SavedWorkBrowserSheet from '$lib/ui-editor/SavedWorkBrowserSheet.svelte';
	import { openSession, type SessionHandle } from '$lib/session/session';
	import type { SavedDocumentSummary } from '$lib/session/session-storage-types';
	import { isBlankCanvas } from '$lib/canvas/blank-detection';
	import {
		trackEditorOpen,
		trackToolUsage,
		trackExport,
		trackCanvasSize,
		trackSessionEnd
	} from '$lib/analytics/events';
	import {
		availableFormats,
		stripKnownExtension,
		buildExportFilename,
		type ExportFormat
	} from '$lib/canvas/export';

	type MobileTab = 'draw' | 'colors' | 'settings';

	let workspace = $state(
		new Workspace({
			foregroundColor: { r: 45, g: 45, b: 45, a: 255 },
			gridColor: '#ECE5D9'
		})
	);
	const editor = $derived(workspace.activeEditor);

	const layout = createLayoutMode();
	let activeTab: MobileTab = $state('draw');
	let canvasContainerEl: HTMLDivElement | undefined = $state();
	const fittedEditors = new WeakSet<EditorState>();
	let session: SessionHandle | undefined;
	let saveDialogTabIndex: number | null = $state(null);
	let browserDocuments: SavedDocumentSummary[] | null = $state(null);

	function initEditorViewport(ed: EditorState, width: number, height: number) {
		ed.viewportSize = { width, height };
		if (!fittedEditors.has(ed)) {
			fittedEditors.add(ed);
			ed.handleFit(1.0);
		}
	}

	function flushSession() {
		session?.flush();
	}

	function handleVisibilityChange() {
		if (document.visibilityState === 'hidden') flushSession();
	}

	function handleAddTab() {
		workspace.addTab();
		session?.markDirty(workspace.activeEditor.documentId);
	}

	async function closeTabImmediately(index: number) {
		const removedDocId = workspace.tabs[index].documentId;
		await session?.flush();
		workspace.closeTab(index);
		session?.notifyTabClosed(removedDocId);
	}

	async function handleCloseTab(index: number) {
		const tab = workspace.tabs[index];
		const isSaved = await session?.isDocumentSaved(tab.documentId) ?? false;

		if (isSaved) {
			await closeTabImmediately(index);
			return;
		}

		if (isBlankCanvas(tab.pixelCanvas.pixels())) {
			await closeTabImmediately(index);
			return;
		}

		saveDialogTabIndex = index;
	}

	async function handleSaveDialogSave(name: string) {
		if (saveDialogTabIndex === null) return;
		const closeIndex = saveDialogTabIndex;
		const tab = workspace.tabs[closeIndex];
		const docId = tab.documentId;
		await session?.flush();
		await session?.saveDocumentAs(docId, name);
		saveDialogTabIndex = null;
		workspace.closeTab(closeIndex);
		session?.notifyTabClosed(docId);
	}

	async function handleSaveDialogDelete() {
		if (saveDialogTabIndex === null) return;
		const tab = workspace.tabs[saveDialogTabIndex];
		const docId = tab.documentId;
		const closeIndex = saveDialogTabIndex;
		saveDialogTabIndex = null;
		workspace.closeTab(closeIndex);
		session?.notifyTabClosed(docId);
		await session?.deleteDocument(docId);
	}

	function handleSaveDialogCancel() {
		saveDialogTabIndex = null;
	}

	async function handleBrowseSavedWork() {
		if (!session) return;
		await session.flush();
		const openIds = new Set(workspace.tabs.map((t) => t.documentId));
		const docs = await session.getAllSavedDocuments();
		browserDocuments = docs.filter((d) => !openIds.has(d.id));
	}

	function handleBrowserSelect(doc: SavedDocumentSummary) {
		workspace.openDocument(doc);
		session?.markDirty(workspace.activeEditor.documentId);
		browserDocuments = null;
	}

	async function handleBrowserDelete(id: string) {
		await session?.deleteDocument(id);
		if (browserDocuments) {
			browserDocuments = browserDocuments.filter((d) => d.id !== id);
		}
	}

	function handleBrowserClose() {
		browserDocuments = null;
	}

	function handleEditorKeyDown(event: KeyboardEvent) {
		if (saveDialogTabIndex !== null || browserDocuments !== null) return;
		editor.handleKeyDown(event);
	}

	function handleEditorKeyUp(event: KeyboardEvent) {
		if (saveDialogTabIndex !== null || browserDocuments !== null) return;
		editor.handleKeyUp(event);
	}

	onMount(() => {
		trackEditorOpen('editor');
		const sessionStart = Date.now();

		openSession({ gridColor: '#ECE5D9' }).then((result) => {
			workspace = result.workspace;
			session = result.session;
			for (const tab of workspace.tabs) {
				fittedEditors.add(tab);
			}
		});

		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			trackSessionEnd((Date.now() - sessionStart) / 1000);
			void session?.flush();
			session?.dispose();
			document.removeEventListener('visibilitychange', handleVisibilityChange);
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

	// Auto-save: track canvas changes per editor
	const lastSeenVersions = new Map<EditorState, number>();
	$effect(() => {
		const currentEditor = editor;
		const version = currentEditor.renderVersion;
		const lastSeen = lastSeenVersions.get(currentEditor);
		if (lastSeen !== undefined && lastSeen !== version) {
			session?.markDirty(currentEditor.documentId);
		}
		lastSeenVersions.set(currentEditor, version);
	});

	// Sync viewport size when active tab changes
	$effect(() => {
		const currentEditor = editor;
		if (!canvasContainerEl) return;
		const rect = canvasContainerEl.getBoundingClientRect();
		const w = Math.round(rect.width);
		const h = Math.round(rect.height);
		if (w > 0 && h > 0) {
			initEditorViewport(currentEditor, w, h);
		}
	});

	// Track container size changes
	$effect(() => {
		if (!canvasContainerEl) return;
		const ro = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			const { width, height } = entry.contentRect;
			const w = Math.round(width);
			const h = Math.round(height);
			initEditorViewport(editor, w, h);
		});
		ro.observe(canvasContainerEl);
		return () => ro.disconnect();
	});

	function handleResize(w: number, h: number) {
		editor.handleResize(w, h);
		trackCanvasSize(w, h);
	}

	function handleExportConfirm(format: ExportFormat, filenameStem: string) {
		const knownExtensions = availableFormats.map((f) => f.extension);
		const cleanStem = stripKnownExtension(filenameStem.trim(), knownExtensions);
		const filename = buildExportFilename(cleanStem, format.extension, editor.pixelCanvas);
		format.exportFn(editor.pixelCanvas, filename);
		trackExport(editor.pixelCanvas.width, editor.pixelCanvas.height, format.id);
		editor.isExportUIOpen = false;
	}
</script>

<svelte:window onkeydown={handleEditorKeyDown} onkeyup={handleEditorKeyUp} onblur={editor.handleBlur} onbeforeunload={flushSession} />

{#if layout.isDocked}
	<div class="editor-docked">
		<TopBar
			zoomPercent={editor.zoomPercent}
			showGrid={editor.viewport.showGrid}
			isExportOpen={editor.isExportUIOpen}
			canvasWidth={editor.pixelCanvas.width}
			canvasHeight={editor.pixelCanvas.height}
			onZoomIn={editor.handleZoomIn}
			onZoomOut={editor.handleZoomOut}
			onZoomReset={editor.handleZoomReset}
			onFit={editor.handleFit}
			onGridToggle={editor.handleGridToggle}
			onExportToggle={editor.toggleExportUI}
			onExportConfirm={handleExportConfirm}
			onBrowseSavedWork={handleBrowseSavedWork}
			isBrowserOpen={browserDocuments !== null}
		/>

		<TabStrip
			tabs={workspace.tabs}
			activeTabIndex={workspace.activeTabIndex}
			onTabClick={(i) => workspace.setActiveTab(i)}
			onTabClose={handleCloseTab}
			onNewTab={handleAddTab}
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
				viewport={editor.viewport}
				viewportSize={editor.viewportSize}
				renderVersion={editor.renderVersion}
				onDraw={editor.handleDraw}
				onDrawStart={editor.handleDrawStart}
				onDrawEnd={editor.handleDrawEnd}
				onViewportChange={editor.handleViewportChange}
				onLongPress={editor.handleLongPress}
				toolCursor={editor.toolCursor}
				isSpaceHeld={editor.isSpaceHeld}
			/>
		</div>

		<RightPanel
			foregroundColor={editor.foregroundColorHex}
			backgroundColor={editor.backgroundColorHex}
			recentColors={editor.recentColors}
			canvasWidth={editor.pixelCanvas.width}
			canvasHeight={editor.pixelCanvas.height}
			resizeAnchor={editor.resizeAnchor}
			onForegroundColorChange={editor.handleForegroundColorChange}
			onBackgroundColorChange={editor.handleBackgroundColorChange}
			onSwapColors={editor.swapColors}
			onResize={handleResize}
			onClear={editor.handleClear}
			onAnchorChange={(anchor) => (editor.resizeAnchor = anchor)}
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
			showGrid={editor.viewport.showGrid}
			zoomPercent={editor.zoomPercent}
			onGridToggle={editor.handleGridToggle}
			onExport={editor.toggleExportUI}
			onZoomIn={editor.handleZoomIn}
			onZoomOut={editor.handleZoomOut}
			onZoomReset={editor.handleZoomReset}
			onBrowseSavedWork={handleBrowseSavedWork}
		/>

		<TabStrip
			tabs={workspace.tabs}
			activeTabIndex={workspace.activeTabIndex}
			onTabClick={(i) => workspace.setActiveTab(i)}
			onTabClose={handleCloseTab}
			onNewTab={handleAddTab}
		/>

		<div class="content-area">
			{#if activeTab === 'draw'}
				<div class="canvas-area" bind:this={canvasContainerEl}>
					<PixelCanvasView
						pixelCanvas={editor.pixelCanvas}
						viewport={editor.viewport}
						viewportSize={editor.viewportSize}
						renderVersion={editor.renderVersion}
						onDraw={editor.handleDraw}
						onDrawStart={editor.handleDrawStart}
						onDrawEnd={editor.handleDrawEnd}
						onViewportChange={editor.handleViewportChange}
						onLongPress={editor.handleLongPress}
						toolCursor={editor.toolCursor}
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
					showGrid={editor.viewport.showGrid}
					resizeAnchor={editor.resizeAnchor}
					onResize={handleResize}
					onExport={editor.toggleExportUI}
					onClear={editor.handleClear}
					onGridToggle={editor.handleGridToggle}
					onAnchorChange={(anchor) => (editor.resizeAnchor = anchor)}
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

		<ExportBottomSheet
			open={editor.isExportUIOpen}
			canvasWidth={editor.pixelCanvas.width}
			canvasHeight={editor.pixelCanvas.height}
			onOpenChange={(isOpen) => (editor.isExportUIOpen = isOpen)}
			onExport={handleExportConfirm}
		/>

		<SavedWorkBrowserSheet
			open={browserDocuments !== null}
			documents={browserDocuments ?? []}
			onSelect={handleBrowserSelect}
			onDelete={handleBrowserDelete}
			onClose={handleBrowserClose}
		/>
	</div>
{/if}

{#if layout.isDocked && browserDocuments !== null}
	<SavedWorkBrowser
		documents={browserDocuments}
		onSelect={handleBrowserSelect}
		onDelete={handleBrowserDelete}
		onClose={handleBrowserClose}
	/>
{/if}

{#if saveDialogTabIndex !== null}
	<SaveDialog
		documentName={workspace.tabs[saveDialogTabIndex].name}
		onSave={handleSaveDialogSave}
		onDelete={handleSaveDialogDelete}
		onCancel={handleSaveDialogCancel}
	/>
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
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
		grid-template:
			'topbar   topbar   topbar'   calc(44px + env(safe-area-inset-top, 0px))
			'tabstrip tabstrip tabstrip'  36px
			'toolbar  canvas   panel'     1fr
			'status   status   status'    calc(28px + env(safe-area-inset-bottom, 0px))
			/ 44px    1fr      200px;
	}

	@media (min-width: 1440px) {
		.editor-docked {
			grid-template:
				'topbar   topbar   topbar'   calc(48px + env(safe-area-inset-top, 0px))
				'tabstrip tabstrip tabstrip'  36px
				'toolbar  canvas   panel'     1fr
				'status   status   status'    calc(28px + env(safe-area-inset-bottom, 0px))
				/ 48px    1fr      240px;
		}
	}

	.editor-docked > :global(.top-bar) {
		grid-area: topbar;
	}

	.editor-docked > :global(.tab-strip) {
		grid-area: tabstrip;
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
		-webkit-touch-callout: none;
		-webkit-user-select: none;
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
		-webkit-touch-callout: default;
		-webkit-user-select: text;
		user-select: text;
	}
</style>
