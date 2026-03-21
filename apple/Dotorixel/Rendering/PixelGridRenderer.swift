import MetalKit

/// Uniforms shared between Swift and Metal shader.
/// 48 bytes, naturally aligned — must match `Uniforms` in Shaders.metal exactly.
struct Uniforms {
    var canvasSize: SIMD2<Float>       // 8 bytes
    var viewportSize: SIMD2<Float>     // 8 bytes
    var panOffset: SIMD2<Float>        // 8 bytes
    var effectivePixelSize: Float      // 4 bytes
    var showGrid: Float                // 4 bytes
    var gridColor: SIMD4<Float>        // 16 bytes
}

/// Metal renderer for the pixel canvas.
/// Draws a fullscreen quad with checkerboard transparency, pixel data, and grid overlay.
/// Designed for on-demand rendering — the view only redraws when `setNeedsDisplay` is called.
final class PixelGridRenderer: NSObject, MTKViewDelegate {

    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    private let pipelineState: MTLRenderPipelineState

    private var canvasTexture: MTLTexture?
    private var currentCanvasWidth: UInt32 = 0
    private var currentCanvasHeight: UInt32 = 0
    private var uniforms = Uniforms(
        canvasSize: .zero,
        viewportSize: .zero,
        panOffset: .zero,
        effectivePixelSize: 1,
        showGrid: 0,
        gridColor: SIMD4<Float>(0.8, 0.8, 0.8, 1.0)
    )

    init?(mtkView: MTKView) {
        guard let device = mtkView.device ?? MTLCreateSystemDefaultDevice() else {
            return nil
        }
        self.device = device
        mtkView.device = device

        guard let commandQueue = device.makeCommandQueue() else {
            return nil
        }
        self.commandQueue = commandQueue

        // Load shaders from the default Metal library
        guard let library = device.makeDefaultLibrary(),
              let vertexFunction = library.makeFunction(name: "vertex_main"),
              let fragmentFunction = library.makeFunction(name: "fragment_main") else {
            return nil
        }

        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = vertexFunction
        descriptor.fragmentFunction = fragmentFunction
        descriptor.colorAttachments[0].pixelFormat = mtkView.colorPixelFormat

        // Enable alpha blending for the output
        descriptor.colorAttachments[0].isBlendingEnabled = true
        descriptor.colorAttachments[0].sourceRGBBlendFactor = .sourceAlpha
        descriptor.colorAttachments[0].destinationRGBBlendFactor = .oneMinusSourceAlpha
        descriptor.colorAttachments[0].sourceAlphaBlendFactor = .one
        descriptor.colorAttachments[0].destinationAlphaBlendFactor = .oneMinusSourceAlpha

        do {
            self.pipelineState = try device.makeRenderPipelineState(descriptor: descriptor)
        } catch {
            print("Failed to create pipeline state: \(error)")
            return nil
        }

        super.init()

        // On-demand rendering: pixel art doesn't need 60fps
        mtkView.isPaused = true
        mtkView.enableSetNeedsDisplay = true

        // Dark gray background outside the canvas area
        mtkView.clearColor = MTLClearColor(red: 0.18, green: 0.18, blue: 0.18, alpha: 1.0)
    }

    /// Upload RGBA pixel data to the GPU texture.
    /// Only recreates the texture when canvas dimensions change.
    func updateCanvasTexture(pixels: Data, width: UInt32, height: UInt32) {
        if canvasTexture == nil
            || currentCanvasWidth != width
            || currentCanvasHeight != height {
            let descriptor = MTLTextureDescriptor.texture2DDescriptor(
                pixelFormat: .rgba8Unorm,
                width: Int(width),
                height: Int(height),
                mipmapped: false
            )
            descriptor.usage = .shaderRead
            canvasTexture = device.makeTexture(descriptor: descriptor)
            currentCanvasWidth = width
            currentCanvasHeight = height
        }

        guard let texture = canvasTexture else { return }

        pixels.withUnsafeBytes { rawBuffer in
            guard let baseAddress = rawBuffer.baseAddress else { return }
            texture.replace(
                region: MTLRegion(
                    origin: MTLOrigin(x: 0, y: 0, z: 0),
                    size: MTLSize(width: Int(width), height: Int(height), depth: 1)
                ),
                mipmapLevel: 0,
                withBytes: baseAddress,
                bytesPerRow: Int(width) * 4
            )
        }
    }

    /// Update the uniform buffer with current viewport state.
    func updateUniforms(
        canvasWidth: UInt32,
        canvasHeight: UInt32,
        viewportWidth: Float,
        viewportHeight: Float,
        panX: Float,
        panY: Float,
        effectivePixelSize: Float,
        showGrid: Bool,
        gridColor: SIMD4<Float>
    ) {
        uniforms.canvasSize = SIMD2<Float>(Float(canvasWidth), Float(canvasHeight))
        uniforms.viewportSize = SIMD2<Float>(viewportWidth, viewportHeight)
        uniforms.panOffset = SIMD2<Float>(panX, panY)
        uniforms.effectivePixelSize = effectivePixelSize
        uniforms.showGrid = showGrid ? 1.0 : 0.0
        uniforms.gridColor = gridColor
    }

    // MARK: - MTKViewDelegate

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        // Trigger redraw when the view gets its actual size
        #if os(macOS)
        view.setNeedsDisplay(view.bounds)
        #else
        view.setNeedsDisplay()
        #endif
    }

    func draw(in view: MTKView) {
        // Update viewport size from the actual drawable (handles first-frame zero-size)
        let ds = view.drawableSize
        guard ds.width > 0, ds.height > 0 else { return }
        uniforms.viewportSize = SIMD2<Float>(Float(ds.width), Float(ds.height))

        guard let drawable = view.currentDrawable,
              let descriptor = view.currentRenderPassDescriptor,
              let texture = canvasTexture else {
            return
        }

        guard let commandBuffer = commandQueue.makeCommandBuffer(),
              let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: descriptor) else {
            return
        }

        encoder.setRenderPipelineState(pipelineState)
        encoder.setVertexBytes(&uniforms, length: MemoryLayout<Uniforms>.size, index: 0)
        encoder.setFragmentBytes(&uniforms, length: MemoryLayout<Uniforms>.size, index: 0)
        encoder.setFragmentTexture(texture, index: 0)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 6)
        encoder.endEncoding()

        commandBuffer.present(drawable)
        commandBuffer.commit()
    }
}
