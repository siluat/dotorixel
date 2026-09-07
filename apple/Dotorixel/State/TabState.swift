import SwiftUI

/// Per-tab shell state. EditLifecycle owns content and transition policy;
/// this module owns presentation and executes the lifecycle's ordered effects.
@Observable
final class TabState {
    let shared: SharedState
    let documentId: String
    let name: String
    @ObservationIgnored private var edit: EditLifecycle!
    private let notifier: DirtyNotifier

    /// Live value-only reads; no mutable Document or History escapes the owner.
    var document: DocumentRead { edit.content }
    var isDrawing: Bool { edit.isDrawing }
    var samplingLoupe: SamplingLoupeState { edit.samplingLoupe }
    var zoomPercent: Int { Int(viewport.zoom() * 100) }
    private(set) var canvasVersion = 0
    private(set) var historyVersion = 0
    private(set) var hoverPoint: ScreenCanvasCoords?
    var viewportSize = ViewportSize(width: 0, height: 0)
    private(set) var isTimelinePanelCollapsed = false
    var showGrid = true
    private(set) var isOnionSkinEnabled = false
    var viewport: AppleViewport {
        // The viewport is persisted per tab, so a replacement that changes
        // its geometry marks dirty; an inert reclamp (same zoom/pan) leaves
        // persisted state untouched (web parity: `TabViewport.reclamp`).
        // Inert during init, so hydration never marks.
        didSet {
            if viewport.zoom() != oldValue.zoom()
                || viewport.panX() != oldValue.panX()
                || viewport.panY() != oldValue.panY()
                || viewport.pixelSize() != oldValue.pixelSize() {
                notifier.markDirty(documentId: documentId)
            }
        }
    }
    init(
        shared: SharedState,
        documentId: String,
        name: String,
        notifier: DirtyNotifier = NoOpDirtyNotifier(),
        isConstrainHeld: @escaping () -> Bool,
        consumePendingToolRestore: @escaping () -> EditorTool?,
        frameScheduler: FrameScheduler = DisplayLinkFrameScheduler(),
        document: AppleDocument,
        viewport: AppleViewport
    ) {
        self.shared = shared
        self.documentId = documentId
        self.name = name
        self.notifier = notifier
        self.viewport = viewport
        // The input binding is converted to a value before ownership begins.
        // Only the lifecycle's independently hydrated Document may be edited.
        self.edit = try! EditLifecycle(
            shared: shared,
            snapshot: DocumentSnapshot.capture(document),
            isConstrainHeld: isConstrainHeld,
            consumePendingToolRestore: consumePendingToolRestore,
            frameScheduler: frameScheduler,
            effects: { [weak self] effect in self?.apply(effect) }
        )
    }

    /// Opens a fresh transparent document of `width × height`.
    convenience init(
        shared: SharedState,
        documentId: String,
        name: String,
        notifier: DirtyNotifier = NoOpDirtyNotifier(),
        isConstrainHeld: @escaping () -> Bool,
        consumePendingToolRestore: @escaping () -> EditorTool?,
        frameScheduler: FrameScheduler = DisplayLinkFrameScheduler(),
        width: UInt32,
        height: UInt32
    ) {
        // The first layer follows the web's naming convention ("Layer 1") —
        // the name the layer panel row displays.
        self.init(
            shared: shared,
            documentId: documentId,
            name: name,
            notifier: notifier,
            isConstrainHeld: isConstrainHeld,
            consumePendingToolRestore: consumePendingToolRestore,
            frameScheduler: frameScheduler,
            document: try! AppleDocument(
                width: width,
                height: height,
                firstLayerId: UUID().uuidString,
                firstLayerName: "Layer 1"
            ),
            viewport: AppleViewport.forCanvas(canvasWidth: width, canvasHeight: height)
        )
    }

    /// Rebuilds a tab from its persistence record: the document through the
    /// hydration constructor, the persisted viewport, and the tab-scoped
    /// presentation flags. History starts empty (web parity: undo/redo is
    /// session-transient). Throws when the persisted parts fail the core's
    /// hydration validation.
    convenience init(
        restoring snapshot: TabSnapshot,
        shared: SharedState,
        notifier: DirtyNotifier = NoOpDirtyNotifier(),
        isConstrainHeld: @escaping () -> Bool,
        consumePendingToolRestore: @escaping () -> EditorTool?,
        frameScheduler: FrameScheduler = DisplayLinkFrameScheduler()
    ) throws {
        self.init(
            shared: shared,
            documentId: snapshot.id,
            name: snapshot.name,
            notifier: notifier,
            isConstrainHeld: isConstrainHeld,
            consumePendingToolRestore: consumePendingToolRestore,
            frameScheduler: frameScheduler,
            document: try snapshot.document.makeDocument(
                timelinePanelCollapsed: snapshot.timelinePanelCollapsed
            ),
            viewport: AppleViewport(
                pixelSize: snapshot.viewport.pixelSize,
                zoom: snapshot.viewport.zoom,
                panX: snapshot.viewport.panX,
                panY: snapshot.viewport.panY
            )
        )
        self.isTimelinePanelCollapsed = snapshot.timelinePanelCollapsed
        self.showGrid = snapshot.viewport.showGrid
        self.isOnionSkinEnabled = snapshot.viewport.showOnionSkin
    }

    private func apply(_ effect: EditEffect) {
        switch effect {
        case .displayChanged: canvasVersion += 1
        case .historyChanged: historyVersion += 1
        case .persistDocument: notifier.markDirty(documentId: documentId)
        case .reclampViewport: reclampViewport()
        case .clearHover: hoverPoint = nil
        case .validateHover:
            if let hoverPoint, !isInCanvasBounds(hoverPoint) { self.hoverPoint = nil }
        }
    }

    var hasUndoableEdit: Bool { edit.hasUndoableEdit }
    var canUndo: Bool { edit.canUndo }
    var canRedo: Bool { edit.canRedo }
    var marquee: AppleMarqueeRegion? { edit.marquee }
    var floatingSelectionOffset: FloatingSelectionOffset? { edit.floatingSelectionOffset }
    var isActiveLayerEditable: Bool { edit.isActiveLayerEditable }
    var isPlaying: Bool { edit.isPlaying }
    var isPlaybackLooping: Bool { edit.isPlaybackLooping }
    var playheadFrameId: String? { edit.playheadFrameId }
    var layersInPanelOrder: [AppleLayerMetadata] { edit.layersInPanelOrder }
    var pixelLayersInPanelOrder: [AppleLayerMetadata] { edit.pixelLayersInPanelOrder }
    var activeLayerId: String { edit.activeLayerId }
    var referenceLayerUnderlay: ReferenceLayerUnderlay? { edit.referenceLayerUnderlay }
    var referencePlacementTarget: ReferenceLayerUnderlay? { edit.referencePlacementTarget }
    var canReorderLayers: Bool { edit.canReorderLayers }
    var frameColumns: [FrameColumn] { edit.frameColumns }
    var activeFrameId: String { edit.activeFrameId }
    var canRemoveFrame: Bool { edit.canRemoveFrame }

    func beginStroke(at coords: ScreenCanvasCoords, button: PointerButton = .primary) {
        edit.beginStroke(at: coords, button: button)
    }

    func continueStroke(to coords: ScreenCanvasCoords) {
        edit.continueStroke(to: coords)
    }

    func endStroke() {
        edit.endStroke()
    }

    func cancelStroke() {
        edit.cancelStroke()
    }

    func modifierStateChanged() {
        edit.modifierStateChanged()
    }

    func selectionClipboardSnapshot() -> SelectionClipboard? {
        edit.selectionClipboardSnapshot()
    }

    func cutSelection() -> SelectionClipboard? {
        edit.cutSelection()
    }

    func nudgeMarquee(by delta: FloatingSelectionOffset) {
        edit.nudgeMarquee(by: delta)
    }

    func clearMarqueePixels() {
        edit.clearMarqueePixels()
    }

    func clearMarqueeOrFloating() {
        edit.clearMarqueeOrFloating()
    }

    func flipMarqueeHorizontal() {
        edit.flipMarqueeHorizontal()
    }

    func flipMarqueeVertical() {
        edit.flipMarqueeVertical()
    }

    func rotateMarqueeCw() {
        edit.rotateMarqueeCw()
    }

    func rotateMarqueeCcw() {
        edit.rotateMarqueeCcw()
    }

    func renderPixels() throws -> Data {
        try edit.renderPixels()
    }

    func startPlayback() {
        edit.startPlayback()
    }

    func stopPlayback() {
        edit.stopPlayback()
    }

    func togglePlayback() {
        edit.togglePlayback()
    }

    func togglePlaybackLoop() {
        edit.togglePlaybackLoop()
    }

    func handleUndo() {
        edit.handleUndo()
    }

    func handleRedo() {
        edit.handleRedo()
    }

    func setActiveLayer(id: String) {
        edit.setActiveLayer(id: id)
    }

    static func defaultLayerName(number: UInt32) -> LocalizedStringResource {
        EditLifecycle.defaultLayerName(number: number)
    }

    func addLayer() {
        edit.addLayer()
    }

    func setReferenceLayer(_ source: ReferenceImageSource) throws {
        try edit.setReferenceLayer(source)
    }

    func setReferencePlacement(_ placement: AppleReferencePlacementUpdate) {
        edit.setReferencePlacement(placement)
    }

    func isReferencePlacementOpen(for role: ReferencePlacementGestureRole) -> Bool {
        edit.isReferencePlacementOpen(for: role)
    }

    func beginReferencePlacement(
        from role: ReferencePlacementGestureRole,
        scalingAbout handle: ReferencePlacementHandle?,
        at translation: CGSize
    ) {
        edit.beginReferencePlacement(from: role, scalingAbout: handle, at: translation)
    }

    func beginReferencePlacementPinch(anchor: CGPoint) {
        edit.beginReferencePlacementPinch(anchor: anchor)
    }

    func updateReferencePlacement(
        translation: CGSize,
        pointsPerCanvasPixel: CGFloat,
        from role: ReferencePlacementGestureRole
    ) {
        edit.updateReferencePlacement(translation: translation, pointsPerCanvasPixel: pointsPerCanvasPixel, from: role)
    }

    func commitReferencePlacement(from role: ReferencePlacementGestureRole) {
        edit.commitReferencePlacement(from: role)
    }

    func cancelReferencePlacement() {
        edit.cancelReferencePlacement()
    }

    func nudgeReferencePlacement(dx: Int64, dy: Int64) {
        edit.nudgeReferencePlacement(dx: dx, dy: dy)
    }

    func scaleReferencePlacement(by factor: Float) {
        edit.scaleReferencePlacement(by: factor)
    }

    func fitReferenceLayerToCanvas() {
        edit.fitReferenceLayerToCanvas()
    }

    func canRemoveLayer(id: String) -> Bool {
        edit.canRemoveLayer(id: id)
    }

    func removeLayer(id: String) {
        edit.removeLayer(id: id)
    }

    func canReorderLayer(id: String) -> Bool {
        edit.canReorderLayer(id: id)
    }

    func reorderLayer(id: String, toPanelIndex: Int) {
        edit.reorderLayer(id: id, toPanelIndex: toPanelIndex)
    }

    func setLayerVisibility(id: String, visible: Bool) {
        edit.setLayerVisibility(id: id, visible: visible)
    }

    func setActiveFrame(id: String) {
        edit.setActiveFrame(id: id)
    }

    func addFrame() {
        edit.addFrame()
    }

    func duplicateFrame() {
        edit.duplicateFrame()
    }

    func removeFrame(id: String) {
        edit.removeFrame(id: id)
    }

    func reorderFrame(id: String, toIndex: Int) {
        edit.reorderFrame(id: id, toIndex: toIndex)
    }

    func setFrameDuration(id: String, durationMs: UInt32) {
        edit.setFrameDuration(id: id, durationMs: durationMs)
    }

    func handleClearCanvas() {
        edit.handleClearCanvas()
    }

    func resizeCanvas(width: UInt32, height: UInt32) {
        edit.resizeCanvas(width: width, height: height)
    }

    func flipCanvasHorizontal() {
        edit.flipCanvasHorizontal()
    }

    func flipCanvasVertical() {
        edit.flipCanvasVertical()
    }

    func rotateCanvasCw() {
        edit.rotateCanvasCw()
    }

    func rotateCanvasCcw() {
        edit.rotateCanvasCcw()
    }

    func isDocumentBlank() -> Bool {
        edit.isDocumentBlank()
    }

    @discardableResult
    func commitFloatingSelection() -> Bool {
        edit.commitFloatingSelection()
    }

    @discardableResult
    func cancelFloatingSelection() -> Bool {
        edit.cancelFloatingSelection()
    }

    func pasteSelectionClipboard(_ clipboard: SelectionClipboard) {
        let center = viewport.visibleCanvasCenter(
            canvasWidth: document.width(), canvasHeight: document.height(),
            viewportSize: viewportSize
        )
        edit.pasteSelectionClipboard(clipboard, centeredAt: center.map { CGPoint(x: $0.x, y: $0.y) })
    }

    func updateReferencePlacement(magnification: CGFloat) {
        edit.updateReferencePlacement(magnification: magnification)
    }

    var onionSkinProjection: [OnionSkinGhostRead] {
        edit.onionSkinProjection(isEnabled: isOnionSkinEnabled)
    }

    func makeExportDocument(format: ExportFormat) throws -> ExportDocument {
        ExportDocument(data: try edit.exportData(format: format))
    }


    /// Toggles grid visibility (the G shortcut and TopBar button behavior).
    /// Persisted per tab, so it marks dirty (web parity: grid visibility
    /// lives in the tab's viewport record).
    func toggleGrid() {
        showGrid.toggle()
        notifier.markDirty(documentId: documentId)
    }

    /// Collapses the Timeline panel to its header strip, or expands it again —
    /// the header chevron's action. Not undoable (web parity: a persisted-UI
    /// mutation, never a History entry).
    func toggleTimelinePanel() {
        isTimelinePanelCollapsed.toggle()
        // Persisted-UI mutation (web parity): never a History entry, but it
        // does mark the document dirty.
        notifier.markDirty(documentId: documentId)
    }

    /// Flips the Onion Skin on or off. Not undoable, but persisted: the flag
    /// lives in the workspace record's per-tab viewports, so it marks the
    /// workspace — naming the document would rewrite its layers and stamp
    /// `updatedAt` for an edit that never touched it (the PR #351 reasoning).
    func toggleOnionSkin() {
        isOnionSkinEnabled.toggle()
        notifier.markWorkspaceDirty()
    }

    /// Publishes the pencil's hover target as the Hover Point. An in-bounds
    /// target shows; a target outside the canvas (the pencil moved off-canvas)
    /// clears it — the highlight only ever marks a real cell.
    func updateHoverPoint(to coords: ScreenCanvasCoords) {
        hoverPoint = isInCanvasBounds(coords) ? coords : nil
    }

    private func isInCanvasBounds(_ coords: ScreenCanvasCoords) -> Bool {
        coords.x >= 0 && coords.y >= 0 && coords.x < Int32(document.width()) && coords.y < Int32(document.height())
    }

    /// Clears the Hover Point when the pencil leaves hover range.
    func clearHoverPoint() {
        hoverPoint = nil
    }

    /// Imports, validates, and decodes a native file before opening the
    /// document Edit. Any file-boundary failure therefore leaves both the
    /// document and its History untouched.
    func importReference(at url: URL) throws {
        let source = try ReferenceImageImporter.importFile(at: url)
        try setReferenceLayer(source)
    }

    /// Captures preserved Document content plus tab identity and presentation.
    func toSnapshot() -> TabSnapshot {
        return TabSnapshot(
            id: documentId,
            name: name,
            document: edit.documentSnapshot(),
            timelinePanelCollapsed: isTimelinePanelCollapsed,
            viewport: TabViewportSnapshot(
                pixelSize: viewport.pixelSize(),
                zoom: viewport.zoom(),
                panX: viewport.panX(),
                panY: viewport.panY(),
                showGrid: showGrid,
                showOnionSkin: isOnionSkinEnabled
            )
        )
    }

    /// PNG export — the pre-294 single-format spelling, kept for the existing
    /// PNG export contract.
    func makePngExportDocument() throws -> ExportDocument {
        try makeExportDocument(format: .png)
    }

    /// Default export filename following the web convention
    /// (`generateDefaultStem` in `src/lib/canvas/export.ts`) with the format's
    /// extension. The save flow offers it as the suggested name; the user may
    /// override it.
    func defaultExportFilename(for format: ExportFormat) -> String {
        "dotorixel-\(document.width())x\(document.height())\(format.stemSuffix).\(format.fileExtension)"
    }

    /// The active Reference Layer's visible underlay footprint — the input
    /// that widens Navigation Bounds past the canvas. `nil` while a Pixel
    /// Layer is active or the Reference is hidden, so the bounds fall back to
    /// the canvas alone (web parity: `#activeReferenceFootprint` in
    /// `tab-state.svelte.ts`). Reads the placement-draft preview, so a running
    /// gesture extends the reachable area live.
    private var activeReferenceFootprint: AppleReferenceFootprint? {
        referencePlacementTarget?.footprint
    }

    /// Clamps a viewport to the current Navigation Bounds — the union of the
    /// canvas rect and the active Reference's footprint. Every viewport sink
    /// funnels through here so the canvas (and an active Reference) can never
    /// be panned or zoomed entirely out of reach.
    private func clampedToNavigationBounds(_ unclamped: AppleViewport) -> AppleViewport {
        let bounds = navigationBounds(
            canvasWidth: document.width(),
            canvasHeight: document.height(),
            referenceFootprint: activeReferenceFootprint
        )
        return unclamped.clampPanToDocumentBounds(
            minX: bounds.minX,
            minY: bounds.minY,
            maxX: bounds.maxX,
            maxY: bounds.maxY,
            viewportSize: viewportSize
        )
    }

    /// Applies the Navigation Bounds clamp and updates the viewport. No
    /// canvasVersion bump needed — replacing the viewport reference triggers
    /// @Observable change detection.
    func handleViewportChange(_ newViewport: AppleViewport) {
        viewport = clampedToNavigationBounds(newViewport)
    }

    /// Re-clamps the current viewport after an event that can shrink
    /// Navigation Bounds — a placement edit, Reference deactivation, removal,
    /// or hiding, undo/redo, or a canvas geometry change — so the viewport
    /// never rests outside the new clamp. Inert when pan is already within
    /// bounds, leaving the viewport reference (and persisted state) untouched
    /// (web parity: `TabViewport.reclamp`).
    private func reclampViewport() {
        let clamped = clampedToNavigationBounds(viewport)
        guard clamped.panX() != viewport.panX() || clamped.panY() != viewport.panY() else {
            return
        }
        viewport = clamped
    }

    func handleZoomIn() {
        let centerX = viewportSize.width / 2
        let centerY = viewportSize.height / 2
        let newZoom = viewportNextZoomLevel(currentZoom: viewport.zoom())
        let zoomed = viewport.zoomAtPoint(screenX: centerX, screenY: centerY, newZoom: newZoom)
        handleViewportChange(zoomed)
    }

    func handleZoomOut() {
        let centerX = viewportSize.width / 2
        let centerY = viewportSize.height / 2
        let newZoom = viewportPrevZoomLevel(currentZoom: viewport.zoom())
        let zoomed = viewport.zoomAtPoint(screenX: centerX, screenY: centerY, newZoom: newZoom)
        handleViewportChange(zoomed)
    }

    func handleZoomReset() {
        let centerX = viewportSize.width / 2
        let centerY = viewportSize.height / 2
        let zoomed = viewport.zoomAtPoint(screenX: centerX, screenY: centerY, newZoom: 1.0)
        handleViewportChange(zoomed)
    }

    /// Fits the canvas rect (web parity — the Reference never changes what
    /// fit frames), then clamps like every other sink so an active Reference
    /// stays reachable.
    func handleFit() {
        viewport = clampedToNavigationBounds(viewport.fitToViewport(
            canvasWidth: document.width(),
            canvasHeight: document.height(),
            viewportSize: viewportSize
        ))
    }

    var defaultExportFilename: String { defaultExportFilename(for: .png) }
}
private struct CanvasPosition {
    let x: Double
    let y: Double
}

private extension AppleViewport {
    /// Center of the visible canvas intersection in canvas coordinates, or
    /// `nil` when the viewport geometry is invalid or misses the canvas.
    func visibleCanvasCenter(
        canvasWidth: UInt32,
        canvasHeight: UInt32,
        viewportSize: ViewportSize
    ) -> CanvasPosition? {
        let effectivePixelSize = effectivePixelSize()
        guard effectivePixelSize.isFinite, effectivePixelSize > 0,
              viewportSize.width.isFinite, viewportSize.width > 0,
              viewportSize.height.isFinite, viewportSize.height > 0 else {
            return nil
        }

        // Rendering consumes rounded pan values, so visibility must use the
        // same projection or fractional pan could shift the chosen center.
        let roundedPanX = panX().rounded()
        let roundedPanY = panY().rounded()
        let visibleLeft = max(0, -roundedPanX / effectivePixelSize)
        let visibleTop = max(0, -roundedPanY / effectivePixelSize)
        let visibleRight = min(
            Double(canvasWidth),
            (viewportSize.width - roundedPanX) / effectivePixelSize
        )
        let visibleBottom = min(
            Double(canvasHeight),
            (viewportSize.height - roundedPanY) / effectivePixelSize
        )
        guard visibleLeft < visibleRight, visibleTop < visibleBottom else { return nil }
        return CanvasPosition(
            x: (visibleLeft + visibleRight) / 2,
            y: (visibleTop + visibleBottom) / 2
        )
    }
}
