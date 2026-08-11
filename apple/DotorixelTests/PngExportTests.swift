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
        let state = Workspace(width: 16, height: 16)
        try state.activeTab.document.setPixel(x: 3, y: 4, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))

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

    @Test("export projects pre-lift pixels while degraded recovery is pending")
    func exportPreservesPendingFloatingRecovery() throws {
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let sourceLayerId = tab.document.activeLayerId()

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        state.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        // Production Layer actions commit first. Reach the defensive recovery
        // branch directly so export is tested against a real live source hole.
        try tab.document.addLayer(newId: UUID().uuidString, name: "Other")
        #expect(!tab.cancelFloatingSelection())
        let liveSource = try #require(
            try tab.document.layerSnapshots().first { $0.id == sourceLayerId }
        )
        let sourceOffset = rgbaByteOffset(x: 1, y: 1, width: 4)
        #expect(Array(liveSource.pixels[sourceOffset..<(sourceOffset + 4)]) == [0, 0, 0, 0])

        let png = try tab.makePngExportDocument()
        let rgba = try decodedRgbaPixels(png: png.data, width: 4, height: 4)
        let destinationOffset = rgbaByteOffset(x: 2, y: 1, width: 4)

        #expect(Array(rgba[sourceOffset..<(sourceOffset + 4)]) == [0xFF, 0, 0, 0xFF])
        #expect(Array(rgba[destinationOffset..<(destinationOffset + 4)]) == [0, 0, 0, 0])
    }

    @Test("export projects pre-lift pixels while a Floating Selection is active")
    func exportPreservesLiveFloatingSelection() throws {
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
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

    /// Byte offset of pixel (x, y) in a row-major RGBA8 buffer.
    private func rgbaByteOffset(x: Int, y: Int, width: Int) -> Int {
        (y * width + x) * 4
    }

    @Test("default export filename follows the web convention dotorixel-{width}x{height}.png")
    func defaultExportFilenameFollowsWebConvention() {
        let state = Workspace(width: 32, height: 24)

        #expect(state.activeTab.defaultExportFilename == "dotorixel-32x24.png")
    }

    /// Decodes a PNG into a flat RGBA8 buffer (row-major, top-left origin).
    private func decodedRgbaPixels(png data: Data, width: Int, height: Int) throws -> [UInt8] {
        let source = try #require(CGImageSourceCreateWithData(data as CFData, nil))
        let image = try #require(CGImageSourceCreateImageAtIndex(source, 0, nil))
        var buffer = [UInt8](repeating: 0, count: width * height * 4)
        try buffer.withUnsafeMutableBytes { bytes in
            let context = try #require(CGContext(
                data: bytes.baseAddress,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: width * 4,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            ))
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        }
        return buffer
    }
}
