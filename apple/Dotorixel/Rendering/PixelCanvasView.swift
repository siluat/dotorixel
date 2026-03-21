import SwiftUI
import MetalKit

/// Default grid line color matching the web renderer's `gridColor: '#cccccc'`.
private let defaultGridColor = SIMD4<Float>(0.8, 0.8, 0.8, 1.0)

/// SwiftUI wrapper for the Metal-backed pixel canvas renderer.
/// Uses `NSViewRepresentable` on macOS, `UIViewRepresentable` on iOS.
struct PixelCanvasView {
    let pixelCanvas: ApplePixelCanvas
    let viewport: AppleViewport
    let showGrid: Bool
}

// MARK: - Shared helpers

extension PixelCanvasView {
    func configureRenderer(_ renderer: PixelGridRenderer, mtkView: MTKView) {
        let width = pixelCanvas.width()
        let height = pixelCanvas.height()
        let pixels = pixelCanvas.pixels()

        renderer.updateCanvasTexture(pixels: pixels, width: width, height: height)

        let drawableSize = mtkView.drawableSize
        let eps = Float(viewport.effectivePixelSize())

        renderer.updateUniforms(
            canvasWidth: width,
            canvasHeight: height,
            viewportWidth: Float(drawableSize.width),
            viewportHeight: Float(drawableSize.height),
            panX: Float(viewport.panX()),
            panY: Float(viewport.panY()),
            effectivePixelSize: eps,
            showGrid: showGrid,
            gridColor: defaultGridColor
        )
    }

    static func makeMTKView(device: MTLDevice) -> MTKView {
        let view = MTKView()
        view.device = device
        view.colorPixelFormat = .bgra8Unorm
        return view
    }
}

#if os(macOS)

extension PixelCanvasView: NSViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> MTKView {
        guard let device = MTLCreateSystemDefaultDevice() else {
            fatalError("Metal is not supported on this device")
        }
        let mtkView = Self.makeMTKView(device: device)

        if let renderer = PixelGridRenderer(mtkView: mtkView) {
            context.coordinator.renderer = renderer
            mtkView.delegate = renderer
        }

        return mtkView
    }

    func updateNSView(_ mtkView: MTKView, context: Context) {
        guard let renderer = context.coordinator.renderer else { return }
        configureRenderer(renderer, mtkView: mtkView)
        mtkView.setNeedsDisplay(mtkView.bounds)
    }
}

#else

extension PixelCanvasView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> MTKView {
        guard let device = MTLCreateSystemDefaultDevice() else {
            fatalError("Metal is not supported on this device")
        }
        let mtkView = Self.makeMTKView(device: device)

        if let renderer = PixelGridRenderer(mtkView: mtkView) {
            context.coordinator.renderer = renderer
            mtkView.delegate = renderer
        }

        return mtkView
    }

    func updateUIView(_ mtkView: MTKView, context: Context) {
        guard let renderer = context.coordinator.renderer else { return }
        configureRenderer(renderer, mtkView: mtkView)
        mtkView.setNeedsDisplay()
    }
}

#endif

// MARK: - Coordinator

extension PixelCanvasView {
    class Coordinator {
        var renderer: PixelGridRenderer?
    }
}
