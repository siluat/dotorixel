<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { createEditorSession } from '$lib/canvas/editor-session/create-editor-session';
	import type { InputPipeline } from '$lib/canvas/editor-session/input-pipeline.svelte';
	import type { Workspace } from '$lib/canvas/editor-session/workspace.svelte';
	import type { TabState } from '$lib/canvas/editor-session/tab-state.svelte';
	import PixelCanvasView from '$lib/canvas/PixelCanvasView.svelte';
	import { createLayoutMode } from '$lib/ui-editor/layout-mode.svelte';
	import TopBar from '$lib/ui-editor/TopBar.svelte';
	import LeftToolbar from '$lib/ui-editor/LeftToolbar.svelte';
	import RightPanel from '$lib/ui-editor/RightPanel.svelte';
	import StatusBar from '$lib/ui-editor/StatusBar.svelte';
	import TimelinePanel from '$lib/ui-editor/TimelinePanel.svelte';
	import ReferenceLayerReplaceDialog from '$lib/ui-editor/ReferenceLayerReplaceDialog.svelte';
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
	import { ModalState } from '$lib/ui-editor/modal-state.svelte';
	import type { ImportError } from '$lib/reference-images/references.svelte';
	import { canvasDropzone } from '$lib/reference-images/canvas-dropzone';
	import { decodeReferenceBlob } from '$lib/reference-images/decode-reference-blob';
	import { validateFile } from '$lib/reference-images/import-validator';
	import type { ReferencePlacement } from '$lib/canvas/canvas-model';
	import { colorToHex, hexToColor } from '$lib/canvas/color';
	import { TOOL_CURSORS } from '$lib/canvas/tool-registry';
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
	import { exportAs, type ExportFormat } from '$lib/canvas/export';

	// Transient defaults that `openSession` replaces once IDB restore resolves.
	const initialSession = createEditorSession({
		notifier: { markDirty() {}, notifyTabRemoved() {} },
		initialForegroundColor: { r: 0, g: 0, b: 0, a: 255 },
		gridColor: '#ECE5D9'
	});
	let workspace = $state<Workspace>(initialSession.workspace);
	let input = $state<InputPipeline>(initialSession.input);

	const pixelPerfectDisabled = $derived(
		workspace.shared.activeTool !== 'pencil' && workspace.shared.activeTool !== 'eraser'
	);
	// Usage-site adapters over shared state (single consumer today — promote to
	// SharedState/Workspace getters only if a second consumer appears).
	const foregroundColorHex = $derived(colorToHex(workspace.shared.foregroundColor));
	const backgroundColorHex = $derived(colorToHex(workspace.shared.backgroundColor));
	const toolCursor = $derived(TOOL_CURSORS[workspace.shared.activeTool]);
	const canPasteSelection = $derived(workspace.shared.selectionClipboard !== null);

	const layout = createLayoutMode();
	let activeTab: MobileTab = $state('draw');
	let canvasContainerEl: HTMLDivElement | undefined = $state();
	const fittedTabs = new WeakSet<TabState>();
	let session: SessionHandle | undefined;
	const modal = new ModalState();
	const activeModal = $derived(modal.active);
	let referenceErrors = $state<string[]>([]);
	let referenceLayerErrors = $state<{ id: string; message: string }[]>([]);
	let referenceFileInputEl = $state<HTMLInputElement>();
	let referenceLayerFileInputEl = $state<HTMLInputElement>();
	let referenceLayerImport = $state<{ name: string } | null>(null);
	const isReferenceLayerImporting = $derived(referenceLayerImport !== null);
	const activeReferences = $derived(
		workspace.references.forDoc(workspace.activeTab.documentId)
	);
	const activeLayerId = $derived.by(() => {
		const tab = workspace.activeTab;
		return tab.layerProjection.activeLayer?.id ?? tab.document.active_layer_id();
	});
	const isReferenceLayerActive = $derived.by(() => {
		const tab = workspace.activeTab;
		return tab.layerProjection.activeLayerKind === 'reference';
	});
	const isTimelinePanelCollapsed = $derived.by(() => {
		const tab = workspace.activeTab;
		void tab.renderVersion;
		return tab.document.is_timeline_panel_collapsed();
	});
	const layers = $derived.by(() => {
		const tab = workspace.activeTab;
		return tab.layerProjection.layersInPanelOrder.map(({ id, name, visible, kind }) => ({
			id,
			name,
			visible,
			kind
		}));
	});
	const frames = $derived.by(() => workspace.activeTab.frameProjection.frames);
	const activeFrameId = $derived.by(
		() => workspace.activeTab.frameProjection.activeFrameId
	);
	const isPlaying = $derived(workspace.activeTab.isPlaying);
	const isLooping = $derived(workspace.activeTab.isLooping);
	const playheadFrameId = $derived(workspace.activeTab.playheadFrameId);
	const displayedRefIds = $derived(
		new Set(
			workspace.references
				.windowStatesForDoc(workspace.activeTab.documentId)
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
			workspace.references.refitAll(tab.documentId, { width, height });
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
	}

	function handleAddLayer() {
		const tab = workspace.activeTab;
		const n = tab.document.next_layer_number();
		tab.addLayer(m.layer_default_name({ n }));
	}

	function hasReferenceLayer(tab: TabState): boolean {
		return tab.layerProjection.referenceLayer !== undefined;
	}

	function openReferenceLayerFilePicker() {
		referenceLayerFileInputEl?.click();
	}

	function handleAddReferenceLayerRequest() {
		if (isReferenceLayerImporting) return;
		if (hasReferenceLayer(workspace.activeTab)) {
			modal.openRefReplace();
			return;
		}
		openReferenceLayerFilePicker();
	}

	function handleActivateLayer(id: string) {
		workspace.activeTab.setActiveLayer(id);
	}

	function handleSelectFrame(id: string) {
		workspace.activeTab.setActiveFrame(id);
	}

	function handleSelectCel(layerId: string, frameId: string) {
		// A cel sits at the intersection of a layer and a frame, so selecting it
		// moves both pointers. Both are persisted-UI (non-undoable) moves.
		const tab = workspace.activeTab;
		tab.setActiveLayer(layerId);
		tab.setActiveFrame(frameId);
	}

	function handleAddFrame() {
		workspace.activeTab.addFrame();
	}

	function handleDuplicateFrame() {
		workspace.activeTab.duplicateFrame();
	}

	function handleRemoveFrame(id: string) {
		workspace.activeTab.removeFrame(id);
	}

	function handleReorderFrame(id: string, newIndex: number) {
		workspace.activeTab.reorderFrame(id, newIndex);
	}

	function handleSetFrameDuration(id: string, durationMs: number) {
		workspace.activeTab.setFrameDuration(id, durationMs);
	}

	function handleTogglePlay() {
		const tab = workspace.activeTab;
		if (tab.isPlaying) tab.stopPlayback();
		else tab.startPlayback();
	}

	function handleToggleLoop() {
		workspace.activeTab.toggleLoop();
	}

	function handleRemoveLayer(id: string) {
		workspace.activeTab.removeLayer(id);
	}

	function handleReorderLayer(id: string, newVisualIndex: number) {
		workspace.activeTab.reorderLayer(id, newVisualIndex);
	}

	function handleToggleLayerVisibility(id: string, newVisible: boolean) {
		workspace.activeTab.setLayerVisibility(id, newVisible);
	}

	function handleFitReferenceLayerToCanvas(id: string) {
		workspace.activeTab.fitReferenceLayerToCanvas(id);
	}

	function handleReferencePlacementCommit(placement: ReferencePlacement) {
		const tab = workspace.activeTab;
		tab.setReferencePlacement(tab.document.active_layer_id(), placement);
	}

	function handleToggleTimelinePanelCollapsed() {
		const tab = workspace.activeTab;
		tab.setTimelinePanelCollapsed(!tab.document.is_timeline_panel_collapsed());
	}

	function handlePixelPerfectToggle() {
		if (pixelPerfectDisabled) return;
		workspace.togglePixelPerfect();
	}

	function handleForegroundColorChange(hex: string) {
		workspace.setForegroundColor(hexToColor(hex));
	}

	function handleBackgroundColorChange(hex: string) {
		workspace.setBackgroundColor(hexToColor(hex));
	}

	async function closeTabImmediately(index: number) {
		await session?.flush();
		workspace.closeTab(index);
	}

	async function handleCloseTab(index: number) {
		const tab = workspace.tabs[index];
		const isSaved = await session?.isDocumentSaved(tab.documentId) ?? false;

		if (isSaved) {
			await closeTabImmediately(index);
			return;
		}

		if (tab.isDocumentBlank()) {
			await closeTabImmediately(index);
			return;
		}

		modal.openSave(index);
	}

	async function handleSaveDialogSave(name: string) {
		const active = modal.active;
		if (active?.kind !== 'save') return;
		const closeIndex = active.tabIndex;
		const tab = workspace.tabs[closeIndex];
		const docId = tab.documentId;
		await session?.flush();
		await session?.saveDocumentAs(docId, name);
		modal.close();
		workspace.closeTab(closeIndex);
	}

	async function handleSaveDialogDelete() {
		const active = modal.active;
		if (active?.kind !== 'save') return;
		const closeIndex = active.tabIndex;
		const tab = workspace.tabs[closeIndex];
		const docId = tab.documentId;
		modal.close();
		workspace.closeTab(closeIndex);
		workspace.references.removeDoc(docId);
		await session?.deleteDocument(docId);
	}

	function handleSaveDialogCancel() {
		modal.close();
	}

	async function handleBrowseSavedWork() {
		if (!session) return;
		await session.flush();
		const openIds = new Set(workspace.tabs.map((t) => t.documentId));
		const docs = await session.getAllSavedDocuments();
		modal.openSavedWork(docs.filter((d) => !openIds.has(d.id)));
	}

	async function handleSavedWorkSelect(doc: SavedDocumentSummary) {
		const opening = modal.active;
		if (opening?.kind !== 'savedWork' || opening.openingId !== null) return;
		modal.setSavedWorkOpeningId(doc.id);
		try {
			const snapshot = await session?.getSavedDocumentSnapshot(doc.id);
			const current = modal.active;
			if (current?.kind !== 'savedWork' || current.openingId !== doc.id) return;
			if (!snapshot) {
				modal.removeSavedWorkDoc(doc.id);
				return;
			}
			workspace.openSnapshot(snapshot);
			modal.close();
		} finally {
			const after = modal.active;
			if (after?.kind === 'savedWork' && after.openingId === doc.id) {
				modal.setSavedWorkOpeningId(null);
			}
		}
	}

	async function handleSavedWorkDelete(id: string) {
		const active = modal.active;
		if (active?.kind === 'savedWork' && active.openingId === id) {
			modal.setSavedWorkOpeningId(null);
		}
		workspace.references.removeDoc(id);
		await session?.deleteDocument(id);
		modal.removeSavedWorkDoc(id);
	}

	function handleSavedWorkClose() {
		modal.close();
	}

	function handleOpenReferences() {
		modal.openReferences();
	}

	function handleCloseReferences() {
		modal.close();
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

	function referenceLayerDisplayName(file: File): string {
		return file.name.trim() || m.reference_layer_default_name();
	}

	function pushReferenceLayerError(message: string) {
		const id = crypto.randomUUID();
		referenceLayerErrors = [...referenceLayerErrors, { id, message }];
		window.setTimeout(() => {
			referenceLayerErrors = referenceLayerErrors.filter((error) => error.id !== id);
		}, 5000);
	}

	function handleDismissReferenceLayerError(id: string) {
		referenceLayerErrors = referenceLayerErrors.filter((error) => error.id !== id);
	}

	function handleReferenceLayerReplaceCancel() {
		modal.close();
	}

	function handleReferenceLayerReplaceConfirm() {
		modal.close();
		openReferenceLayerFilePicker();
	}

	async function importToGallery(files: Iterable<File>): Promise<void> {
		const docId = workspace.activeTab.documentId;
		const { errors } = await workspace.references.importToGallery(files, docId);
		if (errors.length > 0) {
			referenceErrors = [...referenceErrors, ...errors.map((e) => importErrorMessage(e.file, e.error))];
		}
	}

	async function handleReferenceFileChange(event: Event) {
		const inputEl = event.currentTarget as HTMLInputElement;
		const files = inputEl.files;
		if (!files || files.length === 0) return;
		await importToGallery(files);
		inputEl.value = '';
	}

	async function handleReferenceLayerFileChange(event: Event) {
		const inputEl = event.currentTarget as HTMLInputElement;
		const file = inputEl.files?.[0];
		inputEl.value = '';
		if (!file) return;

		const displayName = referenceLayerDisplayName(file);
		const validation = validateFile({ type: file.type, size: file.size });
		if (!validation.ok) {
			pushReferenceLayerError(importErrorMessage(file, { kind: validation.reason }));
			return;
		}

		const targetTab = workspace.activeTab;
		referenceLayerImport = { name: displayName };
		try {
			const decoded = await decodeReferenceBlob(file);
			let didMutate = false;
			try {
				targetTab.setReferenceLayer({
					name: displayName,
					sourceBlob: file,
					sourceRgba: decoded.data,
					naturalWidth: decoded.width,
					naturalHeight: decoded.height
				});
				didMutate = true;
				await session?.flush();
			} catch (error) {
				if (didMutate) {
					targetTab.undo();
					try {
						await session?.flush();
					} catch {
						// The in-memory rollback is the user-visible recovery.
					}
				}
				console.error('Reference Layer import could not be persisted:', error);
				pushReferenceLayerError(m.reference_layer_import_storage_failed({ name: displayName }));
			}
		} catch {
			pushReferenceLayerError(m.references_error_decode_failed({ name: displayName }));
		} finally {
			referenceLayerImport = null;
		}
	}

	async function handleReferenceModalDrop(files: File[]) {
		await importToGallery(files);
	}

	async function handleCanvasDrop(files: File[], dropX: number, dropY: number) {
		const docId = workspace.activeTab.documentId;
		const { errors } = await workspace.references.importDroppedBatch(
			files,
			docId,
			{ x: dropX, y: dropY },
			workspace.activeTab.viewportSize
		);
		if (errors.length > 0) {
			referenceErrors = [...referenceErrors, ...errors.map((e) => importErrorMessage(e.file, e.error))];
		}
	}

	function handleReferenceSelect(ref: ReferenceImage) {
		const docId = workspace.activeTab.documentId;
		workspace.references.openCentered(ref.id, docId, workspace.activeTab.viewportSize);
		handleCloseReferences();
	}

	function handleReferenceToggleDisplay(ref: ReferenceImage) {
		const docId = workspace.activeTab.documentId;
		workspace.references.toggleDisplay(ref.id, docId, workspace.activeTab.viewportSize);
	}

	async function handleReferenceDelete(id: string) {
		const docId = workspace.activeTab.documentId;
		workspace.references.delete(id, docId);
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
		workspace.activeTab.referenceSamplingSession.updatePointer({
			screen: lastReferenceScreen,
			viewport: { width: window.innerWidth, height: window.innerHeight }
		});
	}

	function handleWindowResize() {
		if (!lastReferenceScreen) return;
		workspace.activeTab.referenceSamplingSession.updatePointer({
			screen: lastReferenceScreen,
			viewport: { width: window.innerWidth, height: window.innerHeight }
		});
	}

	function handleEditorKeyDown(event: KeyboardEvent) {
		if (modal.isOpen) return;
		input.handleKeyDown(event);
	}

	function handleEditorKeyUp(event: KeyboardEvent) {
		if (modal.isOpen) return;
		input.handleKeyUp(event);
	}

	onMount(() => {
		trackEditorOpen('editor');
		const sessionStart = Date.now();

		// Expose the async-restore phase so E2E can await a deterministic
		// ready state. The initial session above is a transient default
		// that `openSession` replaces once IDB restore resolves; asserting
		// on persisted state before the swap would race.
		document.documentElement.dataset.sessionState = 'loading';

		openSession({
			gridColor: '#ECE5D9',
			foregroundColor: { r: 0, g: 0, b: 0, a: 255 }
		}).then((result) => {
			workspace = result.workspace;
			input = result.input;
			session = result.session;
			for (const tab of workspace.tabs) {
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
		const tool = workspace.shared.activeTool;
		if (prevTool !== undefined && prevTool !== tool) {
			trackToolUsage(tool);
		}
		prevTool = tool;
	});

	// Sync viewport size when active tab changes
	$effect(() => {
		const currentTab = workspace.activeTab;
		if (!canvasContainerEl) return;
		const rect = canvasContainerEl.getBoundingClientRect();
		const w = Math.round(rect.width);
		const h = Math.round(rect.height);
		if (w > 0 && h > 0) {
			// `initTabViewport` runs `setViewportSize`, which now reclamps and so
			// reads/writes `viewport` + `viewportSize`. Untrack it so this effect
			// re-runs only when the active tab (or container) changes — not when
			// the sync it performs mutates viewport state.
			untrack(() => initTabViewport(currentTab, w, h));
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
			initTabViewport(workspace.activeTab, w, h);
		});
		ro.observe(canvasContainerEl);
		return () => ro.disconnect();
	});

	function handleResize(w: number, h: number) {
		workspace.activeTab.resize(w, h);
		trackCanvasSize(w, h);
	}

	function handleExportConfirm(format: ExportFormat, filenameStem: string) {
		const { width, height } = exportAs(format, filenameStem, {
			still: () => workspace.activeTab.exportableSnapshot(),
			document: () => workspace.activeTab.document
		});
		trackExport(width, height, format.id);
		workspace.activeTab.isExportUIOpen = false;
	}
</script>

<svelte:window
	onkeydown={handleEditorKeyDown}
	onkeyup={handleEditorKeyUp}
	onblur={input.handleBlur}
	onbeforeunload={flushSession}
	onpointerdown={pushReferencePointer}
	onpointermove={pushReferencePointer}
	onresize={handleWindowResize}
/>

{#if layout.isDocked}
	<div class="editor-docked">
		<TopBar
			zoomPercent={workspace.activeTab.zoomPercent}
			showGrid={workspace.activeTab.viewport.showGrid}
			pixelPerfect={workspace.shared.pixelPerfect}
			pixelPerfectDisabled={pixelPerfectDisabled}
			isExportOpen={workspace.activeTab.isExportUIOpen}
			canvasWidth={workspace.activeTab.canvasWidth}
			canvasHeight={workspace.activeTab.canvasHeight}
			onZoomIn={() => workspace.activeTab.zoomIn()}
			onZoomOut={() => workspace.activeTab.zoomOut()}
			onZoomReset={() => workspace.activeTab.zoomReset()}
			onFit={() => workspace.activeTab.zoomFit()}
			onGridToggle={() => workspace.activeTab.toggleGrid()}
			onPixelPerfectToggle={handlePixelPerfectToggle}
			onExportToggle={() => workspace.activeTab.toggleExportUI()}
			onExportConfirm={handleExportConfirm}
			onBrowseSavedWork={handleBrowseSavedWork}
			isSavedWorkOpen={activeModal?.kind === 'savedWork'}
			onOpenReferences={handleOpenReferences}
			isReferencesOpen={activeModal?.kind === 'references'}
		/>

		<TabStrip
			tabs={workspace.tabs}
			activeTabIndex={workspace.activeIndex}
			onTabClick={(i) => workspace.setActiveTab(i)}
			onTabClose={handleCloseTab}
			onNewTab={handleAddTab}
		/>

		<LeftToolbar
			activeTool={workspace.shared.activeTool}
			canUndo={workspace.activeTab.canUndo}
			canRedo={workspace.activeTab.canRedo}
			constrainActive={input.isConstrainActive}
			onToolChange={(tool) => workspace.setActiveTool(tool)}
			onUndo={() => workspace.activeTab.undo()}
			onRedo={() => workspace.activeTab.redo()}
			onToggleConstrain={input.toggleConstrain}
		/>

		<div
			class="canvas-area"
			bind:this={canvasContainerEl}
			use:canvasDropzone={{ onFilesDropped: handleCanvasDrop }}
		>
			<PixelCanvasView
				pixelCanvas={workspace.activeTab.compositeBuffer}
				referenceLayerUnderlay={workspace.activeTab.referenceLayerUnderlay}
				onionSkinGhosts={workspace.activeTab.onionSkinProjection}
				marquee={workspace.activeTab.marquee}
				floatingSelectionOffset={workspace.activeTab.floatingSelectionOffset}
				isReferenceLayerActive={isReferenceLayerActive}
				viewport={workspace.activeTab.viewport}
				viewportSize={workspace.activeTab.viewportSize}
				renderVersion={workspace.activeTab.renderVersion}
				onDraw={input.handleDraw}
				onDrawStart={input.handleDrawStart}
				onDrawEnd={input.handleDrawEnd}
				onDrawCancel={input.handleDrawCancel}
				onViewportChange={(vp) => workspace.activeTab.setViewport(vp)}
				onSampleStart={input.handleSampleStart}
				onSampleUpdate={input.handleSampleUpdate}
				onSampleEnd={input.handleSampleEnd}
				onSampleCancel={input.handleSampleCancel}
				onReferencePlacementCommit={handleReferencePlacementCommit}
				canPasteSelection={canPasteSelection}
				onCopySelection={() => workspace.copySelection()}
				onCutSelection={() => workspace.cutSelection()}
				onPasteSelectionClipboard={() => workspace.pasteSelectionClipboard()}
				onDeleteMarqueePixels={() => workspace.activeTab.clearMarqueePixels()}
				onClearMarqueeOrFloating={() => workspace.activeTab.clearMarqueeOrFloating()}
				onCommitFloatingSelection={() => workspace.activeTab.commitFloatingSelection()}
				onDuplicateFloatingSelection={() => workspace.activeTab.duplicateFloatingSelection()}
				onFlipHorizontal={() => workspace.activeTab.flipMarqueeHorizontal()}
				onFlipVertical={() => workspace.activeTab.flipMarqueeVertical()}
				onRotateCw={() => workspace.activeTab.rotateMarqueeCw()}
				onRotateCcw={() => workspace.activeTab.rotateMarqueeCcw()}
				activeTool={workspace.shared.activeTool}
				toolCursor={toolCursor}
				isSpaceHeld={input.isSpaceHeld}
				samplingSession={workspace.activeTab.samplingSession}
			/>
			<ReferenceWindowOverlay
				store={workspace.references}
				docId={workspace.activeTab.documentId}
				viewportWidth={workspace.activeTab.viewportSize.width}
				viewportHeight={workspace.activeTab.viewportSize.height}
				quickSamplingEnabled={workspace.shared.activeTool === 'eyedropper'}
				onSampleStart={(blob, imageX, imageY, inputSource) =>
					void workspace.activeTab.referenceSampleStart(blob, imageX, imageY, inputSource)}
				onSampleMove={(imageX, imageY) => workspace.activeTab.referenceSampleMove(imageX, imageY)}
				onSampleEnd={() => workspace.activeTab.referenceSampleEnd()}
			/>
		</div>

		<TimelinePanel
			layers={layers}
			activeLayerId={activeLayerId}
			frames={frames}
			activeFrameId={activeFrameId}
			onSelectFrame={handleSelectFrame}
			onSelectCel={handleSelectCel}
			onAddFrame={handleAddFrame}
			onDuplicateFrame={handleDuplicateFrame}
			onRemoveFrame={handleRemoveFrame}
			onReorderFrame={handleReorderFrame}
			onSetFrameDuration={handleSetFrameDuration}
			isPlaying={isPlaying}
			isLooping={isLooping}
			showOnionSkin={workspace.activeTab.viewport.showOnionSkin}
			playheadFrameId={playheadFrameId}
			onTogglePlay={handleTogglePlay}
			onToggleLoop={handleToggleLoop}
			onToggleOnionSkin={() => workspace.activeTab.toggleOnionSkin()}
			collapsed={isTimelinePanelCollapsed}
			onAddLayer={handleAddLayer}
			onAddReferenceLayer={handleAddReferenceLayerRequest}
			onActivateLayer={handleActivateLayer}
			onRemoveLayer={handleRemoveLayer}
			onReorderLayer={handleReorderLayer}
			onToggleLayerVisibility={handleToggleLayerVisibility}
			onToggleCollapsed={handleToggleTimelinePanelCollapsed}
			onFitReferenceLayerToCanvas={handleFitReferenceLayerToCanvas}
			isReferenceLayerImporting={isReferenceLayerImporting}
			referenceLayerImportName={referenceLayerImport?.name}
		/>

		<RightPanel
			foregroundColor={foregroundColorHex}
			backgroundColor={backgroundColorHex}
			recentColors={workspace.shared.recentColors}
			canvasWidth={workspace.activeTab.canvasWidth}
			canvasHeight={workspace.activeTab.canvasHeight}
			resizeAnchor={workspace.activeTab.resizeAnchor}
			onForegroundColorChange={handleForegroundColorChange}
			onBackgroundColorChange={handleBackgroundColorChange}
			onSwapColors={() => workspace.swapColors()}
			onResize={handleResize}
			onClear={() => workspace.activeTab.clear()}
			onAnchorChange={(anchor) => workspace.setActiveResizeAnchor(anchor)}
			onFlipCanvasHorizontal={() => workspace.activeTab.flipCanvasHorizontal()}
			onFlipCanvasVertical={() => workspace.activeTab.flipCanvasVertical()}
			onRotateCanvasCw={() => workspace.activeTab.rotateCanvasCw()}
			onRotateCanvasCcw={() => workspace.activeTab.rotateCanvasCcw()}
		/>

		<StatusBar
			canvasWidth={workspace.activeTab.canvasWidth}
			canvasHeight={workspace.activeTab.canvasHeight}
			activeTool={workspace.shared.activeTool}
			layoutMode={layout.mode}
			marquee={workspace.activeTab.marquee}
		/>
	</div>
{:else}
	<div class="editor-tabs">
		<AppBar
			activeTab={activeTab}
			showGrid={workspace.activeTab.viewport.showGrid}
			pixelPerfect={workspace.shared.pixelPerfect}
			pixelPerfectDisabled={pixelPerfectDisabled}
			zoomPercent={workspace.activeTab.zoomPercent}
			onGridToggle={() => workspace.activeTab.toggleGrid()}
			onPixelPerfectToggle={handlePixelPerfectToggle}
			onExport={() => workspace.activeTab.toggleExportUI()}
			onZoomIn={() => workspace.activeTab.zoomIn()}
			onZoomOut={() => workspace.activeTab.zoomOut()}
			onZoomReset={() => workspace.activeTab.zoomReset()}
			onBrowseSavedWork={handleBrowseSavedWork}
			onOpenReferences={handleOpenReferences}
		/>

		<TabStrip
			tabs={workspace.tabs}
			activeTabIndex={workspace.activeIndex}
			onTabClick={(i) => workspace.setActiveTab(i)}
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
						pixelCanvas={workspace.activeTab.compositeBuffer}
						referenceLayerUnderlay={workspace.activeTab.referenceLayerUnderlay}
						onionSkinGhosts={workspace.activeTab.onionSkinProjection}
						marquee={workspace.activeTab.marquee}
						floatingSelectionOffset={workspace.activeTab.floatingSelectionOffset}
						isReferenceLayerActive={isReferenceLayerActive}
						viewport={workspace.activeTab.viewport}
						viewportSize={workspace.activeTab.viewportSize}
						renderVersion={workspace.activeTab.renderVersion}
						onDraw={input.handleDraw}
						onDrawStart={input.handleDrawStart}
						onDrawEnd={input.handleDrawEnd}
						onDrawCancel={input.handleDrawCancel}
						onViewportChange={(vp) => workspace.activeTab.setViewport(vp)}
						onSampleStart={input.handleSampleStart}
						onSampleUpdate={input.handleSampleUpdate}
						onSampleEnd={input.handleSampleEnd}
						onSampleCancel={input.handleSampleCancel}
						onReferencePlacementCommit={handleReferencePlacementCommit}
						canPasteSelection={canPasteSelection}
						onCopySelection={() => workspace.copySelection()}
						onCutSelection={() => workspace.cutSelection()}
						onPasteSelectionClipboard={() => workspace.pasteSelectionClipboard()}
						onDeleteMarqueePixels={() => workspace.activeTab.clearMarqueePixels()}
						onClearMarqueeOrFloating={() => workspace.activeTab.clearMarqueeOrFloating()}
						onCommitFloatingSelection={() => workspace.activeTab.commitFloatingSelection()}
						onDuplicateFloatingSelection={() => workspace.activeTab.duplicateFloatingSelection()}
						onFlipHorizontal={() => workspace.activeTab.flipMarqueeHorizontal()}
						onFlipVertical={() => workspace.activeTab.flipMarqueeVertical()}
						onRotateCw={() => workspace.activeTab.rotateMarqueeCw()}
						onRotateCcw={() => workspace.activeTab.rotateMarqueeCcw()}
						activeTool={workspace.shared.activeTool}
						toolCursor={toolCursor}
						isSpaceHeld={input.isSpaceHeld}
						samplingSession={workspace.activeTab.samplingSession}
					/>
					<ReferenceWindowOverlay
						store={workspace.references}
						docId={workspace.activeTab.documentId}
						viewportWidth={workspace.activeTab.viewportSize.width}
						viewportHeight={workspace.activeTab.viewportSize.height}
						quickSamplingEnabled={workspace.shared.activeTool === 'eyedropper'}
						onSampleStart={(blob, imageX, imageY, inputSource) =>
					void workspace.activeTab.referenceSampleStart(blob, imageX, imageY, inputSource)}
						onSampleMove={(imageX, imageY) => workspace.activeTab.referenceSampleMove(imageX, imageY)}
						onSampleEnd={() => workspace.activeTab.referenceSampleEnd()}
					/>
				</div>
			{:else if activeTab === 'colors'}
				<ColorsContent
					foregroundColor={foregroundColorHex}
					backgroundColor={backgroundColorHex}
					onForegroundColorChange={handleForegroundColorChange}
					onBackgroundColorChange={handleBackgroundColorChange}
					onSwapColors={() => workspace.swapColors()}
				/>
			{:else}
				<SettingsContent
					canvasWidth={workspace.activeTab.canvasWidth}
					canvasHeight={workspace.activeTab.canvasHeight}
					showGrid={workspace.activeTab.viewport.showGrid}
					resizeAnchor={workspace.activeTab.resizeAnchor}
					onResize={handleResize}
					onExport={() => workspace.activeTab.toggleExportUI()}
					onClear={() => workspace.activeTab.clear()}
					onGridToggle={() => workspace.activeTab.toggleGrid()}
					onAnchorChange={(anchor) => workspace.setActiveResizeAnchor(anchor)}
					onFlipCanvasHorizontal={() => workspace.activeTab.flipCanvasHorizontal()}
					onFlipCanvasVertical={() => workspace.activeTab.flipCanvasVertical()}
					onRotateCanvasCw={() => workspace.activeTab.rotateCanvasCw()}
					onRotateCanvasCcw={() => workspace.activeTab.rotateCanvasCcw()}
				/>
			{/if}
		</div>

		<StatusBar
			canvasWidth={workspace.activeTab.canvasWidth}
			canvasHeight={workspace.activeTab.canvasHeight}
			activeTool={workspace.shared.activeTool}
			layoutMode={layout.mode}
			marquee={workspace.activeTab.marquee}
			includeBottomSafeArea={false}
		/>

		{#if activeTab === 'draw'}
			<ToolStrip
				activeTool={workspace.shared.activeTool}
				canUndo={workspace.activeTab.canUndo}
				canRedo={workspace.activeTab.canRedo}
				constrainActive={input.isConstrainActive}
				onToolChange={(tool) => workspace.setActiveTool(tool)}
				onUndo={() => workspace.activeTab.undo()}
				onRedo={() => workspace.activeTab.redo()}
				onToggleConstrain={input.toggleConstrain}
			/>
			<ColorBar
				foregroundColor={foregroundColorHex}
				backgroundColor={backgroundColorHex}
				recentColors={workspace.shared.recentColors}
				onForegroundColorChange={handleForegroundColorChange}
			/>
		{:else if activeTab === 'layers'}
			<TimelinePanel
				layers={layers}
				activeLayerId={activeLayerId}
				frames={frames}
				activeFrameId={activeFrameId}
				onSelectFrame={handleSelectFrame}
				onSelectCel={handleSelectCel}
				onAddFrame={handleAddFrame}
				onDuplicateFrame={handleDuplicateFrame}
				onRemoveFrame={handleRemoveFrame}
				onReorderFrame={handleReorderFrame}
				onSetFrameDuration={handleSetFrameDuration}
				isPlaying={isPlaying}
				isLooping={isLooping}
				showOnionSkin={workspace.activeTab.viewport.showOnionSkin}
				playheadFrameId={playheadFrameId}
				onTogglePlay={handleTogglePlay}
				onToggleLoop={handleToggleLoop}
				onToggleOnionSkin={() => workspace.activeTab.toggleOnionSkin()}
				collapsed={false}
				onAddLayer={handleAddLayer}
				onAddReferenceLayer={handleAddReferenceLayerRequest}
				onActivateLayer={handleActivateLayer}
				onRemoveLayer={handleRemoveLayer}
				onReorderLayer={handleReorderLayer}
				onToggleLayerVisibility={handleToggleLayerVisibility}
				onToggleCollapsed={handleToggleTimelinePanelCollapsed}
				onFitReferenceLayerToCanvas={handleFitReferenceLayerToCanvas}
				isReferenceLayerImporting={isReferenceLayerImporting}
				referenceLayerImportName={referenceLayerImport?.name}
			/>
		{/if}

		<TabBar
			activeTab={activeTab}
			onTabChange={(tab) => (activeTab = tab)}
		/>

		<ExportBottomSheet
			open={workspace.activeTab.isExportUIOpen}
			canvasWidth={workspace.activeTab.canvasWidth}
			canvasHeight={workspace.activeTab.canvasHeight}
			onOpenChange={(isOpen) => (workspace.activeTab.isExportUIOpen = isOpen)}
			onExport={handleExportConfirm}
		/>

		<SavedWorkBrowserSheet
			open={activeModal?.kind === 'savedWork'}
			documents={activeModal?.kind === 'savedWork' ? activeModal.documents : []}
			onSelect={handleSavedWorkSelect}
			onDelete={handleSavedWorkDelete}
			onClose={handleSavedWorkClose}
		/>

		<ReferenceBrowserSheet
			open={activeModal?.kind === 'references'}
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

{#if workspace.activeTab.referenceSamplingSession.position}
	<Loupe
		grid={workspace.activeTab.referenceSamplingSession.grid}
		position={workspace.activeTab.referenceSamplingSession.position}
	/>
{/if}

{#if layout.isDocked && activeModal?.kind === 'references'}
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

<input
	type="file"
	accept="image/png,image/jpeg,image/webp,image/gif"
	bind:this={referenceLayerFileInputEl}
	onchange={handleReferenceLayerFileChange}
	style="display: none"
/>

{#if referenceLayerErrors.length > 0}
	<div class="toast-stack" aria-live="polite">
		{#each referenceLayerErrors as error (error.id)}
			<div class="toast" role="alert">
				<span>{error.message}</span>
				<button
					type="button"
					class="toast-dismiss"
					aria-label={m.references_error_dismiss()}
					onclick={() => handleDismissReferenceLayerError(error.id)}
				>
					×
				</button>
			</div>
		{/each}
	</div>
{/if}

{#if activeModal?.kind === 'refReplace'}
	<ReferenceLayerReplaceDialog
		onConfirm={handleReferenceLayerReplaceConfirm}
		onCancel={handleReferenceLayerReplaceCancel}
	/>
{/if}

{#if layout.isDocked && activeModal?.kind === 'savedWork'}
	<SavedWorkBrowser
		documents={activeModal.documents}
		onSelect={handleSavedWorkSelect}
		onDelete={handleSavedWorkDelete}
		onClose={handleSavedWorkClose}
	/>
{/if}

{#if activeModal?.kind === 'save'}
	<SaveDialog
		documentName={workspace.tabs[activeModal.tabIndex].name}
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
			/ auto    1fr      200px;
	}

	@media (min-width: 1440px) {
		.editor-docked {
			grid-template:
				'topbar   topbar   topbar'    calc(48px + env(safe-area-inset-top, 0px))
				'tabstrip tabstrip tabstrip'  36px
				'toolbar  canvas   panel'     1fr
				'toolbar  timeline panel'     auto
				'status   status   status'    calc(28px + env(safe-area-inset-bottom, 0px))
				/ auto    1fr      240px;
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

	.toast-stack {
		position: fixed;
		right: max(16px, env(safe-area-inset-right, 0px) + 16px);
		bottom: max(16px, env(safe-area-inset-bottom, 0px) + 16px);
		z-index: 220;
		display: flex;
		flex-direction: column;
		gap: var(--ds-space-2);
		max-width: min(360px, calc(100vw - 32px));
	}

	.toast {
		display: flex;
		align-items: center;
		gap: var(--ds-space-3);
		padding: 10px 12px;
		background: var(--ds-bg-elevated);
		border: var(--ds-border-width) solid var(--ds-border-subtle);
		border-radius: var(--ds-radius-md);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
		color: var(--ds-text-primary);
		font-family: var(--ds-font-body);
		font-size: var(--ds-font-size-md);
		line-height: 1.4;
	}

	.toast span {
		min-width: 0;
	}

	.toast-dismiss {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: none;
		border-radius: var(--ds-radius-sm);
		background: none;
		color: var(--ds-text-secondary);
		font-family: inherit;
		font-size: var(--ds-font-size-lg);
		line-height: 1;
		cursor: pointer;
		flex: none;
	}

	.toast-dismiss:hover {
		background: var(--ds-bg-hover);
		color: var(--ds-text-primary);
	}
</style>
