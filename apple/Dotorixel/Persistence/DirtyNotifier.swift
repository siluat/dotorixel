/// Port that the state layers (`Workspace`, `TabState`, `SharedState`) use
/// to signal that persistable state changed (web parity: `DirtyNotifier` in
/// `dirty-notifier.ts`). Implementations decide how to react — production
/// debounces through `AutoSave`; tests record.
protocol DirtyNotifier {
    /// A document's persistable state changed.
    func markDirty(documentId: String)
    /// A document's tab closed; its record must not be rewritten.
    func notifyTabRemoved(documentId: String)
}

/// The default notifier for workspaces opened without persistence wiring
/// (previews, tests): every signal is dropped.
struct NoOpDirtyNotifier: DirtyNotifier {
    func markDirty(documentId: String) {}
    func notifyTabRemoved(documentId: String) {}
}
