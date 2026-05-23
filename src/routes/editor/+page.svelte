<script lang="ts">
	import { onMount } from 'svelte';
	import { createEditorController } from '$lib/canvas/editor-session/create-editor-controller';
	import type { EditorController } from '$lib/canvas/editor-session/editor-controller.svelte';
	import type { TabState } from '$lib/canvas/editor-session/tab-state.svelte';
	import { wasmBackend } from '$lib/canvas/wasm-backend';
	import PixelCanvasView from '$lib/canvas/PixelCanvasView.svelte';
	import { createLayoutMode } from '$lib/ui-editor/layout-mode.svelte';
	import TopBar from '$lib/ui-editor/TopBar.svelte';
	import LeftToolbar from '$lib/ui-editor/LeftToolbar.svelte';
	import RightPanel from '$lib/ui-editor/RightPanel.svelte';
	import StatusBar from '$lib/ui-editor/StatusBar.svelte';
	import TimelinePanel from '$lib/ui-editor/TimelinePanel.svelte';
	import AppBar from '$lib/ui-editor/AppBar.svelte';
	import ToolStrip from '$lib/ui-editor/ToolStrip.svelte';
	import ColorBar from '$lib/ui-editor/ColorBar.svelte';
	import TabBar from '$lib/ui-editor/TabBar.svelte';
	import type { MobileTab } from '$lib/ui-editor/mobile-tab';
	import TabStrip from '$lib/ui-editor/TabStrip.svelte';
	import ColorsContent from '$lib/ui-editor/ColorsContent.svelte';
	import SettingsContent from '$lib/ui-editor/SettingsContent.svelte';
	import ExportBottomSheet from '$lib/ui-editor/ExportBottomSheet.svelte';
	import SaveDialog from '$lib/ui-editor/SaveDialog.svelte';
	import SavedWorkBrowser from '$lib/ui-editor/SavedWorkBrowser.svelte';
	import SavedWorkBrowserSheet from '$lib/ui-editor/SavedWorkBrowserSheet.svelte';
	import ReferenceBrowser from '$lib/reference-images/ReferenceBrowser.svelte';
	import ReferenceBrowserSheet from '$lib/reference-images/ReferenceBrowserSheet.svelte';
	import ReferenceWindowOverlay from '$lib/reference-images/ReferenceWindowOverlay.svelte';
	import Loupe from '$lib/ui-editor/Loupe.svelte';
	import type { ImportError } from '$lib/reference-images/references.svelte';
	import { canvasDropzone } from '$lib/reference-images/canvas-dropzone';
	import * as m from '$lib/paraglide/messages';
	import type { ReferenceImage } from '$lib/reference-images/reference-image-types';
	import { openSession, type SessionHandle } from '$lib/session/session';
	import type { SavedDocumentSummary } from '$lib/session/session-storage-types';
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

	let editor = $state<EditorController>(
		createEditorController({
			backend: wasmBackend,
			notifier: { markDirty() {}, notifyTabRemoved() {} },
			initialForegroundColor: { r: 0, g: 0, b: 0, a: 255 },
			gridColor: '#ECE5D9'
		})
	);
	const pixelPerfectDisabled = $derived(
		editor.activeTool !== 'pencil' && editor.activeTool !== 'eraser'
	);

	const layout = createLayoutMode();
	let activeTab: MobileTab = $state('draw');
	let canvasContainerEl: HTMLDivElement | undefined = $state();
	const fittedTabs = new WeakSet<TabState>();
	let session: SessionHandle | undefined;
	let saveDialogTabIndex: number | null = $state(null);
	let browserDocuments: SavedDocumentSummary[] | null = $state(null);
	let isReferencesOpen = $state(false);
	let referenceErrors = $state<string[]>([]);
	let referenceFileInputEl = $state<HTMLInputElement>();
	const activeReferences = $derived(
		editor.workspace.references.forDoc(editor.workspace.activeTab.documentId)
	);
	const activeLayerId = $derived.by(() => {
		const tab = editor.workspace.activeTab;
		// Subscribe to document mutations — Document is a WASM handle, so its
		// methods don't trigger Svelte reactivity on their own.
		void tab.renderVersion;
		return tab.document.active_layer_id();
	});
	const isTimelinePanelCollapsed = $derived.by(() => {
		const tab = editor.workspace.activeTab;
		void tab.renderVersion;
		return tab.document.is_timeline_panel_collapsed();
	});
	// TimelinePanel shows front-most (z-top) layer at the top, matching the
	// Aseprite/Photoshop convention. The core stack is bottom-to-top
	// (`layers[0]` = z-bottom, `layers[N-1]` = z-top), so iterate in reverse.
	const layers = $derived.by(() => {
		const tab = editor.workspace.activeTab;
		void tab.renderVersion;
		const doc = tab.document;
		const out: { id: string; name: string; visible: boolean; kind: 'pixel' | 'reference' }[] =
			[];
		const count = doc.layer_count();
		for (let i = count - 1; i >= 0; i--) {
			const id = doc.layer_id_at(i);
			const name = doc.layer_name_at(i);
			const visible = doc.layer_visible_at(i);
			const kind = doc.layer_kind_at(i);
			if (
				id !== undefined &&
				name !== undefined &&
				visible !== undefined &&
				kind !== undefined
			) {
				out.push({
					id,
					name,
					visible,
					kind: kind === 'reference' ? 'reference' : 'pixel'
				});
			}
		}
		return out;
	});
	const displayedRefIds = $derived(
		new Set(
			editor.workspace.references
				.displayStatesForDoc(editor.workspace.activeTab.documentId)
				.filter((s) => s.visible)
				.map((s) => s.refId)
		)
	);

	function initTabViewport(tab: TabState, width: number, height: number) {
		tab.setViewportSize({ width, height });
		if (!fittedTabs.has(tab)) {
			fittedTabs.add(tab);
			tab.zoomFit(1.0);
		}
		if (width > 0 && height > 0) {
			editor.workspace.references.refitAll(tab.documentId, { width, height });
		}
	}

	function flushSession() {
		session?.flush();
	}

	function handleVisibilityChange() {
		if (document.visibilityState === 'hidden') flushSession();
	}

	function handleAddTab() {
		editor.workspace.addTab();
	}

	function handleAddLayer() {
		const tab = editor.workspace.activeTab;
		const n = tab.document.next_layer_number();
		tab.addLayer(m.layer_default_name({ n }));
	}

	function handleActivateLayer(id: string) {
		editor.workspace.activeTab.setActiveLayer(id);
	}

	function handleRemoveLayer(id: string) {
		editor.workspace.activeTab.removeLayer(id);
	}

	function handleReorderLayer(id: string, newVisualIndex: number) {
		editor.workspace.activeTab.reorderLayer(id, newVisualIndex);
	}

	function handleToggleLayerVisibility(id: string, newVisible: boolean) {
		editor.workspace.activeTab.setLayerVisibility(id, newVisible);
	}

	function handleToggleTimelinePanelCollapsed() {
		const tab = editor.workspace.activeTab;
		tab.setTimelinePanelCollapsed(!tab.document.is_timeline_panel_collapsed());
	}

	function handlePixelPerfectToggle() {
		if (pixelPerfectDisabled) return;
		editor.togglePixelPerfect();
	}

	async function closeTabImmediately(index: number) {
		await session?.flush();
		editor.workspace.closeTab(index);
	}

	async function handleCloseTab(index: number) {
		const tab = editor.workspace.tabs[index];
		const isSaved = await session?.isDocumentSaved(tab.documentId) ?? false;

		if (isSaved) {
			await closeTabImmediately(index);
			return;
		}

		if (tab.isDocumentBlank()) {
			await closeTabImmediately(index);
			return;
		}

		saveDialogTabIndex = index;
	}

	async function handleSaveDialogSave(name: string) {
		if (saveDialogTabIndex === null) return;
		const closeIndex = saveDialogTabIndex;
		const tab = editor.workspace.tabs[closeIndex];
		const docId = tab.documentId;
		await session?.flush();
		await session?.saveDocumentAs(docId, name);
		saveDialogTabIndex = null;
		editor.workspace.closeTab(closeIndex);
	}

	async function handleSaveDialogDelete() {
		if (saveDialogTabIndex === null) return;
		const tab = editor.workspace.tabs[saveDialogTabIndex];
		const docId = tab.documentId;
		const closeIndex = saveDialogTabIndex;
		saveDialogTabIndex = null;
		editor.workspace.closeTab(closeIndex);
		editor.workspace.references.removeDoc(docId);
		await session?.deleteDocument(docId);
	}

	function handleSaveDialogCancel() {
		saveDialogTabIndex = null;
	}

	async function handleBrowseSavedWork() {
		if (!session) return;
		await session.flush();
		const openIds = new Set(editor.workspace.tabs.map((t) => t.documentId));
		const docs = await session.getAllSavedDocuments();
		browserDocuments = docs.filter((d) => !openIds.has(d.id));
	}

	function handleBrowserSelect(doc: SavedDocumentSummary) {
		editor.workspace.openDocument(doc);
		browserDocuments = null;
	}

	async function handleBrowserDelete(id: string) {
		editor.workspace.references.removeDoc(id);
		await session?.deleteDocument(id);
		if (browserDocuments) {
			browserDocuments = browserDocuments.filter((d) => d.id !== id);
		}
	}

	function handleBrowserClose() {
		browserDocuments = null;
	}

	function handleOpenReferences() {
		isReferencesOpen = true;
	}

	function handleCloseReferences() {
		isReferencesOpen = false;
		referenceErrors = [];
	}

	function handleReferenceAddRequest() {
		referenceFileInputEl?.click();
	}

	function importErrorMessage(file: File, error: ImportError): string {
		switch (error.kind) {
			case 'unsupported-format':
				return m.references_error_unsupported_format({ name: file.name });
			case 'too-large':
				return m.references_error_too_large({ name: file.name });
			case 'decode-failed':
				return m.references_error_decode_failed({ name: file.name });
		}
	}

	async function importToGallery(files: Iterable<File>): Promise<void> {
		const docId = editor.workspace.activeTab.documentId;
		const { errors } = await editor.workspace.references.importToGallery(files, docId);
		if (errors.length > 0) {
			referenceErrors = [...referenceErrors, ...errors.map((e) => importErrorMessage(e.file, e.error))];
		}
	}

	async function handleReferenceFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = input.files;
		if (!files || files.length === 0) return;
		await importToGallery(files);
		input.value = '';
	}

	async function handleReferenceModalDrop(files: File[]) {
		await importToGallery(files);
	}

	async function handleCanvasDrop(files: File[], dropX: number, dropY: number) {
		const docId = editor.workspace.activeTab.documentId;
		const { errors } = await editor.workspace.references.importDroppedBatch(
			files,
			docId,
			{ x: dropX, y: dropY },
			editor.viewportSize
		);
		if (errors.length > 0) {
			referenceErrors = [...referenceErrors, ...errors.map((e) => importErrorMessage(e.file, e.error))];
		}
	}

	function handleReferenceSelect(ref: ReferenceImage) {
		const docId = editor.workspace.activeTab.documentId;
		editor.workspace.references.openCentered(ref.id, docId, editor.viewportSize);
		handleCloseReferences();
	}

	function handleReferenceToggleDisplay(ref: ReferenceImage) {
		const docId = editor.workspace.activeTab.documentId;
		editor.workspace.references.toggleDisplay(ref.id, docId, editor.viewportSize);
	}

	async function handleReferenceDelete(id: string) {
		const docId = editor.workspace.activeTab.documentId;
		editor.workspace.references.delete(id, docId);
	}

	function handleDismissReferenceError(index: number) {
		referenceErrors = referenceErrors.filter((_, i) => i !== index);
	}

	// Reference long-press sampling lives outside the canvas, so pump pointer
	// coords into the session at page level rather than relying on the canvas's
	// own pump in PixelCanvasView.
	let lastReferenceScreen: { x: number; y: number } | null = null;
	function pushReferencePointer(event: PointerEvent) {
		lastReferenceScreen = { x: event.clientX, y: event.clientY };
		editor.referenceSamplingSession.updatePointer({
			screen: lastReferenceScreen,
			viewport: { width: window.innerWidth, height: window.innerHeight }
		});
	}

	function handleWindowResize() {
		if (!lastReferenceScreen) return;
		editor.referenceSamplingSession.updatePointer({
			screen: lastReferenceScreen,
			viewport: { width: window.innerWidth, height: window.innerHeight }
		});
	}

	function handleEditorKeyDown(event: KeyboardEvent) {
		if (saveDialogTabIndex !== null || browserDocuments !== null || isReferencesOpen) return;
		editor.handleKeyDown(event);
	}

	function handleEditorKeyUp(event: KeyboardEvent) {
		if (saveDialogTabIndex !== null || browserDocuments !== null || isReferencesOpen) return;
		editor.handleKeyUp(event);
	}

	onMount(() => {
		trackEditorOpen('editor');
		const sessionStart = Date.now();

		// Expose the async-restore phase so E2E can await a deterministic
		// ready state. The initial controller above is a transient default
		// that `openSession` replaces once IDB restore resolves; asserting
		// on persisted state before the swap would race.
		document.documentElement.dataset.sessionState = 'loading';

		openSession({
			backend: wasmBackend,
			gridColor: '#ECE5D9',
			foregroundColor: { r: 0, g: 0, b: 0, a: 255 }
		}).then((result) => {
			editor = result.editor;
			session = result.session;
			for (const tab of editor.workspace.tabs) {
				fittedTabs.add(tab);
			}
			document.documentElement.dataset.sessionState = 'restored';
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

	// Sync viewport size when active tab changes
	$effect(() => {
		const currentTab = editor.workspace.activeTab;
		if (!canvasContainerEl) return;
		const rect = canvasContainerEl.getBoundingClientRect();
		const w = Math.round(rect.width);
		const h = Math.round(rect.height);
		if (w > 0 && h > 0) {
			initTabViewport(currentTab, w, h);
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
			initTabViewport(editor.workspace.activeTab, w, h);
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
		const snapshot = editor.exportableSnapshot();
		const filename = buildExportFilename(cleanStem, format.extension, snapshot);
		format.exportFn(snapshot, filename);
		trackExport(snapshot.width, snapshot.height, format.id);
		editor.workspace.activeTab.isExportUIOpen = false;
	}
</script>

<svelte:window
	onkeydown={handleEditorKeyDown}
	onkeyup={handleEditorKeyUp}
	onblur={editor.handleBlur}
	onbeforeunload={flushSession}
	onpointerdown={pushReferencePointer}
	onpointermove={pushReferencePointer}
	onresize={handleWindowResize}
/>

{#if layout.isDocked}
	<div class="editor-docked">
		<TopBar
			zoomPercent={editor.zoomPercent}
			showGrid={editor.viewport.showGrid}
			pixelPerfect={editor.pixelPerfect}
			pixelPerfectDisabled={pixelPerfectDisabled}
			isExportOpen={editor.isExportUIOpen}
			canvasWidth={editor.canvasWidth}
			canvasHeight={editor.canvasHeight}
			onZoomIn={editor.handleZoomIn}
			onZoomOut={editor.handleZoomOut}
			onZoomReset={editor.handleZoomReset}
			onFit={editor.handleFit}
			onGridToggle={editor.handleGridToggle}
			onPixelPerfectToggle={handlePixelPerfectToggle}
			onExportToggle={editor.toggleExportUI}
			onExportConfirm={handleExportConfirm}
			onBrowseSavedWork={handleBrowseSavedWork}
			isBrowserOpen={browserDocuments !== null}
			onOpenReferences={handleOpenReferences}
			isReferencesOpen={isReferencesOpen}
		/>

		<TabStrip
			tabs={editor.workspace.tabs}
			activeTabIndex={editor.workspace.activeIndex}
			onTabClick={(i) => editor.workspace.setActiveTab(i)}
			onTabClose={handleCloseTab}
			onNewTab={handleAddTab}
		/>

		<LeftToolbar
			activeTool={editor.activeTool}
			canUndo={editor.canUndo}
			canRedo={editor.canRedo}
			onToolChange={(tool) => editor.setTool(tool)}
			onUndo={editor.handleUndo}
			onRedo={editor.handleRedo}
		/>

		<div
			class="canvas-area"
			bind:this={canvasContainerEl}
			use:canvasDropzone={{ onFilesDropped: handleCanvasDrop }}
		>
			<PixelCanvasView
				pixelCanvas={editor.compositeBuffer}
				referenceUnderlay={editor.referenceUnderlay}
				viewport={editor.viewport}
				viewportSize={editor.viewportSize}
				renderVersion={editor.renderVersion}
				onDraw={editor.handleDraw}
				onDrawStart={editor.handleDrawStart}
				onDrawEnd={editor.handleDrawEnd}
				onViewportChange={editor.handleViewportChange}
				onSampleStart={editor.handleSampleStart}
				onSampleUpdate={editor.handleSampleUpdate}
				onSampleEnd={editor.handleSampleEnd}
				onSampleCancel={editor.handleSampleCancel}
				toolCursor={editor.toolCursor}
				isSpaceHeld={editor.isSpaceHeld}
				samplingSession={editor.samplingSession}
			/>
			<ReferenceWindowOverlay
				store={editor.workspace.references}
				docId={editor.workspace.activeTab.documentId}
				viewportWidth={editor.viewportSize.width}
				viewportHeight={editor.viewportSize.height}
				quickSamplingEnabled={editor.activeTool === 'eyedropper'}
				onSampleStart={editor.handleReferenceSampleStart}
				onSampleMove={editor.handleReferenceSampleMove}
				onSampleEnd={editor.handleReferenceSampleEnd}
			/>
		</div>

		<TimelinePanel
			layers={layers}
			activeLayerId={activeLayerId}
			collapsed={isTimelinePanelCollapsed}
			onAddLayer={handleAddLayer}
			onActivateLayer={handleActivateLayer}
			onRemoveLayer={handleRemoveLayer}
			onReorderLayer={handleReorderLayer}
			onToggleLayerVisibility={handleToggleLayerVisibility}
			onToggleCollapsed={handleToggleTimelinePanelCollapsed}
		/>

		<RightPanel
			foregroundColor={editor.foregroundColorHex}
			backgroundColor={editor.backgroundColorHex}
			recentColors={editor.recentColors}
			canvasWidth={editor.canvasWidth}
			canvasHeight={editor.canvasHeight}
			resizeAnchor={editor.resizeAnchor}
			onForegroundColorChange={editor.handleForegroundColorChange}
			onBackgroundColorChange={editor.handleBackgroundColorChange}
			onSwapColors={editor.swapColors}
			onResize={handleResize}
			onClear={editor.handleClear}
			onAnchorChange={(anchor) => editor.workspace.setActiveResizeAnchor(anchor)}
		/>

		<StatusBar
			canvasWidth={editor.canvasWidth}
			canvasHeight={editor.canvasHeight}
			activeTool={editor.activeTool}
		/>
	</div>
{:else}
	<div class="editor-tabs">
		<AppBar
			activeTab={activeTab}
			showGrid={editor.viewport.showGrid}
			pixelPerfect={editor.pixelPerfect}
			pixelPerfectDisabled={pixelPerfectDisabled}
			zoomPercent={editor.zoomPercent}
			onGridToggle={editor.handleGridToggle}
			onPixelPerfectToggle={handlePixelPerfectToggle}
			onExport={editor.toggleExportUI}
			onZoomIn={editor.handleZoomIn}
			onZoomOut={editor.handleZoomOut}
			onZoomReset={editor.handleZoomReset}
			onBrowseSavedWork={handleBrowseSavedWork}
			onOpenReferences={handleOpenReferences}
		/>

		<TabStrip
			tabs={editor.workspace.tabs}
			activeTabIndex={editor.workspace.activeIndex}
			onTabClick={(i) => editor.workspace.setActiveTab(i)}
			onTabClose={handleCloseTab}
			onNewTab={handleAddTab}
		/>

		<div class="content-area">
			{#if activeTab === 'draw' || activeTab === 'layers'}
				<div
					class="canvas-area"
					bind:this={canvasContainerEl}
					use:canvasDropzone={{ onFilesDropped: handleCanvasDrop }}
				>
					<PixelCanvasView
						pixelCanvas={editor.compositeBuffer}
						referenceUnderlay={editor.referenceUnderlay}
						viewport={editor.viewport}
						viewportSize={editor.viewportSize}
						renderVersion={editor.renderVersion}
						onDraw={editor.handleDraw}
						onDrawStart={editor.handleDrawStart}
						onDrawEnd={editor.handleDrawEnd}
						onViewportChange={editor.handleViewportChange}
						onSampleStart={editor.handleSampleStart}
						onSampleUpdate={editor.handleSampleUpdate}
						onSampleEnd={editor.handleSampleEnd}
						onSampleCancel={editor.handleSampleCancel}
						toolCursor={editor.toolCursor}
						isSpaceHeld={editor.isSpaceHeld}
						samplingSession={editor.samplingSession}
					/>
					<ReferenceWindowOverlay
						store={editor.workspace.references}
						docId={editor.workspace.activeTab.documentId}
						viewportWidth={editor.viewportSize.width}
						viewportHeight={editor.viewportSize.height}
						quickSamplingEnabled={editor.activeTool === 'eyedropper'}
						onSampleStart={editor.handleReferenceSampleStart}
						onSampleMove={editor.handleReferenceSampleMove}
						onSampleEnd={editor.handleReferenceSampleEnd}
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
					canvasWidth={editor.canvasWidth}
					canvasHeight={editor.canvasHeight}
					showGrid={editor.viewport.showGrid}
					resizeAnchor={editor.resizeAnchor}
					onResize={handleResize}
					onExport={editor.toggleExportUI}
					onClear={editor.handleClear}
					onGridToggle={editor.handleGridToggle}
					onAnchorChange={(anchor) => editor.workspace.setActiveResizeAnchor(anchor)}
				/>
			{/if}
		</div>

		{#if activeTab === 'draw'}
			<ToolStrip
				activeTool={editor.activeTool}
				canUndo={editor.canUndo}
				canRedo={editor.canRedo}
				onToolChange={(tool) => editor.setTool(tool)}
				onUndo={editor.handleUndo}
				onRedo={editor.handleRedo}
			/>
			<ColorBar
				foregroundColor={editor.foregroundColorHex}
				backgroundColor={editor.backgroundColorHex}
				recentColors={editor.recentColors}
				onForegroundColorChange={editor.handleForegroundColorChange}
			/>
		{:else if activeTab === 'layers'}
			<TimelinePanel
				layers={layers}
				activeLayerId={activeLayerId}
				collapsed={false}
				onAddLayer={handleAddLayer}
				onActivateLayer={handleActivateLayer}
				onRemoveLayer={handleRemoveLayer}
				onReorderLayer={handleReorderLayer}
				onToggleLayerVisibility={handleToggleLayerVisibility}
				onToggleCollapsed={handleToggleTimelinePanelCollapsed}
			/>
		{/if}

		<TabBar
			activeTab={activeTab}
			onTabChange={(tab) => (activeTab = tab)}
		/>

		<ExportBottomSheet
			open={editor.isExportUIOpen}
			canvasWidth={editor.canvasWidth}
			canvasHeight={editor.canvasHeight}
			onOpenChange={(isOpen) => (editor.workspace.activeTab.isExportUIOpen = isOpen)}
			onExport={handleExportConfirm}
		/>

		<SavedWorkBrowserSheet
			open={browserDocuments !== null}
			documents={browserDocuments ?? []}
			onSelect={handleBrowserSelect}
			onDelete={handleBrowserDelete}
			onClose={handleBrowserClose}
		/>

		<ReferenceBrowserSheet
			open={isReferencesOpen}
			references={activeReferences}
			displayedRefIds={displayedRefIds}
			errors={referenceErrors}
			onSelect={handleReferenceSelect}
			onDelete={handleReferenceDelete}
			onToggleDisplay={handleReferenceToggleDisplay}
			onAddRequest={handleReferenceAddRequest}
			onDismissError={handleDismissReferenceError}
			onClose={handleCloseReferences}
			onFilesDropped={handleReferenceModalDrop}
		/>
	</div>
{/if}

{#if editor.referenceSamplingSession.position}
	<Loupe
		grid={editor.referenceSamplingSession.grid}
		position={editor.referenceSamplingSession.position}
	/>
{/if}

{#if layout.isDocked && isReferencesOpen}
	<ReferenceBrowser
		references={activeReferences}
		displayedRefIds={displayedRefIds}
		errors={referenceErrors}
		onSelect={handleReferenceSelect}
		onDelete={handleReferenceDelete}
		onToggleDisplay={handleReferenceToggleDisplay}
		onAddRequest={handleReferenceAddRequest}
		onDismissError={handleDismissReferenceError}
		onClose={handleCloseReferences}
		onFilesDropped={handleReferenceModalDrop}
	/>
{/if}

<input
	type="file"
	accept="image/png,image/jpeg,image/webp,image/gif"
	multiple
	bind:this={referenceFileInputEl}
	onchange={handleReferenceFileChange}
	style="display: none"
/>

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
		documentName={editor.workspace.tabs[saveDialogTabIndex].name}
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
			'topbar   topbar   topbar'    calc(44px + env(safe-area-inset-top, 0px))
			'tabstrip tabstrip tabstrip'  36px
			'toolbar  canvas   panel'     1fr
			'toolbar  timeline panel'     auto
			'status   status   status'    calc(28px + env(safe-area-inset-bottom, 0px))
			/ 44px    1fr      200px;
	}

	@media (min-width: 1440px) {
		.editor-docked {
			grid-template:
				'topbar   topbar   topbar'    calc(48px + env(safe-area-inset-top, 0px))
				'tabstrip tabstrip tabstrip'  36px
				'toolbar  canvas   panel'     1fr
				'toolbar  timeline panel'     auto
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

	/* :global because the `data-drag-over` attribute is set imperatively by the
	   canvasDropzone action; Svelte's scoped CSS only tracks attributes present
	   in markup at compile time. */
	:global(.canvas-area[data-drag-over='true']::after) {
		content: '';
		position: absolute;
		inset: 8px;
		border: 2px dashed var(--ds-accent);
		border-radius: 8px;
		background: color-mix(in srgb, var(--ds-accent) 4%, transparent);
		pointer-events: none;
		z-index: 60;
	}

	.editor-docked > :global(.timeline-panel) {
		grid-area: timeline;
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
