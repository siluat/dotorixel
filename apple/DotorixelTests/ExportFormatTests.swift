import Foundation
import Testing
import UniformTypeIdentifiers
@testable import Dotorixel

/// Format-selecting export surface (issue 294) — the Apple counterpart of the
/// web's `availableFormats` registry (`src/lib/canvas/export.ts`).
@Suite("Export format selection")
struct ExportFormatTests {

    @Test("The export surface offers PNG and SVG, each declaring its file extension and content type")
    func offersPngAndSvgWithExtensionAndContentType() {
        #expect(ExportFormat.allCases == [.png, .svg])
        #expect(ExportFormat.png.fileExtension == "png")
        #expect(ExportFormat.png.contentType == .png)
        #expect(ExportFormat.svg.fileExtension == "svg")
        #expect(ExportFormat.svg.contentType == .svg)
    }

    @Test("Format labels match the web registry's display names")
    func formatLabelsMatchWebRegistry() {
        #expect(ExportFormat.png.label == "PNG")
        #expect(ExportFormat.svg.label == "SVG")
    }

    @Test("Default export filename keeps the web convention dotorixel-{width}x{height} per format")
    func defaultExportFilenameFollowsWebConventionPerFormat() {
        let state = Workspace(width: 32, height: 24)

        #expect(state.activeTab.defaultExportFilename(for: .png) == "dotorixel-32x24.png")
        #expect(state.activeTab.defaultExportFilename(for: .svg) == "dotorixel-32x24.svg")
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
