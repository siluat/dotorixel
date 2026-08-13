import MetalKit
import Testing
@testable import Dotorixel

/// A `PixelGridRenderer` that records the last buffer handed to the canvas
/// texture upload — the seam between the editor state and the Metal draw.
private final class CanvasTextureSpy: PixelGridRenderer {
    var uploadedPixels: Data?
    var uploadedWidth: UInt32?
    var uploadedHeight: UInt32?
    var uploadedReferenceProjection: ReferenceLayerRenderProjection?

    override func updateCanvasTexture(pixels: Data, width: UInt32, height: UInt32) {
        uploadedPixels = pixels
        uploadedWidth = width
        uploadedHeight = height
        super.updateCanvasTexture(pixels: pixels, width: width, height: height)
    }

    override func updateReferenceUnderlay(_ projection: ReferenceLayerRenderProjection?) {
        uploadedReferenceProjection = projection
        super.updateReferenceUnderlay(projection)
    }
}

/// Pins the tab's render projection at the Metal texture boundary: committed
/// content is the visible Layer composite, while a live Floating Selection is
/// a non-mutating patch at its projected destination.
@Suite("Render path — canvas texture projection")
struct RenderPathTests {

    @MainActor
    private func makeSpy(view: MTKView) throws -> CanvasTextureSpy {
        view.device = MTLCreateSystemDefaultDevice()
        return try #require(CanvasTextureSpy(mtkView: view))
    }

    @MainActor
    @Test("the canvas texture receives the composite — a hidden layer's pixels are absent")
    func hiddenLayerDisappearsFromUploadedBuffer() throws {
        let state = Workspace(width: 2, height: 2)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try state.activeTab.document.setPixel(x: 0, y: 0, color: red)
        let layerId = state.activeTab.document.layers()[0].id

        let mtkView = MTKView()
        let spy = try makeSpy(view: mtkView)
        let view = PixelCanvasView(
            tab: state.activeTab,
            viewport: state.activeTab.viewport,
            showGrid: false,
            workspace: state
        )

        view.configureRenderer(spy, mtkView: mtkView)
        let visiblePixels = try #require(spy.uploadedPixels)
        #expect(spy.uploadedWidth == 2)
        #expect(spy.uploadedHeight == 2)
        #expect(Array(visiblePixels[0..<4]) == [0xFF, 0x00, 0x00, 0xFF])

        // The layer's paint survives untouched — only its composite
        // contribution disappears with the visibility flag.
        try state.activeTab.document.setLayerVisibility(id: layerId, visible: false)
        view.configureRenderer(spy, mtkView: mtkView)
        let hiddenPixels = try #require(spy.uploadedPixels)
        #expect(hiddenPixels.allSatisfy { $0 == 0 })
        #expect(Array(try state.activeTab.document.activeLayerPixels()[0..<4]) == [0xFF, 0x00, 0x00, 0xFF])
    }

    @MainActor
    @Test("a visible Reference source reaches Metal separately from the Pixel-only canvas texture")
    func visibleReferenceReachesSeparateUnderlayTexture() throws {
        let state = Workspace(width: 4, height: 4)
        let redReference = Data([0xFF, 0, 0, 0xFF])
        try state.activeTab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png",
            rgba: redReference,
            width: 1,
            height: 1
        ))
        let referenceId = state.activeTab.document.activeLayerId()
        let mtkView = MTKView()
        let spy = try makeSpy(view: mtkView)
        let view = PixelCanvasView(
            tab: state.activeTab,
            viewport: state.activeTab.viewport,
            showGrid: false,
            workspace: state
        )

        view.configureRenderer(spy, mtkView: mtkView)

        let viewport = state.activeTab.viewport
        let expectedProjection = state.activeTab.referenceLayerUnderlay?.projectForRendering(
            effectivePixelSize: Float(viewport.effectivePixelSize()),
            panX: Float(viewport.panX()),
            panY: Float(viewport.panY())
        )
        #expect(spy.uploadedReferenceProjection == expectedProjection)
        #expect(expectedProjection?.sourceKey == referenceId)
        #expect(expectedProjection?.sourceRgba == redReference)
        #expect(spy.uploadedPixels?.allSatisfy { $0 == 0 } == true)

        state.activeTab.setLayerVisibility(id: referenceId, visible: false)
        view.configureRenderer(spy, mtkView: mtkView)
        #expect(spy.uploadedReferenceProjection == nil)
        #expect(spy.uploadedPixels?.allSatisfy { $0 == 0 } == true)
    }

    @MainActor
    @Test("the canvas texture receives the Floating Selection patch preview")
    func floatingSelectionPreviewReachesUploadedBuffer() throws {
        let state = Workspace(width: 3, height: 1)
        let tab = state.activeTab
        try tab.document.setPixel(
            x: 0,
            y: 0,
            color: Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        )
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1)
        )
        state.shared.activeTool = .selection
        tab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        tab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 0))
        tab.endStroke()

        let mtkView = MTKView()
        let spy = try makeSpy(view: mtkView)
        let view = PixelCanvasView(
            tab: tab,
            viewport: tab.viewport,
            showGrid: false,
            workspace: state
        )

        view.configureRenderer(spy, mtkView: mtkView)

        let pixels = try #require(spy.uploadedPixels)
        #expect(Array(pixels[0..<4]) == [0, 0, 0, 0])
        #expect(Array(pixels[4..<8]) == [0xFF, 0, 0, 0xFF])
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0))
    }
}
