import SwiftUI

@main
struct DotorixelApp: App {
    // Owned at App scope (not ContentView) so the Edit-menu commands below
    // can reach the same state the editor views observe. The session wraps
    // the workspace with persistence wiring: restore on launch, debounced
    // auto-save, and the scenePhase flush below.
    @State private var session = AppSession()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        #if os(macOS)
        // A single `Window` (not `WindowGroup`): the editor is a
        // single-document app until Phase 4 (multi-tab + persistence), and
        // the app-scoped Workspace must not be aliased by ⌘N-spawned
        // windows all mutating one canvas.
        Window("Dotorixel", id: "editor") {
            ContentView(workspace: session.workspace, saveFlow: session.saveFlow)
                // Floor the window so the docked chrome (44pt toolbar + 200pt panel)
                // can't be squeezed past the canvas on a narrowly-resized Mac window.
                .frame(minWidth: 480, minHeight: 400)
                .task { session.start() }
        }
        .commands {
            // Replace the system undo/redo group (which would target the
            // responder chain's NSUndoManager) with commands bound to the
            // editor's own History stacks.
            CommandGroup(replacing: .undoRedo) {
                UndoRedoCommands(workspace: session.workspace)
            }
        }
        .defaultSize(width: 960, height: 640)
        .windowResizability(.contentMinSize)
        .onChange(of: scenePhase) { _, newPhase in
            flushOnLeavingActive(newPhase)
        }
        #else
        // iPad's compact context is ≥320pt natively and needs no size floor.
        // Multiple scenes are explicitly disabled in project.yml
        // (UIApplicationSupportsMultipleScenes: NO), so the app-scoped
        // state is never aliased across scenes.
        WindowGroup {
            ContentView(workspace: session.workspace, saveFlow: session.saveFlow)
                .task { session.start() }
        }
        .commands {
            CommandGroup(replacing: .undoRedo) {
                UndoRedoCommands(workspace: session.workspace)
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            flushOnLeavingActive(newPhase)
        }
        #endif
    }

    /// Leaving the active phase (backgrounding, losing foreground) flushes
    /// any pending auto-save before the debounce elapses — the native analog
    /// of the web's `visibilitychange` / `beforeunload` flush.
    private func flushOnLeavingActive(_ phase: ScenePhase) {
        guard phase != .active else { return }
        Task { await session.flush() }
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
    let workspace: Workspace

    var body: some View {
        Button("Undo") {
            workspace.activeTab.handleUndo()
        }
        .keyboardShortcut("z", modifiers: .command)
        .disabled(workspace.isTextInputFocused || !workspace.activeTab.canUndo)

        Button("Redo") {
            workspace.activeTab.handleRedo()
        }
        .keyboardShortcut("z", modifiers: [.command, .shift])
        .disabled(workspace.isTextInputFocused || !workspace.activeTab.canRedo)
    }
}
