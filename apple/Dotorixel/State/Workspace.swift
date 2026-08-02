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

    /// Fresh tabs open at this square dimension (web parity:
    /// `DEFAULT_CANVAS_DIMENSION` in `tab-state.svelte.ts`).
    static let defaultCanvasDimension: UInt32 = 16

    init(width: UInt32 = Workspace.defaultCanvasDimension,
         height: UInt32 = Workspace.defaultCanvasDimension) {
        self.shared = SharedState()
        // Two-phase: `tabs` starts empty so `createTab` — an instance method
        // whose closures capture `self` — can run once phase-1 init is done.
        self.tabs = []
        self.tabs = [createTab(width: width, height: height)]
        keyboardShortcuts.host = self
    }

    // MARK: - Tab lifecycle

    /// Opens a fresh default-size document in a new tab and makes it active
    /// (web parity: `addTab` in `workspace.svelte.ts`).
    @discardableResult
    func addTab() -> TabState {
        resolveOutgoingStroke(nextIndex: tabs.count)
        let tab = createTab(
            width: Self.defaultCanvasDimension,
            height: Self.defaultCanvasDimension
        )
        tabs.append(tab)
        activeTabIndex = tabs.count - 1
        return tab
    }

    /// Activates the tab at `index` (web parity: `setActiveTab` in
    /// `workspace.svelte.ts`).
    ///
    /// - Precondition: `index` is a valid `tabs` position — callers tap tabs
    ///   the strip itself rendered, so no stale index reaches here.
    func setActiveTab(_ index: Int) {
        resolveOutgoingStroke(nextIndex: index)
        activeTabIndex = index
    }

    /// Whether any tab may be closed — false only at the sole-tab guard
    /// (the workspace always keeps at least one tab open). The tab strip
    /// renders its close affordances from this, the UI face of the guard
    /// `closeTab` enforces.
    var canCloseTab: Bool {
        tabs.count > 1
    }

    /// Removes the tab at `index` (web parity: `closeTab` in
    /// `workspace.svelte.ts`): closing the active tab activates its right
    /// neighbor, clamped to the new last tab at the end. Silently refuses
    /// to close the sole remaining tab — `activeTab`'s force-index relies
    /// on the collection never being empty.
    ///
    /// - Precondition: `index` is a valid `tabs` position. Stale indices are
    ///   screened out at the UI boundary — the strip bounds-checks its
    ///   pending close index at confirm time before calling in.
    func closeTab(_ index: Int) {
        guard canCloseTab else { return }
        tabs.remove(at: index)
        if index == activeTabIndex {
            activeTabIndex = min(index, tabs.count - 1)
        } else if index < activeTabIndex {
            activeTabIndex -= 1
        }
    }

    /// Commits the active tab's in-flight stroke before a different tab
    /// becomes active — activation must never leave the outgoing tab
    /// mid-edit, so its drawn pixels and undo entry seal here. This is the
    /// policy layer; the canvas coordinator's originating-tab capture is the
    /// defense beneath it, for pointer events already in flight when the
    /// switch lands. No-op when the active tab is unchanged.
    private func resolveOutgoingStroke(nextIndex: Int) {
        if nextIndex != activeTabIndex && activeTab.isDrawing {
            activeTab.endStroke()
        }
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
