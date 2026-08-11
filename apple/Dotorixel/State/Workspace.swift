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
    private(set) var activeTabIndex = 0

    /// Where persistable mutations are reported (web parity: the
    /// `DirtyNotifier` port). Shared-state mutations funnel through
    /// `wireSharedDirtyMarking()`; tab-scoped mutations mark from `TabState`.
    private let notifier: DirtyNotifier

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
         height: UInt32 = Workspace.defaultCanvasDimension,
         notifier: DirtyNotifier = NoOpDirtyNotifier()) {
        self.shared = SharedState()
        self.notifier = notifier
        // Two-phase: `tabs` starts empty so `createTab` — an instance method
        // whose closures capture `self` — can run once phase-1 init is done.
        self.tabs = []
        self.tabs = [createTab(width: width, height: height)]
        keyboardShortcuts.host = self
        wireSharedDirtyMarking()
    }

    /// Rebuilds the whole workspace from a persistence snapshot (web parity:
    /// the `restored` path of `createEditorSession`): every tab's document
    /// through the hydration constructor, tab order, active tab, per-tab
    /// viewports, and the shared state. Throws when a tab fails the core's
    /// hydration validation; History starts empty (session-transient, web
    /// parity).
    init(restoring snapshot: WorkspaceSnapshot,
         notifier: DirtyNotifier = NoOpDirtyNotifier()) throws {
        // The workspace invariant is "never empty" (`activeTab` force-indexes)
        // — an empty snapshot must fail the restore, not produce a workspace
        // that crashes on first read.
        guard !snapshot.tabs.isEmpty else { throw WorkspaceRestoreError.emptySnapshot }
        self.shared = SharedState(restoring: snapshot.sharedState)
        self.notifier = notifier
        // Two-phase for the same reason as the designated fresh init: the
        // restore closures capture `self`.
        self.tabs = []
        self.tabs = try snapshot.tabs.map { tabSnapshot in
            try TabState(
                restoring: tabSnapshot,
                shared: shared,
                notifier: notifier,
                isConstrainHeld: { [weak self] in
                    guard let self else { return false }
                    return self.isShiftKeyHeld || self.isConstrainLatchOn
                },
                consumePendingToolRestore: { [weak self] in
                    self?.keyboardShortcuts.consumePendingToolRestore()
                }
            )
        }
        // Clamped restore (web parity plus a low guard): a stored index that
        // no longer points at a tab lands on the nearest valid tab instead
        // of crashing `activeTab`.
        self.activeTabIndex = max(0, min(snapshot.activeTabIndex, tabs.count - 1))
        // Restored tabs keep their persisted zoom/pan: pre-marking them
        // fitted makes their first presentation reclamp instead of refit.
        self.fittedTabIds = Set(tabs.map(\.documentId))
        keyboardShortcuts.host = self
        // Wired after hydration assigned the shared slots, so restoring
        // marks nothing (hydration is not a user mutation).
        wireSharedDirtyMarking()
    }

    /// Routes shared-slot mutations (tool, colors, recent colors,
    /// pixel-perfect) into dirty marking. Marks the workspace, not a
    /// document: shared slots live in the workspace record, and naming the
    /// active document would rewrite its layers and stamp `updatedAt` for an
    /// edit that never touched it. (Deliberate divergence — the web marks
    /// the active document here; PR #351 review.)
    private func wireSharedDirtyMarking() {
        shared.onPersistableChange = { [weak self] in
            self?.notifier.markWorkspaceDirty()
        }
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
        notifier.markDirty(documentId: tab.documentId)
        return tab
    }

    /// Activates the tab at `index` (web parity: `setActiveTab` in
    /// `workspace.svelte.ts`).
    ///
    /// - Precondition: `index` is a valid `tabs` position — callers tap tabs
    ///   the strip itself rendered, so no stale index reaches here.
    func setActiveTab(_ index: Int) {
        guard index != activeTabIndex else { return }
        resolveOutgoingStroke(nextIndex: index)
        activeTabIndex = index
        // The active tab index is persisted workspace state — no document
        // changed, so only the workspace record is marked. (The web omits
        // this mark entirely — a switch alone is only saved when something
        // else dirties the session — an accepted gap this shell closes.)
        notifier.markWorkspaceDirty()
    }

    /// Opens a saved document's snapshot as a new active tab (web parity:
    /// `openSnapshot` in `workspace.svelte.ts`) — the browser's reopen path.
    /// The tab is deliberately not pre-marked fitted: reopening resets the
    /// view, so its first presentation fits the canvas. Marks the document
    /// dirty so the next save includes the reopened tab. Throws when the
    /// snapshot fails the core's hydration validation.
    @discardableResult
    func openSnapshot(_ snapshot: TabSnapshot) throws -> TabState {
        resolveOutgoingStroke(nextIndex: tabs.count)
        // A document reopened in the same session must fit again: closed
        // tabs' ids linger in `fittedTabIds`, and a lingering entry would
        // defeat the reset-view contract above (the web is immune — its
        // fitted set is keyed by tab object, recreated on reopen).
        fittedTabIds.remove(snapshot.id)
        let tab = try TabState(
            restoring: snapshot,
            shared: shared,
            notifier: notifier,
            isConstrainHeld: { [weak self] in
                guard let self else { return false }
                return self.isShiftKeyHeld || self.isConstrainLatchOn
            },
            consumePendingToolRestore: { [weak self] in
                self?.keyboardShortcuts.consumePendingToolRestore()
            }
        )
        tabs.append(tab)
        activeTabIndex = tabs.count - 1
        notifier.markDirty(documentId: tab.documentId)
        return tab
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
        let removed = tabs.remove(at: index)
        if index == activeTabIndex {
            activeTabIndex = min(index, tabs.count - 1)
        } else if index < activeTabIndex {
            activeTabIndex -= 1
        }
        notifier.notifyTabRemoved(documentId: removed.documentId)
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

    // MARK: - Canvas presentation

    /// Tabs whose canvas has been fitted once (web parity: `fittedTabs` in
    /// `+page.svelte`) — a revisited tab keeps its own zoom/pan instead of
    /// refitting. Ids of closed tabs linger harmlessly (they are never
    /// reused). Transient by design: never persisted.
    private var fittedTabIds: Set<String> = []

    /// Adopts the canvas area's device size for the active tab: fits the
    /// canvas the first time a tab is shown; afterwards the tab keeps its
    /// own zoom/pan, with the pan reclamped against the new area (web
    /// parity: `initTabViewport` in `+page.svelte` — fit once per tab,
    /// reclamp ever after). The canvas host calls this on appear, on
    /// canvas-area size changes (window resize, Timeline collapse), and on
    /// active-tab switch.
    func presentActiveTab(in deviceSize: ViewportSize) {
        let tab = activeTab
        tab.viewportSize = deviceSize
        if fittedTabIds.insert(tab.documentId).inserted {
            tab.handleFit()
        } else {
            tab.handleViewportChange(tab.viewport)
        }
    }

    // MARK: - Persistence

    /// Captures the whole workspace as a persistence value (web parity:
    /// `Workspace.toSnapshot` in `workspace.svelte.ts`): every tab in tab
    /// order, the active tab index, and the shared state.
    func toSnapshot() -> WorkspaceSnapshot {
        WorkspaceSnapshot(
            tabs: tabs.map { $0.toSnapshot() },
            activeTabIndex: activeTabIndex,
            sharedState: SharedStateSnapshot(
                activeTool: shared.activeTool,
                foregroundColor: shared.foregroundColor,
                backgroundColor: shared.backgroundColor,
                recentColors: shared.recentColors,
                pixelPerfect: shared.pixelPerfect
            )
        )
    }

    // MARK: - Tools

    /// Activates a tool the way a toolbar tap does (web parity: `activateTool`
    /// in `tool-ui.ts`): re-activating the already-active constrainable tool
    /// toggles the Constrain latch; anything else selects the tool.
    func activateTool(_ tool: EditorTool) {
        if tool == shared.activeTool {
            if tool.isConstrainable {
                isConstrainLatchOn.toggle()
            }
            return
        }
        switchActiveTool(to: tool)
    }

    /// The shared transition policy for toolbar and keyboard tool changes.
    /// A same-tool toolbar tap is handled before this seam because only that
    /// input species owns the Constrain-latch gesture.
    private func switchActiveTool(to tool: EditorTool) {
        guard tool != shared.activeTool else { return }
        // A stroke owns the tool session it resolved at begin. Replacing the
        // tool mid-gesture would invalidate that session (most visibly after
        // a Floating Selection commit), so every tool-change input follows
        // the same in-flight no-op policy.
        guard !activeTab.isDrawing else { return }
        guard activeTab.floatingSelectionOffset == nil
                || activeTab.commitFloatingSelection()
        else { return }
        shared.activeTool = tool
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
            notifier: notifier,
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

/// Restore-side failures owned by the workspace itself, before any record
/// reaches the core's hydration validation.
enum WorkspaceRestoreError: Error {
    /// The snapshot holds no tabs — unrepresentable as a workspace.
    case emptySnapshot
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
        switchActiveTool(to: tool)
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
