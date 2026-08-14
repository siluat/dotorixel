import Foundation
import Testing
@testable import Dotorixel

private final class ReferenceEditabilityDirtyRecorder: DirtyNotifier {
    private(set) var markedDocumentIds: [String] = []

    func markDirty(documentId: String) {
        markedDocumentIds.append(documentId)
    }

    func markWorkspaceDirty() {}
    func notifyTabRemoved(documentId: String) {}
}

private let mutationToolsRequiringEditableLayer: [EditorTool] = [
    .pencil,
    .eraser,
    .line,
    .rectangle,
    .ellipse,
    .floodFill,
    .move,
    .selection,
]

private final class SamplingGridBatchSpy: SamplingSurface {
    private(set) var pixelRequestCount = 0
    private(set) var gridRequestCount = 0

    func samplePixel(at coords: ScreenCanvasCoords) -> Color? {
        pixelRequestCount += 1
        return Color(r: 0, g: 0, b: 0, a: 0)
    }

    func sampleGrid(center: ScreenCanvasCoords, size: Int) -> [Color?] {
        gridRequestCount += 1
        return Array(repeating: Color(r: 0, g: 0, b: 0, a: 0), count: size * size)
    }
}

private struct ReferenceActiveTestFixture {
    let notifier: ReferenceEditabilityDirtyRecorder
    let pixelLayerId: String
    let referenceLayerId: String
    let document: AppleDocument
    let tab: TabState
}

private func makeReferenceActiveFixture(
    documentId: String,
    shared: SharedState = SharedState(),
    configurePixelLayer: (AppleDocument) throws -> Void = { _ in }
) throws -> ReferenceActiveTestFixture {
    let notifier = ReferenceEditabilityDirtyRecorder()
    let pixelLayerId = UUID().uuidString.lowercased()
    let referenceLayerId = UUID().uuidString.lowercased()
    let document = try AppleDocument(
        width: 4,
        height: 4,
        firstLayerId: pixelLayerId,
        firstLayerName: "Layer 1"
    )
    try configurePixelLayer(document)
    try document.addReferenceLayer(
        newId: referenceLayerId,
        name: "Reference",
        sourceRgba: Data([0, 0xFF, 0, 0xFF]),
        sourceWidth: 1,
        sourceHeight: 1
    )
    let tab = TabState(
        shared: shared,
        documentId: documentId,
        name: documentId,
        notifier: notifier,
        isConstrainHeld: { false },
        consumePendingToolRestore: { nil },
        document: document,
        viewport: AppleViewport.forCanvas(canvasWidth: 4, canvasHeight: 4)
    )
    return ReferenceActiveTestFixture(
        notifier: notifier,
        pixelLayerId: pixelLayerId,
        referenceLayerId: referenceLayerId,
        document: document,
        tab: tab
    )
}

@Suite("Reference Layer editability — state boundary")
struct ReferenceEditabilityTests {

    @Test(
        "Reference-active mutation tools expose the blocked canvas presentation",
        arguments: mutationToolsRequiringEditableLayer
    )
    func blockedCanvasPresentation(tool: EditorTool) {
        #expect(CanvasInteractionPresentation.resolve(
            isActiveLayerEditable: false,
            tool: tool
        ) == .editBlocked)
        #expect(CanvasInteractionPresentation.resolve(
            isActiveLayerEditable: true,
            tool: tool
        ) == .available)
    }

    @Test("Eyedropper stays available on a Reference Layer")
    func eyedropperCanvasPresentation() {
        #expect(CanvasInteractionPresentation.resolve(
            isActiveLayerEditable: false,
            tool: .eyedropper
        ) == .available)
    }

    @Test(
        "a Reference-active mutation tool opens no stroke and has no side effects",
        arguments: mutationToolsRequiringEditableLayer
    )
    func mutationToolsAreBlocked(tool: EditorTool) throws {
        let shared = SharedState()
        shared.activeTool = tool
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let originalMarquee = AppleMarqueeRegion(x: 1, y: 1, width: 2, height: 2)
        let fixture = try makeReferenceActiveFixture(
            documentId: "reference-editability",
            shared: shared
        ) { document in
            try document.setPixel(x: 1, y: 1, color: red)
            try document.setMarquee(region: originalMarquee)
        }
        let document = fixture.document
        let tab = fixture.tab
        let pixelsBeforeAttempt = document.composite()
        let recentColorsBeforeAttempt = shared.recentColors
        let canvasVersionBeforeAttempt = tab.canvasVersion

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 2))
        tab.endStroke()

        #expect(!tab.isDrawing)
        #expect(document.composite() == pixelsBeforeAttempt)
        #expect(document.marquee() == originalMarquee)
        #expect(shared.recentColors == recentColorsBeforeAttempt)
        #expect(tab.canvasVersion == canvasVersionBeforeAttempt)
        #expect(!tab.canUndo)
        #expect(fixture.notifier.markedDocumentIds.isEmpty)
    }

    @Test("the displayed Marquee hides on Reference and returns on a Pixel Layer")
    func marqueeDisplayHidesAndRestores() throws {
        let originalMarquee = AppleMarqueeRegion(x: 1, y: 1, width: 2, height: 2)
        let fixture = try makeReferenceActiveFixture(documentId: "reference-marquee") {
            try $0.setMarquee(region: originalMarquee)
        }
        let document = fixture.document
        let tab = fixture.tab

        #expect(document.marquee() == originalMarquee)
        #expect(tab.marquee == nil)

        tab.setActiveLayer(id: fixture.pixelLayerId)

        #expect(document.activeLayerId() == fixture.pixelLayerId)
        #expect(tab.isActiveLayerEditable)
        #expect(document.marquee() == originalMarquee)
        #expect(tab.marquee == originalMarquee)
    }

    @Test("Reference activation cannot redirect an in-flight Pixel stroke")
    func referenceActivationCannotRedirectStroke() throws {
        let shared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        shared.foregroundColor = red
        let fixture = try makeReferenceActiveFixture(
            documentId: "reference-mid-stroke",
            shared: shared
        )
        let document = fixture.document
        let tab = fixture.tab
        try document.setActiveLayer(id: fixture.pixelLayerId)

        tab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        tab.setActiveLayer(id: fixture.referenceLayerId)
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 0))
        tab.endStroke()

        #expect(document.activeLayerId() == fixture.pixelLayerId)
        #expect(try document.getPixel(x: 0, y: 0) == red)
        #expect(try document.getPixel(x: 1, y: 0) == red)
        #expect(try document.getPixel(x: 2, y: 0) == red)
        #expect(tab.canUndo)
        #expect(fixture.notifier.markedDocumentIds == ["reference-mid-stroke"])
    }

    @Test("Reference-active Marquee commands leave the preserved selection untouched")
    func marqueeCommandsAreBlocked() throws {
        let originalMarquee = AppleMarqueeRegion(x: 1, y: 1, width: 2, height: 2)
        let fixture = try makeReferenceActiveFixture(documentId: "reference-marquee-commands") {
            try $0.setMarquee(region: originalMarquee)
        }
        let document = fixture.document
        let tab = fixture.tab
        let pixelsBeforeCommands = document.composite()
        let canvasVersionBeforeCommands = tab.canvasVersion

        tab.nudgeMarquee(by: FloatingSelectionOffset(dx: 1, dy: 0))
        tab.clearMarqueePixels()
        tab.clearMarqueeOrFloating()
        tab.flipMarqueeHorizontal()
        tab.flipMarqueeVertical()
        tab.rotateMarqueeCw()
        tab.rotateMarqueeCcw()

        #expect(document.composite() == pixelsBeforeCommands)
        #expect(document.marquee() == originalMarquee)
        #expect(tab.canvasVersion == canvasVersionBeforeCommands)
        #expect(!tab.canUndo)
        #expect(fixture.notifier.markedDocumentIds.isEmpty)
    }

    @Test("Loupe sampling delegates one neighborhood batch to its surface")
    func loupeSamplingUsesOneBatch() {
        let surface = SamplingGridBatchSpy()

        let grid = sampleGrid(
            surface: surface,
            center: ScreenCanvasCoords(x: 2, y: 2),
            size: LoupeGeometry.gridSize
        )

        #expect(grid.count == LoupeGeometry.gridSize * LoupeGeometry.gridSize)
        #expect(surface.gridRequestCount == 1)
        #expect(surface.pixelRequestCount == 0)
    }

    @Test("Eyedropper and Loupe read Pixel art over a visible Reference underlay")
    func eyedropperAndLoupeReadWhatTheUserSees() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let green = Color(r: 0, g: 0xFF, b: 0, a: 0xFF)
        let black = Color(r: 0, g: 0, b: 0, a: 0xFF)
        let translucentRed = Color(r: 0xFF, g: 0, b: 0, a: 0x80)
        let translucentRedOverGreen = Color(r: 0x80, g: 0x7F, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        try tab.document.setPixel(x: 0, y: 0, color: red)
        try tab.document.setPixel(x: 0, y: 1, color: translucentRed)
        var referencePixels = Data()
        for index in 0..<16 {
            referencePixels.append(contentsOf: index == 15
                ? [0, 0, 0, 0]
                : [0, 0xFF, 0, 0xFF])
        }
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "Green reference",
            rgba: referencePixels,
            width: 4,
            height: 4
        ))
        let referenceId = try #require(
            tab.document.layers().first(where: { $0.kind == .reference })?.id
        )
        let pixelId = try #require(
            tab.document.layers().first(where: { $0.kind == .pixel })?.id
        )
        #expect(tab.document.activeLayerId() == referenceId)
        #expect(tab.document.tryGetPixel(x: 1, y: 1) == green)
        workspace.shared.activeTool = .eyedropper

        workspace.shared.foregroundColor = black
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        #expect(tab.samplingLoupe.grid[LoupeGeometry.centerIndex] == green)
        tab.endStroke()
        #expect(workspace.shared.foregroundColor == green)

        workspace.shared.backgroundColor = black
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2), button: .secondary)
        #expect(tab.samplingLoupe.grid[LoupeGeometry.centerIndex] == green)
        tab.endStroke()
        #expect(workspace.shared.backgroundColor == green)

        tab.setActiveLayer(id: pixelId)
        #expect(tab.document.activeLayerId() == pixelId)
        workspace.shared.foregroundColor = black
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        #expect(tab.samplingLoupe.grid[LoupeGeometry.centerIndex] == green)
        tab.endStroke()
        #expect(workspace.shared.foregroundColor == green)

        workspace.shared.foregroundColor = black
        tab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 1))
        #expect(tab.samplingLoupe.grid[LoupeGeometry.centerIndex] == translucentRedOverGreen)
        tab.endStroke()
        #expect(workspace.shared.foregroundColor == translucentRedOverGreen)

        workspace.shared.foregroundColor = black
        tab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        #expect(tab.samplingLoupe.grid[LoupeGeometry.centerIndex] == red)
        tab.endStroke()
        #expect(workspace.shared.foregroundColor == red)

        workspace.shared.foregroundColor = black
        tab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        #expect(tab.samplingLoupe.grid[LoupeGeometry.centerIndex] == transparent)
        tab.endStroke()
        #expect(workspace.shared.foregroundColor == black)

        tab.beginStroke(at: ScreenCanvasCoords(x: -1, y: -1))
        #expect(tab.samplingLoupe.grid[LoupeGeometry.centerIndex] == nil)
        tab.endStroke()
        #expect(workspace.shared.foregroundColor == black)

        tab.setLayerVisibility(id: referenceId, visible: false)
        workspace.shared.foregroundColor = black
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        #expect(tab.samplingLoupe.grid[LoupeGeometry.centerIndex] == transparent)
        tab.endStroke()
        #expect(workspace.shared.foregroundColor == black)
    }
}
