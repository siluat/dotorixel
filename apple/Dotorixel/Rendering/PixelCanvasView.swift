import SwiftUI
import MetalKit

/// Grid line color matching Pebble UI's `--pebble-canvas-stroke: #E0DCD7`.
private let defaultGridColor = SIMD4<Float>(0.878, 0.863, 0.843, 1.0)

/// SwiftUI wrapper for the Metal-backed pixel canvas renderer.
/// Uses `NSViewRepresentable` on macOS, `UIViewRepresentable` on iOS.
struct PixelCanvasView {
    let pixelCanvas: ApplePixelCanvas
    let viewport: AppleViewport
    let showGrid: Bool
    var editorState: EditorState
    /// Observed by SwiftUI to trigger re-renders when canvas pixels change.
    /// The value itself is unused — only its change matters for the diff.
    var canvasVersion: Int = 0
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
}

#if os(macOS)

extension PixelCanvasView: NSViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> InputMTKView {
        guard let device = MTLCreateSystemDefaultDevice() else {
            fatalError("Metal is not supported on this device")
        }
        let mtkView = InputMTKView()
        mtkView.device = device
        mtkView.colorPixelFormat = .bgra8Unorm
        mtkView.inputDelegate = context.coordinator

        if let renderer = PixelGridRenderer(mtkView: mtkView) {
            context.coordinator.renderer = renderer
            mtkView.delegate = renderer
        }

        return mtkView
    }

    func updateNSView(_ mtkView: InputMTKView, context: Context) {
        let coordinator = context.coordinator
        coordinator.pixelCanvas = pixelCanvas
        coordinator.viewport = viewport
        coordinator.editorState = editorState

        guard let renderer = coordinator.renderer else { return }
        configureRenderer(renderer, mtkView: mtkView)
        mtkView.setNeedsDisplay(mtkView.bounds)
    }
}

#else

extension PixelCanvasView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> InputMTKView {
        guard let device = MTLCreateSystemDefaultDevice() else {
            fatalError("Metal is not supported on this device")
        }
        let mtkView = InputMTKView()
        mtkView.device = device
        mtkView.colorPixelFormat = .bgra8Unorm
        mtkView.inputDelegate = context.coordinator
        mtkView.isMultipleTouchEnabled = true

        if let renderer = PixelGridRenderer(mtkView: mtkView) {
            context.coordinator.renderer = renderer
            mtkView.delegate = renderer
        }

        let pinch = UIPinchGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handlePinch(_:))
        )
        pinch.cancelsTouchesInView = true
        mtkView.addGestureRecognizer(pinch)

        let pan = UIPanGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleTwoFingerPan(_:))
        )
        pan.minimumNumberOfTouches = 2
        pan.maximumNumberOfTouches = 2
        pan.cancelsTouchesInView = true
        mtkView.addGestureRecognizer(pan)

        return mtkView
    }

    func updateUIView(_ mtkView: InputMTKView, context: Context) {
        let coordinator = context.coordinator
        coordinator.pixelCanvas = pixelCanvas
        coordinator.viewport = viewport
        coordinator.editorState = editorState

        guard let renderer = coordinator.renderer else { return }
        configureRenderer(renderer, mtkView: mtkView)
        mtkView.setNeedsDisplay()
    }
}

#endif

// MARK: - Coordinator

extension PixelCanvasView {
    class Coordinator: NSObject, CanvasInputDelegate {
        var renderer: PixelGridRenderer?
        var pixelCanvas: ApplePixelCanvas?
        var viewport: AppleViewport?
        var editorState: EditorState?

        private var isInteracting = false
        private var lastPixel: ScreenCanvasCoords?

        #if !os(macOS)
        /// Tracks cumulative pinch scale for computing per-frame deltas on iPadOS.
        private var lastPinchScale: CGFloat = 1.0
        #endif

        // MARK: - CanvasInputDelegate

        func drawingBegan(at point: CGPoint, in view: InputMTKView) {
            guard let pixelCanvas, let viewport, let editorState else { return }

            isInteracting = true
            lastPixel = nil
            editorState.isDrawing = true
            editorState.historyManager.pushSnapshot(pixels: pixelCanvas.pixels())

            let devicePoint = convertToDevicePixels(point, in: view)
            let coords = viewport.screenToCanvas(screenX: devicePoint.x, screenY: devicePoint.y)
            applyToolAt(coords, pixelCanvas: pixelCanvas, editorState: editorState)
            lastPixel = coords
            triggerRedraw(editorState)
        }

        func drawingMoved(to point: CGPoint, in view: InputMTKView) {
            guard isInteracting,
                  let pixelCanvas, let viewport, let editorState else { return }

            let devicePoint = convertToDevicePixels(point, in: view)
            let coords = viewport.screenToCanvas(screenX: devicePoint.x, screenY: devicePoint.y)

            if let last = lastPixel, coords.x == last.x && coords.y == last.y {
                return
            }

            var didChange = false
            if let last = lastPixel {
                let interpolated = appleInterpolatePixels(
                    x0: last.x, y0: last.y,
                    x1: coords.x, y1: coords.y
                )
                for pixel in interpolated {
                    if applyToolAt(pixel, pixelCanvas: pixelCanvas, editorState: editorState) {
                        didChange = true
                    }
                }
            } else {
                if applyToolAt(coords, pixelCanvas: pixelCanvas, editorState: editorState) {
                    didChange = true
                }
            }

            lastPixel = coords
            if didChange {
                triggerRedraw(editorState)
            }
        }

        func drawingEnded(in view: InputMTKView) {
            isInteracting = false
            lastPixel = nil
            editorState?.isDrawing = false
        }

        // MARK: - macOS zoom/pan

        #if os(macOS)
        func scrollWheelChanged(
            deltaX: CGFloat, deltaY: CGFloat,
            at point: CGPoint, isPrecise: Bool,
            in view: InputMTKView
        ) {
            guard let viewport, let editorState else { return }

            if isPrecise {
                // Trackpad two-finger scroll → pan
                let scale = view.window?.backingScaleFactor ?? 1.0
                let panned = viewport.pan(
                    deltaX: -deltaX * scale,
                    deltaY: -deltaY * scale
                )
                editorState.handleViewportChange(panned)
            } else {
                // Mouse wheel → discrete zoom at cursor position
                guard deltaY != 0 else { return }
                let devicePoint = convertToDevicePixels(point, in: view)
                let currentZoom = viewport.zoom()
                let newZoom = deltaY > 0
                    ? viewportNextZoomLevel(currentZoom: currentZoom)
                    : viewportPrevZoomLevel(currentZoom: currentZoom)
                let zoomed = viewport.zoomAtPoint(
                    screenX: devicePoint.x, screenY: devicePoint.y, newZoom: newZoom
                )
                editorState.handleViewportChange(zoomed)
            }
        }

        func magnifyChanged(
            magnification: CGFloat,
            at point: CGPoint,
            in view: InputMTKView
        ) {
            guard let viewport, let editorState else { return }

            let devicePoint = convertToDevicePixels(point, in: view)
            let currentZoom = viewport.zoom()
            let newZoom = viewportClampZoom(zoom: currentZoom * (1.0 + magnification))
            let zoomed = viewport.zoomAtPoint(
                screenX: devicePoint.x, screenY: devicePoint.y, newZoom: newZoom
            )
            editorState.handleViewportChange(zoomed)
        }
        #endif

        // MARK: - iPadOS gestures

        #if !os(macOS)
        @objc func handlePinch(_ recognizer: UIPinchGestureRecognizer) {
            guard let view = recognizer.view as? InputMTKView,
                  let viewport, let editorState else { return }

            switch recognizer.state {
            case .began:
                lastPinchScale = 1.0
            case .changed:
                let scaleDelta = recognizer.scale / lastPinchScale
                lastPinchScale = recognizer.scale

                let center = recognizer.location(in: view)
                let devicePoint = convertToDevicePixels(center, in: view)
                let currentZoom = viewport.zoom()
                let newZoom = viewportClampZoom(zoom: currentZoom * scaleDelta)
                let zoomed = viewport.zoomAtPoint(
                    screenX: devicePoint.x, screenY: devicePoint.y, newZoom: newZoom
                )
                editorState.handleViewportChange(zoomed)
            case .ended, .cancelled:
                lastPinchScale = 1.0
            default:
                break
            }
        }

        @objc func handleTwoFingerPan(_ recognizer: UIPanGestureRecognizer) {
            guard let view = recognizer.view as? InputMTKView,
                  let viewport, let editorState else { return }

            switch recognizer.state {
            case .changed:
                let translation = recognizer.translation(in: view)
                let scale = view.contentScaleFactor
                let panned = viewport.pan(
                    deltaX: translation.x * scale,
                    deltaY: translation.y * scale
                )
                editorState.handleViewportChange(panned)
                recognizer.setTranslation(.zero, in: view)
            case .ended, .cancelled:
                break
            default:
                break
            }
        }
        #endif

        // MARK: - Private

        /// Converts a point in SwiftUI points to device pixels.
        ///
        /// The viewport's `fitToViewport` uses device pixels (points × displayScale),
        /// so input coordinates must be scaled the same way before calling `screenToCanvas`.
        private func convertToDevicePixels(_ point: CGPoint, in view: InputMTKView) -> (x: Double, y: Double) {
            #if os(macOS)
            let scale = view.window?.backingScaleFactor ?? 1.0
            #else
            let scale = view.contentScaleFactor
            #endif
            return (x: point.x * scale, y: point.y * scale)
        }

        @discardableResult
        private func applyToolAt(
            _ coords: ScreenCanvasCoords,
            pixelCanvas: ApplePixelCanvas,
            editorState: EditorState
        ) -> Bool {
            pixelCanvas.applyTool(
                x: coords.x,
                y: coords.y,
                tool: editorState.activeTool,
                foregroundColor: editorState.foregroundColor
            )
        }

        /// Triggers a canvas re-render by incrementing the version counter.
        ///
        /// Does NOT call `setNeedsDisplay` directly — SwiftUI observes the version
        /// change and calls `update*View`, which runs `configureRenderer` with fresh
        /// pixel data before setting needs display.
        private func triggerRedraw(_ editorState: EditorState) {
            editorState.canvasVersion += 1
        }
    }
}
