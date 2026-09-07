import Foundation
import Observation

/// Follow-up work decided by editing policy and performed by the tab's shell.
/// Events are delivered synchronously in transition order, including failure paths.
enum EditEffect {
    case displayChanged
    case historyChanged
    case persistDocument
    case reclampViewport
    case clearHover
    case validateHover
}

/// Owns a tab's Document, History and in-flight editing state. Callers request
/// semantic operations; admission, Floating Selection resolution and Edit Baseline
/// ordering remain behind this interface. Content reads never expose a mutable
/// binding object. The shell executes the effects without re-deciding policy.
@Observable
final class EditLifecycle {
    private var document: AppleDocument {
        didSet {
            referenceSourceCache.clear()
            placementInteraction.cancel()
        }
    }
    private let documentHistory = AppleDocumentHistory.defaultHistory()
    private let shared: SharedState
    private let isConstrainHeldProvider: () -> Bool
    private let pendingToolRestoreProvider: () -> EditorTool?
    @ObservationIgnored private let reportFailure: (String) -> Void
    @ObservationIgnored private let emit: (EditEffect) -> Void
    private(set) var isDrawing = false
    let samplingLoupe = SamplingLoupeState()
    private var canvasVersion = 0 { didSet { emit(.displayChanged) } }
    private var historyVersion = 0 { didSet { emit(.historyChanged) } }
    @ObservationIgnored private var strokeStartVersion = 0
    @ObservationIgnored private let referenceSourceCache = ReferenceLayerSourceCache()
    @ObservationIgnored private let placementInteraction = ReferenceLayerPlacementInteraction()
    @ObservationIgnored private let frameProjectionCache = FrameProjectionCache()
    @ObservationIgnored private var onionSkinCache: (
        document: ObjectIdentifier, canvasVersion: Int, read: [OnionSkinGhostRead]
    )?
    @ObservationIgnored private var playback: PlaybackController!
    private let strokeEngine = StrokeEngine()
    // Sessions borrow their host with unowned references throughout a stroke.
    @ObservationIgnored private lazy var strokeHost = StrokeHost(self)
    private let floatingSelection = FloatingSelectionLifecycle()

    /// A read-only live projection. Every read resolves the current Document,
    /// including after Undo/Redo has replaced the underlying binding object.
    var content: DocumentRead {
        _ = canvasVersion
        return DocumentRead { [self] in document }
    }

    /// Reconstructs owned content from a value; the caller cannot retain a
    /// mutable alias to the editing Document. Hydration never emits effects.
    convenience init(
        shared: SharedState,
        snapshot: DocumentSnapshot,
        isConstrainHeld: @escaping () -> Bool = { false },
        consumePendingToolRestore: @escaping () -> EditorTool? = { nil },
        frameScheduler: FrameScheduler = DisplayLinkFrameScheduler(),
        effects: @escaping (EditEffect) -> Void = { _ in },
        restoreDocument: (DocumentSnapshot) throws -> AppleDocument = { try $0.makeDocument() },
        reportFailure: @escaping (String) -> Void = { assertionFailure($0) }
    ) throws {
        self.init(
            shared: shared, document: try restoreDocument(snapshot),
            isConstrainHeld: isConstrainHeld,
            consumePendingToolRestore: consumePendingToolRestore,
            frameScheduler: frameScheduler, effects: effects, reportFailure: reportFailure
        )
    }

    /// Creates fresh content inside its owner without a capture/restore round trip.
    convenience init(
        shared: SharedState,
        width: UInt32,
        height: UInt32,
        isConstrainHeld: @escaping () -> Bool = { false },
        consumePendingToolRestore: @escaping () -> EditorTool? = { nil },
        frameScheduler: FrameScheduler = DisplayLinkFrameScheduler(),
        effects: @escaping (EditEffect) -> Void = { _ in }
    ) {
        self.init(
            shared: shared,
            document: try! AppleDocument(
                width: width, height: height, firstLayerId: UUID().uuidString,
                firstLayerName: "Layer 1"
            ),
            isConstrainHeld: isConstrainHeld,
            consumePendingToolRestore: consumePendingToolRestore,
            frameScheduler: frameScheduler, effects: effects,
            reportFailure: { assertionFailure($0) }
        )
    }

    // Only this owner may pass a newly created binding directly. External
    // constructors use values so their callers cannot retain a mutable alias.
    private init(
        shared: SharedState,
        document: AppleDocument,
        isConstrainHeld: @escaping () -> Bool,
        consumePendingToolRestore: @escaping () -> EditorTool?,
        frameScheduler: FrameScheduler,
        effects: @escaping (EditEffect) -> Void,
        reportFailure: @escaping (String) -> Void
    ) {
        self.document = document
        self.reportFailure = reportFailure
        self.shared = shared
        self.isConstrainHeldProvider = isConstrainHeld
        self.pendingToolRestoreProvider = consumePendingToolRestore
        self.emit = effects
        self.playback = PlaybackController(deps: PlaybackControllerDeps(
            getFrames: { [weak self] in
                self?.document.frames().map {
                    PlaybackFrame(id: $0.id, durationMs: $0.durationMs)
                } ?? []
            },
            requestRender: { [weak self] in self?.canvasVersion += 1 },
            frameScheduler: frameScheduler
        ))
    }

    /// Captures preservation pixels without committing a live Floating Selection.
    func documentSnapshot() -> DocumentSnapshot {
        DocumentSnapshot.capture(document, floatingSelection: floatingSelection)
    }

    var hasUndoableEdit: Bool {
        _ = historyVersion
        return documentHistory.canUndo()
    }

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

    /// One projection for whether selection commands may target the active
    /// Layer. The action bar reads the same predicate the command boundary
    /// enforces, so a future Reference Layer hides the surface without
    /// duplicating Layer-kind policy in the view.
    var isActiveLayerEditable: Bool {
        document.layers().first(where: { $0.id == document.activeLayerId() })?.kind == .pixel
    }

    /// True while in-editor playback is running its transient playhead.
    var isPlaying: Bool { playback.isPlaying }

    /// True when playback wraps to the first frame at the end instead of
    /// stopping.
    var isPlaybackLooping: Bool { playback.isLooping }

    /// The frame the playhead is showing, or `nil` while stopped. It is never
    /// the Active Frame pointer — playback leaves the edit pointer untouched.
    var playheadFrameId: String? { playback.playheadFrameId }

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

    /// Whether the stack has somewhere to reorder to — false only while the
    /// document holds a single layer. The panel renders reorder handles
    /// disabled while this is false. Reads `canvasVersion` to register the
    /// @Observable dependency (the layer stack lives in the UniFFI object,
    /// invisible to observation).
    var canReorderLayers: Bool {
        _ = canvasVersion
        return document.layers().filter { $0.kind == .pixel }.count > 1
    }

    /// The frame axis projected for the timeline ruler — one column per frame
    /// in axis order, each carrying its playback duration and per-Cel
    /// occupancy. Reads `canvasVersion` to register the @Observable dependency
    /// (the axis lives in the UniFFI object, invisible to observation) and to
    /// key the projection cache.
    var frameColumns: [FrameColumn] {
        let version = canvasVersion
        return frameProjectionCache.columns(
            for: document,
            canvasVersion: version,
            liveStroke: liveStroke,
            load: {
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
            },
            probe: { cel in
                // Same trusted-id argument as above: the address is the
                // document's own active pair, read one call ago.
                (try? document.isCelOccupied(frameId: cel.frameId, layerId: cel.layerId)) ?? false
            }
        )
    }

    /// The drawing-target frame's id — the ruler's active-column predicate.
    /// Reads `canvasVersion` to register the @Observable dependency (the
    /// pointer lives in the UniFFI object, invisible to observation).
    var activeFrameId: String {
        _ = canvasVersion
        return document.activeFrameId()
    }

    /// Whether the axis has a frame to spare — false only while the document
    /// holds a single frame, which can never be removed. The panel renders the
    /// remove affordance disabled while this is false. Reads `canvasVersion` to
    /// register the @Observable dependency (the axis lives in the UniFFI
    /// object, invisible to observation).
    var canRemoveFrame: Bool {
        _ = canvasVersion
        return document.frames().count > 1
    }

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
        // A tool stroke edits the Active Frame's Cel — exit the playback
        // preview first so the user draws on (and sees) the frame being
        // edited, not the moving playhead. `performEdit` covers the undoable
        // commands; this covers the incremental stroke path (web parity:
        // `drawStart`).
        playback.stop()
        // The pencil is touching down (or a finger stroke starting) — the
        // hover target gives way to the paint it was previewing.
        emit(.clearHover)
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
        // Recorded before the first sample can bump: a tool whose `begin`
        // changes nothing bumps no version at all, so the stroke's span has to
        // be anchored here rather than inferred from the counter.
        strokeStartVersion = canvasVersion
        if strokeEngine.begin(tool: shared.activeTool, host: strokeHost, button: button, at: coords) {
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
    func pasteSelectionClipboard(_ clipboard: SelectionClipboard, centeredAt center: CGPoint? = nil) {
        guard !isDrawing, isActiveLayerEditable else { return }
        // Pasting is an edit action — exit the playback preview first, or the
        // Floating Selection it creates would hide behind the playhead
        // composite while staying live (the `beginStroke` precedent).
        playback.stop()
        guard resolveFloatingSelectionRecovery() else { return }
        if floatingSelection.isActive, !commitFloatingSelection() { return }
        guard let destination = pasteDestination(for: clipboard, center: center) else { return }
        if floatingSelection.pasteClipboard(
            clipboard,
            at: destination,
            in: document
        ) {
            canvasVersion += 1
        }
    }

    /// Translates the active Marquee by lifting it into a Floating Selection
    /// on the first key press, then accumulating later nudges in that same
    /// transient buffer. History is recorded only when the Floating Selection
    /// commits. Reference Layers are not editable and therefore ignore it.
    func nudgeMarquee(by delta: FloatingSelectionOffset) {
        guard !isDrawing, isActiveLayerEditable else { return }
        guard delta != .zero else { return }
        // A nudge lifts (or moves) a Floating Selection — exit the playback
        // preview first for the same reason as `pasteSelectionClipboard`.
        playback.stop()

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

    /// Renderer-facing pixel buffer: committed composite normally, or the
    /// non-mutating Floating Selection patch preview while one is active.
    /// While playback runs, the playhead frame's committed composite overrides
    /// both — playback previews committed art only, and `startPlayback`
    /// resolves any Floating Selection before the playhead exists.
    func renderPixels() throws -> Data {
        if let playheadFrameId = playback.playheadFrameId {
            return try document.compositeAt(frameId: playheadFrameId)
        }
        return try floatingSelection.renderPixels(in: document)
    }

    /// Starts playback from the first frame. Commits any in-flight Floating
    /// Selection first so the preview shows the committed Document (the
    /// active-frame-switch precedent). No-ops while a stroke is drawing (the
    /// mid-stroke seal every frame-axis command shares) or when the commit
    /// fails; a no-op when already playing.
    func startPlayback() {
        // Already playing: nothing to (re)start, and edit state must not be
        // re-resolved for a start that changes nothing.
        guard !isPlaying else { return }
        guard !isDrawing else { return }
        guard resolveFloatingSelectionRecovery() else { return }
        guard !floatingSelection.isActive || commitFloatingSelection() else { return }
        playback.start()
    }

    /// Stops playback and discards the playhead, returning the display to the
    /// Active Frame. No-op when already stopped.
    func stopPlayback() {
        playback.stop()
    }

    /// The transport's Play/Pause action: stops a running playback, starts a
    /// stopped one (web parity: `handleTogglePlay` in the editor page).
    func togglePlayback() {
        if isPlaying {
            stopPlayback()
        } else {
            startPlayback()
        }
    }

    /// Toggles whether playback loops at the end of the sequence.
    func togglePlaybackLoop() {
        playback.toggleLoop()
    }

    /// Restores the previous document state from the history stack.
    /// No-ops silently while a drawing stroke is in progress.
    func handleUndo() {
        // History moves the document under the display — exit the playback
        // preview first (web parity: `undo`).
        playback.stop()
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
        // Same playback exit as Undo (web parity: `redo`).
        playback.stop()
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
        emit(.reclampViewport)
        canvasVersion += 1
        // The active-layer pointer is persisted document state (web parity:
        // a persisted-UI mutation marks dirty without a History entry).
        emit(.persistDocument)
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
            emit(.reclampViewport)
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
            emit(.reclampViewport)
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
            emit(.reclampViewport)
            canvasVersion += 1
        }
    }

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
        emit(.reclampViewport)
    }

    /// Abandons the gesture — the overlay and underlay fall back to the
    /// committed placement on the next render.
    func cancelReferencePlacement() {
        placementInteraction.cancel()
        // The draft may have extended Navigation Bounds past the committed
        // footprint — falling back shrinks them, and the pan must follow.
        emit(.reclampViewport)
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
                emit(.reclampViewport)
            }
            canvasVersion += 1
        }
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
            emit(.reclampViewport)
            canvasVersion += 1
        }
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
    func setActiveFrame(id: String) {
        guard !isDrawing else { return }
        guard id != document.activeFrameId() else { return }
        guard document.frames().contains(where: { $0.id == id }) else { return }
        guard resolveFloatingSelectionRecovery() else { return }
        guard !floatingSelection.isActive || commitFloatingSelection() else { return }
        guard (try? document.setActiveFrame(id: id)) != nil else { return }
        canvasVersion += 1
        // The active-frame pointer is persisted document state since 292
        // (web parity: a persisted-UI mutation marks dirty without a History
        // entry — the `setActiveLayer` reasoning).
        emit(.persistDocument)
    }

    /// Inserts an empty frame directly after the active one and makes it the
    /// drawing target — the ruler's add action. Every Pixel Layer receives a
    /// transparent Cel, so the new frame starts blank while the frame it was
    /// added after keeps its pixels.
    ///
    /// One undoable Edit: the whole-document snapshot restores both the frame
    /// structure and the Cels in a single undo. `performEdit` commits a pending
    /// Floating Selection first, so its lifted pixels land on their origin Cel
    /// rather than on the frame being created.
    /// No-ops silently while a drawing stroke is in progress (web parity — a
    /// live stroke's target must not move mid-stroke).
    func addFrame() {
        guard !isDrawing else { return }
        if performEdit({ (try? document.addFrame(newId: UUID().uuidString)) != nil }) {
            canvasVersion += 1
        }
    }

    /// Inserts a copy of the active frame directly after it and makes the copy
    /// the drawing target — the ruler's duplicate action. Every Pixel Layer's
    /// active-frame Cel is cloned, so the copy carries the whole composited
    /// moment, and editing it leaves the source frame untouched.
    ///
    /// Undoable and stroke-guarded exactly like `addFrame`.
    func duplicateFrame() {
        guard !isDrawing else { return }
        if performEdit({ (try? document.duplicateFrame(newId: UUID().uuidString)) != nil }) {
            canvasVersion += 1
        }
    }

    /// Removes the frame with `id` and drops its Cel from every Pixel Layer —
    /// the ruler's remove action. Removing the active frame moves the active
    /// pointer to an adjacent frame (delegated to the core).
    ///
    /// The last remaining frame is never removed (surfaced in the UI as a
    /// disabled affordance); that branch and an unknown id record no history
    /// entry. Undoable and stroke-guarded exactly like `addFrame`.
    func removeFrame(id: String) {
        guard !isDrawing else { return }
        guard canRemoveFrame else { return }
        if performEdit({ (try? document.removeFrame(id: id)) != nil }) {
            canvasVersion += 1
        }
    }

    /// Moves the frame with `id` to `toIndex` on the axis (leftmost column =
    /// 0) — the ruler drag's drop commit. Unlike the layer sidebar, the ruler
    /// renders the axis in the order `frameColumns` returns it, so the index
    /// the drag reports is already the axis index and needs no translation.
    /// Cels stay keyed by frame id, so each frame's pixels travel with it.
    ///
    /// A `toIndex` past either end lands the frame at that end, mirroring the
    /// core's own silent clamp — a drag released left of the first column
    /// reports a negative index, which the unsigned FFI boundary cannot carry
    /// and would trap on rather than wrap.
    ///
    /// A drop at the frame's current position leaves the document unchanged,
    /// so it records no history entry (web parity); a real move records exactly
    /// one. Silently ignores an unknown id, and no-ops while a drawing stroke
    /// is in progress — rearranging the axis under a live stroke would also
    /// replace its pending Edit Baseline.
    func reorderFrame(id: String, toIndex: Int) {
        guard !isDrawing else { return }
        let lastIndex = max(document.frames().count - 1, 0)
        let axisIndex = min(max(toIndex, 0), lastIndex)
        if performEdit({
            (try? document.reorderFrame(id: id, newIndex: UInt64(axisIndex))) != nil
        }) {
            canvasVersion += 1
        }
    }

    /// Sets the display duration of the frame with `id` — the duration
    /// editor's commit. Durations are per-frame, so retiming one frame leaves
    /// the others untouched. `durationMs` is clamped at the binding boundary
    /// to `[frameMinDurationMs, frameMaxDurationMs]`; the shell never restates
    /// the range.
    ///
    /// One retime is one undoable entry; a dispatch that leaves the stored
    /// duration unchanged records nothing (web parity). Silently ignores an
    /// unknown id, and no-ops while a drawing stroke is in progress —
    /// stroke-guarded exactly like `addFrame`.
    func setFrameDuration(id: String, durationMs: UInt32) {
        guard !isDrawing else { return }
        if performEdit({ (try? document.setFrameDuration(id: id, durationMs: durationMs)) != nil }) {
            canvasVersion += 1
        }
    }

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
        emit(.reclampViewport)
        // The new canvas geometry can leave a published Hover Point out of
        // bounds, and no hover event fires while the pencil holds still — clear
        // it here so the overlay never marks a cell the resize deleted. The
        // next hover republishes against the new dimensions.
        emit(.clearHover)
        canvasVersion += 1
    }

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

    /// True when every cel of every layer is fully transparent (web parity:
    /// `isDocumentBlank`). Iterates every layer and frame — hidden layers
    /// and inactive frames included, unlike the composite — so
    /// painted-then-hidden content and content on another frame still count
    /// as non-blank and the tab-close save prompt won't silently discard
    /// them.
    func isDocumentBlank() -> Bool {
        DocumentSnapshot.isDocumentBlank(document, floatingSelection: floatingSelection)
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
            emit(.persistDocument)
            return true
        case .unchanged:
            return true
        case let .failed(didCommit, message):
            if didCommit {
                emit(.persistDocument)
            }
            reportFailure(message)
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
                emit(.persistDocument)
            }
            return false
        }
    }

    /// Applies a pending Alt-eyedropper tool restore once the stroke is
    /// down — the Apple analog of the web Input Pipeline's
    /// `restoreTemporaryTool` (an Alt released mid-stroke defers to here).
    private func restoreTemporaryTool() {
        if let tool = pendingToolRestoreProvider() {
            shared.activeTool = tool
        }
    }

    @discardableResult
    private func resolveEditBaseline() -> Bool {
        let committed = documentHistory.endEdit(current: document)
        historyVersion += 1
        // A committed entry means the document actually changed — the one
        // signal every undoable edit (stroke or command) funnels through.
        if committed {
            emit(.persistDocument)
        }
        return committed
    }

    private func performEdit(_ mutate: () -> Bool) -> Bool {
        // A document edit exits the playback preview: a structural change
        // (e.g. deleting the frame under the playhead) must not run against a
        // moving playhead. Stopping first returns the display to the Active
        // Frame (web parity: `#mutate`).
        playback.stop()
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

    private func pasteDestination(
        for clipboard: SelectionClipboard, center: CGPoint?
    ) -> AppleMarqueeRegion? {
        let canvasWidth = Double(document.width())
        let canvasHeight = Double(document.height())
        let center = center ?? CGPoint(x: canvasWidth / 2, y: canvasHeight / 2)
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

    /// Adopts a document returned by undo/redo. History hands back a new
    /// object (core value-snapshot semantics), so the reference is replaced.
    /// A cross-dimension restore (a resize undone or redone) can strand the
    /// pan or a published Hover Point against geometry that no longer
    /// exists — reclamp and re-check them like `resizeCanvas` does.
    private func applyRestoredDocument(_ restored: AppleDocument) {
        document = restored
        emit(.reclampViewport)
        emit(.validateHover)
        canvasVersion += 1
        historyVersion += 1
        emit(.persistDocument)
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

    /// The stroke in progress, or nil while none is.
    ///
    /// Every frame-axis, layer-stack, and History command no-ops while a stroke
    /// is in progress (the mid-stroke seal), so its target is the only Cel
    /// whose occupancy can change between two samples of one stroke — which is
    /// what lets the projection re-probe a single Cel instead of rescanning the
    /// axis on the pointer path. That holds only back to where the stroke
    /// began, so the version is carried alongside the address.
    private var liveStroke: LiveStroke? {
        guard isDrawing else { return nil }
        return LiveStroke(
            cel: CelAddress(
                frameId: document.activeFrameId(),
                layerId: document.activeLayerId()
            ),
            startedAtVersion: strokeStartVersion
        )
    }

    /// Post-rotate geometry care, mirroring `resizeCanvas`: the W↔H swap can
    /// strand the pan outside the new bounds, and a published Hover Point
    /// marks a cell the rotation moved — reclamp the one and clear the other
    /// (the next hover event republishes against the new dimensions).
    private func reclampAfterCanvasRotation() {
        emit(.reclampViewport)
        emit(.clearHover)
    }

    /// Holds the current document as the pending Edit Baseline. The entry
    /// commits at stroke end only if the stroke changed the document —
    /// see `resolveEditBaseline()`.
    private func beginEdit() {
        documentHistory.beginEdit(document: document)
    }

    private func liftFloatingSelection(from sourceRegion: AppleMarqueeRegion) -> Bool {
        floatingSelection.liftFromMarquee(sourceRegion, in: document)
    }

    private func moveFloatingSelection(to offset: FloatingSelectionOffset) -> Bool {
        floatingSelection.moveTo(offset)
    }

    func updateReferencePlacement(magnification: CGFloat) {
        placementInteraction.update(magnification: magnification)
        canvasVersion += 1
    }

    /// Projects the Onion Skin ghosts for the current Active Frame — each
    /// neighbor's descriptor plus its committed `compositeAt` buffer, in axis
    /// order. Empty while the toggle is off, while Playback runs, or on a side
    /// with no neighbor. Computing it never mutates the document, never moves
    /// the Active Frame, and never pushes History.
    func onionSkinProjection(isEnabled: Bool) -> [OnionSkinGhostRead] {
        guard isEnabled else { return [] }
        // Playback previews committed frames full-strength; ghosts would
        // contradict the moving playhead (web parity: the `playheadFrameId`
        // guard in `onionSkinProjection`).
        guard playback.playheadFrameId == nil else { return [] }
        // Keyed by the render-invalidation path (web parity: the
        // `renderVersion`-keyed `#onionSkinProjectionCache`): `compositeAt` is
        // a full per-ghost composite, and the projection is re-read on every
        // render — one memoized entry per (document, version) makes edits,
        // undo/redo, and frame switches refresh ghosts without recompositing
        // on every read. A live stroke edits only the Active Frame's Cel (the
        // mid-stroke seal keeps every other mutator out), so the neighbors'
        // composites cannot change while one runs — the stroke's start
        // version keys the whole stroke, sparing a full ghost recomposite per
        // pointer sample (the `FrameProjectionCache` patch reasoning; raised
        // by cubic-dev-ai on PR #379).
        let version = isDrawing ? strokeStartVersion : canvasVersion
        let key = ObjectIdentifier(document)
        if let cached = onionSkinCache, cached.document == key, cached.canvasVersion == version {
            return cached.read
        }
        let read = onionSkinGhosts(
            frameIds: document.frames().map(\.id),
            activeFrameId: document.activeFrameId(),
            config: .default
        ).compactMap { ghost -> OnionSkinGhostRead? in
            // The only error is an id absent from the axis, and these ids came
            // from that same axis one call ago (the frame projection's
            // trusted-id precedent).
            guard let pixels = try? document.compositeAt(frameId: ghost.frameId) else {
                return nil
            }
            return OnionSkinGhostRead(
                frameId: ghost.frameId,
                kind: ghost.kind,
                distance: ghost.distance,
                pixels: pixels
            )
        }
        onionSkinCache = (key, version, read)
        return read
    }

    /// Encodes the document's export output in the given format at 1× scale
    /// (one canvas pixel per image/rect pixel), matching the web's export
    /// convention.
    ///
    /// - Throws: `AppleError` when a transient projection cannot be rebuilt or
    ///   encoding fails.
    func exportData(format: ExportFormat) throws -> Data {
        let exportDocument: AppleDocument
        if floatingSelection.isActive || floatingSelection.hasPendingRecovery {
            exportDocument = try DocumentSnapshot.capture(
                document, floatingSelection: floatingSelection
            ).makeDocument()
        } else {
            exportDocument = document
        }
        let data = switch format {
        case .png: try exportDocument.encodeExportPng()
        case .svg: Data(try exportDocument.encodeExportSvg().utf8)
        case .gif: try exportDocument.encodeGif()
        case .spritesheet: try exportDocument.encodeSpritesheetPng()
        }
        return data
    }

    private final class StrokeHost: SelectionSessionHost {
        unowned let owner: EditLifecycle
        init(_ owner: EditLifecycle) { self.owner = owner }
        var drawingSurface: any DrawingSurface { owner.document }
        var samplingSurface: any SamplingSurface { DocumentSamplingSurface(document: owner.document) }
        var foregroundColor: Color { owner.shared.foregroundColor }
        var backgroundColor: Color { owner.shared.backgroundColor }
        var isPixelPerfectEnabled: Bool { owner.shared.pixelPerfect }
        var isConstrainHeld: Bool { owner.isConstrainHeldProvider() }
        var samplingLoupe: SamplingLoupeState { owner.samplingLoupe }
        var selectionMarqueeForInteraction: AppleMarqueeRegion? {
            owner.floatingSelection.displayedMarquee(in: owner.document)
        }
        var floatingSelectionOffset: FloatingSelectionOffset? { owner.floatingSelectionOffset }
        func beginEdit() { owner.beginEdit() }
        func commitColorPick(_ color: Color, to target: ColorPickTarget) {
            switch target {
            case .foreground: owner.shared.foregroundColor = color
            case .background: owner.shared.backgroundColor = color
            }
            owner.shared.recordRecentColor(color)
        }
        func recordRecentColor(_ color: Color) { owner.shared.recordRecentColor(color) }
        func liftFloatingSelection(from region: AppleMarqueeRegion) -> Bool {
            owner.liftFloatingSelection(from: region)
        }
        func moveFloatingSelection(to offset: FloatingSelectionOffset) -> Bool {
            owner.moveFloatingSelection(to: offset)
        }
        func commitFloatingSelection() -> Bool { owner.commitFloatingSelection() }
        func cancelFloatingSelection() -> Bool { owner.cancelFloatingSelection() }
    }
}

/// Value-only reads of the current Document. Its private resolver cannot be
/// downcast to a mutable binding or used to bypass the Edit lifecycle.
struct DocumentRead {
    private let resolve: () -> AppleDocument
    fileprivate init(_ resolve: @escaping () -> AppleDocument) { self.resolve = resolve }
    func width() -> UInt32 { resolve().width() }
    func height() -> UInt32 { resolve().height() }
    func activeLayerId() -> String { resolve().activeLayerId() }
    func activeFrameId() -> String { resolve().activeFrameId() }
    func layers() -> [AppleLayerMetadata] { resolve().layers() }
    func frames() -> [AppleFrameMetadata] { resolve().frames() }
    func getPixel(x: UInt32, y: UInt32) throws -> Color { try resolve().getPixel(x: x, y: y) }
    func composite() -> Data { resolve().composite() }
    func compositeAt(frameId: String) throws -> Data { try resolve().compositeAt(frameId: frameId) }
    func compositeForExport() -> Data { resolve().compositeForExport() }
    func marquee() -> AppleMarqueeRegion? { resolve().marquee() }
    func activeLayerPixels() throws -> Data { try resolve().activeLayerPixels() }
    func layerSnapshots() throws -> [AppleLayerSnapshot] { try resolve().layerSnapshots() }
    func layerPlacementAt(stackIndex: UInt64) -> AppleReferencePlacement? { resolve().layerPlacementAt(stackIndex: stackIndex) }
    func layerSourcePixelsAt(stackIndex: UInt64) -> Data? { resolve().layerSourcePixelsAt(stackIndex: stackIndex) }
    func nextLayerNumber() -> UInt32 { resolve().nextLayerNumber() }
    func tryGetPixel(x: UInt32, y: UInt32) -> Color? { resolve().tryGetPixel(x: x, y: y) }
}
