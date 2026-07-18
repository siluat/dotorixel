#if os(macOS)
import SwiftUI

/// macOS wiring for the editor keyboard shortcuts: local NSEvent monitors
/// feed normalized key events into `EditorState.keyboardShortcuts`.
///
/// Monitors see events before responder-chain dispatch, so shortcuts work
/// regardless of which view is first responder — the text-input guard lives
/// in the controller (via `isTextInputFocused`), not in responder targeting.
///
/// Ownership split: ⌘Z/⇧⌘Z belong to the Edit-menu commands
/// (`UndoRedoCommands`) and pass through untouched — a single execution
/// path per shortcut on each platform. Everything else the controller
/// handles (tool letters, X, G, ⌘Y, Alt-hold) is consumed here.
struct ShortcutKeyMonitorModifier: ViewModifier {
    let editorState: EditorState

    @State private var monitors: [Any] = []

    func body(content: Content) -> some View {
        content
            .onAppear(perform: install)
            .onDisappear(perform: remove)
            // The window losing key status means release events will never
            // arrive — clear held-key state (web blur parity).
            .onReceive(
                NotificationCenter.default.publisher(for: NSWindow.didResignKeyNotification)
            ) { _ in
                editorState.keyboardShortcuts.reset()
            }
    }

    private func install() {
        guard monitors.isEmpty else { return }

        let keyDown = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            handleKeyDown(event) ? nil : event
        }
        let flagsChanged = NSEvent.addLocalMonitorForEvents(matching: .flagsChanged) { event in
            editorState.keyboardShortcuts.setAltHeld(event.modifierFlags.contains(.option))
            return event
        }
        monitors = [keyDown, flagsChanged].compactMap { $0 }
    }

    private func remove() {
        for monitor in monitors {
            NSEvent.removeMonitor(monitor)
        }
        monitors = []
    }

    /// Returns whether the event was consumed as an editor shortcut.
    private func handleKeyDown(_ event: NSEvent) -> Bool {
        guard let character = event.charactersIgnoringModifiers?.lowercased().first else {
            return false
        }
        let modifiers = ShortcutModifiers(event.modifierFlags)
        // ⌘Z/⇧⌘Z pass through to the Edit-menu commands (single owner).
        if KeyboardShortcutController.isMenuOwnedShortcut(character, modifiers: modifiers) {
            return false
        }
        return editorState.keyboardShortcuts.handleKeyDown(
            character, modifiers: modifiers, isRepeat: event.isARepeat
        )
    }
}

extension ShortcutModifiers {
    /// Maps AppKit modifier flags to the platform-neutral set.
    init(_ flags: NSEvent.ModifierFlags) {
        self = []
        if flags.contains(.command) { insert(.command) }
        if flags.contains(.shift) { insert(.shift) }
        if flags.contains(.option) { insert(.option) }
        if flags.contains(.control) { insert(.control) }
    }
}
#endif
