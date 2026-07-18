import SwiftUI

@main
struct DotorixelApp: App {
    // Owned at App scope (not ContentView) so the Edit-menu commands below
    // can reach the same state the editor views observe.
    @State private var editorState = EditorState()

    var body: some Scene {
        #if os(macOS)
        // A single `Window` (not `WindowGroup`): the editor is a
        // single-document app until Phase 4 (multi-tab + persistence), and
        // the app-scoped EditorState must not be aliased by ⌘N-spawned
        // windows all mutating one canvas.
        Window("Dotorixel", id: "editor") {
            ContentView(editorState: editorState)
                // Floor the window so the docked chrome (44pt toolbar + 200pt panel)
                // can't be squeezed past the canvas on a narrowly-resized Mac window.
                .frame(minWidth: 480, minHeight: 400)
        }
        .commands {
            // Replace the system undo/redo group (which would target the
            // responder chain's NSUndoManager) with commands bound to the
            // editor's own History stacks.
            CommandGroup(replacing: .undoRedo) {
                UndoRedoCommands(editorState: editorState)
            }
        }
        .defaultSize(width: 960, height: 640)
        .windowResizability(.contentMinSize)
        #else
        // iPad's compact context is ≥320pt natively and needs no size floor.
        // Multiple scenes are explicitly disabled in project.yml
        // (UIApplicationSupportsMultipleScenes: NO), so the app-scoped
        // state is never aliased across scenes.
        WindowGroup {
            ContentView(editorState: editorState)
        }
        .commands {
            CommandGroup(replacing: .undoRedo) {
                UndoRedoCommands(editorState: editorState)
            }
        }
        #endif
    }
}

/// Edit-menu undo/redo bound to the editor History. A `View` (not inline
/// `CommandGroup` content) so its body re-evaluates when `canUndo`/`canRedo`
/// change — `@Observable` tracking registers only inside a view body.
///
/// Disabled while a text field is focused: the menu path bypasses
/// `KeyboardShortcutController`, so it needs the text-input guard itself —
/// ⌘Z while typing in a size field must not undo the canvas (web parity).
private struct UndoRedoCommands: View {
    let editorState: EditorState

    var body: some View {
        Button("Undo") {
            editorState.handleUndo()
        }
        .keyboardShortcut("z", modifiers: .command)
        .disabled(editorState.isTextInputFocused || !editorState.canUndo)

        Button("Redo") {
            editorState.handleRedo()
        }
        .keyboardShortcut("z", modifiers: [.command, .shift])
        .disabled(editorState.isTextInputFocused || !editorState.canRedo)
    }
}
