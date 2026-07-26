import MetalKit
import Testing
@testable import Dotorixel

/// A `PixelGridRenderer` that records the last buffer handed to the canvas
/// texture upload — the seam between the editor state and the Metal draw.
private final class CanvasTextureSpy: PixelGridRenderer {
    var uploadedPixels: Data?
    var uploadedWidth: UInt32?
    var uploadedHeight: UInt32?

    override func updateCanvasTexture(pixels: Data, width: UInt32, height: UInt32) {
        uploadedPixels = pixels
        uploadedWidth = width
        uploadedHeight = height
        super.updateCanvasTexture(pixels: pixels, width: width, height: height)
    }
}

/// Pins that the render path draws the *document composite*: what reaches the
/// canvas texture is the blend of visible layers, not any single layer's
/// buffer. No UI toggles visibility yet (the layer panel arrives in issues
/// 258+), so this seam test is the only guard on composite rendering.
@Suite("Render path — document composite")
struct RenderPathTests {

    @MainActor
    private func makeSpy(view: MTKView) throws -> CanvasTextureSpy {
        view.device = MTLCreateSystemDefaultDevice()
        return try #require(CanvasTextureSpy(mtkView: view))
    }

    @MainActor
    @Test("the canvas texture receives the composite — a hidden layer's pixels are absent")
    func hiddenLayerDisappearsFromUploadedBuffer() throws {
        let state = EditorState(width: 2, height: 2)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try state.document.setPixel(x: 0, y: 0, color: red)
        let layerId = state.document.layers()[0].id

        let mtkView = MTKView()
        let spy = try makeSpy(view: mtkView)
        let view = PixelCanvasView(
            document: state.document,
            viewport: state.viewport,
            showGrid: false,
            editorState: state
        )

        view.configureRenderer(spy, mtkView: mtkView)
        let visiblePixels = try #require(spy.uploadedPixels)
        #expect(spy.uploadedWidth == 2)
        #expect(spy.uploadedHeight == 2)
        #expect(Array(visiblePixels[0..<4]) == [0xFF, 0x00, 0x00, 0xFF])

        // The layer's paint survives untouched — only its composite
        // contribution disappears with the visibility flag.
        try state.document.setLayerVisibility(id: layerId, visible: false)
        view.configureRenderer(spy, mtkView: mtkView)
        let hiddenPixels = try #require(spy.uploadedPixels)
        #expect(hiddenPixels.allSatisfy { $0 == 0 })
        #expect(Array(try state.document.activeLayerPixels()[0..<4]) == [0xFF, 0x00, 0x00, 0xFF])
    }
}
