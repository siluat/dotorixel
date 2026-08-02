import SwiftUI

/// Workspace-level editor state (web parity: `Workspace` in
/// `workspace.svelte.ts`): owns the tab collection — a single tab for now —
/// and exposes the active tab. The shape `addTab` / `closeTab` /
/// `setActiveTab` will extend in the multi-tab slice.
@Observable
final class Workspace {
    /// The one `SharedState` instance every tab sees by reference.
    let shared: SharedState
    private(set) var tabs: [TabState]
    private var activeTabIndex = 0

    var activeTab: TabState {
        tabs[activeTabIndex]
    }

    /// Whether the physical Shift key is held (macOS modifier flags, iPad
    /// hardware keyboard). One of the two Shift-constrain sources.
    var isShiftKeyHeld: Bool = false {
        didSet { if isShiftKeyHeld != oldValue { activeTab.modifierStateChanged() } }
    }

    /// Sticky toolbar Constrain latch — the touch-first stand-in for holding
    /// Shift. Session-transient by design (in-memory only): it resets on
    /// relaunch, mirroring how a held key is never remembered.
    var isConstrainLatchOn: Bool = false {
        didSet { if isConstrainLatchOn != oldValue { activeTab.modifierStateChanged() } }
    }

    /// Whether a text field (the canvas-size inputs) has keyboard focus —
    /// the signal that suppresses editor shortcuts so typed letters stay in
    /// the field. Set by the owning views on focus change.
    ///
    /// Entering text focus also clears held-key state: on iPad the canvas
    /// loses first responder, so release events (e.g. the Alt that opened a
    /// temporary eyedropper) would never arrive.
    var isTextInputFocused: Bool = false {
        didSet {
            if isTextInputFocused && !oldValue {
                keyboardShortcuts.reset()
            }
        }
    }

    /// Editor keyboard shortcuts (tool keys, X/G, undo/redo combos,
    /// Alt-hold eyedropper). Platform wiring feeds it normalized key events;
    /// it dispatches back into this workspace via `KeyboardShortcutHost`.
    let keyboardShortcuts = KeyboardShortcutController()

    init(width: UInt32 = 16, height: UInt32 = 16) {
        self.shared = SharedState()
        // Two-phase: `tabs` starts empty so `createTab` — an instance method
        // whose closures capture `self` — can run once phase-1 init is done.
        self.tabs = []
        self.tabs = [createTab(width: width, height: height)]
        keyboardShortcuts.host = self
    }

    // MARK: - Tools

    /// Activates a tool the way a toolbar tap does (web parity: `activateTool`
    /// in `tool-ui.ts`): re-activating the already-active constrainable tool
    /// toggles the Constrain latch; anything else selects the tool.
    func activateTool(_ tool: EditorTool) {
        if tool == shared.activeTool && tool.isConstrainable {
            isConstrainLatchOn.toggle()
        } else {
            shared.activeTool = tool
        }
    }

    // MARK: - Colors

    /// Exchanges the shared foreground and background colors.
    func swapColors() {
        let previousForeground = shared.foregroundColor
        shared.foregroundColor = shared.backgroundColor
        shared.backgroundColor = previousForeground
    }

    /// Constructs a `TabState` with the workspace's ambient deps baked in
    /// (web parity: `createTab` in `workspace.svelte.ts`) — the shared state
    /// by reference, and closures bridging the workspace-scoped transient
    /// input state into the tab's stroke lifecycle.
    private func createTab(width: UInt32, height: UInt32) -> TabState {
        TabState(
            shared: shared,
            documentId: "doc-\(UUID().uuidString)",
            name: nextUntitledName(),
            isConstrainHeld: { [weak self] in
                guard let self else { return false }
                return self.isShiftKeyHeld || self.isConstrainLatchOn
            },
            consumePendingToolRestore: { [weak self] in
                self?.keyboardShortcuts.consumePendingToolRestore()
            },
            width: width,
            height: height
        )
    }

    /// The next fresh-tab display name (web parity: `#nextUntitledName` in
    /// `workspace.svelte.ts`) — the lowest "Untitled N" not already in use.
    private func nextUntitledName() -> String {
        let usedNumbers = Set(tabs.compactMap { tab -> Int? in
            let match = tab.name.wholeMatch(of: /Untitled (\d+)/)
            return match.flatMap { Int($0.1) }
        })
        var nextNumber = 1
        while usedNumbers.contains(nextNumber) { nextNumber += 1 }
        return "Untitled \(nextNumber)"
    }
}

// MARK: - KeyboardShortcutHost

/// The workspace hosts the keyboard controller: shared state answers the
/// tool reads directly, and document-scoped commands delegate to the
/// active tab.
extension Workspace: KeyboardShortcutHost {
    var isDrawing: Bool { activeTab.isDrawing }

    var activeTool: EditorTool { shared.activeTool }

    /// Sets the active tool directly — the keyboard/programmatic path.
    /// Unlike `activateTool`, re-selecting the active constrainable tool
    /// never toggles the Constrain latch (web parity: `setActiveTool`).
    func setActiveTool(_ tool: EditorTool) {
        shared.activeTool = tool
    }

    func handleUndo() {
        activeTab.handleUndo()
    }

    func handleRedo() {
        activeTab.handleRedo()
    }

    func toggleGrid() {
        activeTab.toggleGrid()
    }
}
