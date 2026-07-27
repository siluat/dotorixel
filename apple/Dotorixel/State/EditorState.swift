import SwiftUI

/// Central editor state shared across all views via `@Observable`.
///
/// Wraps UniFFI objects (`AppleDocument`, `AppleViewport`) and provides
/// SwiftUI-compatible properties. Since `AppleDocument` is a reference type
/// whose internal mutations are invisible to `@Observable`, the `canvasVersion`
/// counter must be incremented manually to trigger Metal re-renders.
@Observable
final class EditorState {
    /// The Document being edited. The layer panel lists its stack and picks
    /// the drawing target; add/remove and reorder arrive with issues 259–260.
    var document: AppleDocument
    var viewport: AppleViewport
    /// Layer-aware undo/redo: whole-`Document` snapshots, so pixel edits,
    /// layer-structure changes, and resizes all restore through one path.
    let documentHistory = AppleDocumentHistory.defaultHistory()
    var activeTool: EditorTool = .pencil
    var foregroundColor: Color
    var backgroundColor: Color
    var showGrid: Bool = true
    /// Pixel-perfect freehand mode (web default: on). Strokes snapshot the
    /// flag at begin, so toggling mid-stroke only affects the next stroke.
    var pixelPerfect: Bool = true

    /// Whether the physical Shift key is held (macOS modifier flags, iPad
    /// hardware keyboard). One of the two Shift-constrain sources.
    var isShiftKeyHeld: Bool = false {
        didSet { if isShiftKeyHeld != oldValue { modifierStateChanged() } }
    }

    /// Sticky toolbar Constrain latch — the touch-first stand-in for holding
    /// Shift. Session-transient by design (in-memory only): it resets on
    /// relaunch, mirroring how a held key is never remembered.
    var isConstrainLatchOn: Bool = false {
        didSet { if isConstrainLatchOn != oldValue { modifierStateChanged() } }
    }

    /// Whether a text field (the canvas-size inputs) has keyboard focus —
    /// the signal that suppresses editor shortcuts so typed letters stay in
    /// the field. Set by the owning views on focus change.
    ///
    /// Entering text focus also clears held-key state: on iPad the canvas
    /// loses first responder, so release events (e.g. the Alt that opened a
    /// temporary eyedropper) would never arrive.
    var isTextInputFocused: Bool = false {
        didSet {
            if isTextInputFocused && !oldValue {
                keyboardShortcuts.reset()
            }
        }
    }

    /// Editor keyboard shortcuts (tool keys, X/G, undo/redo combos,
    /// Alt-hold eyedropper). Platform wiring feeds it normalized key events;
    /// it dispatches back into this state via `KeyboardShortcutHost`.
    let keyboardShortcuts = KeyboardShortcutController()

    /// Colors recently *used* to draw or sampled by the eyedropper —
    /// most-recent first. In-memory only for now; persistence arrives with
    /// Phase 4 (the web keeps this in the workspace snapshot).
    private(set) var recentColors: [Color] = []

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

    /// Current viewport dimensions in device pixels. Updated by ContentView on
    /// appear and resize; used by zoom/pan handlers for clamp_pan calculations.
    var viewportSize = ViewportSize(width: 0, height: 0)

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

    init(
        width: UInt32 = 16,
        height: UInt32 = 16
    ) {
        // The first layer follows the web's naming convention ("Layer 1") —
        // the name the layer panel row displays.
        self.document = try! AppleDocument(
            width: width,
            height: height,
            firstLayerId: UUID().uuidString,
            firstLayerName: "Layer 1"
        )
        self.viewport = AppleViewport.forCanvas(canvasWidth: width, canvasHeight: height)
        // Web-matching defaults (shared-state.svelte.ts): foreground black, background white.
        self.foregroundColor = Color(r: 0x00, g: 0x00, b: 0x00, a: 0xFF)
        self.backgroundColor = Color(r: 0xFF, g: 0xFF, b: 0xFF, a: 0xFF)
        keyboardShortcuts.host = self
    }

    // MARK: - Tools

    /// Activates a tool the way a toolbar tap does (web parity: `activateTool`
    /// in `tool-ui.ts`): re-activating the already-active constrainable tool
    /// toggles the Constrain latch; anything else selects the tool.
    func activateTool(_ tool: EditorTool) {
        if tool == activeTool && tool.isConstrainable {
            isConstrainLatchOn.toggle()
        } else {
            activeTool = tool
        }
    }

    /// Sets the active tool directly — the keyboard/programmatic path.
    /// Unlike `activateTool`, re-selecting the active constrainable tool
    /// never toggles the Constrain latch (web parity: `setActiveTool`).
    func setActiveTool(_ tool: EditorTool) {
        activeTool = tool
    }

    /// Toggles grid visibility (the G shortcut and TopBar button behavior).
    func toggleGrid() {
        showGrid.toggle()
    }

    // MARK: - Colors

    /// Exchanges the foreground and background colors.
    func swapColors() {
        let previousForeground = foregroundColor
        foregroundColor = backgroundColor
        backgroundColor = previousForeground
    }

    // MARK: - Stroke lifecycle

    /// Resolves the active tool into a per-stroke session and drives it.
    private let strokeEngine = StrokeEngine()

    /// Opens a stroke session from the active tool and feeds the first sample.
    /// The pointer button picks the stroke's draw color (primary → foreground,
    /// secondary → background); touch input is always primary.
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
        if strokeEngine.begin(tool: activeTool, host: self, button: button, at: coords) {
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
        if let tool = keyboardShortcuts.consumePendingToolRestore() {
            setActiveTool(tool)
        }
    }

    /// Routes a Shift/latch flip into the active stroke so a stationary
    /// preview reshapes immediately — sessions otherwise read modifiers only
    /// when a new pointer sample arrives. A no-op outside a stroke.
    private func modifierStateChanged() {
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

// MARK: - KeyboardShortcutHost

// The requirements (`isDrawing`, `isTextInputFocused`, `activeTool`,
// `setActiveTool`, `handleUndo`, `handleRedo`, `toggleGrid`, `swapColors`)
// are all fulfilled by the primary declaration above.
extension EditorState: KeyboardShortcutHost {}

// MARK: - StrokeSessionHost

extension EditorState: StrokeSessionHost {
    /// The document viewed through the `DrawingSurface` seam — sessions
    /// paint the active layer and read the composite, nothing structural.
    var drawingSurface: any DrawingSurface { document }

    var isPixelPerfectEnabled: Bool { pixelPerfect }

    /// The single seam shape sessions read: physical Shift and the Constrain
    /// latch OR-combined, so the latch is indistinguishable from a held key.
    var isConstrainHeld: Bool { isShiftKeyHeld || isConstrainLatchOn }

    /// Holds the current document as the pending Edit Baseline. The entry
    /// commits at stroke end only if the stroke changed the document —
    /// see `resolveEditBaseline()`.
    func beginEdit() {
        documentHistory.beginEdit(document: document)
    }

    /// Commits a sampled color to the given active-color slot. Not undoable —
    /// History stays untouched; the swatch updates via `@Observable`.
    /// A commit is a color *use*, so it also lands in the recent list
    /// (web parity: the sampling session folds both into its commit).
    func commitColorPick(_ color: Color, to target: ColorPickTarget) {
        switch target {
        case .foreground: foregroundColor = color
        case .background: backgroundColor = color
        }
        recordRecentColor(color)
    }

    /// Maximum entries in `recentColors` — web parity (`addRecentColor` in
    /// `src/lib/canvas/color.ts`).
    private static let maxRecentColors = 12

    /// Folds a used color into `recentColors`, most-recent first. Re-using a
    /// listed color moves it to the front instead of duplicating it; the
    /// list caps at `maxRecentColors`, dropping the oldest.
    func recordRecentColor(_ color: Color) {
        recentColors.removeAll { $0 == color }
        recentColors.insert(color, at: 0)
        if recentColors.count > Self.maxRecentColors {
            recentColors.removeLast(recentColors.count - Self.maxRecentColors)
        }
    }
}
