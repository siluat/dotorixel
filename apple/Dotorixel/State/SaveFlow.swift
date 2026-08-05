import Foundation

/// Coordinates the explicit keep/discard layer on top of session
/// persistence (web parity: the close-tab and saved-work handlers in
/// `+page.svelte`): the close-tab save dialog and the saved-work browser.
/// Owns the presentation state those surfaces bind to; the store work runs
/// through `SessionPersistence` and the injected session flush.
///
/// Every operation is keyed by document id, never a tab position: the tab
/// collection can mutate across this flow's awaits (a second close tap, a
/// close racing the dialog), so positions are resolved fresh at each
/// mutation point and a vanished document resolves as a no-op.
///
/// Rebuilt by `AppSession` whenever the workspace is (launch restore) —
/// its references are direct, never stale.
@MainActor
@Observable
final class SaveFlow {

    /// The close-tab save dialog's pending request: which document's close
    /// is waiting on the user's keep/discard choice, and the name field's
    /// prefill (the tab's display name).
    struct PendingSave: Equatable {
        let documentId: String
        let documentName: String
    }

    /// Non-nil while the close-tab save dialog is presented.
    private(set) var pendingSave: PendingSave?

    private let workspace: Workspace
    /// `nil` when the store failed to open — the editor runs without
    /// persistence, and every close falls through to the dialog's
    /// keep-nothing branches (web parity: the no-op session handle).
    private let persistence: SessionPersistence?
    /// Persists pending auto-save state immediately and reports whether the
    /// write stuck (production: `AutoSave.flush` + its restored-dirty state,
    /// via `AppSession`). Run before store reads and tab closes so decisions
    /// see the live workspace; `false` means the store rejected the write,
    /// and destructive follow-ups must not proceed over the stale record.
    private let flush: () async -> Bool

    init(
        workspace: Workspace,
        persistence: SessionPersistence?,
        flush: @escaping () async -> Bool
    ) {
        self.workspace = workspace
        self.persistence = persistence
        self.flush = flush
    }

    // MARK: - Close-tab decision

    /// Routes a tab-close request (web parity: `handleCloseTab`): a saved
    /// document closes immediately, a blank one has nothing worth keeping,
    /// and anything else waits on the save dialog's three-way choice.
    /// No-ops while the browser is presented — the two surfaces share one
    /// presentation host and must not coexist.
    func requestCloseTab(documentId: String) async {
        guard browserDocuments == nil, workspace.canCloseTab,
              let tab = tab(for: documentId) else { return }
        if await persistence?.isDocumentSaved(id: documentId) ?? false {
            await closeTab(documentId: documentId)
        } else if tab.isDocumentBlank() {
            await closeTab(documentId: documentId)
        } else {
            // Re-resolved after the await: the tab may have closed — or the
            // browser opened — while the saved flag was read.
            guard browserDocuments == nil,
                  let currentTab = self.tab(for: documentId) else { return }
            pendingSave = PendingSave(documentId: documentId, documentName: currentTab.name)
        }
    }

    /// Closes the document's tab between two flushes. The one before
    /// persists the document's latest content while its tab is still in the
    /// snapshot — and must stick: closing over a failed write would strand
    /// the latest edits in a stale record. The one after brings the stored
    /// tab order in line with the close — left stale, a termination before
    /// the next debounced save would resurrect the closed tab on relaunch.
    private func closeTab(documentId: String) async {
        guard await flush() else { return }
        // Re-resolved after the await — and the browser may have opened
        // while the flush ran: an in-flight close must not mutate the tabs
        // under its presented sheet (the dialog branch's same re-check).
        guard browserDocuments == nil,
              let index = tabIndex(of: documentId) else { return }
        workspace.closeTab(index)
        _ = await flush()
    }

    // MARK: - Save dialog resolution

    /// The dialog's keep branch (web parity: `handleSaveDialogSave`): the
    /// flush writes the document's latest content, the explicit save marks
    /// it kept under `name`, and the tab closes. The close is gated on the
    /// save having stuck — closing anyway would hand the document to the
    /// closed-tab cleanup, deleting work the user chose to keep. On failure
    /// the dialog dismisses and the tab stays open.
    func confirmSave(name: String) async {
        guard let pending = takePendingSave() else { return }
        // The flush must stick before the keep: `saveDocumentAs` on a stale
        // record would mark content saved that is missing the latest edits.
        guard await flush() else { return }
        if let persistence {
            try? await persistence.saveDocumentAs(id: pending.documentId, name: name)
            guard await persistence.isDocumentSaved(id: pending.documentId) else { return }
        }
        if let index = tabIndex(of: pending.documentId) {
            workspace.closeTab(index)
            _ = await flush()
        }
    }

    /// The dialog's discard branch (web parity: `handleSaveDialogDelete`):
    /// the tab closes and the document's record is dropped immediately. The
    /// trailing flush rewrites the stored tab order — left stale, it would
    /// reference the deleted record and the whole session would fail its
    /// next restore.
    func confirmDelete() async {
        guard let pending = takePendingSave() else { return }
        if let index = tabIndex(of: pending.documentId) {
            workspace.closeTab(index)
        }
        try? await persistence?.deleteDocument(id: pending.documentId)
        _ = await flush()
    }

    /// The dialog's cancel branch: dismisses, everything untouched.
    func cancelSave() {
        pendingSave = nil
    }

    /// Consumes the pending request. Tab existence is not checked here —
    /// each branch resolves the document's current position itself and
    /// no-ops when it vanished.
    private func takePendingSave() -> PendingSave? {
        defer { pendingSave = nil }
        return pendingSave
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
    /// the listing reflects the live session. No-ops if the save dialog was
    /// requested during the awaits — the two surfaces share one
    /// presentation host and must not coexist.
    func openBrowser() async {
        // A failed flush only staled the listing — browsing is not
        // destructive, so the result is not gated on.
        _ = await flush()
        let summaries = await persistence?.savedDocumentSummaries() ?? []
        guard pendingSave == nil else { return }
        let openIds = Set(workspace.tabs.map(\.documentId))
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
        let snapshot = await persistence?.savedDocumentSnapshot(id: id)
        // Re-checked after the await (web parity: the `openingId` re-check):
        // the browser may have closed, or the card been deleted, while the
        // snapshot loaded — opening then would resurrect the document.
        guard browserDocuments?.contains(where: { $0.id == id }) == true else { return }
        guard let snapshot, (try? workspace.openSnapshot(snapshot)) != nil else {
            browserDocuments?.removeAll { $0.id == id }
            return
        }
        browserDocuments = nil
    }

    /// Deletes a saved document permanently (web parity:
    /// `handleSavedWorkDelete`). The card leaves the presented list only
    /// when the store delete went through — dropping it on a failed delete
    /// would show the document gone while its record remains.
    func deleteSavedDocument(id: String) async {
        guard (try? await persistence?.deleteDocument(id: id)) != nil else { return }
        browserDocuments?.removeAll { $0.id == id }
    }

    // MARK: - Tab resolution

    private func tab(for documentId: String) -> TabState? {
        workspace.tabs.first { $0.documentId == documentId }
    }

    private func tabIndex(of documentId: String) -> Int? {
        workspace.tabs.firstIndex { $0.documentId == documentId }
    }
}
