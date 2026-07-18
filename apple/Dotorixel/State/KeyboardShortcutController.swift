/// Commands and state reads the keyboard controller needs from its owner —
/// the Apple analog of the web's `KeyboardInputHost`
/// (`keyboard-input.svelte.ts`). `EditorState` is the production host.
protocol KeyboardShortcutHost: AnyObject {
    /// Whether a draw stroke is in progress.
    var isDrawing: Bool { get }
    /// Whether a text field (e.g. the canvas-size inputs) has keyboard focus.
    var isTextInputFocused: Bool { get }
    /// The currently active tool.
    var activeTool: EditorTool { get }
    /// Sets the active tool directly — the keyboard path never toggles the
    /// Constrain latch the way a toolbar re-tap does.
    func setActiveTool(_ tool: EditorTool)
    /// Undo one step.
    func handleUndo()
    /// Redo one step.
    func handleRedo()
    /// Toggle grid visibility.
    func toggleGrid()
    /// Swap foreground/background colors.
    func swapColors()
}

/// Platform-neutral modifier state accompanying a key press.
struct ShortcutModifiers: OptionSet {
    let rawValue: Int

    static let command = ShortcutModifiers(rawValue: 1 << 0)
    static let shift = ShortcutModifiers(rawValue: 1 << 1)
    static let option = ShortcutModifiers(rawValue: 1 << 2)
    static let control = ShortcutModifiers(rawValue: 1 << 3)
}

/// Editor keyboard shortcut logic, ported from the web's
/// `createKeyboardInput` (`keyboard-input.svelte.ts`) and kept free of
/// SwiftUI/AppKit/UIKit so it is unit-testable. Platform wiring feeds it
/// normalized key events; it dispatches commands through
/// `KeyboardShortcutHost`.
final class KeyboardShortcutController {
    weak var host: KeyboardShortcutHost?

    /// Whether Alt/Option is physically held right now.
    private var isAltHeld = false
    /// The tool to restore when the temporary Alt-eyedropper switch ends;
    /// nil when no temporary switch is active.
    private var toolBeforeModifier: EditorTool?

    /// Routes an Alt/Option press-state change (macOS `flagsChanged`, iPad
    /// `presses*`). Holding Alt temporarily switches to the eyedropper;
    /// releasing restores the prior tool.
    func setAltHeld(_ isHeld: Bool) {
        guard isHeld != isAltHeld else { return }
        isAltHeld = isHeld
        guard let host else { return }

        if isHeld {
            guard !host.isTextInputFocused else { return }
            // Mid-stroke: the active session keeps its tool; nothing is
            // saved, so the later release has nothing to restore.
            guard !host.isDrawing else { return }
            // Already the eyedropper — a temporary switch would "restore"
            // the eyedropper itself and lose the user's real prior tool.
            guard host.activeTool != .eyedropper else { return }
            toolBeforeModifier = host.activeTool
            host.setActiveTool(.eyedropper)
        } else {
            // Mid-stroke release: leave the saved tool pending — the input
            // pipeline restores it at stroke end via
            // `consumePendingToolRestore()`, never mid-stroke.
            guard !host.isDrawing else { return }
            if let tool = toolBeforeModifier {
                toolBeforeModifier = nil
                host.setActiveTool(tool)
            }
        }
    }

    /// Clears held-key state when key focus is lost (window resigns key /
    /// scene deactivates — web blur parity): the matching release events
    /// will never arrive, so a pending temporary switch restores now.
    func reset() {
        isAltHeld = false
        if let tool = toolBeforeModifier {
            toolBeforeModifier = nil
            host?.setActiveTool(tool)
        }
    }

    /// Called when a draw stroke ends or is cancelled: returns the tool a
    /// temporary Alt switch must restore, consuming it, or nil when Alt is
    /// still held (restore waits for the release) or no switch is pending.
    func consumePendingToolRestore() -> EditorTool? {
        guard !isAltHeld, let tool = toolBeforeModifier else { return nil }
        toolBeforeModifier = nil
        return tool
    }

    /// Whether this key combo belongs to the Edit-menu commands
    /// (`UndoRedoCommands`), which own ⌘Z/⇧⌘Z on both platforms. Platform
    /// wiring must pass these through instead of forwarding them here —
    /// otherwise the menu and the controller would double-fire.
    static func isMenuOwnedShortcut(_ character: Character, modifiers: ShortcutModifiers) -> Bool {
        modifiers.contains(.command) && character == "z"
    }

    /// Routes one key press. Returns whether the key was consumed as a
    /// shortcut — callers swallow handled events so they don't also reach
    /// platform default handling.
    ///
    /// Repeat policy (web parity): held undo/redo keeps firing and a held
    /// tool key re-activates harmlessly, but G/X toggles fire once — their
    /// repeats are swallowed without dispatching so the grid doesn't flicker.
    @discardableResult
    func handleKeyDown(_ character: Character, modifiers: ShortcutModifiers = [], isRepeat: Bool = false) -> Bool {
        guard let host, let command = resolveKeyDown(character, modifiers: modifiers, host: host) else {
            return false
        }
        switch command {
        // The host's undo/redo handlers self-guard against firing mid-stroke.
        case .undo: host.handleUndo()
        case .redo: host.handleRedo()
        case .toggleGrid: if !isRepeat { host.toggleGrid() }
        case .swapColors: if !isRepeat { host.swapColors() }
        case .activateTool(let tool): host.setActiveTool(tool)
        }
        return true
    }

    private enum ShortcutCommand {
        case undo
        case redo
        case toggleGrid
        case swapColors
        case activateTool(EditorTool)
    }

    /// The single keydown decision table, ported from the web handler.
    private func resolveKeyDown(
        _ character: Character,
        modifiers: ShortcutModifiers,
        host: KeyboardShortcutHost
    ) -> ShortcutCommand? {
        // Web parity: every shortcut is gated on the target not being a text
        // input, so the canvas-size fields keep receiving plain letters.
        guard !host.isTextInputFocused else { return nil }

        // ⌘Z / ⇧⌘Z / ⌘Y — undo/redo combos mirror the web handler.
        if modifiers.contains(.command) {
            if character == "z" {
                return modifiers.contains(.shift) ? .redo : .undo
            }
            if character == "y" {
                return .redo
            }
            return nil
        }

        // Bare-letter shortcuts only from here down.
        guard modifiers.isEmpty else { return nil }

        // G and X sit above the mid-stroke guard (web parity): toggling the
        // grid or swapping colors is safe while drawing.
        if character == "g" { return .toggleGrid }
        if character == "x" { return .swapColors }

        // Tool switching is inert mid-stroke — the active session keeps its
        // tool for the stroke's whole lifetime.
        guard !host.isDrawing else { return nil }
        if let tool = EditorTool.allCases.first(where: { $0.shortcutKey == character }) {
            return .activateTool(tool)
        }
        return nil
    }
}
