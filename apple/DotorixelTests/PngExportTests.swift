import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers
@testable import Dotorixel

@Suite("TabState — PNG export")
struct PngExportTests {

    @Test("export document data is a decodable PNG with canvas dimensions")
    func exportDataIsDecodablePngWithCanvasDimensions() throws {
        let state = Workspace(width: 16, height: 16)

        let document = try state.activeTab.makePngExportDocument()

        let source = try #require(CGImageSourceCreateWithData(document.data as CFData, nil))
        #expect(CGImageSourceGetType(source) == UTType.png.identifier as CFString)
        let image = try #require(CGImageSourceCreateImageAtIndex(source, 0, nil))
        #expect(image.width == 16)
        #expect(image.height == 16)
    }

    @Test("exported PNG keeps drawn pixels in their colors and undrawn pixels transparent")
    func exportPreservesPixelContent() throws {
        let preparedDocument = makeSingleLayerDocument(width: 16, height: 16)
        let preparedShared = SharedState()
        try preparedDocument.setPixel(x: 3, y: 4, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        let state = workspaceWithDocument(preparedDocument, shared: preparedShared)

        let document = try state.activeTab.makePngExportDocument()

        let rgba = try decodedRgbaPixels(png: document.data, width: 16, height: 16)
        let bytesPerPixel = 4
        let alphaOffset = 3
        let drawn = rgbaByteOffset(x: 3, y: 4, width: 16)
        #expect(Array(rgba[drawn..<drawn + bytesPerPixel]) == [0xFF, 0x00, 0x00, 0xFF])
        let undrawnAlphas = stride(from: alphaOffset, to: rgba.count, by: bytesPerPixel)
            .filter { $0 != drawn + alphaOffset }
            .map { rgba[$0] }
        #expect(undrawnAlphas.allSatisfy { $0 == 0 })
    }

    @Test("Reference visibility never changes exported PNG bytes")
    func referenceIsExcludedWhetherVisibleOrHidden() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        try preparedDocument.setPixel(
            x: 1,
            y: 2,
            color: Color(r: 0x12, g: 0x34, b: 0x56, a: 0xFF)
        )
        let state = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = state.activeTab
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png",
            rgba: Data((0..<(4 * 4)).flatMap { _ in [UInt8(0xFF), 0, 0, 0xFF] }),
            width: 4,
            height: 4
        ))
        let referenceId = tab.document.activeLayerId()

        let visible = try tab.makePngExportDocument().data
        tab.setLayerVisibility(id: referenceId, visible: false)
        let hidden = try tab.makePngExportDocument().data

        #expect(visible == hidden)
        let rgba = try decodedRgbaPixels(png: visible, width: 4, height: 4)
        let referenceOnlyOffset = rgbaByteOffset(x: 0, y: 0, width: 4)
        let pixelLayerOffset = rgbaByteOffset(x: 1, y: 2, width: 4)
        #expect(Array(rgba[referenceOnlyOffset..<(referenceOnlyOffset + 4)]) == [0, 0, 0, 0])
        #expect(Array(rgba[pixelLayerOffset..<(pixelLayerOffset + 4)]) == [0x12, 0x34, 0x56, 0xFF])
    }

    @Test("export projects pre-lift pixels while degraded recovery is pending")
    func exportPreservesPendingFloatingRecovery() throws {
        let (edit, _) = try makeRecoveryEdit()
        #expect(!edit.cancelFloatingSelection())
        #expect(try edit.content.getPixel(x: 1, y: 1).a == 0)

        let rgba = try decodedRgbaPixels(png: edit.exportData(format: .png), width: 4, height: 4)
        let sourceOffset = rgbaByteOffset(x: 1, y: 1, width: 4)
        let destinationOffset = rgbaByteOffset(x: 2, y: 1, width: 4)
        #expect(Array(rgba[sourceOffset..<(sourceOffset + 4)]) == [255, 0, 0, 255])
        #expect(Array(rgba[destinationOffset..<(destinationOffset + 4)]) == [0, 0, 0, 0])
        #expect(!edit.hasUndoableEdit)
    }

    @Test("export projects pre-lift pixels while a Floating Selection is active")
    func exportPreservesLiveFloatingSelection() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        let state = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = state.activeTab
        state.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        let floatingOffset = FloatingSelectionOffset(dx: 1, dy: 0)
        #expect(tab.floatingSelectionOffset == floatingOffset)
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 1) == transparent)

        let png = try tab.makePngExportDocument()
        let rgba = try decodedRgbaPixels(png: png.data, width: 4, height: 4)
        let sourceOffset = rgbaByteOffset(x: 1, y: 1, width: 4)
        let destinationOffset = rgbaByteOffset(x: 2, y: 1, width: 4)

        #expect(Array(rgba[sourceOffset..<(sourceOffset + 4)]) == [0xFF, 0, 0, 0xFF])
        #expect(Array(rgba[destinationOffset..<(destinationOffset + 4)]) == [0, 0, 0, 0])
        #expect(tab.floatingSelectionOffset == floatingOffset)
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 1) == transparent)
    }

    @Test("default export filename follows the web convention dotorixel-{width}x{height}.png")
    func defaultExportFilenameFollowsWebConvention() {
        let state = Workspace(width: 32, height: 24)

        #expect(state.activeTab.defaultExportFilename == "dotorixel-32x24.png")
    }
}
