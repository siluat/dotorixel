import SwiftUI

/// Per-tab editor state — everything scoped to one open document (web parity:
/// `TabState` in `tab-state.svelte.ts`): the document, its history, the
/// viewport, and the tab-scoped stroke lifecycle. References (does not own)
/// the workspace's `SharedState` so changes to the active tool / colors
/// propagate across tabs.
///
/// Wraps UniFFI objects (`AppleDocument`, `AppleViewport`) and provides
/// SwiftUI-compatible properties. Since `AppleDocument` is a reference type
/// whose internal mutations are invisible to `@Observable`, the `canvasVersion`
/// counter must be incremented manually to trigger Metal re-renders.
@Observable
final class TabState {
    /// The workspace's shared state, referenced (not owned) so changes to the
    /// active tool / colors propagate across tabs.
    let shared: SharedState

    /// Stable identity of the open document — the key session persistence
    /// and the tab strip will address the tab by.
    let documentId: String

    /// The document's display name (web parity: fresh tabs are named
    /// "Untitled N" by the workspace).
    let name: String

    /// The Document being edited. The layer panel lists its stack, picks the
    /// drawing target, and adds, removes, and reorders layers.
    var document: AppleDocument {
        didSet {
            referenceSourceCache.clear()
            // An in-flight placement draft describes the outgoing document's
            // Reference. Undo/redo can land mid-drag from a hardware keyboard,
            // so drop it rather than let it preview — or commit — onto the
            // document that replaced it.
            placementInteraction.cancel()
        }
    }
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
    /// Layer-aware undo/redo: whole-`Document` snapshots, so pixel edits,
    /// layer-structure changes, and resizes all restore through one path.
    let documentHistory = AppleDocumentHistory.defaultHistory()

    /// State behind the loupe overlay shown while an eyedropper stroke is
    /// active — see `StrokeSessionHost.samplingLoupe`.
    let samplingLoupe = SamplingLoupeState()

    /// Manually incremented to trigger SwiftUI updates when canvas pixels change.
    var canvasVersion: Int = 0
    private(set) var isDrawing: Bool = false

    /// The pencil's current hover target in canvas coordinates, or nil when no
    /// preview should show — see the Hover Point entry in `CONTEXT.md`. Fed by
    /// the pencil-hover recognizer through `updateHoverPoint`/`clearHoverPoint`;
    /// SwiftUI renders the target-cell highlight from it.
    private(set) var hoverPoint: ScreenCanvasCoords?

    /// Incremented when an edit resolves, and on undo/redo, to trigger
    /// `canUndo`/`canRedo` re-evaluation.
    /// Needed because `@Observable` cannot detect internal state changes in UniFFI objects.
    private(set) var historyVersion: Int = 0

    /// Current viewport dimensions in device pixels. Updated by the canvas
    /// host view on appear and resize; used by the viewport sinks for
    /// Navigation Bounds clamping.
    var viewportSize = ViewportSize(width: 0, height: 0)

    /// Where this tab reports persistable mutations (web parity: the
    /// `DirtyNotifier` port), keyed by `documentId`.
    private let notifier: DirtyNotifier

    /// Reads the workspace's Shift-constrain state (physical Shift OR the
    /// Constrain latch) — injected because the transient input state lives at
    /// workspace scope while stroke sessions read it through this tab.
    private let isConstrainHeldProvider: () -> Bool

    /// Consumes the workspace keyboard controller's pending Alt-eyedropper
    /// tool restore at stroke end — injected for the same scope reason as
    /// `isConstrainHeldProvider`.
    private let pendingToolRestoreProvider: () -> EditorTool?

    /// Reference source bytes are immutable for a Layer id. Keep their FFI
    /// copy outside Observation so pixel-stroke updates only re-read placement
    /// geometry and reuse the same Data storage.
    @ObservationIgnored private let referenceSourceCache = ReferenceLayerSourceCache()

    /// The in-flight Reference Layer Placement Interaction. Its draft is
    /// transient rather than document state, so `canvasVersion` — not
    /// Observation — is what republishes it, exactly like the Floating
    /// Selection lifecycle beside it.
    @ObservationIgnored private let placementInteraction = ReferenceLayerPlacementInteraction()

    /// Cel occupancy costs a full buffer scan per `[layer × frame]`. Keep the
    /// projection's FFI copy outside Observation, memoized per canvas version,
    /// so a live stroke's per-sample re-render reuses one read.
    @ObservationIgnored private let frameProjectionCache = FrameProjectionCache()

    var canUndo: Bool {
        // Read to register @Observable dependencies — History lives inside
        // UniFFI while Floating lifecycle changes bump the canvas version.
        _ = historyVersion
        _ = canvasVersion
        // A live Floating Selection and a pending recovery are transient
        // rather than History entries, but Undo is still their user-facing
        // resolution action.
        return floatingSelection.isActive
            || floatingSelection.hasPendingRecovery
            || documentHistory.canUndo()
    }

    var canRedo: Bool {
        // Read to register the same History + Floating dependencies as Undo.
        _ = historyVersion
        _ = canvasVersion
        // Redo cannot replace the Document while the lifecycle still owns a
        // Floating Selection Layer or its pending recovery snapshot.
        return !floatingSelection.isActive
            && !floatingSelection.hasPendingRecovery
            && documentHistory.canRedo()
    }

    var zoomPercent: Int {
        Int(viewport.zoom() * 100)
    }

    /// Whether the bottom-docked Timeline panel is collapsed to its header
    /// strip. Tab-scoped: the web persists it per document. In-memory only
    /// for now; persistence arrives with the session auto-save slice.
    private(set) var isTimelinePanelCollapsed: Bool = false

    /// Whether the pixel grid overlay renders. Tab-scoped (web parity: grid
    /// visibility lives in each tab's persisted viewport data).
    var showGrid: Bool = true

    init(
        shared: SharedState,
        documentId: String,
        name: String,
        notifier: DirtyNotifier = NoOpDirtyNotifier(),
        isConstrainHeld: @escaping () -> Bool,
        consumePendingToolRestore: @escaping () -> EditorTool?,
        document: AppleDocument,
        viewport: AppleViewport
    ) {
        self.shared = shared
        self.documentId = documentId
        self.name = name
        self.notifier = notifier
        self.isConstrainHeldProvider = isConstrainHeld
        self.pendingToolRestoreProvider = consumePendingToolRestore
        self.document = document
        self.viewport = viewport
    }

    /// Opens a fresh transparent document of `width × height`.
    convenience init(
        shared: SharedState,
        documentId: String,
        name: String,
        notifier: DirtyNotifier = NoOpDirtyNotifier(),
        isConstrainHeld: @escaping () -> Bool,
        consumePendingToolRestore: @escaping () -> EditorTool?,
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
        consumePendingToolRestore: @escaping () -> EditorTool?
    ) throws {
        self.init(
            shared: shared,
            documentId: snapshot.id,
            name: snapshot.name,
            notifier: notifier,
            isConstrainHeld: isConstrainHeld,
            consumePendingToolRestore: consumePendingToolRestore,
            document: try AppleDocument.fromLayers(
                width: snapshot.width,
                height: snapshot.height,
                layers: snapshot.layers,
                activeLayerId: snapshot.activeLayerId,
                nextLayerNumber: snapshot.nextLayerNumber,
                timelinePanelCollapsed: snapshot.timelinePanelCollapsed,
                reference: snapshot.reference
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
        try document.setMarquee(region: snapshot.marquee)
    }

    // MARK: - Stroke lifecycle

    /// Resolves the active tool into a per-stroke session and drives it.
    private let strokeEngine = StrokeEngine()
    private let floatingSelection = FloatingSelectionLifecycle()

    /// Opens a stroke session from the shared active tool and feeds the first
    /// sample. The pointer button picks the stroke's draw color (primary →
    /// foreground, secondary → background); touch input is always primary.
    func beginStroke(at coords: ScreenCanvasCoords, button: PointerButton = .primary) {
        // Editability is enforced once at the state boundary. Mutation
        // sessions can trust their target is a Pixel Layer, while the
        // Eyedropper remains available for what-you-see Reference sampling.
        guard !shared.activeTool.requiresEditableLayer || isActiveLayerEditable else {
            return
        }
        // The pencil is touching down (or a finger stroke starting) — the
        // hover target gives way to the paint it was previewing.
        hoverPoint = nil
        // A begin can arrive while a stroke is active (e.g. a second finger on
        // iPadOS). Close the previous stroke through the full cancel path so
        // its Edit Baseline resolves before the next session begins one.
        if isDrawing {
            cancelStroke()
        }
        // A degraded cancel keeps a persistence-safe recovery snapshot but
        // releases its interactive Floating owner. Repair the live Document
        // before any tool is allowed to open a new edit against its Layer.
        guard resolveFloatingSelectionRecovery() else { return }
        // The active tool is workspace-shared while Floating Selections are
        // tab-local. A tab can therefore be revisited with another tool
        // selected; resolve its pending selection before that tool opens a
        // History baseline against transient Floating state.
        if shared.activeTool != .selection,
           floatingSelection.isActive,
           !commitFloatingSelection() {
            return
        }
        isDrawing = true
        if strokeEngine.begin(tool: shared.activeTool, host: self, button: button, at: coords) {
            canvasVersion += 1
        }
    }

    /// Feeds one pointer sample to the active stroke.
    func continueStroke(to coords: ScreenCanvasCoords) {
        if strokeEngine.sample(at: coords) {
            canvasVersion += 1
        }
    }

    /// Ends the active stroke, committing any deferred effect and resolving
    /// the stroke's undo entry.
    func endStroke() {
        if strokeEngine.end() {
            canvasVersion += 1
        }
        resolveEditBaseline()
        isDrawing = false
        restoreTemporaryTool()
    }

    /// Cancels the active stroke after an interrupted pointer sequence
    /// (e.g. `touchesCancelled`), discarding any deferred effect. A cancel
    /// that restored the pre-stroke pixels resolves as a no-op and leaves
    /// History untouched.
    func cancelStroke() {
        if strokeEngine.cancel() {
            canvasVersion += 1
        }
        resolveEditBaseline()
        isDrawing = false
        restoreTemporaryTool()
    }

    /// Applies a pending Alt-eyedropper tool restore once the stroke is
    /// down — the Apple analog of the web Input Pipeline's
    /// `restoreTemporaryTool` (an Alt released mid-stroke defers to here).
    private func restoreTemporaryTool() {
        if let tool = pendingToolRestoreProvider() {
            shared.activeTool = tool
        }
    }

    /// Routes a Shift/latch flip into the active stroke so a stationary
    /// preview reshapes immediately — sessions otherwise read modifiers only
    /// when a new pointer sample arrives. A no-op outside a stroke. Called by
    /// the workspace, which owns the transient input state.
    func modifierStateChanged() {
        guard isDrawing else { return }
        if strokeEngine.modifierChanged() {
            canvasVersion += 1
        }
    }

    /// Resolves the pending Edit Baseline against the current document — the
    /// undo entry commits only when the edit actually changed the document; a
    /// no-op edit leaves both stacks (including the redo future) untouched.
    ///
    /// Returns whether an undo entry was committed. Stroke paths discard it:
    /// they bump the re-render off the stroke engine's own signal, which also
    /// covers the preview a cancelled stroke must erase.
    @discardableResult
    private func resolveEditBaseline() -> Bool {
        let committed = documentHistory.endEdit(current: document)
        historyVersion += 1
        // A committed entry means the document actually changed — the one
        // signal every undoable edit (stroke or command) funnels through.
        if committed {
            notifier.markDirty(documentId: documentId)
        }
        return committed
    }

    /// Runs one undoable Edit: holds the current document as the pending
    /// Edit Baseline, applies `mutate`, and resolves the baseline. Returns
    /// whether an undo entry was committed — a `mutate` that fails (returns
    /// false) or leaves the document unchanged discards the baseline and
    /// records nothing. Callers guard `isDrawing` first: opening a baseline
    /// while a stroke's is pending is the overlap the mid-stroke seals
    /// exist to prevent.
    @discardableResult
    private func performEdit(_ mutate: () -> Bool) -> Bool {
        guard resolveFloatingSelectionRecovery() else { return false }
        // A Floating Selection is its own pending edit. Resolve it first so
        // this command receives a fresh baseline and a distinct undo step.
        guard !floatingSelection.isActive || commitFloatingSelection() else {
            return false
        }
        beginEdit()
        guard mutate() else {
            // The document is unchanged, so resolving the baseline discards
            // it without recording an entry.
            resolveEditBaseline()
            return false
        }
        return resolveEditBaseline()
    }

    /// Toggles grid visibility (the G shortcut and TopBar button behavior).
    /// Persisted per tab, so it marks dirty (web parity: grid visibility
    /// lives in the tab's viewport record).
    func toggleGrid() {
        showGrid.toggle()
        notifier.markDirty(documentId: documentId)
    }

    // MARK: - Timeline panel

    /// Collapses the Timeline panel to its header strip, or expands it again —
    /// the header chevron's action. Not undoable (web parity: a persisted-UI
    /// mutation, never a History entry).
    func toggleTimelinePanel() {
        isTimelinePanelCollapsed.toggle()
        // Persisted-UI mutation (web parity): never a History entry, but it
        // does mark the document dirty.
        notifier.markDirty(documentId: documentId)
    }

    // MARK: - Selection

    /// The current Marquee, or `nil` when no selection exists — what the
    /// marching-ants overlay renders. Reads `canvasVersion` to register the
    /// @Observable dependency (the Marquee lives in the UniFFI object,
    /// invisible to observation; strokes and undo/redo both bump the version).
    var marquee: AppleMarqueeRegion? {
        _ = canvasVersion
        guard isActiveLayerEditable else { return nil }
        return floatingSelection.displayedMarquee(in: document)
    }

    /// Translation of the live Floating Selection, or `nil` when the Marquee
    /// still refers directly to committed document pixels.
    var floatingSelectionOffset: FloatingSelectionOffset? {
        _ = canvasVersion
        return floatingSelection.offset
    }

    /// Non-mutating Copy projection for the workspace-shared Selection
    /// Clipboard. Copy is inert during a stroke, on a Reference Layer, or
    /// while a degraded Floating cancellation still owns baseline recovery.
    func selectionClipboardSnapshot() -> SelectionClipboard? {
        guard !isDrawing,
              isActiveLayerEditable,
              !floatingSelection.hasPendingRecovery else { return nil }
        return floatingSelection.clipboardSnapshot(in: document)
    }

    /// Captures and clears the active Marquee as one undoable Edit. Pending
    /// recovery resolves before capture, then a live Floating Selection
    /// commits so Cut targets its translated Marquee as a distinct History step.
    func cutSelection() -> SelectionClipboard? {
        guard !isDrawing, isActiveLayerEditable else { return nil }
        guard resolveFloatingSelectionRecovery() else { return nil }
        if floatingSelection.isActive, !commitFloatingSelection() { return nil }
        guard let snapshot = floatingSelection.clipboardSnapshot(in: document) else {
            return nil
        }
        if performEdit({ document.clearMarqueePixels(); return true }) {
            canvasVersion += 1
        }
        return snapshot
    }

    /// Starts a clipboard-backed Floating Selection at the center of the
    /// visible canvas area. The clipboard and Document stay unchanged until
    /// the Floating Selection is explicitly committed.
    func pasteSelectionClipboard(_ clipboard: SelectionClipboard) {
        guard !isDrawing, isActiveLayerEditable else { return }
        guard resolveFloatingSelectionRecovery() else { return }
        if floatingSelection.isActive, !commitFloatingSelection() { return }
        guard let destination = pasteDestination(for: clipboard) else { return }
        if floatingSelection.pasteClipboard(
            clipboard,
            at: destination,
            in: document
        ) {
            canvasVersion += 1
        }
    }

    private func pasteDestination(
        for clipboard: SelectionClipboard
    ) -> AppleMarqueeRegion? {
        let canvasWidth = Double(document.width())
        let canvasHeight = Double(document.height())
        let center = viewport.visibleCanvasCenter(
            canvasWidth: document.width(),
            canvasHeight: document.height(),
            viewportSize: viewportSize
        ) ?? CanvasPosition(x: canvasWidth / 2, y: canvasHeight / 2)
        let originX = Int64(floor(center.x - Double(clipboard.width) / 2))
        let originY = Int64(floor(center.y - Double(clipboard.height) / 2))
        guard let x = Int32(exactly: originX), let y = Int32(exactly: originY),
              Int32(exactly: originX + Int64(clipboard.width) - 1) != nil,
              Int32(exactly: originY + Int64(clipboard.height) - 1) != nil else {
            return nil
        }
        return AppleMarqueeRegion(
            x: x,
            y: y,
            width: clipboard.width,
            height: clipboard.height
        )
    }

    /// Translates the active Marquee by lifting it into a Floating Selection
    /// on the first key press, then accumulating later nudges in that same
    /// transient buffer. History is recorded only when the Floating Selection
    /// commits. Reference Layers are not editable and therefore ignore it.
    func nudgeMarquee(by delta: FloatingSelectionOffset) {
        guard !isDrawing, isActiveLayerEditable else { return }
        guard delta != .zero else { return }

        if !floatingSelection.isActive {
            guard let marquee = document.marquee() else { return }
            guard floatingSelection.liftFromMarquee(marquee, in: document) else { return }
        }
        if floatingSelection.nudge(by: delta) {
            canvasVersion += 1
        }
    }

    /// Clears committed pixels inside the Marquee as one undoable Edit. A
    /// live Floating Selection follows the web policy: commit its move first,
    /// then clear the translated Marquee as a distinct Edit.
    func clearMarqueePixels() {
        guard !isDrawing, isActiveLayerEditable else { return }
        if performEdit({ document.clearMarqueePixels(); return true }) {
            canvasVersion += 1
        }
    }

    /// Escape policy shared with the web: an active Floating Selection is
    /// cancelled by exact baseline restoration without touching History;
    /// otherwise the idle Marquee is removed as an undoable Edit.
    func clearMarqueeOrFloating() {
        guard !isDrawing, isActiveLayerEditable else { return }
        if floatingSelection.isActive {
            _ = cancelFloatingSelection()
            return
        }
        if performEdit({ (try? document.setMarquee(region: nil)) != nil }) {
            canvasVersion += 1
        }
    }

    /// Mirrors the active Pixel Layer's Marquee left↔right as one undoable
    /// Edit. The core owns region-local pixel transformation and no-op
    /// detection; the shell only seals strokes and records a real result.
    func flipMarqueeHorizontal() {
        guard !isDrawing, isActiveLayerEditable else { return }
        if performEdit({ document.flipMarqueeHorizontal(); return true }) {
            canvasVersion += 1
        }
    }

    /// Mirrors the active Pixel Layer's Marquee top↔bottom as one undoable Edit.
    func flipMarqueeVertical() {
        guard !isDrawing, isActiveLayerEditable else { return }
        if performEdit({ document.flipMarqueeVertical(); return true }) {
            canvasVersion += 1
        }
    }

    /// Rotates the active Pixel Layer's Marquee 90° clockwise as one
    /// undoable Edit; the core updates both pixels and Marquee bounds.
    func rotateMarqueeCw() {
        guard !isDrawing, isActiveLayerEditable else { return }
        if performEdit({ document.rotateMarqueeCw(); return true }) {
            canvasVersion += 1
        }
    }

    /// Rotates the active Pixel Layer's Marquee 90° counter-clockwise as one
    /// undoable Edit; the core updates both pixels and Marquee bounds.
    func rotateMarqueeCcw() {
        guard !isDrawing, isActiveLayerEditable else { return }
        if performEdit({ document.rotateMarqueeCcw(); return true }) {
            canvasVersion += 1
        }
    }

    /// One projection for whether selection commands may target the active
    /// Layer. The action bar reads the same predicate the command boundary
    /// enforces, so a future Reference Layer hides the surface without
    /// duplicating Layer-kind policy in the view.
    var isActiveLayerEditable: Bool {
        document.layers().first(where: { $0.id == document.activeLayerId() })?.kind == .pixel
    }

    /// Renderer-facing pixel buffer: committed composite normally, or the
    /// non-mutating Floating Selection patch preview while one is active.
    func renderPixels() throws -> Data {
        try floatingSelection.renderPixels(in: document)
    }

    // MARK: - Hover preview

    /// Publishes the pencil's hover target as the Hover Point. An in-bounds
    /// target shows; a target outside the canvas (the pencil moved off-canvas)
    /// clears it — the highlight only ever marks a real cell.
    func updateHoverPoint(to coords: ScreenCanvasCoords) {
        hoverPoint = isInCanvasBounds(coords) ? coords : nil
    }

    private func isInCanvasBounds(_ coords: ScreenCanvasCoords) -> Bool {
        document.containsPixel(x: coords.x, y: coords.y)
    }

    /// Clears the Hover Point when the pencil leaves hover range.
    func clearHoverPoint() {
        hoverPoint = nil
    }

    /// Retries the exact baseline-pixel restoration retained after a degraded
    /// Floating cancellation. The recovery is not a History entry: success
    /// only refreshes the canvas, while failure keeps the snapshot available
    /// for persistence and a later retry.
    @discardableResult
    private func resolveFloatingSelectionRecovery() -> Bool {
        guard floatingSelection.hasPendingRecovery else { return true }

        switch floatingSelection.retryPendingRecovery(in: document) {
        case .noRecovery:
            return true
        case .restored:
            canvasVersion += 1
            return true
        case let .failed(didMutateDocument, _):
            if didMutateDocument {
                canvasVersion += 1
            }
            return false
        }
    }

    // MARK: - History

    /// Restores the previous document state from the history stack.
    /// No-ops silently while a drawing stroke is in progress.
    func handleUndo() {
        guard !isDrawing else { return }
        // A Floating Selection has not entered History yet. Undo first
        // cancels that transient operation, restoring its exact baseline
        // pixels without consuming the previous committed edit.
        if floatingSelection.isActive {
            _ = cancelFloatingSelection()
            return
        }
        // A degraded cancel has not entered History. Undo retries its exact
        // recovery and never consumes the preceding committed edit.
        if floatingSelection.hasPendingRecovery {
            _ = resolveFloatingSelectionRecovery()
            return
        }
        if let restored = documentHistory.undo(current: document) {
            applyRestoredDocument(restored)
        }
    }

    /// Restores the next document state from the history stack.
    /// No-ops silently while a drawing stroke is in progress.
    func handleRedo() {
        // Replacing the Document while a Floating Selection owns references
        // into its Layer would orphan that transient state. A degraded
        // cancellation's recovery snapshot has the same replacement guard;
        // Redo returns after both states are resolved.
        guard !isDrawing,
              !floatingSelection.isActive,
              !floatingSelection.hasPendingRecovery else { return }
        if let restored = documentHistory.redo(current: document) {
            applyRestoredDocument(restored)
        }
    }

    /// Adopts a document returned by undo/redo. History hands back a new
    /// object (core value-snapshot semantics), so the reference is replaced.
    /// A cross-dimension restore (a resize undone or redone) can strand the
    /// pan or a published Hover Point against geometry that no longer
    /// exists — reclamp and re-check them like `resizeCanvas` does.
    private func applyRestoredDocument(_ restored: AppleDocument) {
        document = restored
        reclampViewport()
        if let hoverPoint, !isInCanvasBounds(hoverPoint) {
            self.hoverPoint = nil
        }
        canvasVersion += 1
        historyVersion += 1
        notifier.markDirty(documentId: documentId)
    }

    // MARK: - Layers

    /// The layer rows in **panel order** — top of the stack first, the order
    /// the layer panel renders. `document.layers()` is stack order
    /// (bottom-first); the panel mirrors it (web parity:
    /// `stack_idx = (count - 1) - visual_idx`).
    var layersInPanelOrder: [AppleLayerMetadata] {
        // Read to register the @Observable dependency — layer structure
        // lives in the UniFFI object, invisible to observation.
        _ = canvasVersion
        return document.layers().reversed()
    }

    /// Pixel rows in panel order. The singleton Reference row is fixed after
    /// these rows and never participates in the Reorder Interaction.
    var pixelLayersInPanelOrder: [AppleLayerMetadata] {
        layersInPanelOrder.filter { $0.kind == .pixel }
    }

    /// The drawing-target layer's id — the panel's active-row predicate.
    /// Reads `canvasVersion` to register the @Observable dependency (the
    /// pointer lives in the UniFFI object, invisible to observation).
    var activeLayerId: String {
        _ = canvasVersion
        return document.activeLayerId()
    }

    /// The visible singleton Reference Layer projected for the viewport
    /// renderer, or nil when absent/hidden. All geometry comes from the core:
    /// the shell only packages source reads with the canonical footprint.
    var referenceLayerUnderlay: ReferenceLayerUnderlay? {
        _ = canvasVersion
        let layers = document.layers()
        guard let referenceIndex = layers.firstIndex(where: { $0.kind == .reference }),
              layers[referenceIndex].visible,
              let placement = document.layerPlacementAt(stackIndex: UInt64(referenceIndex)),
              let footprint = document.referenceLayerFootprintAt(stackIndex: UInt64(referenceIndex)) else {
            return nil
        }
        let referenceId = layers[referenceIndex].id
        guard let source = referenceSourceCache.source(for: referenceId, load: {
            guard let rgba = document.layerSourcePixelsAt(stackIndex: UInt64(referenceIndex)),
                  let dimensions = document.layerSourceDimensionsAt(stackIndex: UInt64(referenceIndex)) else {
                return nil
            }
            return ReferenceLayerSource(
                id: referenceId,
                rgba: rgba,
                width: dimensions.width,
                height: dimensions.height
            )
        }) else {
            return nil
        }
        let previewed = previewedPlacement(
            committed: placement,
            footprint: footprint,
            sourceKey: source.id,
            naturalWidth: source.width,
            naturalHeight: source.height
        )
        return ReferenceLayerUnderlay(
            sourceKey: source.id,
            sourceRgba: source.rgba,
            naturalWidth: source.width,
            naturalHeight: source.height,
            placement: previewed.placement,
            footprint: previewed.footprint,
            // Reference opacity UI is a later polish slice. The core's current
            // import path creates it fully opaque, so pin that reachable value.
            opacity: 1
        )
    }

    /// Substitutes a running gesture's draft for the committed placement, so
    /// the Metal underlay and the overlay box both preview the edit before it
    /// reaches the document. The draft's footprint comes from the core's
    /// rotation-aware projection rather than a shell-side recomputation.
    private func previewedPlacement(
        committed: AppleReferencePlacement,
        footprint: AppleReferenceFootprint,
        sourceKey: String,
        naturalWidth: UInt32,
        naturalHeight: UInt32
    ) -> (placement: AppleReferencePlacement, footprint: AppleReferenceFootprint) {
        // A draft opened on a different image — an import replaces the
        // Reference in place — describes geometry this source never had.
        guard let draft = placementInteraction.draft,
              placementInteraction.targetKey == sourceKey else {
            return (committed, footprint)
        }
        // Move and scale preserve the Layer's quarter-turn, which the core
        // re-applies on commit — carry it through the preview too.
        let drafted = AppleReferencePlacement(
            x: draft.x,
            y: draft.y,
            scale: draft.scale,
            rotation: committed.rotation
        )
        guard let draftedFootprint = try? appleReferenceFootprint(
            placement: drafted,
            naturalWidth: naturalWidth,
            naturalHeight: naturalHeight
        ) else {
            return (committed, footprint)
        }
        return (drafted, draftedFootprint)
    }

    /// The Reference Layer the placement overlay may edit: the visible
    /// singleton Reference underlay while it is the active layer, `nil`
    /// otherwise. One projection carries the whole overlay visibility rule —
    /// activating the Reference shows the box, deactivating or hiding the row
    /// takes it away — so the view renders it verbatim.
    ///
    /// Gated on the same Layer-kind authority as editing (`isActiveLayerEditable`)
    /// rather than a second kind test, read in its positive direction: paint is
    /// blocked on a Reference Layer precisely when placement is available.
    var referencePlacementTarget: ReferenceLayerUnderlay? {
        guard !isActiveLayerEditable else { return nil }
        return referenceLayerUnderlay
    }

    /// Makes the layer with `id` the drawing target — the layer panel's
    /// row-tap action. Not undoable (web parity: a persisted-UI mutation,
    /// never a History entry) and a silent no-op while a stroke is drawing —
    /// the stroke's target must not switch mid-stroke — or for an unknown id.
    func setActiveLayer(id: String) {
        guard !isDrawing else { return }
        guard id != document.activeLayerId() else { return }
        guard document.layers().contains(where: { $0.id == id }) else { return }
        guard resolveFloatingSelectionRecovery() else { return }
        guard !floatingSelection.isActive || commitFloatingSelection() else { return }
        guard (try? document.setActiveLayer(id: id)) != nil else { return }
        // Leaving the Reference Layer shrinks Navigation Bounds back to the
        // canvas — the pan must follow rather than rest out of reach.
        reclampViewport()
        canvasVersion += 1
        // The active-layer pointer is persisted document state (web parity:
        // a persisted-UI mutation marks dirty without a History entry).
        notifier.markDirty(documentId: documentId)
    }

    /// The localized default name for the layer numbered `number` — web
    /// parity (`layer_default_name`: "Layer {n}"). Resolved once at creation
    /// and stored in the document, like the web's add-layer call site.
    /// Int-cast so the catalog key is a stable "Layer %lld" — UInt32
    /// interpolation would generate a different format specifier.
    static func defaultLayerName(number: UInt32) -> LocalizedStringResource {
        "Layer \(Int(number))"
    }

    /// Creates a transparent pixel layer directly above the active layer and
    /// makes it the drawing target (core semantics) — the layer panel's add
    /// action, auto-named with the localized default name and the document's
    /// monotonic layer counter.
    /// No-ops silently while a drawing stroke is in progress — admitting it
    /// would both switch the stroke's target to the new layer and replace the
    /// stroke's pending Edit Baseline (iPad multitouch).
    func addLayer() {
        guard !isDrawing else { return }
        let name = String(localized: Self.defaultLayerName(number: document.nextLayerNumber()))
        if performEdit({ (try? document.addLayer(newId: UUID().uuidString, name: name)) != nil }) {
            // The new layer becomes the drawing target, deactivating an
            // active Reference — Navigation Bounds shrink to the canvas.
            reclampViewport()
            canvasVersion += 1
        }
    }

    /// Sets or replaces the singleton Reference Layer from an already decoded
    /// native import. The core fixes it at the bottom of the stack, resets its
    /// placement to fit the canvas, and makes it active. Replacement is one
    /// undoable Edit, just like initial import.
    ///
    /// Decoding and file validation happen before this boundary, so any thrown
    /// binding error leaves the Document unchanged and resolves the pending
    /// baseline without an entry.
    func setReferenceLayer(_ source: ReferenceImageSource) throws {
        guard !isDrawing else { return }
        var mutationError: Error?
        let changed = performEdit {
            do {
                try document.addReferenceLayer(
                    newId: UUID().uuidString,
                    name: source.name,
                    sourceRgba: source.rgba,
                    sourceWidth: source.width,
                    sourceHeight: source.height
                )
                return true
            } catch {
                mutationError = error
                return false
            }
        }
        if let mutationError {
            throw mutationError
        }
        if changed {
            // A replacement resets the placement to fit the canvas — a
            // footprint that extended Navigation Bounds is gone, so the pan
            // must come back inside the shrunk region.
            reclampViewport()
            canvasVersion += 1
        }
    }

    /// Commits one completed Reference Layer Placement Interaction gesture —
    /// a drag release, pinch end, nudge, or fit — as a single undoable Edit.
    /// The core preserves the layer's quarter-turn rotation, and the Edit
    /// Baseline discards a gesture that left the placement unchanged, so a
    /// net-zero gesture records nothing and never marks the document dirty.
    ///
    /// Silently inert while a stroke is drawing (the stroke owns the pending
    /// baseline), while a placement gesture is running, or without a Reference
    /// Layer. Rejects a placement that violates the core invariant —
    /// non-finite position, scale ≤ 0 — at the binding boundary, leaving the
    /// document untouched.
    ///
    /// The running-gesture seal is what keeps a keyboard nudge or a fit from
    /// landing mid-drag: the gesture's own release would commit from its start
    /// and silently overwrite that Edit. The gesture's commit path clears its
    /// draft before writing, so it passes the seal.
    func setReferencePlacement(_ placement: AppleReferencePlacementUpdate) {
        guard !isDrawing, placementInteraction.draft == nil else { return }
        guard let referenceId = document.layers().first(where: { $0.kind == .reference })?.id
        else { return }
        if performEdit({
            (try? document.setReferencePlacement(id: referenceId, placement: placement)) != nil
        }) {
            // The edit can pull the footprint back toward the canvas —
            // shrink Navigation Bounds and the pan must follow immediately.
            reclampViewport()
            canvasVersion += 1
        }
    }

    // MARK: - Reference Layer Placement Interaction

    /// Whether `role` owns the running placement gesture — the overlay's cue
    /// that it should open one rather than keep feeding an existing one.
    func isReferencePlacementOpen(for role: ReferencePlacementGestureRole) -> Bool {
        placementInteraction.isOpen(for: role)
    }

    /// Opens a placement gesture on the live overlay for the surface `role`
    /// names, scaling about `scalingAbout` when that surface is a grip. Inert
    /// without an active placement or while a stroke owns the pending Edit
    /// Baseline, and refused while another pointer already owns the placement.
    func beginReferencePlacement(
        from role: ReferencePlacementGestureRole,
        scalingAbout handle: ReferencePlacementHandle?,
        at translation: CGSize
    ) {
        guard !isDrawing, let target = referencePlacementTarget else { return }
        placementInteraction.begin(
            on: target,
            from: role,
            scalingAbout: handle,
            at: translation
        )
    }

    /// Opens a pinch gesture on the overlay body. `anchor` is the canvas-space
    /// point under the fingers, which the scaled placement holds still.
    func beginReferencePlacementPinch(anchor: CGPoint) {
        guard !isDrawing, let target = referencePlacementTarget else { return }
        placementInteraction.beginPinch(on: target, anchor: anchor)
    }

    /// Advances a drag gesture's live draft. `pointsPerCanvasPixel` converts
    /// the SwiftUI translation into canvas pixels; the update is ignored unless
    /// `role` owns the gesture.
    func updateReferencePlacement(
        translation: CGSize,
        pointsPerCanvasPixel: CGFloat,
        from role: ReferencePlacementGestureRole
    ) {
        placementInteraction.update(
            translation: translation,
            pointsPerCanvasPixel: pointsPerCanvasPixel,
            from: role
        )
        canvasVersion += 1
    }

    /// Advances a pinch gesture's live draft.
    func updateReferencePlacement(magnification: CGFloat) {
        placementInteraction.update(magnification: magnification)
        canvasVersion += 1
    }

    /// Ends `role`'s gesture and commits its draft as one undoable Edit. A
    /// gesture that ended where it started resolves to a no-op Edit and
    /// records nothing, and a non-owner's release resolves nothing at all.
    ///
    /// The draft is dropped before the write is attempted, so the re-render
    /// fires either way: a write the document refuses (mid-stroke, or a target
    /// that changed under the gesture) must not leave the discarded draft on
    /// screen.
    func commitReferencePlacement(from role: ReferencePlacementGestureRole) {
        let key = placementInteraction.targetKey
        guard let placement = placementInteraction.commit(from: role) else { return }
        canvasVersion += 1
        // The gesture described the Reference it opened on. If that Layer was
        // replaced, hidden, or deactivated while the gesture ran, its draft
        // describes geometry that no longer exists — drop it rather than write
        // it onto whatever took its place.
        guard key == referencePlacementTarget?.sourceKey else { return }
        setReferencePlacement(placement)
        // The write can be refused after the draft is already dropped (a
        // stroke owns the pending Edit Baseline) — the draft's bounds
        // extension is gone either way, so reclamp explicitly. A committed
        // write has already reclamped, leaving this inert.
        reclampViewport()
    }

    /// Abandons the gesture — the overlay and underlay fall back to the
    /// committed placement on the next render.
    func cancelReferencePlacement() {
        placementInteraction.cancel()
        // The draft may have extended Navigation Bounds past the committed
        // footprint — falling back shrinks them, and the pan must follow.
        reclampViewport()
        canvasVersion += 1
    }

    /// Arrow-key translation of the active Reference Layer Placement, in whole
    /// canvas pixels. Each press commits through the same path as a drag
    /// release, so it is its own undo step (web parity: the placement nudge
    /// commits per press rather than accumulating like the Marquee nudge,
    /// which has a Floating Selection to buffer into).
    ///
    /// Inert unless the placement overlay is live — the arrows only reach here
    /// through the routing that reads the same projection.
    func nudgeReferencePlacement(dx: Int64, dy: Int64) {
        guard let target = referencePlacementTarget else { return }
        setReferencePlacement(AppleReferencePlacementUpdate(
            x: target.placement.x + Float(dx),
            y: target.placement.y + Float(dy),
            scale: target.placement.scale
        ))
    }

    /// Multiplies the active Reference Layer Placement's scale about the
    /// footprint's center, committed like any other completed gesture. The
    /// pointer-free counterpart of a corner drag — VoiceOver's adjustable
    /// action reaches resizing through here.
    ///
    /// Stops at the same minimum projected size the drag and pinch gestures do,
    /// so an adjust-gesture user cannot shrink the box out of reach, and
    /// refuses a factor that would leave the core's `scale > 0` invariant.
    func scaleReferencePlacement(by factor: Float) {
        guard let target = referencePlacementTarget else { return }
        let requested = target.placement.scale * factor
        guard requested.isFinite else { return }
        let scale = max(requested, referencePlacementMinimumScale(
            footprint: target.footprint,
            currentScale: target.placement.scale
        ))
        guard scale > 0 else { return }
        // The origin follows the scale that was applied, not the one that was
        // asked for: at the floor those differ, and moving the origin by the
        // requested factor anyway would walk the reference toward its center
        // without ever resizing it.
        let appliedFactor = scale / target.placement.scale
        let footprint = target.footprint
        let center = (
            x: (footprint.minX + footprint.maxX) / 2,
            y: (footprint.minY + footprint.maxY) / 2
        )
        setReferencePlacement(AppleReferencePlacementUpdate(
            x: center.x - (center.x - target.placement.x) * appliedFactor,
            y: center.y - (center.y - target.placement.y) * appliedFactor,
            scale: scale
        ))
    }

    /// The Timeline Reference row's fit affordance: recomputes the centered,
    /// aspect-preserving placement from the core and commits it through the
    /// same one-gesture-one-Edit path as a drag. Web parity
    /// (`fitReferenceLayerToCanvas`) — the fit fills the canvas in both
    /// directions rather than capping at the import-time scale ceiling.
    ///
    /// Inert without a Reference Layer, and a no-op Edit when the placement is
    /// already fitted.
    func fitReferenceLayerToCanvas() {
        guard !isDrawing else { return }
        let layers = document.layers()
        guard let referenceIndex = layers.firstIndex(where: { $0.kind == .reference }),
              let dimensions = document.layerSourceDimensionsAt(
                  stackIndex: UInt64(referenceIndex)
              ),
              let fitted = try? appleReferencePlacementFitToCanvas(
                  canvasWidth: document.width(),
                  canvasHeight: document.height(),
                  naturalWidth: dimensions.width,
                  naturalHeight: dimensions.height
              )
        else { return }
        setReferencePlacement(AppleReferencePlacementUpdate(
            x: fitted.x,
            y: fitted.y,
            scale: fitted.scale
        ))
    }

    /// Imports, validates, and decodes a native file before opening the
    /// document Edit. Any file-boundary failure therefore leaves both the
    /// document and its History untouched.
    func importReference(at url: URL) throws {
        let source = try ReferenceImageImporter.importFile(at: url)
        try setReferenceLayer(source)
    }

    /// Per-row remove affordance. A Reference can be removed while a Pixel
    /// Layer remains. The final Pixel Layer cannot be removed behind a
    /// Reference: the temporary persistence projection for issue 278 must
    /// always have a restorable Pixel document until issue 282 lands.
    func canRemoveLayer(id: String) -> Bool {
        _ = canvasVersion
        let layers = document.layers()
        guard let layer = layers.first(where: { $0.id == id }) else { return false }
        if layer.kind == .reference {
            return layers.count > 1
        }
        return layers.filter { $0.kind == .pixel }.count > 1
    }

    /// Removes the layer with `id` — the layer panel's per-row remove
    /// action. When the removed layer was active, the active pointer moves
    /// to an adjacent layer (delegated to the core). The core's sole-layer
    /// guard rejects removing the last layer (surfaced in the UI as a
    /// disabled affordance); that branch and an unknown id record no
    /// history entry.
    /// No-ops silently while a drawing stroke is in progress (web parity —
    /// a live stroke's target must not vanish mid-stroke).
    func removeLayer(id: String) {
        guard !isDrawing else { return }
        guard canRemoveLayer(id: id) else { return }
        let isRemovingReference = document.layers().contains {
            $0.id == id && $0.kind == .reference
        }
        if performEdit({ (try? document.removeLayer(id: id)) != nil }) {
            if isRemovingReference {
                referenceSourceCache.clear()
                // Deleting the Reference shrinks Navigation Bounds back to
                // the canvas — reclamp so the pan never rests out of reach.
                reclampViewport()
            }
            canvasVersion += 1
        }
    }

    /// Whether the stack has somewhere to reorder to — false only while the
    /// document holds a single layer. The panel renders reorder handles
    /// disabled while this is false. Reads `canvasVersion` to register the
    /// @Observable dependency (the layer stack lives in the UniFFI object,
    /// invisible to observation).
    var canReorderLayers: Bool {
        _ = canvasVersion
        return document.layers().filter { $0.kind == .pixel }.count > 1
    }

    /// Per-row reorder affordance: only Pixel Layers participate, and at
    /// least two Pixel rows must exist for a different target to be possible.
    func canReorderLayer(id: String) -> Bool {
        guard canReorderLayers else { return false }
        return document.layers().contains { $0.id == id && $0.kind == .pixel }
    }

    /// Moves the layer with `id` to `toPanelIndex` in **panel order** (top of
    /// panel = index 0) — the panel drag's drop commit. Translates panel→stack
    /// (`stack_idx = (count - 1) - panel_idx`, the inverse of
    /// `layersInPanelOrder`) and delegates the move to the core.
    /// A `toPanelIndex` past either end lands the row at that end, mirroring
    /// the core's own silent clamp — a drag released past the last row must
    /// settle there, not trap on the out-of-range stack index the raw
    /// translation would produce.
    /// A drop at the row's current position leaves the document unchanged, so
    /// it records no history entry (web parity); a real move records exactly
    /// one, and the active layer is preserved across either. Silently ignores
    /// an unknown id.
    /// No-ops silently while a drawing stroke is in progress — restacking the
    /// live stroke's target would also replace its pending Edit Baseline.
    func reorderLayer(id: String, toPanelIndex: Int) {
        guard !isDrawing else { return }
        guard canReorderLayer(id: id) else { return }
        let lastPanelIndex = document.layers().count - 1
        let stackIndex = lastPanelIndex - min(max(toPanelIndex, 0), lastPanelIndex)
        if performEdit({
            (try? document.reorderLayer(id: id, newIndex: UInt64(stackIndex))) != nil
        }) {
            canvasVersion += 1
        }
    }

    /// Sets the visibility flag of the layer with `id` — the layer panel's
    /// eye action. A real change records one undo entry and re-renders the
    /// composite; a no-op change records nothing (web parity — `endEdit`
    /// discards a baseline the document didn't diverge from). Silently
    /// ignores an unknown id.
    /// No-ops silently while a drawing stroke is in progress — committing
    /// here would replace the stroke's pending Edit Baseline.
    func setLayerVisibility(id: String, visible: Bool) {
        guard !isDrawing else { return }
        if performEdit({ (try? document.setLayerVisibility(id: id, visible: visible)) != nil }) {
            // Hiding the active Reference removes its underlay footprint from
            // Navigation Bounds — reclamp the pan against the shrunk region.
            reclampViewport()
            canvasVersion += 1
        }
    }

    // MARK: - Frames

    /// The frame axis projected for the timeline ruler — one column per frame
    /// in axis order, each carrying its playback duration and per-Cel
    /// occupancy. Reads `canvasVersion` to register the @Observable dependency
    /// (the axis lives in the UniFFI object, invisible to observation) and to
    /// key the projection cache.
    var frameColumns: [FrameColumn] {
        let version = canvasVersion
        return frameProjectionCache.columns(
            for: document,
            canvasVersion: version
        ) {
            document.frames().map { frame in
                FrameColumn(
                    id: frame.id,
                    durationMs: frame.durationMs,
                    occupiedLayerIds: Set(
                        // The only error is an id absent from the axis, and
                        // these ids came from that same axis one call ago.
                        (try? document.occupiedLayerIds(frameId: frame.id)) ?? []
                    )
                )
            }
        }
    }

    /// The drawing-target frame's id — the ruler's active-column predicate.
    /// Reads `canvasVersion` to register the @Observable dependency (the
    /// pointer lives in the UniFFI object, invisible to observation).
    var activeFrameId: String {
        _ = canvasVersion
        return document.activeFrameId()
    }

    /// Makes the frame with `id` the drawing target — the ruler header's tap
    /// action, and the frame-axis mirror of `setActiveLayer`. Not undoable
    /// (web parity: navigating the timeline never pollutes History) and a
    /// silent no-op while a stroke is drawing — the stroke's target must not
    /// switch mid-stroke — or for an unknown id.
    ///
    /// A live Floating Selection is committed first, so its lifted pixels land
    /// on the Cel they came from instead of leaking into the frame being
    /// switched to (web parity: the PRD 186 contract).
    ///
    /// Unlike `setActiveLayer` this marks nothing dirty: the frame axis has no
    /// persistence projection until issue 292, so a switch changes no saved
    /// state and a save it triggered would write the same record back.
    func setActiveFrame(id: String) {
        guard !isDrawing else { return }
        guard id != document.activeFrameId() else { return }
        guard document.frames().contains(where: { $0.id == id }) else { return }
        guard resolveFloatingSelectionRecovery() else { return }
        guard !floatingSelection.isActive || commitFloatingSelection() else { return }
        guard (try? document.setActiveFrame(id: id)) != nil else { return }
        canvasVersion += 1
    }

    // MARK: - Canvas clear

    /// Erases every pixel of the active layer to transparent, holding the
    /// pre-clear document as the Edit Baseline so undo restores the drawing.
    /// Clearing an already-blank layer changes nothing, so it records no
    /// entry, leaves the redo future intact, and skips the re-render.
    /// No-ops silently while a drawing stroke is in progress.
    func handleClearCanvas() {
        guard !isDrawing else { return }
        if performEdit({ document.clear(); return true }) {
            canvasVersion += 1
        }
    }

    // MARK: - Canvas size

    /// Resizes the document to the given dimensions as one undoable Edit
    /// (web parity — whole-document snapshots restore pixels and dimensions
    /// together) and reclamps the viewport pan against the new bounds.
    /// Silent no-op when dimensions are unchanged or outside
    /// `canvasMinDimension...canvasMaxDimension`.
    /// No-ops silently while a drawing stroke is in progress — a live session's
    /// pre-stroke snapshot belongs to the current document and must stay restorable.
    func resizeCanvas(width: UInt32, height: UInt32) {
        guard !isDrawing else { return }
        guard width != document.width() || height != document.height() else { return }
        // Content keeps its current anchoring (top-left); the web's anchor
        // selector UI is out of scope for the Apple shell today.
        let resized = performEdit {
            (try? document.resize(newWidth: width, newHeight: height, anchor: .topLeft)) != nil
        }
        guard resized else { return }
        reclampViewport()
        // The new canvas geometry can leave a published Hover Point out of
        // bounds, and no hover event fires while the pencil holds still — clear
        // it here so the overlay never marks a cell the resize deleted. The
        // next hover republishes against the new dimensions.
        hoverPoint = nil
        canvasVersion += 1
    }

    // MARK: - Canvas transforms

    /// Mirrors the whole document left↔right as one undoable Edit — the
    /// right panel's Flip Canvas Horizontal button. A symmetric document
    /// comes back unchanged, so the Edit Baseline resolves without recording
    /// an entry (web parity: the Canvas Transform tier).
    /// No-ops silently while a drawing stroke is in progress.
    func flipCanvasHorizontal() {
        guard !isDrawing else { return }
        if performEdit({ document.flipCanvasHorizontal(); return true }) {
            canvasVersion += 1
        }
    }

    /// Mirrors the whole document top↔bottom as one undoable Edit — the
    /// mirror of `flipCanvasHorizontal`.
    /// No-ops silently while a drawing stroke is in progress.
    func flipCanvasVertical() {
        guard !isDrawing else { return }
        if performEdit({ document.flipCanvasVertical(); return true }) {
            canvasVersion += 1
        }
    }

    /// Rotates the whole document 90° clockwise as one undoable Edit —
    /// canvas width and height swap (undo restores pixels and dimensions
    /// together, the same whole-document snapshot path as `resizeCanvas`).
    /// No-ops silently while a drawing stroke is in progress.
    func rotateCanvasCw() {
        guard !isDrawing else { return }
        if performEdit({ document.rotateCanvasCw(); return true }) {
            reclampAfterCanvasRotation()
            canvasVersion += 1
        }
    }

    /// Rotates the whole document 90° counter-clockwise as one undoable
    /// Edit — the mirror of `rotateCanvasCw`.
    /// No-ops silently while a drawing stroke is in progress.
    func rotateCanvasCcw() {
        guard !isDrawing else { return }
        if performEdit({ document.rotateCanvasCcw(); return true }) {
            reclampAfterCanvasRotation()
            canvasVersion += 1
        }
    }

    /// Post-rotate geometry care, mirroring `resizeCanvas`: the W↔H swap can
    /// strand the pan outside the new bounds, and a published Hover Point
    /// marks a cell the rotation moved — reclamp the one and clear the other
    /// (the next hover event republishes against the new dimensions).
    private func reclampAfterCanvasRotation() {
        reclampViewport()
        hoverPoint = nil
    }

    // MARK: - Persistence

    /// Captures this tab's full persistence record (web parity:
    /// `TabState.toSnapshot` in `tab-state.svelte.ts`) — the document parts
    /// the hydration constructor consumes plus the tab-scoped presentation
    /// state.
    func toSnapshot() -> TabSnapshot {
        return TabSnapshot(
            id: documentId,
            name: name,
            width: document.width(),
            height: document.height(),
            layers: persistenceLayerSnapshots(),
            reference: document.referenceLayerSnapshot(),
            activeLayerId: floatingSelection.snapshotActiveLayerId(
                currentActiveLayerId: document.activeLayerId()
            ),
            nextLayerNumber: document.nextLayerNumber(),
            marquee: document.marquee(),
            timelinePanelCollapsed: isTimelinePanelCollapsed,
            viewport: TabViewportSnapshot(
                pixelSize: viewport.pixelSize(),
                zoom: viewport.zoom(),
                panX: viewport.panX(),
                panY: viewport.panY(),
                showGrid: showGrid
            )
        )
    }

    /// True when every layer's pixel buffer is fully transparent (web
    /// parity: `isDocumentBlank`). Iterates every layer — hidden ones
    /// included, unlike the composite — so painted-then-hidden content
    /// still counts as non-blank and the tab-close save prompt won't
    /// silently discard it.
    func isDocumentBlank() -> Bool {
        persistenceLayerSnapshots().allSatisfy { layer in
            layer.pixels.allSatisfy { $0 == 0 }
        }
    }

    /// Persistence-facing Layers project a live Floating Selection — or a
    /// pending degraded recovery — back onto its baseline Layer pixels. Any
    /// transient preview mutation must not affect saves, export, or the
    /// tab-close blank-document guard.
    private func persistenceLayerSnapshots() -> [AppleLayerSnapshot] {
        document.pixelLayerSnapshots().map { liveLayer in
            var snapshotLayer = liveLayer
            snapshotLayer.pixels = floatingSelection.snapshotPixels(
                for: liveLayer.id,
                currentPixels: liveLayer.pixels
            )
            return snapshotLayer
        }
    }

    // MARK: - Export

    /// Encodes the document's export composite as a PNG export document at 1×
    /// scale (one canvas pixel per image pixel), matching the web's export
    /// convention.
    ///
    /// - Throws: `AppleError` when a transient projection cannot be rebuilt or
    ///   PNG encoding fails.
    func makePngExportDocument() throws -> PngExportDocument {
        let exportDocument: AppleDocument
        if floatingSelection.isActive || floatingSelection.hasPendingRecovery {
            exportDocument = try AppleDocument.fromLayers(
                width: document.width(),
                height: document.height(),
                layers: persistenceLayerSnapshots(),
                activeLayerId: floatingSelection.snapshotActiveLayerId(
                    currentActiveLayerId: document.activeLayerId()
                ),
                nextLayerNumber: document.nextLayerNumber(),
                timelinePanelCollapsed: isTimelinePanelCollapsed
            )
        } else {
            exportDocument = document
        }
        return PngExportDocument(data: try exportDocument.encodeExportPng())
    }

    /// Default export filename following the web convention
    /// (`generateExportFilename` in `src/lib/canvas/export.ts`).
    /// The save flow offers it as the suggested name; the user may override it.
    var defaultExportFilename: String {
        "dotorixel-\(document.width())x\(document.height()).png"
    }

    // MARK: - Viewport

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
}

// MARK: - StrokeSessionHost

extension TabState: StrokeSessionHost {
    /// The document viewed through the `DrawingSurface` seam — sessions
    /// paint the active layer and read the composite, nothing structural.
    var drawingSurface: any DrawingSurface { document }
    var samplingSurface: any SamplingSurface {
        DocumentSamplingSurface(document: document)
    }

    /// Stroke draw colors come from the workspace-shared slots.
    var foregroundColor: Color { shared.foregroundColor }
    var backgroundColor: Color { shared.backgroundColor }

    var isPixelPerfectEnabled: Bool { shared.pixelPerfect }

    /// The single seam shape sessions read: physical Shift and the Constrain
    /// latch OR-combined at workspace scope, so the latch is indistinguishable
    /// from a held key.
    var isConstrainHeld: Bool { isConstrainHeldProvider() }

    /// Holds the current document as the pending Edit Baseline. The entry
    /// commits at stroke end only if the stroke changed the document —
    /// see `resolveEditBaseline()`.
    func beginEdit() {
        documentHistory.beginEdit(document: document)
    }

    /// Commits a sampled color to the given shared active-color slot. Not
    /// undoable — History stays untouched; the swatch updates via
    /// `@Observable`. A commit is a color *use*, so it also lands in the
    /// recent list (web parity: the sampling session folds both into its
    /// commit).
    func commitColorPick(_ color: Color, to target: ColorPickTarget) {
        switch target {
        case .foreground: shared.foregroundColor = color
        case .background: shared.backgroundColor = color
        }
        recordRecentColor(color)
    }

    /// Records a color into the workspace-shared recent list.
    func recordRecentColor(_ color: Color) {
        shared.recordRecentColor(color)
    }
}

// MARK: - SelectionSessionHost

extension TabState: SelectionSessionHost {
    var selectionMarqueeForInteraction: AppleMarqueeRegion? {
        floatingSelection.displayedMarquee(in: document)
    }

    func liftFloatingSelection(from sourceRegion: AppleMarqueeRegion) -> Bool {
        floatingSelection.liftFromMarquee(sourceRegion, in: document)
    }

    func moveFloatingSelection(to offset: FloatingSelectionOffset) -> Bool {
        floatingSelection.moveTo(offset)
    }

    @discardableResult
    func commitFloatingSelection() -> Bool {
        guard let outcome = floatingSelection.commit(
            in: document,
            history: documentHistory
        ) else { return false }

        historyVersion += 1
        canvasVersion += 1
        switch outcome {
        case .committed:
            notifier.markDirty(documentId: documentId)
            return true
        case .unchanged:
            return true
        case let .failed(didCommit, message):
            if didCommit {
                notifier.markDirty(documentId: documentId)
            }
            assertionFailure(message)
            return false
        }
    }

    @discardableResult
    func cancelFloatingSelection() -> Bool {
        guard let outcome = floatingSelection.cancel(in: document) else { return false }
        canvasVersion += 1
        switch outcome {
        case .restored:
            return true
        case let .degraded(
            didRestoreLayerPixels,
            didRestoreMarquee,
            _
        ):
            // A degraded cancellation participates in auto-save. While
            // recovery is pending, the lifecycle projects retained baseline
            // pixels instead of exposing a partial restore to persistence.
            if !didRestoreLayerPixels || !didRestoreMarquee {
                notifier.markDirty(documentId: documentId)
            }
            return false
        }
    }
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
