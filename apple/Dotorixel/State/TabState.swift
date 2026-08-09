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
    var document: AppleDocument
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
    /// host view on appear and resize; used by zoom/pan handlers for
    /// clamp_pan calculations.
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

    var canUndo: Bool {
        // Read to register @Observable dependency — actual state lives in UniFFI object
        _ = historyVersion
        return documentHistory.canUndo()
    }

    var canRedo: Bool {
        // Read to register @Observable dependency — actual state lives in UniFFI object
        _ = historyVersion
        return documentHistory.canRedo()
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
    }

    // MARK: - Stroke lifecycle

    /// Resolves the active tool into a per-stroke session and drives it.
    private let strokeEngine = StrokeEngine()

    /// Opens a stroke session from the shared active tool and feeds the first
    /// sample. The pointer button picks the stroke's draw color (primary →
    /// foreground, secondary → background); touch input is always primary.
    func beginStroke(at coords: ScreenCanvasCoords, button: PointerButton = .primary) {
        // The pencil is touching down (or a finger stroke starting) — the
        // hover target gives way to the paint it was previewing.
        hoverPoint = nil
        // A begin can arrive while a stroke is active (e.g. a second finger on
        // iPadOS). Close the previous stroke through the full cancel path so
        // its Edit Baseline resolves before the next session begins one.
        if isDrawing {
            cancelStroke()
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
        return document.marquee()
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

    /// Keeps the Marquee inside the current canvas after its geometry changes.
    /// The Apple resize path is top-left anchored, so the selection keeps its
    /// origin and only the cropped overlap survives; no overlap clears it.
    private func clipMarqueeToCanvas() {
        guard let marquee = document.marquee() else { return }
        let clipped = appleMarqueeClipTo(
            region: marquee,
            canvasW: document.width(),
            canvasH: document.height()
        )
        do {
            try document.setMarquee(region: clipped)
        } catch {
            // A core-produced Marquee clipped by the core helper is valid.
            assertionFailure("Failed to clip Marquee after canvas resize: \(error)")
        }
    }

    /// Clears the Hover Point when the pencil leaves hover range.
    func clearHoverPoint() {
        hoverPoint = nil
    }

    // MARK: - History

    /// Restores the previous document state from the history stack.
    /// No-ops silently while a drawing stroke is in progress.
    func handleUndo() {
        guard !isDrawing else { return }
        if let restored = documentHistory.undo(current: document) {
            applyRestoredDocument(restored)
        }
    }

    /// Restores the next document state from the history stack.
    /// No-ops silently while a drawing stroke is in progress.
    func handleRedo() {
        guard !isDrawing else { return }
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
        viewport = viewport.clampPan(
            canvasWidth: document.width(),
            canvasHeight: document.height(),
            viewportSize: viewportSize
        )
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

    /// The drawing-target layer's id — the panel's active-row predicate.
    /// Reads `canvasVersion` to register the @Observable dependency (the
    /// pointer lives in the UniFFI object, invisible to observation).
    var activeLayerId: String {
        _ = canvasVersion
        return document.activeLayerId()
    }

    /// Makes the layer with `id` the drawing target — the layer panel's
    /// row-tap action. Not undoable (web parity: a persisted-UI mutation,
    /// never a History entry) and a silent no-op while a stroke is drawing —
    /// the stroke's target must not switch mid-stroke — or for an unknown id.
    func setActiveLayer(id: String) {
        guard !isDrawing else { return }
        guard id != document.activeLayerId() else { return }
        guard (try? document.setActiveLayer(id: id)) != nil else { return }
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
            canvasVersion += 1
        }
    }

    /// Whether a layer can currently be removed — false only at the
    /// sole-layer guard (a document always keeps at least one layer). The
    /// panel renders remove buttons disabled while this is false, the UI
    /// face of the guard `removeLayer` enforces. Reads `canvasVersion` to
    /// register the @Observable dependency (the layer stack lives in the
    /// UniFFI object, invisible to observation).
    var canRemoveLayer: Bool {
        _ = canvasVersion
        return document.layers().count > 1
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
        if performEdit({ (try? document.removeLayer(id: id)) != nil }) {
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
        return document.layers().count > 1
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
            canvasVersion += 1
        }
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
    /// (web parity — whole-document snapshots restore pixels, dimensions, and
    /// Marquee together), clips the Marquee to the new canvas, and reclamps
    /// the viewport pan against the new bounds.
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
            guard (try? document.resize(
                newWidth: width,
                newHeight: height,
                anchor: .topLeft
            )) != nil else { return false }
            clipMarqueeToCanvas()
            return true
        }
        guard resized else { return }
        viewport = viewport.clampPan(
            canvasWidth: width,
            canvasHeight: height,
            viewportSize: viewportSize
        )
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
        viewport = viewport.clampPan(
            canvasWidth: document.width(),
            canvasHeight: document.height(),
            viewportSize: viewportSize
        )
        hoverPoint = nil
    }

    // MARK: - Persistence

    /// Captures this tab's full persistence record (web parity:
    /// `TabState.toSnapshot` in `tab-state.svelte.ts`) — the document parts
    /// the hydration constructor consumes plus the tab-scoped presentation
    /// state.
    func toSnapshot() -> TabSnapshot {
        TabSnapshot(
            id: documentId,
            name: name,
            width: document.width(),
            height: document.height(),
            // `layerSnapshots` errors only on a Reference Layer, which the
            // Apple shell has no creation path for yet — an impossible state
            // here, not a boundary to guard.
            layers: try! document.layerSnapshots(),
            activeLayerId: document.activeLayerId(),
            nextLayerNumber: document.nextLayerNumber(),
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
        // `layerSnapshots` errors only on a Reference Layer (no Apple
        // creation path yet) — same impossible state as `toSnapshot`.
        let layers = try! document.layerSnapshots()
        return layers.allSatisfy { layer in layer.pixels.allSatisfy { $0 == 0 } }
    }

    // MARK: - Export

    /// Encodes the document's export composite as a PNG export document at 1×
    /// scale (one canvas pixel per image pixel), matching the web's export
    /// convention.
    ///
    /// - Throws: `AppleError` when PNG encoding fails.
    func makePngExportDocument() throws -> PngExportDocument {
        PngExportDocument(data: try document.encodeExportPng())
    }

    /// Default export filename following the web convention
    /// (`generateExportFilename` in `src/lib/canvas/export.ts`).
    /// The save flow offers it as the suggested name; the user may override it.
    var defaultExportFilename: String {
        "dotorixel-\(document.width())x\(document.height()).png"
    }

    // MARK: - Viewport

    /// Applies clamp_pan and updates the viewport. No canvasVersion bump needed —
    /// replacing the viewport reference triggers @Observable change detection.
    func handleViewportChange(_ newViewport: AppleViewport) {
        viewport = newViewport.clampPan(
            canvasWidth: document.width(),
            canvasHeight: document.height(),
            viewportSize: viewportSize
        )
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

    func handleFit() {
        viewport = viewport.fitToViewport(
            canvasWidth: document.width(),
            canvasHeight: document.height(),
            viewportSize: viewportSize
        )
    }
}

// MARK: - StrokeSessionHost

extension TabState: StrokeSessionHost {
    /// The document viewed through the `DrawingSurface` seam — sessions
    /// paint the active layer and read the composite, nothing structural.
    var drawingSurface: any DrawingSurface { document }

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
