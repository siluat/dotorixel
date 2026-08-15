import Foundation
import Testing
@testable import Dotorixel

/// An opaque single-color reference source of the given dimensions.
private func makeReferenceSource(width: UInt32, height: UInt32) -> ReferenceImageSource {
    var rgba = Data()
    for _ in 0..<(width * height) {
        rgba.append(contentsOf: [0, 0xFF, 0, 0xFF])
    }
    return ReferenceImageSource(name: "Reference", rgba: rgba, width: width, height: height)
}

/// Navigation Bounds at the TabState seam: every viewport sink clamps to the
/// union of the canvas rect and the active Reference's footprint, and falls
/// back to the canvas alone when a Pixel Layer is active.
///
/// Fixture geometry used throughout: 16×16 canvas, 512×512 viewport, default
/// pixel size 32 (zoom 1 → effective pixel 32, canvas display exactly fills
/// the viewport, so the canvas-only clamp locks pan to 0). A 16×16 reference
/// placed at x: 24 spans canvas pixels 24…40, extending the union to
/// maxX = 40 (display 1280 > 512 → margin mode, min panX = 32 − 1280 = −1248).
@Suite("TabState — Navigation Bounds clamping")
struct TabStateNavigationBoundsTests {
    @Test("pan reaches an active Reference's far edge beyond the canvas")
    func panReachesActiveReferenceBeyondCanvas() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 24, y: 0, scale: 1))

        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))

        #expect(tab.viewport.panX() == -800)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("with a Pixel Layer active the canvas-only clamp is unchanged")
    func pixelLayerActiveKeepsCanvasOnlyClamp() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 24, y: 0, scale: 1))
        let pixelId = try #require(
            tab.document.layers().first(where: { $0.kind == .pixel })?.id
        )
        tab.setActiveLayer(id: pixelId)

        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))

        #expect(tab.viewport.panX() == 0)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("moving the Reference back inside the canvas reclamps the pan immediately")
    func placementEditShrinksBoundsAndReclamps() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 24, y: 0, scale: 1))
        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))

        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 0, y: 0, scale: 1))

        #expect(tab.viewport.panX() == 0)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("switching to a Pixel Layer restores canvas bounds and reclamps the pan")
    func deactivationShrinksBoundsAndReclamps() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 24, y: 0, scale: 1))
        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))
        let pixelId = try #require(
            tab.document.layers().first(where: { $0.kind == .pixel })?.id
        )

        tab.setActiveLayer(id: pixelId)

        #expect(tab.viewport.panX() == 0)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("deleting the Reference restores canvas bounds and reclamps the pan")
    func removalShrinksBoundsAndReclamps() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 24, y: 0, scale: 1))
        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))
        let referenceId = try #require(
            tab.document.layers().first(where: { $0.kind == .reference })?.id
        )

        tab.removeLayer(id: referenceId)

        #expect(tab.viewport.panX() == 0)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("hiding the Reference row restores canvas bounds and reclamps the pan")
    func hidingShrinksBoundsAndReclamps() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 24, y: 0, scale: 1))
        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))
        let referenceId = try #require(
            tab.document.layers().first(where: { $0.kind == .reference })?.id
        )

        tab.setLayerVisibility(id: referenceId, visible: false)

        #expect(tab.viewport.panX() == 0)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("undo keeps a pan the restored Reference footprint still allows")
    func undoKeepsPanWithinRestoredUnion() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 24, y: 0, scale: 1))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 25, y: 0, scale: 1))
        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))

        // Undoes only the 24 → 25 nudge: the restored footprint still spans
        // 24…40, so the union still admits the pan.
        tab.handleUndo()

        #expect(tab.viewport.panX() == -800)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("undoing the placement past the canvas edge reclamps the pan")
    func undoShrinksBoundsAndReclamps() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 24, y: 0, scale: 1))
        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))

        // Undoes the 0 → 24 placement: the restored footprint lies inside
        // the canvas again, so the union collapses to the canvas rect.
        tab.handleUndo()

        #expect(tab.viewport.panX() == 0)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("canvas resize reclamps against the union, not the canvas alone")
    func resizeReclampsAgainstUnion() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 24, y: 0, scale: 1))
        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))

        // 16 → 20 canvas width: the union still spans out to the Reference's
        // maxX 40, so the pan remains reachable (the canvas-only clamp would
        // pull it back to its 20-pixel margin limit).
        tab.resizeCanvas(width: 20, height: 16)

        #expect(tab.viewport.panX() == -800)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("canvas rotation reclamps against the union, not the canvas alone")
    func rotationReclampsAgainstUnion() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        // An asymmetric pixel, so the rotation really changes the document —
        // a blank canvas would resolve to a no-op Edit and skip the reclamp.
        try tab.document.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0, b: 0, a: 0xFF))
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 24, y: 0, scale: 1))
        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))

        // A square canvas keeps its dimensions and the Reference placement
        // stays fixed across a canvas quarter-turn, so the union — and the
        // pan it admits — must survive the rotation's reclamp.
        tab.rotateCanvasCw()

        #expect(tab.viewport.panX() == -800)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("fit frames the canvas unchanged while the Reference is active")
    func fitFramesTheCanvasWithReferenceActive() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 24, y: 0, scale: 1))
        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))

        // Web parity: fit targets the canvas rect, not the union — the
        // Reference only widens what the clamp afterwards admits.
        tab.handleFit()

        #expect(tab.viewport.zoom() == 1.0)
        #expect(tab.viewport.panX() == 0)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("fit result is clamped to the union when containment demands it")
    func fitResultClampsToUnion() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 1024, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: -16, y: 0, scale: 1))

        // Union spans x ∈ −16…16 → 1024 display pixels, exactly the viewport
        // width, so containment pins panX to 512 — the canvas sits right of
        // center with the whole Reference visible on its left. An unclamped
        // fit would center the canvas at panX 256, cropping the Reference.
        tab.handleFit()

        #expect(tab.viewport.zoom() == 1.0)
        #expect(tab.viewport.panX() == 512)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("a running drag extends the bounds live and its cancel reclamps")
    func draftExtendsLiveAndCancelReclamps() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.beginReferencePlacement(from: .body, scalingAbout: nil, at: .zero)
        tab.updateReferencePlacement(
            translation: CGSize(width: 24, height: 0),
            pointsPerCanvasPixel: 1,
            from: .body
        )

        // The uncommitted draft already spans 24…40, so the pan reaches it.
        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))
        #expect(tab.viewport.panX() == -800)

        // Cancelling falls back to the committed in-canvas placement — the
        // bounds shrink and the pan must follow.
        tab.cancelReferencePlacement()
        #expect(tab.viewport.panX() == 0)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("adding a Pixel Layer deactivates the Reference and reclamps")
    func addLayerDeactivatesReferenceAndReclamps() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 24, y: 0, scale: 1))
        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))

        // The new layer becomes the drawing target — another deactivation
        // route into canvas-only bounds.
        tab.addLayer()

        #expect(tab.viewport.panX() == 0)
        #expect(tab.viewport.panY() == 0)
    }

    @Test("replacing the Reference resets its footprint and reclamps")
    func replacementShrinksBoundsAndReclamps() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 512, height: 512)
        try tab.setReferenceLayer(makeReferenceSource(width: 16, height: 16))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 24, y: 0, scale: 1))
        tab.handleViewportChange(tab.viewport.pan(deltaX: -800, deltaY: 0))

        // Replacement resets the placement to fit the canvas, so the union
        // collapses back to the canvas rect.
        try tab.setReferenceLayer(makeReferenceSource(width: 8, height: 8))

        #expect(tab.viewport.panX() == 0)
        #expect(tab.viewport.panY() == 0)
    }
}
