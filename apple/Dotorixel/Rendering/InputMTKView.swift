import MetalKit

/// Abstracts platform-specific input events into unified drawing commands.
///
/// The coordinator implements this protocol to receive drawing events from
/// `InputMTKView`, regardless of whether the input came from a mouse (macOS),
/// touch, or Apple Pencil (iPadOS).
protocol CanvasInputDelegate: AnyObject {
    /// `inputSource` picks the loupe positioning offsets: only a direct
    /// finger touch is `.touch`; mouse, trackpad, and Apple Pencil are
    /// `.mouse` (the pencil tip does not cover the loupe the way a finger does).
    func drawingBegan(at point: CGPoint, button: PointerButton, inputSource: LoupeInputSource, in view: InputMTKView)
    func drawingMoved(to point: CGPoint, in view: InputMTKView)
    func drawingEnded(in view: InputMTKView)
    /// An interrupted pointer sequence (e.g. `touchesCancelled`) — must tear
    /// the stroke down via its cancel path, not its end path.
    func drawingCancelled(in view: InputMTKView)
    /// The physical Shift key's held state, re-read from an input event —
    /// one of the two Shift-constrain sources (the other is the toolbar
    /// Constrain latch). Fired on every event that surfaces modifier flags;
    /// the receiver dedups unchanged values.
    func shiftStateChanged(isHeld: Bool, in view: InputMTKView)
    /// The physical Alt/Option key's held state (iPad hardware keyboard) —
    /// drives the temporary eyedropper switch. macOS reads Option globally
    /// via `ShortcutKeyMonitorModifier` instead, so this fires on iPad only.
    func altStateChanged(isHeld: Bool, in view: InputMTKView)
    /// A character key pressed on an iPad hardware keyboard, normalized for
    /// the shortcut controller. Returns whether the key was consumed as a
    /// shortcut, so the view keeps consumed presses out of the responder
    /// chain. macOS captures keys via `ShortcutKeyMonitorModifier` instead,
    /// so this fires on iPad only.
    func characterKeyPressed(
        _ character: Character, modifiers: ShortcutModifiers, isRepeat: Bool, in view: InputMTKView
    ) -> Bool
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

    /// Shift press/release while the canvas is first responder — the source
    /// that lets a stationary mid-stroke Shift change reshape the preview.
    override func flagsChanged(with event: NSEvent) {
        inputDelegate?.shiftStateChanged(isHeld: event.modifierFlags.contains(.shift), in: self)
        // Unlike the mouse handlers (which suppress AppKit's context menu),
        // modifier changes have no default behavior to block — keep the
        // responder chain intact.
        super.flagsChanged(with: event)
    }

    override func mouseDown(with event: NSEvent) {
        // Re-sync on stroke begin: a Shift press while another view held
        // first responder never reached `flagsChanged`.
        inputDelegate?.shiftStateChanged(isHeld: event.modifierFlags.contains(.shift), in: self)
        let point = convert(event.locationInWindow, from: nil)
        inputDelegate?.drawingBegan(at: point, button: .primary, inputSource: .mouse, in: self)
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
        inputDelegate?.shiftStateChanged(isHeld: event.modifierFlags.contains(.shift), in: self)
        let point = convert(event.locationInWindow, from: nil)
        inputDelegate?.drawingBegan(at: point, button: .secondary, inputSource: .mouse, in: self)
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

    // iPad hardware-keyboard Shift: presses reach the view only while it is
    // first responder; touch events also carry modifier flags as a fallback
    // re-sync. The toolbar Constrain latch covers every other input.

    override var canBecomeFirstResponder: Bool { true }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil {
            becomeFirstResponder()
        }
    }

    override func resignFirstResponder() -> Bool {
        // Key releases can't reach a non-first-responder — a code left in
        // the held set would mark that key's next press as an auto-repeat.
        heldKeyCodes.removeAll()
        return super.resignFirstResponder()
    }

    private func isShiftPress(_ presses: Set<UIPress>) -> Bool {
        presses.contains { $0.key?.keyCode == .keyboardLeftShift || $0.key?.keyCode == .keyboardRightShift }
    }

    private func isAltPress(_ presses: Set<UIPress>) -> Bool {
        presses.contains { $0.key?.keyCode == .keyboardLeftAlt || $0.key?.keyCode == .keyboardRightAlt }
    }

    /// Key codes currently held down — `UIPress` has no repeat flag, so a
    /// `pressesBegan` for a code already in this set is a keyboard
    /// auto-repeat (the physical release always passes through
    /// `pressesEnded`/`pressesCancelled`, which remove the code).
    private var heldKeyCodes: Set<UIKeyboardHIDUsage> = []

    /// Forwards character keys to the shortcut controller. ⌘Z/⇧⌘Z are
    /// excluded — the Edit-menu commands own undo/redo key equivalents on
    /// both platforms, and forwarding here would double-fire them.
    /// Returns the presses NOT consumed as shortcuts (modifier-only and
    /// unhandled presses pass through) for responder-chain forwarding.
    private func forwardCharacterPresses(_ presses: Set<UIPress>) -> Set<UIPress> {
        var unhandledPresses = presses
        for press in presses {
            guard let key = press.key,
                  let character = key.charactersIgnoringModifiers.lowercased().first
            else { continue }
            let isRepeat = !heldKeyCodes.insert(key.keyCode).inserted
            let modifiers = ShortcutModifiers(key.modifierFlags)
            if KeyboardShortcutController.isMenuOwnedShortcut(character, modifiers: modifiers) { continue }
            let consumed = inputDelegate?.characterKeyPressed(
                character, modifiers: modifiers, isRepeat: isRepeat, in: self
            ) ?? false
            if consumed {
                unhandledPresses.remove(press)
            }
        }
        return unhandledPresses
    }

    private func releaseHeldKeyCodes(_ presses: Set<UIPress>) {
        for press in presses {
            if let keyCode = press.key?.keyCode {
                heldKeyCodes.remove(keyCode)
            }
        }
    }

    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if isShiftPress(presses) {
            inputDelegate?.shiftStateChanged(isHeld: true, in: self)
        }
        if isAltPress(presses) {
            inputDelegate?.altStateChanged(isHeld: true, in: self)
        }
        // Consumed shortcuts stop here — forwarding them up the responder
        // chain would hand them to system focus/default handling too.
        let unhandledPresses = forwardCharacterPresses(presses)
        if !unhandledPresses.isEmpty {
            super.pressesBegan(unhandledPresses, with: event)
        }
    }

    // A release reports the event's combined modifier state, not a bare
    // `false` — releasing one of two held Shift keys must keep the
    // constraint (the macOS `flagsChanged` path gets this for free).

    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        releaseHeldKeyCodes(presses)
        if isShiftPress(presses) {
            inputDelegate?.shiftStateChanged(isHeld: event?.modifierFlags.contains(.shift) ?? false, in: self)
        }
        if isAltPress(presses) {
            inputDelegate?.altStateChanged(isHeld: event?.modifierFlags.contains(.alternate) ?? false, in: self)
        }
        super.pressesEnded(presses, with: event)
    }

    override func pressesCancelled(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        releaseHeldKeyCodes(presses)
        if isShiftPress(presses) {
            inputDelegate?.shiftStateChanged(isHeld: event?.modifierFlags.contains(.shift) ?? false, in: self)
        }
        if isAltPress(presses) {
            inputDelegate?.altStateChanged(isHeld: event?.modifierFlags.contains(.alternate) ?? false, in: self)
        }
        super.pressesCancelled(presses, with: event)
    }

    /// Routes multi-touch events into single-stroke drawing commands: the
    /// router decides which touch drives the stroke and when a second finger
    /// ends it (issue 245); this view only feeds events and executes the
    /// returned commands. Touches are identified without retaining them.
    private var strokeRouter = TouchStrokeRouter<ObjectIdentifier>()

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        // Re-acquire first responder at stroke start — another control may
        // have taken it since `didMoveToWindow`, which would silently stop
        // `presses*` (and with it mid-drag Shift changes) from arriving.
        if !isFirstResponder {
            becomeFirstResponder()
        }
        if let event {
            inputDelegate?.shiftStateChanged(isHeld: event.modifierFlags.contains(.shift), in: self)
            // Recognizer-claimed touches were cancelled for this view but
            // their fingers may still be on the glass — re-sync the router
            // with the event-wide truth so a mid-gesture begin stays blocked.
            strokeRouter.syncDownTouches(downTouchSnapshot(of: event))
        }
        for touch in touches {
            execute(
                strokeRouter.touchBegan(
                    ObjectIdentifier(touch),
                    kind: TouchKind(touch.type),
                    at: touch.location(in: self)
                ),
                event: event
            )
        }
    }

    /// Every touch currently on the glass (or pressed on an indirect
    /// device), event-wide — including touches a recognizer claimed away
    /// from this view. Filtering is an exclude-list on purpose: whether a
    /// claimed-but-still-down touch reports `.moved` or a per-view
    /// `.cancelled` in a later event is undocumented, and a genuinely dead
    /// touch leaves the event right after its terminal delivery — so
    /// counting everything except lifts and hovers can overblock at most
    /// the one begin a cancellation coincides with, never underblock.
    /// Hover phases are excluded: a hovering pencil must not block drawing.
    private func downTouchSnapshot(of event: UIEvent) -> [ObjectIdentifier: TouchKind] {
        var snapshot: [ObjectIdentifier: TouchKind] = [:]
        for touch in event.allTouches ?? [] {
            switch touch.phase {
            case .ended, .regionEntered, .regionMoved, .regionExited:
                continue
            default:
                snapshot[ObjectIdentifier(touch)] = TouchKind(touch.type)
            }
        }
        return snapshot
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            execute(
                strokeRouter.touchMoved(ObjectIdentifier(touch), to: touch.location(in: self)),
                event: event
            )
        }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            execute(strokeRouter.touchEnded(ObjectIdentifier(touch)), event: event)
        }
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            execute(strokeRouter.touchCancelled(ObjectIdentifier(touch)), event: event)
        }
    }

    private func execute(_ commands: [StrokeRoutingCommand], event: UIEvent?) {
        for command in commands {
            switch command {
            case .begin(let point, let kind):
                // Pointer devices (trackpad/mouse) report pressed buttons on
                // the event; direct touch has an empty mask and draws with
                // the primary.
                let button: PointerButton = event?.buttonMask.contains(.secondary) == true
                    ? .secondary
                    : .primary
                // Only a direct finger touch needs the loupe's touch offsets;
                // pencil and indirect pointers behave like a mouse.
                let inputSource: LoupeInputSource = kind == .direct ? .touch : .mouse
                inputDelegate?.drawingBegan(at: point, button: button, inputSource: inputSource, in: self)
            case .move(let point):
                inputDelegate?.drawingMoved(to: point, in: self)
            case .end:
                inputDelegate?.drawingEnded(in: self)
            case .cancel:
                inputDelegate?.drawingCancelled(in: self)
            }
        }
    }

    #endif
}

#if !os(macOS)
extension TouchKind {
    /// Maps UIKit's touch species onto the router's platform-neutral kinds.
    /// `.indirect` (non-pointer indirect input) has no drawing semantics of
    /// its own — treat it like a finger.
    init(_ type: UITouch.TouchType) {
        switch type {
        case .pencil: self = .pencil
        case .indirectPointer: self = .indirectPointer
        default: self = .direct
        }
    }
}

extension ShortcutModifiers {
    /// Maps UIKit key modifier flags to the platform-neutral set.
    init(_ flags: UIKeyModifierFlags) {
        self = []
        if flags.contains(.command) { insert(.command) }
        if flags.contains(.shift) { insert(.shift) }
        if flags.contains(.alternate) { insert(.option) }
        if flags.contains(.control) { insert(.control) }
    }
}
#endif
