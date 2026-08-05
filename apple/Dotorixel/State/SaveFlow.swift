import Foundation

/// Coordinates the explicit keep/discard layer on top of session
/// persistence (web parity: the close-tab and saved-work handlers in
/// `+page.svelte`): the close-tab save dialog and the saved-work browser.
/// Owns the presentation state those surfaces bind to; the store work runs
/// through `SessionPersistence` and the injected session flush.
///
/// Rebuilt by `AppSession` whenever the workspace is (launch restore) —
/// its references are direct, never stale.
@MainActor
@Observable
final class SaveFlow {

    /// The close-tab save dialog's pending request: which tab close is
    /// waiting on the user's keep/discard choice, and the name field's
    /// prefill (the tab's display name).
    struct PendingSave: Equatable {
        let tabIndex: Int
        let documentName: String
    }

    /// Non-nil while the close-tab save dialog is presented.
    private(set) var pendingSave: PendingSave?

    private let workspace: Workspace
    /// `nil` when the store failed to open — the editor runs without
    /// persistence, and every close falls through to the dialog's
    /// keep-nothing branches (web parity: the no-op session handle).
    private let persistence: SessionPersistence?
    /// Persists pending auto-save state immediately (production:
    /// `AutoSave.flush` via `AppSession`) — run before store reads and tab
    /// closes so decisions see the live workspace, not a stale store.
    private let flush: () async -> Void

    init(
        workspace: Workspace,
        persistence: SessionPersistence?,
        flush: @escaping () async -> Void
    ) {
        self.workspace = workspace
        self.persistence = persistence
        self.flush = flush
    }

    // MARK: - Close-tab decision

    /// Routes a tab-close request (web parity: `handleCloseTab`): a saved
    /// document closes immediately, a blank one has nothing worth keeping,
    /// and anything else waits on the save dialog's three-way choice.
    func requestCloseTab(_ index: Int) async {
        guard workspace.canCloseTab, workspace.tabs.indices.contains(index) else { return }
        let tab = workspace.tabs[index]
        if await persistence?.isDocumentSaved(id: tab.documentId) ?? false {
            await closeTabImmediately(index)
        } else if tab.isDocumentBlank() {
            await closeTabImmediately(index)
        } else {
            pendingSave = PendingSave(tabIndex: index, documentName: tab.name)
        }
    }

    /// Flushes pending session state, then closes the tab — the store's
    /// closed-tab cleanup runs against the live workspace on the next save.
    private func closeTabImmediately(_ index: Int) async {
        await flush()
        workspace.closeTab(index)
    }

    // MARK: - Save dialog resolution

    /// The dialog's keep branch (web parity: `handleSaveDialogSave`): the
    /// flush writes the document's latest content, the explicit save marks
    /// it kept under `name`, and the tab closes.
    func confirmSave(name: String) async {
        guard let pending = takeValidPendingSave() else { return }
        let docId = workspace.tabs[pending.tabIndex].documentId
        await flush()
        try? await persistence?.saveDocumentAs(id: docId, name: name)
        workspace.closeTab(pending.tabIndex)
    }

    /// The dialog's discard branch (web parity: `handleSaveDialogDelete`):
    /// the tab closes and the document's record is dropped immediately.
    func confirmDelete() async {
        guard let pending = takeValidPendingSave() else { return }
        let docId = workspace.tabs[pending.tabIndex].documentId
        workspace.closeTab(pending.tabIndex)
        try? await persistence?.deleteDocument(id: docId)
    }

    /// The dialog's cancel branch: dismisses, everything untouched.
    func cancelSave() {
        pendingSave = nil
    }

    // MARK: - Saved work browser

    /// The documents the saved-work browser lists — `nil` while the browser
    /// is closed, empty when nothing qualifies (the empty state).
    private(set) var browserDocuments: [SavedDocumentSummary]?

    /// Re-entrancy guard for `selectSavedDocument` (web parity: the
    /// `openingId` guard): a second tap while the first snapshot loads must
    /// not open the document twice.
    private var isOpeningSavedDocument = false

    /// Presents the browser (web parity: `handleBrowseSavedWork`): saved
    /// documents excluding those already open in a tab, after a flush so
    /// the listing reflects the live session.
    func openBrowser() async {
        await flush()
        let openIds = Set(workspace.tabs.map(\.documentId))
        let summaries = await persistence?.savedDocumentSummaries() ?? []
        browserDocuments = summaries.filter { !openIds.contains($0.id) }
    }

    func closeBrowser() {
        browserDocuments = nil
    }

    /// Reopens a saved document in a new active tab and closes the browser
    /// (web parity: `handleSavedWorkSelect`). A record that vanished — or
    /// fails hydration — is dropped from the list instead, and the browser
    /// stays open.
    func selectSavedDocument(id: String) async {
        guard browserDocuments != nil, !isOpeningSavedDocument else { return }
        isOpeningSavedDocument = true
        defer { isOpeningSavedDocument = false }
        guard let snapshot = await persistence?.savedDocumentSnapshot(id: id),
              (try? workspace.openSnapshot(snapshot)) != nil else {
            browserDocuments?.removeAll { $0.id == id }
            return
        }
        browserDocuments = nil
    }

    /// Deletes a saved document permanently (web parity:
    /// `handleSavedWorkDelete`) and drops it from the presented list.
    func deleteSavedDocument(id: String) async {
        try? await persistence?.deleteDocument(id: id)
        browserDocuments?.removeAll { $0.id == id }
    }

    /// Consumes the pending request, bounds-checked at resolution time —
    /// the strip can change between request and choice (the TabStrip alert's
    /// confirm-time guard, moved with the flow).
    private func takeValidPendingSave() -> PendingSave? {
        defer { pendingSave = nil }
        guard let pending = pendingSave,
              workspace.tabs.indices.contains(pending.tabIndex) else { return nil }
        return pending
    }
}
