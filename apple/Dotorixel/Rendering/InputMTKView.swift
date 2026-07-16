import MetalKit

/// Abstracts platform-specific input events into unified drawing commands.
///
/// The coordinator implements this protocol to receive drawing events from
/// `InputMTKView`, regardless of whether the input came from a mouse (macOS),
/// touch, or Apple Pencil (iPadOS).
protocol CanvasInputDelegate: AnyObject {
    func drawingBegan(at point: CGPoint, button: PointerButton, in view: InputMTKView)
    func drawingMoved(to point: CGPoint, in view: InputMTKView)
    func drawingEnded(in view: InputMTKView)
    /// An interrupted pointer sequence (e.g. `touchesCancelled`) — must tear
    /// the stroke down via its cancel path, not its end path.
    func drawingCancelled(in view: InputMTKView)
    #if os(macOS)
    func scrollWheelChanged(deltaX: CGFloat, deltaY: CGFloat, at point: CGPoint, isPrecise: Bool, in view: InputMTKView)
    func magnifyChanged(magnification: CGFloat, at point: CGPoint, in view: InputMTKView)
    #endif
}

/// MTKView subclass that captures native input events and forwards them
/// to a `CanvasInputDelegate`.
class InputMTKView: MTKView {
    weak var inputDelegate: CanvasInputDelegate?

    #if os(macOS)

    override var acceptsFirstResponder: Bool { true }
    override var isFlipped: Bool { true }

    override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        inputDelegate?.drawingBegan(at: point, button: .primary, in: self)
    }

    override func mouseDragged(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        inputDelegate?.drawingMoved(to: point, in: self)
    }

    override func mouseUp(with event: NSEvent) {
        inputDelegate?.drawingEnded(in: self)
    }

    // Right-button events mirror the left-button sequence; not calling super
    // also suppresses AppKit's default context-menu behavior on the canvas.

    override func rightMouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        inputDelegate?.drawingBegan(at: point, button: .secondary, in: self)
    }

    override func rightMouseDragged(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        inputDelegate?.drawingMoved(to: point, in: self)
    }

    override func rightMouseUp(with event: NSEvent) {
        inputDelegate?.drawingEnded(in: self)
    }

    override func scrollWheel(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        inputDelegate?.scrollWheelChanged(
            deltaX: event.scrollingDeltaX,
            deltaY: event.scrollingDeltaY,
            at: point,
            isPrecise: event.hasPreciseScrollingDeltas,
            in: self
        )
    }

    override func magnify(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        inputDelegate?.magnifyChanged(
            magnification: event.magnification,
            at: point,
            in: self
        )
    }

    #else

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let point = touch.location(in: self)
        // Pointer devices (trackpad/mouse) report pressed buttons on the
        // event; direct touch has an empty mask and draws with the primary.
        let button: PointerButton = event?.buttonMask.contains(.secondary) == true
            ? .secondary
            : .primary
        inputDelegate?.drawingBegan(at: point, button: button, in: self)
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let point = touch.location(in: self)
        inputDelegate?.drawingMoved(to: point, in: self)
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        inputDelegate?.drawingEnded(in: self)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        inputDelegate?.drawingCancelled(in: self)
    }

    #endif
}
