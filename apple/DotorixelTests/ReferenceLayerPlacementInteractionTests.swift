import CoreGraphics
import Foundation
import Testing
@testable import Dotorixel

private final class PlacementDirtyRecorder: DirtyNotifier {
    private(set) var markedDocumentIds: [String] = []

    func markDirty(documentId: String) {
        markedDocumentIds.append(documentId)
    }

    func markWorkspaceDirty() {}
    func notifyTabRemoved(documentId: String) {}
}

private struct PlacementFixture {
    let notifier: PlacementDirtyRecorder
    let tab: TabState
    let pixelLayerId: String
    let referenceLayerId: String
}

/// An 8 × 8 document carrying a 4 × 2 Reference source, so the core's auto-fit
/// lands at scale 1 with a (2, 3)–(6, 5) footprint — a non-square source whose
/// projected box is asymmetric in both axes.
private func makePlacementFixture(
    documentId: String = "reference-placement"
) throws -> PlacementFixture {
    let notifier = PlacementDirtyRecorder()
    let pixelLayerId = UUID().uuidString.lowercased()
    let document = try AppleDocument(
        width: 8,
        height: 8,
        firstLayerId: pixelLayerId,
        firstLayerName: "Layer 1"
    )
    let tab = TabState(
        shared: SharedState(),
        documentId: documentId,
        name: documentId,
        notifier: notifier,
        isConstrainHeld: { false },
        consumePendingToolRestore: { nil },
        document: document,
        viewport: AppleViewport(pixelSize: 10, zoom: 1, panX: 0, panY: 0)
    )
    try tab.setReferenceLayer(ReferenceImageSource(
        name: "Reference",
        rgba: Data(repeating: 0xFF, count: 4 * 2 * 4),
        width: 4,
        height: 2
    ))
    let referenceLayerId = try #require(
        tab.document.layers().first(where: { $0.kind == .reference })?.id
    )
    return PlacementFixture(
        notifier: notifier,
        tab: tab,
        pixelLayerId: pixelLayerId,
        referenceLayerId: referenceLayerId
    )
}

@Suite("Reference Layer Placement Interaction — overlay subject")
struct ReferencePlacementTargetTests {

    @Test("the placement target appears with the active Reference and hides otherwise")
    func targetFollowsActivation() throws {
        let fixture = try makePlacementFixture()
        let tab = fixture.tab

        // Import makes the Reference active (core semantics), so the overlay
        // is live the moment the underlay exists.
        let target = try #require(tab.referencePlacementTarget)
        #expect(target.footprint == AppleReferenceFootprint(minX: 2, minY: 3, maxX: 6, maxY: 5))
        #expect(target.naturalWidth == 4)
        #expect(target.naturalHeight == 2)

        tab.setActiveLayer(id: fixture.pixelLayerId)
        #expect(tab.referencePlacementTarget == nil)
        #expect(tab.referenceLayerUnderlay != nil)

        tab.setActiveLayer(id: fixture.referenceLayerId)
        #expect(tab.referencePlacementTarget != nil)

        tab.setLayerVisibility(id: fixture.referenceLayerId, visible: false)
        #expect(tab.referencePlacementTarget == nil)
    }
}

/// A 4 × 2 source placed at (2, 3) with scale 1 — the fixture document's
/// auto-fit state, restated as a plain value for the gesture math.
private let unitTarget = ReferenceLayerUnderlay(
    sourceKey: "reference",
    sourceRgba: Data(repeating: 0xFF, count: 4 * 2 * 4),
    naturalWidth: 4,
    naturalHeight: 2,
    placement: AppleReferencePlacement(x: 2, y: 3, scale: 1, rotation: 0),
    footprint: AppleReferenceFootprint(minX: 2, minY: 3, maxX: 6, maxY: 5),
    opacity: 1
)

@Suite("Reference Layer Placement Interaction — move gesture")
struct ReferencePlacementMoveTests {

    @Test("dragging the body translates the placement by the canvas-space delta")
    func bodyDragTranslatesPlacement() {
        let interaction = ReferenceLayerPlacementInteraction()

        interaction.begin(on: unitTarget, handle: nil)
        // 10pt per canvas pixel: a (30, -15)pt drag is +3, -1.5 canvas pixels.
        interaction.update(
            translation: CGSize(width: 30, height: -15),
            pointsPerCanvasPixel: 10
        )

        #expect(interaction.draft == AppleReferencePlacementUpdate(x: 5, y: 1.5, scale: 1))
        #expect(interaction.commit() == AppleReferencePlacementUpdate(x: 5, y: 1.5, scale: 1))
        #expect(interaction.draft == nil)
    }
}

/// A 40 × 20 source at scale 1, placed at (2, 3) — large enough that the
/// minimum-projected-size floor stays out of the way of ordinary scale math.
private let scaleTarget = ReferenceLayerUnderlay(
    sourceKey: "reference",
    sourceRgba: Data(repeating: 0xFF, count: 40 * 20 * 4),
    naturalWidth: 40,
    naturalHeight: 20,
    placement: AppleReferencePlacement(x: 2, y: 3, scale: 1, rotation: 0),
    footprint: AppleReferenceFootprint(minX: 2, minY: 3, maxX: 42, maxY: 23),
    opacity: 1
)

@Suite("Reference Layer Placement Interaction — scale gesture")
struct ReferencePlacementScaleTests {

    @Test("a corner drag scales about the opposite corner, which holds still")
    func cornerDragAnchorsTheOppositeCorner() {
        let interaction = ReferenceLayerPlacementInteraction()

        // Pulling the bottom-right handle 25 canvas pixels outward along x
        // projects onto the corner's diagonal as scale 1.5; the top-left
        // corner is the anchor, so the origin does not move.
        interaction.begin(on: scaleTarget, handle: .bottomRight)
        interaction.update(
            translation: CGSize(width: 250, height: 0),
            pointsPerCanvasPixel: 10
        )
        #expect(interaction.draft == AppleReferencePlacementUpdate(x: 2, y: 3, scale: 1.5))
        interaction.cancel()

        // The mirrored pull on the top-left handle reaches the same scale and
        // holds the bottom-right corner (42, 23) still instead.
        interaction.begin(on: scaleTarget, handle: .topLeft)
        interaction.update(
            translation: CGSize(width: -250, height: 0),
            pointsPerCanvasPixel: 10
        )
        #expect(interaction.draft == AppleReferencePlacementUpdate(x: -18, y: -7, scale: 1.5))
    }

    @Test("a scale drag collapsing the box stops at the minimum projected size")
    func scaleDragRespectsTheMinimumProjectedSize() {
        let interaction = ReferenceLayerPlacementInteraction()

        interaction.begin(on: scaleTarget, handle: .bottomRight)
        interaction.update(
            translation: CGSize(width: -100_000, height: -100_000),
            pointsPerCanvasPixel: 10
        )

        // Web parity: the shorter axis reaches the 8-canvas-pixel floor first,
        // so the smallest reachable scale is 8 / 20. The invariant the core
        // enforces (scale > 0) is never approached from a gesture.
        let draft = interaction.draft
        #expect(draft == AppleReferencePlacementUpdate(x: 2, y: 3, scale: 8.0 / 20.0))
        #expect((draft?.scale ?? 0) > 0)
    }
}

@Suite("Reference Layer Placement Interaction — pinch gesture")
struct ReferencePlacementPinchTests {

    @Test("a pinch inside the overlay scales about the point under the fingers")
    func pinchHoldsItsAnchor() {
        let interaction = ReferenceLayerPlacementInteraction()

        // Anchored on the box's own origin, doubling grows it away from that
        // corner — the placement origin does not move.
        interaction.beginPinch(on: scaleTarget, anchor: CGPoint(x: 2, y: 3))
        interaction.update(magnification: 2)
        #expect(interaction.draft == AppleReferencePlacementUpdate(x: 2, y: 3, scale: 2))
        interaction.cancel()

        // Anchored on the box center, halving pulls both edges toward it.
        interaction.beginPinch(on: scaleTarget, anchor: CGPoint(x: 22, y: 13))
        interaction.update(magnification: 0.5)
        #expect(interaction.draft == AppleReferencePlacementUpdate(x: 12, y: 8, scale: 0.5))
    }

    @Test("a collapsing pinch stops at the minimum projected size, anchor intact")
    func pinchRespectsTheMinimumProjectedSize() {
        let interaction = ReferenceLayerPlacementInteraction()

        interaction.beginPinch(on: scaleTarget, anchor: CGPoint(x: 2, y: 3))
        interaction.update(magnification: 0.001)

        // Clamped to 8 / 20, and the anchored corner still holds — the
        // position follows the scale the gesture actually reached.
        #expect(interaction.draft
            == AppleReferencePlacementUpdate(x: 2, y: 3, scale: 8.0 / 20.0))
    }
}

@Suite("Reference Layer Placement Interaction — live draft")
struct ReferencePlacementDraftTests {

    @Test("a running gesture renders its draft without touching the document or History")
    func draftRendersBeforeCommit() throws {
        let fixture = try makePlacementFixture(documentId: "placement-draft")
        let tab = fixture.tab
        let committed = try #require(tab.referencePlacementTarget).placement
        let marksBeforeGesture = fixture.notifier.markedDocumentIds.count
        let canvasVersionBeforeGesture = tab.canvasVersion

        tab.beginReferencePlacement(handle: nil)
        tab.updateReferencePlacement(
            translation: CGSize(width: 40, height: 20),
            pointsPerCanvasPixel: 10
        )

        // Both surfaces read the draft: the overlay box and the Metal underlay
        // move together, one gesture ahead of the document.
        let previewed = try #require(tab.referencePlacementTarget)
        #expect(previewed.placement == AppleReferencePlacement(x: 6, y: 5, scale: 1, rotation: 0))
        #expect(previewed.footprint == AppleReferenceFootprint(minX: 6, minY: 5, maxX: 10, maxY: 7))
        #expect(tab.referenceLayerUnderlay?.placement == previewed.placement)
        #expect(tab.canvasVersion > canvasVersionBeforeGesture)
        // The document and its History are untouched until the gesture ends.
        #expect(fixture.notifier.markedDocumentIds.count == marksBeforeGesture)

        tab.commitReferencePlacement()

        #expect(try #require(tab.referencePlacementTarget).placement == previewed.placement)
        #expect(fixture.notifier.markedDocumentIds.count == marksBeforeGesture + 1)

        tab.handleUndo()

        #expect(try #require(tab.referencePlacementTarget).placement == committed)
    }

    @Test("replacing the document drops an in-flight draft instead of committing it")
    func documentReplacementDropsTheDraft() throws {
        let fixture = try makePlacementFixture(documentId: "placement-replaced")
        let tab = fixture.tab
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 5, y: 5, scale: 1))

        tab.beginReferencePlacement(handle: nil)
        tab.updateReferencePlacement(
            translation: CGSize(width: 100, height: 100),
            pointsPerCanvasPixel: 10
        )
        // Undo can land mid-drag from a hardware keyboard: it swaps the whole
        // document out from under the gesture, whose draft describes a
        // placement that no longer exists.
        tab.handleUndo()

        #expect(try #require(tab.referencePlacementTarget).placement
            == AppleReferencePlacement(x: 2, y: 3, scale: 1, rotation: 0))

        tab.commitReferencePlacement()

        #expect(try #require(tab.referencePlacementTarget).placement
            == AppleReferencePlacement(x: 2, y: 3, scale: 1, rotation: 0))
    }

    @Test("a cancelled gesture leaves the committed placement showing")
    func cancelDropsTheDraft() throws {
        let fixture = try makePlacementFixture(documentId: "placement-cancel")
        let tab = fixture.tab
        let committed = try #require(tab.referencePlacementTarget).placement
        let marksBeforeGesture = fixture.notifier.markedDocumentIds.count

        tab.beginReferencePlacement(handle: .bottomRight)
        tab.updateReferencePlacement(
            translation: CGSize(width: 400, height: 400),
            pointsPerCanvasPixel: 10
        )
        tab.cancelReferencePlacement()

        #expect(try #require(tab.referencePlacementTarget).placement == committed)
        #expect(fixture.notifier.markedDocumentIds.count == marksBeforeGesture)
    }
}

@Suite("Reference Layer Placement Interaction — commit contract")
struct ReferencePlacementCommitTests {

    @Test("a completed placement change is one undoable Edit that marks the document dirty")
    func commitRecordsOneUndoableEdit() throws {
        let fixture = try makePlacementFixture(documentId: "placement-commit")
        let tab = fixture.tab
        let autoFit = try #require(tab.referencePlacementTarget).placement
        // Import is itself an Edit that marked dirty, so count from there.
        let marksBeforeCommit = fixture.notifier.markedDocumentIds.count

        tab.setReferencePlacement(
            AppleReferencePlacementUpdate(x: 5.5, y: -1.25, scale: 2)
        )

        let moved = try #require(tab.referencePlacementTarget)
        #expect(moved.placement == AppleReferencePlacement(x: 5.5, y: -1.25, scale: 2, rotation: 0))
        // The 4 × 2 source at scale 2 projects an 8 × 4 box from the new origin.
        #expect(moved.footprint == AppleReferenceFootprint(
            minX: 5.5, minY: -1.25, maxX: 13.5, maxY: 2.75
        ))
        #expect(tab.canUndo)
        #expect(fixture.notifier.markedDocumentIds.count == marksBeforeCommit + 1)
        #expect(fixture.notifier.markedDocumentIds.last == "placement-commit")

        tab.handleUndo()

        #expect(try #require(tab.referencePlacementTarget).placement == autoFit)
    }

    @Test("a net-zero gesture records nothing")
    func netZeroCommitRecordsNothing() throws {
        let fixture = try makePlacementFixture(documentId: "placement-net-zero")
        let tab = fixture.tab
        let autoFit = try #require(tab.referencePlacementTarget).placement
        let marksBeforeCommit = fixture.notifier.markedDocumentIds

        tab.setReferencePlacement(AppleReferencePlacementUpdate(
            x: autoFit.x, y: autoFit.y, scale: autoFit.scale
        ))

        #expect(try #require(tab.referencePlacementTarget).placement == autoFit)
        #expect(fixture.notifier.markedDocumentIds == marksBeforeCommit)

        tab.handleUndo()

        // The only entry to walk back is the import, so undo removes the
        // Reference outright — a placement entry would have absorbed it.
        #expect(tab.referencePlacementTarget == nil)
        #expect(tab.document.layers().allSatisfy { $0.kind == .pixel })
    }

    @Test("fit to canvas restores the fitted placement in one undoable step")
    func fitToCanvasIsOneStep() throws {
        let fixture = try makePlacementFixture(documentId: "placement-fit")
        let tab = fixture.tab
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: -20, y: 30, scale: 0.25))
        let marksBeforeFit = fixture.notifier.markedDocumentIds.count

        tab.fitReferenceLayerToCanvas()

        // Web parity (`fitReferencePlacementToCanvas`): the aspect-preserving
        // fit fills the canvas rather than capping at scale 1, so the 4 × 2
        // source lands at scale 2, centered vertically in the 8 × 8 canvas.
        #expect(try #require(tab.referencePlacementTarget).placement
            == AppleReferencePlacement(x: 0, y: 2, scale: 2, rotation: 0))
        #expect(fixture.notifier.markedDocumentIds.count == marksBeforeFit + 1)

        tab.handleUndo()

        #expect(try #require(tab.referencePlacementTarget).placement
            == AppleReferencePlacement(x: -20, y: 30, scale: 0.25, rotation: 0))
    }

    @Test("an arrow nudge translates the placement by whole canvas pixels")
    func nudgeTranslatesPlacement() throws {
        let fixture = try makePlacementFixture(documentId: "placement-nudge")
        let tab = fixture.tab

        tab.nudgeReferencePlacement(dx: -1, dy: 0)
        tab.nudgeReferencePlacement(dx: 0, dy: 10)

        // Auto-fit put the box at (2, 3); the two presses accumulate from
        // there, each through the same commit path a drag release uses.
        #expect(try #require(tab.referencePlacementTarget).placement
            == AppleReferencePlacement(x: 1, y: 13, scale: 1, rotation: 0))

        tab.handleUndo()

        #expect(try #require(tab.referencePlacementTarget).placement
            == AppleReferencePlacement(x: 1, y: 3, scale: 1, rotation: 0))
    }

    @Test("nudging is inert without an active Reference Layer Placement")
    func nudgeRequiresTheActivePlacement() throws {
        let fixture = try makePlacementFixture(documentId: "placement-nudge-inert")
        let tab = fixture.tab
        let autoFit = try #require(tab.referencePlacementTarget).placement
        tab.setActiveLayer(id: fixture.pixelLayerId)

        tab.nudgeReferencePlacement(dx: 5, dy: 5)

        #expect(try #require(tab.referenceLayerUnderlay).placement == autoFit)
    }

    @Test(
        "a placement violating the core invariant is rejected without touching the document",
        arguments: [
            AppleReferencePlacementUpdate(x: .nan, y: 0, scale: 1),
            AppleReferencePlacementUpdate(x: 0, y: .infinity, scale: 1),
            AppleReferencePlacementUpdate(x: 0, y: 0, scale: 0),
            AppleReferencePlacementUpdate(x: 0, y: 0, scale: -1),
            AppleReferencePlacementUpdate(x: 0, y: 0, scale: .nan),
        ]
    )
    func invalidPlacementIsRejectedAtTheBoundary(
        invalid: AppleReferencePlacementUpdate
    ) throws {
        let fixture = try makePlacementFixture(documentId: "placement-invariant")
        let tab = fixture.tab
        let autoFit = try #require(tab.referencePlacementTarget).placement
        let marksBeforeAttempt = fixture.notifier.markedDocumentIds.count

        tab.setReferencePlacement(invalid)

        #expect(try #require(tab.referencePlacementTarget).placement == autoFit)
        #expect(fixture.notifier.markedDocumentIds.count == marksBeforeAttempt)
    }

    @Test("placement is sealed while a stroke is drawing")
    func commitIsSealedMidStroke() throws {
        let fixture = try makePlacementFixture(documentId: "placement-inert")
        let tab = fixture.tab
        let autoFit = try #require(tab.referencePlacementTarget).placement

        tab.setActiveLayer(id: fixture.pixelLayerId)
        tab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 99, y: 99, scale: 3))
        tab.endStroke()

        #expect(try #require(tab.referenceLayerUnderlay).placement == autoFit)
    }
}
