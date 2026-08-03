/// Port that the state layers (`Workspace`, `TabState`, `SharedState`) use
/// to signal that persistable state changed (web parity: `DirtyNotifier` in
/// `dirty-notifier.ts`). Implementations decide how to react — production
/// debounces through `AutoSave`; tests record.
protocol DirtyNotifier {
    /// A document's persistable state changed — its record is rewritten on
    /// the next save.
    func markDirty(documentId: String)
    /// Workspace-level persistable state changed (shared slots, tab
    /// arrangement) with no document content changing: the workspace record
    /// is rewritten, no document record is.
    func markWorkspaceDirty()
    /// A document's tab closed; its record must not be rewritten.
    func notifyTabRemoved(documentId: String)
}

/// The default notifier for workspaces opened without persistence wiring
/// (previews, tests): every signal is dropped.
struct NoOpDirtyNotifier: DirtyNotifier {
    func markDirty(documentId: String) {}
    func markWorkspaceDirty() {}
    func notifyTabRemoved(documentId: String) {}
}
