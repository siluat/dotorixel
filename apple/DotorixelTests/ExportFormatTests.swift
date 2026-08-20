import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers
@testable import Dotorixel

/// Format-selecting export surface (issue 294) — the Apple counterpart of the
/// web's `availableFormats` registry (`src/lib/canvas/export.ts`).
@Suite("Export format selection")
struct ExportFormatTests {

    @Test("The export surface offers PNG, SVG, GIF, and spritesheet, each declaring its file extension and content type")
    func offersEveryFormatWithExtensionAndContentType() {
        // Menu order mirrors the web registry (`availableFormats`).
        #expect(ExportFormat.allCases == [.png, .svg, .gif, .spritesheet])
        #expect(ExportFormat.png.fileExtension == "png")
        #expect(ExportFormat.png.contentType == .png)
        #expect(ExportFormat.svg.fileExtension == "svg")
        #expect(ExportFormat.svg.contentType == .svg)
        #expect(ExportFormat.gif.fileExtension == "gif")
        #expect(ExportFormat.gif.contentType == .gif)
        #expect(ExportFormat.spritesheet.fileExtension == "png")
        #expect(ExportFormat.spritesheet.contentType == .png)
    }

    @Test("Format labels match the web registry's display names")
    func formatLabelsMatchWebRegistry() {
        #expect(ExportFormat.png.label == "PNG")
        #expect(ExportFormat.svg.label == "SVG")
        #expect(ExportFormat.gif.label == "GIF")
        #expect(ExportFormat.spritesheet.label == "Spritesheet")
    }

    @Test("Default export filename keeps the web convention dotorixel-{width}x{height} per format")
    func defaultExportFilenameFollowsWebConventionPerFormat() {
        let state = Workspace(width: 32, height: 24)

        #expect(state.activeTab.defaultExportFilename(for: .png) == "dotorixel-32x24.png")
        #expect(state.activeTab.defaultExportFilename(for: .svg) == "dotorixel-32x24.svg")
        #expect(state.activeTab.defaultExportFilename(for: .gif) == "dotorixel-32x24.gif")
        // The sheet-marked stem keeps the spritesheet distinct from the still PNG.
        #expect(
            state.activeTab.defaultExportFilename(for: .spritesheet) == "dotorixel-32x24-sheet.png"
        )
    }

    @Test("SVG export document is UTF-8 SVG matching the canvas content")
    func svgExportDocumentMatchesCanvasContent() throws {
        let state = Workspace(width: 16, height: 16)
        try state.activeTab.document.setPixel(
            x: 3, y: 4, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        )

        let document = try state.activeTab.makeExportDocument(format: .svg)

        let svg = try #require(String(data: document.data, encoding: .utf8))
        #expect(svg.contains(#"viewBox="0 0 16 16""#))
        #expect(svg.contains(##"<rect x="3" y="4" width="1" height="1" fill="#ff0000"/>"##))
        // The untouched pixels stay transparent — exactly one rect total.
        #expect(svg.components(separatedBy: "<rect").count - 1 == 1)
    }

    @Test("SVG export projects pre-lift pixels while a Floating Selection is active")
    func svgExportPreservesLiveFloatingSelection() throws {
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab
        try tab.document.setPixel(x: 1, y: 1, color: Color(r: 0xFF, g: 0, b: 0, a: 0xFF))
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        state.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0))

        let document = try tab.makeExportDocument(format: .svg)

        let svg = try #require(String(data: document.data, encoding: .utf8))
        #expect(svg.contains(##"<rect x="1" y="1" width="1" height="1" fill="#ff0000"/>"##))
        // The uncommitted destination stays transparent — the source rect is the only one.
        #expect(svg.components(separatedBy: "<rect").count - 1 == 1)
    }

    @Test("A visible Reference Layer never appears in the exported SVG")
    func svgExportExcludesReferenceLayer() throws {
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab
        try tab.document.setPixel(x: 1, y: 2, color: Color(r: 0xFF, g: 0, b: 0, a: 0xFF))
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png",
            rgba: Data((0..<(4 * 4)).flatMap { _ in [UInt8(0), 0, 0xFF, 0xFF] }),
            width: 4,
            height: 4
        ))

        let document = try tab.makeExportDocument(format: .svg)

        let svg = try #require(String(data: document.data, encoding: .utf8))
        #expect(svg.contains("#ff0000"))
        #expect(!svg.contains("#0000ff"))
        #expect(svg.components(separatedBy: "<rect").count - 1 == 1)
    }

    @Test("Spritesheet export of a multi-frame document tiles every frame's composite in axis order")
    func spritesheetExportTilesEveryFrameComposite() throws {
        let state = Workspace(width: 2, height: 2)
        let tab = state.activeTab
        try tab.document.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        try tab.document.addFrame(newId: UUID().uuidString) // second frame, active and empty
        try tab.document.setPixel(x: 1, y: 1, color: Color(r: 0x00, g: 0xFF, b: 0x00, a: 0xFF))

        let document = try tab.makeExportDocument(format: .spritesheet)

        let sheet = try decodedRgbaPixels(png: document.data, width: 4, height: 2)
        for (tile, frame) in tab.document.frames().enumerated() {
            #expect(
                tilePixels(sheet: sheet, sheetWidth: 4, tileWidth: 2, height: 2, index: tile)
                    == Array(try tab.document.compositeAt(frameId: frame.id)),
                "tile \(tile) matches its frame's composite"
            )
        }
    }

    @Test("A single-frame document exports a one-tile sheet identical to its frame composite")
    func singleFrameDocumentExportsOneTileSheet() throws {
        let state = Workspace(width: 3, height: 2)
        let tab = state.activeTab
        try tab.document.setPixel(x: 2, y: 1, color: Color(r: 0x00, g: 0x00, b: 0xFF, a: 0xFF))

        let document = try tab.makeExportDocument(format: .spritesheet)

        let sheet = try decodedRgbaPixels(png: document.data, width: 3, height: 2)
        #expect(sheet == Array(tab.document.composite()))
    }

    @Test("Spritesheet export projects pre-lift pixels while a Floating Selection is active")
    func spritesheetExportPreservesLiveFloatingSelection() throws {
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab
        let red: [UInt8] = [0xFF, 0x00, 0x00, 0xFF]
        let transparent: [UInt8] = [0x00, 0x00, 0x00, 0x00]
        try tab.document.setPixel(x: 1, y: 1, color: Color(r: 0xFF, g: 0, b: 0, a: 0xFF))
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        state.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0))

        let document = try tab.makeExportDocument(format: .spritesheet)

        let sheet = try decodedRgbaPixels(png: document.data, width: 4, height: 4)
        // The lifted pixel stays at its pre-lift source; the uncommitted
        // destination stays transparent.
        let source = rgbaByteOffset(x: 1, y: 1, width: 4)
        let destination = rgbaByteOffset(x: 2, y: 1, width: 4)
        #expect(Array(sheet[source..<source + 4]) == red)
        #expect(Array(sheet[destination..<destination + 4]) == transparent)
    }

    @Test("Spritesheet export keeps every frame while a Floating Selection is active")
    func spritesheetExportKeepsFrameAxisDuringFloatingSelection() throws {
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab
        let red: [UInt8] = [0xFF, 0x00, 0x00, 0xFF]
        let green: [UInt8] = [0x00, 0xFF, 0x00, 0xFF]
        let transparent: [UInt8] = [0x00, 0x00, 0x00, 0x00]
        try tab.document.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0, b: 0, a: 0xFF))
        try tab.document.addFrame(newId: UUID().uuidString) // second frame, active and empty
        try tab.document.setPixel(x: 1, y: 1, color: Color(r: 0, g: 0xFF, b: 0, a: 0xFF))
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        state.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0))

        let document = try tab.makeExportDocument(format: .spritesheet)

        // Both frames survive the projection — a two-tile sheet, not a
        // collapsed single-frame document.
        let sheet = try decodedRgbaPixels(png: document.data, width: 8, height: 4)
        let firstTile = tilePixels(sheet: sheet, sheetWidth: 8, tileWidth: 4, height: 4, index: 0)
        let inactiveFramePixel = rgbaByteOffset(x: 0, y: 0, width: 4)
        #expect(Array(firstTile[inactiveFramePixel..<inactiveFramePixel + 4]) == red)
        // The active frame's tile carries the pre-lift projection.
        let secondTile = tilePixels(sheet: sheet, sheetWidth: 8, tileWidth: 4, height: 4, index: 1)
        let source = rgbaByteOffset(x: 1, y: 1, width: 4)
        let destination = rgbaByteOffset(x: 2, y: 1, width: 4)
        #expect(Array(secondTile[source..<source + 4]) == green)
        #expect(Array(secondTile[destination..<destination + 4]) == transparent)
    }

    @Test("GIF export of a multi-frame document animates with the authored per-frame timing and loops forever")
    func gifExportHonorsPerFrameTimingAndLoops() throws {
        let state = Workspace(width: 2, height: 2)
        let tab = state.activeTab
        try tab.document.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        try tab.document.addFrame(newId: UUID().uuidString) // second frame, active and empty
        try tab.document.setPixel(x: 1, y: 1, color: Color(r: 0x00, g: 0xFF, b: 0x00, a: 0xFF))
        let frames = tab.document.frames()
        // The retimed second frame visibly holds five times longer.
        try tab.document.setFrameDuration(id: frames[0].id, durationMs: 100)
        try tab.document.setFrameDuration(id: frames[1].id, durationMs: 500)

        let document = try tab.makeExportDocument(format: .gif)

        let source = try #require(CGImageSourceCreateWithData(document.data as CFData, nil))
        #expect(CGImageSourceGetType(source) == UTType.gif.identifier as CFString)
        #expect(CGImageSourceGetCount(source) == 2)
        #expect(try gifUnclampedDelaySeconds(source: source, frame: 0) == 0.10)
        #expect(try gifUnclampedDelaySeconds(source: source, frame: 1) == 0.50)
        // 0 is the NETSCAPE looping extension's loop-forever value.
        #expect(try gifLoopCount(source: source) == 0)
    }

    @Test("A single-frame document exports a valid single-frame GIF matching its composite")
    func singleFrameDocumentExportsSingleFrameGif() throws {
        let state = Workspace(width: 3, height: 2)
        let tab = state.activeTab
        try tab.document.setPixel(x: 2, y: 1, color: Color(r: 0x00, g: 0x00, b: 0xFF, a: 0xFF))

        let document = try tab.makeExportDocument(format: .gif)

        let source = try #require(CGImageSourceCreateWithData(document.data as CFData, nil))
        #expect(CGImageSourceGetType(source) == UTType.gif.identifier as CFString)
        #expect(CGImageSourceGetCount(source) == 1)
        let image = try #require(CGImageSourceCreateImageAtIndex(source, 0, nil))
        #expect(try rgbaPixels(image: image, width: 3, height: 2) == Array(tab.document.composite()))
    }

    @Test("GIF export keeps every frame while a Floating Selection is active")
    func gifExportKeepsFrameAxisDuringFloatingSelection() throws {
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab
        let red: [UInt8] = [0xFF, 0x00, 0x00, 0xFF]
        let green: [UInt8] = [0x00, 0xFF, 0x00, 0xFF]
        let transparent: [UInt8] = [0x00, 0x00, 0x00, 0x00]
        try tab.document.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0, b: 0, a: 0xFF))
        try tab.document.addFrame(newId: UUID().uuidString) // second frame, active and empty
        try tab.document.setPixel(x: 1, y: 1, color: Color(r: 0, g: 0xFF, b: 0, a: 0xFF))
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        state.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0))

        let document = try tab.makeExportDocument(format: .gif)

        // Both frames survive the projection — a two-frame GIF, not a
        // collapsed single-frame document.
        let source = try #require(CGImageSourceCreateWithData(document.data as CFData, nil))
        #expect(CGImageSourceGetCount(source) == 2)
        let firstFrame = try #require(CGImageSourceCreateImageAtIndex(source, 0, nil))
        let firstPixels = try rgbaPixels(image: firstFrame, width: 4, height: 4)
        let inactiveFramePixel = rgbaByteOffset(x: 0, y: 0, width: 4)
        #expect(Array(firstPixels[inactiveFramePixel..<inactiveFramePixel + 4]) == red)
        // The active frame carries the pre-lift projection: the lifted pixel
        // stays at its source; the uncommitted destination stays transparent.
        let secondFrame = try #require(CGImageSourceCreateImageAtIndex(source, 1, nil))
        let secondPixels = try rgbaPixels(image: secondFrame, width: 4, height: 4)
        let sourcePixel = rgbaByteOffset(x: 1, y: 1, width: 4)
        let destination = rgbaByteOffset(x: 2, y: 1, width: 4)
        #expect(Array(secondPixels[sourcePixel..<sourcePixel + 4]) == green)
        #expect(Array(secondPixels[destination..<destination + 4]) == transparent)
    }

    @Test("SVG export is byte-identical with onion skin on and off")
    func onionSkinNeverReachesSvgExport() throws {
        let state = Workspace(width: 2, height: 2)
        let tab = state.activeTab
        try tab.document.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0, b: 0, a: 0xFF))
        try tab.document.addFrame(newId: UUID().uuidString)

        let exportedOff = try tab.makeExportDocument(format: .svg).data
        tab.toggleOnionSkin()
        let exportedOn = try tab.makeExportDocument(format: .svg).data

        #expect(exportedOn == exportedOff)
    }
}
