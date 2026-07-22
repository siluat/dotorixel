import SwiftUI
import MetalKit

/// Default grid line color — light warm gray (#E0DCD7).
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
    /// Whether the canvas-size fields hold keyboard focus. Passed as a
    /// stored property (read at ContentView scope, like `canvasVersion`) so
    /// its change re-runs the update pass — the iPad first-responder
    /// reclaim below depends on it.
    var isTextInputFocused: Bool = false
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

        // Viewport navigation is a finger gesture: restricting both
        // recognizers to direct touches keeps a pencil out of them (issue
        // 252). A pencil landing during an active pinch/pan then always
        // reaches `touchesBegan` — so its stroke cancels the gesture instead
        // of being swallowed by `cancelsTouchesInView` — and can never be
        // miscounted toward the two-finger signal.
        let directTouchOnly = [UITouch.TouchType.direct.rawValue as NSNumber]

        let pinch = UIPinchGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handlePinch(_:))
        )
        pinch.cancelsTouchesInView = true
        pinch.allowedTouchTypes = directTouchOnly
        mtkView.addGestureRecognizer(pinch)

        let pan = UIPanGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleTwoFingerPan(_:))
        )
        pan.minimumNumberOfTouches = 2
        pan.maximumNumberOfTouches = 2
        pan.cancelsTouchesInView = true
        pan.allowedTouchTypes = directTouchOnly
        mtkView.addGestureRecognizer(pan)

        // Register both as viewport gestures so the view suppresses them
        // during a pencil stroke — gating new begins (via the view's
        // `gestureRecognizerShouldBegin`, no delegate needed) and cancelling
        // any already in flight when the pencil lands (issue 252).
        mtkView.viewportGestureRecognizers = [pinch, pan]

        return mtkView
    }

    func updateUIView(_ mtkView: InputMTKView, context: Context) {
        let coordinator = context.coordinator
        coordinator.viewport = viewport
        coordinator.editorState = editorState

        // Reclaim key focus when the canvas-size fields release it —
        // `presses*` (hardware-keyboard shortcuts) only reach the canvas
        // while it is first responder. Deferred: first-responder moves are
        // not allowed during a SwiftUI view update.
        if !isTextInputFocused && !mtkView.isFirstResponder {
            DispatchQueue.main.async {
                mtkView.becomeFirstResponder()
            }
        }

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
        var viewport: AppleViewport?
        var editorState: EditorState?

        private var isInteracting = false

        /// The input source resolved at stroke begin — reused for the loupe
        /// pointer pushes on every subsequent move of the same stroke.
        private var strokeInputSource: LoupeInputSource = .mouse

        #if !os(macOS)
        /// Tracks cumulative pinch scale for computing per-frame deltas on iPadOS.
        private var lastPinchScale: CGFloat = 1.0
        #endif

        // MARK: - CanvasInputDelegate

        // Drawing events only convert coordinates and forward — the stroke
        // lifecycle (session resolution, interpolation, dedup, history,
        // re-render) is owned by EditorState and its StrokeEngine.

        func drawingBegan(at point: CGPoint, button: PointerButton, inputSource: LoupeInputSource, in view: InputMTKView) {
            guard let viewport, let editorState else { return }

            isInteracting = true
            strokeInputSource = inputSource
            // Pointer push precedes the stroke so the loupe has a position
            // the moment the first sample shows it.
            pushLoupePointer(point, in: view, editorState: editorState)
            editorState.beginStroke(
                at: canvasCoords(of: point, in: view, viewport: viewport),
                button: button
            )
        }

        func drawingMoved(to point: CGPoint, in view: InputMTKView) {
            guard isInteracting, let viewport, let editorState else { return }

            pushLoupePointer(point, in: view, editorState: editorState)
            editorState.continueStroke(to: canvasCoords(of: point, in: view, viewport: viewport))
        }

        func drawingEnded(in view: InputMTKView) {
            isInteracting = false
            editorState?.endStroke()
        }

        func drawingCancelled(in view: InputMTKView) {
            isInteracting = false
            editorState?.cancelStroke()
        }

        func shiftStateChanged(isHeld: Bool, in view: InputMTKView) {
            // EditorState dedups unchanged values and routes a mid-stroke
            // flip into the active session's modifier refresh.
            editorState?.isShiftKeyHeld = isHeld
        }

        func altStateChanged(isHeld: Bool, in view: InputMTKView) {
            editorState?.keyboardShortcuts.setAltHeld(isHeld)
        }

        func characterKeyPressed(
            _ character: Character, modifiers: ShortcutModifiers, isRepeat: Bool, in view: InputMTKView
        ) -> Bool {
            editorState?.keyboardShortcuts.handleKeyDown(
                character, modifiers: modifiers, isRepeat: isRepeat
            ) ?? false
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

        /// Feeds the loupe's position inputs in canvas-area points — the
        /// coordinate space the SwiftUI overlay is laid out in, so no device
        /// -pixel conversion applies.
        private func pushLoupePointer(_ point: CGPoint, in view: InputMTKView, editorState: EditorState) {
            editorState.samplingLoupe.updatePointer(
                screen: point,
                viewport: view.bounds.size,
                inputSource: strokeInputSource
            )
        }

        private func canvasCoords(
            of point: CGPoint,
            in view: InputMTKView,
            viewport: AppleViewport
        ) -> ScreenCanvasCoords {
            let devicePoint = convertToDevicePixels(point, in: view)
            return viewport.screenToCanvas(screenX: devicePoint.x, screenY: devicePoint.y)
        }

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
    }
}
