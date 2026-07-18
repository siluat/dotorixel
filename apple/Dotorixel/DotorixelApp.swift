import SwiftUI

@main
struct DotorixelApp: App {
    // Owned at App scope (not ContentView) so the Edit-menu commands below
    // can reach the same state the editor views observe.
    @State private var editorState = EditorState()

    var body: some Scene {
        WindowGroup {
            ContentView(editorState: editorState)
            #if os(macOS)
                // Floor the window so the docked chrome (44pt toolbar + 200pt panel)
                // can't be squeezed past the canvas on a narrowly-resized Mac window.
                // iPad's compact context is ≥320pt natively and needs no floor.
                .frame(minWidth: 480, minHeight: 400)
            #endif
        }
        .commands {
            // Replace the system undo/redo group (which would target the
            // responder chain's NSUndoManager) with commands bound to the
            // editor's own History stacks.
            CommandGroup(replacing: .undoRedo) {
                UndoRedoCommands(editorState: editorState)
            }
        }
        #if os(macOS)
        .defaultSize(width: 960, height: 640)
        .windowResizability(.contentMinSize)
        #endif
    }
}

/// Edit-menu undo/redo bound to the editor History. A `View` (not inline
/// `CommandGroup` content) so its body re-evaluates when `canUndo`/`canRedo`
/// change — `@Observable` tracking registers only inside a view body.
private struct UndoRedoCommands: View {
    let editorState: EditorState

    var body: some View {
        Button("Undo") {
            editorState.handleUndo()
        }
        .keyboardShortcut("z", modifiers: .command)
        .disabled(!editorState.canUndo)

        Button("Redo") {
            editorState.handleRedo()
        }
        .keyboardShortcut("z", modifiers: [.command, .shift])
        .disabled(!editorState.canRedo)
    }
}
