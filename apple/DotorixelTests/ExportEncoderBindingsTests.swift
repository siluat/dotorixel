import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers
@testable import Dotorixel

/// Binding-level tests for the `AppleDocument` export encoder FFI methods
/// (SVG, animated GIF, spritesheet PNG).
///
/// The encoders' algorithms are unit-tested in the Rust core; these prove
/// the encoder surface is callable across the UniFFI boundary and marshals
/// correctly, following the `DocumentBindingsTests` pattern.
@Suite("Export encoder FFI bindings")
struct ExportEncoderBindingsTests {

    @Test("SVG encodes each drawn pixel as a rect and omits transparent pixels")
    func svgEncodesDrawnPixelsAndOmitsTransparent() throws {
        let doc = try AppleDocument(
            width: 2, height: 2, firstLayerId: UUID().uuidString, firstLayerName: "Layer 1"
        )
        try doc.setPixel(x: 1, y: 0, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))

        let svg = try doc.encodeExportSvg()

        #expect(svg.contains(##"<rect x="1" y="0" width="1" height="1" fill="#ff0000"/>"##))
        // The three untouched pixels stay transparent — exactly one rect total.
        #expect(svg.components(separatedBy: "<rect").count - 1 == 1)
        #expect(svg.contains(#"viewBox="0 0 2 2""#))
        #expect(svg.contains(#"shape-rendering="crispEdges""#))
    }

    @Test("GIF for a two-frame document decodes as two frames with centisecond-quantized delays")
    func gifDecodesTwoFramesWithQuantizedDelays() throws {
        let doc = try AppleDocument(
            width: 2, height: 2, firstLayerId: UUID().uuidString, firstLayerName: "Layer 1"
        )
        try doc.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        try doc.addFrame(newId: UUID().uuidString)
        let frames = doc.frames()
        // 125 ms rounds to 13 cs; 200 ms is exactly 20 cs.
        try doc.setFrameDuration(id: frames[0].id, durationMs: 125)
        try doc.setFrameDuration(id: frames[1].id, durationMs: 200)

        let gif = try doc.encodeGif()

        let source = try #require(CGImageSourceCreateWithData(gif as CFData, nil))
        #expect(CGImageSourceGetType(source) == UTType.gif.identifier as CFString)
        #expect(CGImageSourceGetCount(source) == 2)
        #expect(try gifUnclampedDelaySeconds(source: source, frame: 0) == 0.13)
        #expect(try gifUnclampedDelaySeconds(source: source, frame: 1) == 0.20)
    }

    @Test("spritesheet is width × frame count by height, each tile its frame's composite")
    func spritesheetTilesEveryFrameComposite() throws {
        let doc = try AppleDocument(
            width: 2, height: 2, firstLayerId: UUID().uuidString, firstLayerName: "Layer 1"
        )
        try doc.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        try doc.addFrame(newId: UUID().uuidString) // second frame, active and empty
        try doc.setPixel(x: 1, y: 1, color: Color(r: 0x00, g: 0xFF, b: 0x00, a: 0xFF))

        let png = try doc.encodeSpritesheetPng()

        let source = try #require(CGImageSourceCreateWithData(png as CFData, nil))
        #expect(CGImageSourceGetType(source) == UTType.png.identifier as CFString)
        let sheet = try decodedRgbaPixels(png: png, width: 4, height: 2)
        for (tile, frame) in doc.frames().enumerated() {
            #expect(
                tilePixels(sheet: sheet, sheetWidth: 4, tileWidth: 2, height: 2, index: tile)
                    == Array(try doc.compositeAt(frameId: frame.id)),
                "tile \(tile) matches its frame's composite"
            )
        }
    }

    @Test("a hidden layer and a visible Reference Layer appear in none of the three outputs")
    func hiddenAndReferenceLayersExcludedFromAllThreeOutputs() throws {
        // Bottom Pixel Layer: opaque red. Top Pixel Layer: opaque green, then
        // hidden. Reference Layer: opaque blue, left visible.
        let doc = try AppleDocument(
            width: 1, height: 1, firstLayerId: UUID().uuidString, firstLayerName: "Bottom"
        )
        try doc.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        let topId = UUID().uuidString
        try doc.addLayer(newId: topId, name: "Top")
        try doc.setPixel(x: 0, y: 0, color: Color(r: 0x00, g: 0xFF, b: 0x00, a: 0xFF))
        try doc.setLayerVisibility(id: topId, visible: false)
        try doc.addReferenceLayer(
            newId: UUID().uuidString,
            name: "Reference",
            sourceRgba: Data([0x00, 0x00, 0xFF, 0xFF]),
            sourceWidth: 1,
            sourceHeight: 1
        )
        let red: [UInt8] = [0xFF, 0x00, 0x00, 0xFF]

        let svg = try doc.encodeExportSvg()
        #expect(svg.contains("#ff0000"))
        #expect(!svg.contains("#00ff00"))
        #expect(!svg.contains("#0000ff"))

        let gifSource = try #require(
            CGImageSourceCreateWithData(try doc.encodeGif() as CFData, nil)
        )
        let gifImage = try #require(CGImageSourceCreateImageAtIndex(gifSource, 0, nil))
        #expect(try rgbaPixels(image: gifImage, width: 1, height: 1) == red)

        let sheet = try decodedRgbaPixels(
            png: try doc.encodeSpritesheetPng(), width: 1, height: 1
        )
        #expect(sheet == red)
    }

    @Test("encoding is a pure query — the active frame and document state stay untouched")
    func encodingLeavesActiveFrameAndDocumentStateUntouched() throws {
        let doc = try AppleDocument(
            width: 2, height: 2, firstLayerId: UUID().uuidString, firstLayerName: "Layer 1"
        )
        try doc.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        try doc.addFrame(newId: UUID().uuidString) // second frame, active and empty
        let activeFrameBefore = doc.activeFrameId()
        let activeLayerBefore = doc.activeLayerId()
        let compositeBefore = doc.composite()

        // Every encoder reads all frames, including non-active ones.
        _ = try doc.encodeExportSvg()
        _ = try doc.encodeGif()
        _ = try doc.encodeSpritesheetPng()

        #expect(doc.activeFrameId() == activeFrameBefore)
        #expect(doc.activeLayerId() == activeLayerBefore)
        #expect(doc.composite() == compositeBefore)
    }

    /// Reads a GIF frame's raw (unclamped) delay in seconds — the on-wire
    /// centisecond field, unlike the clamped variant viewers substitute for
    /// tiny delays.
    private func gifUnclampedDelaySeconds(source: CGImageSource, frame: Int) throws -> Double {
        let properties = try #require(
            CGImageSourceCopyPropertiesAtIndex(source, frame, nil) as? [CFString: Any]
        )
        let gif = try #require(properties[kCGImagePropertyGIFDictionary] as? [CFString: Any])
        return try #require(gif[kCGImagePropertyGIFUnclampedDelayTime] as? Double)
    }

    /// Decodes a PNG into a flat RGBA8 buffer (row-major, top-left origin).
    /// Lossless for the fully opaque / fully transparent pixels these tests
    /// draw (premultiplication cannot distort alpha 255 or 0).
    private func decodedRgbaPixels(png data: Data, width: Int, height: Int) throws -> [UInt8] {
        let source = try #require(CGImageSourceCreateWithData(data as CFData, nil))
        let image = try #require(CGImageSourceCreateImageAtIndex(source, 0, nil))
        #expect(image.width == width)
        #expect(image.height == height)
        return try rgbaPixels(image: image, width: width, height: height)
    }

    /// Renders a decoded CGImage into a flat RGBA8 buffer (row-major,
    /// top-left origin).
    private func rgbaPixels(image: CGImage, width: Int, height: Int) throws -> [UInt8] {
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

    /// Extracts tile `index`'s pixels (tileWidth × height) from a decoded
    /// horizontal-strip sheet buffer.
    private func tilePixels(
        sheet: [UInt8], sheetWidth: Int, tileWidth: Int, height: Int, index: Int
    ) -> [UInt8] {
        (0..<height).flatMap { y in
            let rowStart = (y * sheetWidth + index * tileWidth) * 4
            return sheet[rowStart..<rowStart + tileWidth * 4]
        }
    }
}
