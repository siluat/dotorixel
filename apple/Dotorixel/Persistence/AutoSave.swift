import Foundation

/// Debounced session auto-save (web parity: `AutoSave` in
/// `src/lib/session/auto-save.ts`). User mutations mark the workspace dirty
/// — tracking which documents changed so unchanged documents are not
/// rewritten — and a debounced write persists the current snapshot.
/// `flush()` persists immediately, the scenePhase analog of the web's
/// `visibilitychange` / `beforeunload` flush. A failed save restores the
/// dirty state so the next debounce or flush retries it.
///
/// Main-actor bound: dirty marks come from UI mutations and the snapshot
/// getter reads UI state. The injected `save` runs `await`ed off the dirty
/// bookkeeping, so a slow store never blocks marking.
@MainActor
final class AutoSave {
    private let save: (WorkspaceSnapshot, Set<String>?) async throws -> Void
    private let getSnapshot: () -> WorkspaceSnapshot
    private let debounce: Duration

    private var isDirty = false
    private var dirtyDocIds: Set<String> = []
    private var debounceTask: Task<Void, Never>?
    /// Bumped whenever the pending debounce is superseded (a newer mark, a
    /// flush). `Task.cancel` alone can lose the race — a task whose sleep
    /// already resumed would clear its replacement's `debounceTask` and save
    /// before the new debounce window elapsed — so the woken task re-checks
    /// its generation before touching shared state.
    private var debounceGeneration = 0
    /// Tail of the save chain — every save awaits its predecessor, so writes
    /// never interleave and `flush()` returns only after its own save ran.
    private var saveChain: Task<Void, Never>?

    /// Web-parity default debounce (3 s in `auto-save.ts`).
    static let defaultDebounce: Duration = .seconds(3)

    init(
        save: @escaping (WorkspaceSnapshot, Set<String>?) async throws -> Void,
        getSnapshot: @escaping () -> WorkspaceSnapshot,
        debounce: Duration = AutoSave.defaultDebounce
    ) {
        self.save = save
        self.getSnapshot = getSnapshot
        self.debounce = debounce
    }

    /// Marks the workspace dirty — `documentId` names the changed document
    /// so the save rewrites only changed documents — and (re)starts the
    /// debounce window.
    func markDirty(_ documentId: String? = nil) {
        isDirty = true
        if let documentId {
            dirtyDocIds.insert(documentId)
        }
        debounceTask?.cancel()
        debounceGeneration += 1
        let generation = debounceGeneration
        debounceTask = Task {
            _ = try? await Task.sleep(for: debounce)
            // Superseded while sleeping (newer mark or flush) — a stale task
            // must not clear `debounceTask` or save early.
            guard generation == debounceGeneration else { return }
            debounceTask = nil
            await enqueueSave().value
        }
    }

    /// Notes that a document's tab closed: the workspace arrangement is dirty,
    /// but the removed document must not be rewritten (web parity:
    /// `notifyTabRemoved`).
    func notifyTabRemoved(_ documentId: String) {
        markDirty()
        dirtyDocIds.remove(documentId)
    }

    /// Persists any pending changes immediately, returning once the write
    /// finished. No-ops when nothing is dirty.
    func flush() async {
        debounceTask?.cancel()
        debounceGeneration += 1
        debounceTask = nil
        await enqueueSave().value
    }

    /// Appends one save to the chain. Chaining serializes writes and lets a
    /// `flush()` racing a just-elapsed debounce resolve as one real save and
    /// one no-op (the `isDirty` guard) instead of two interleaved writes.
    private func enqueueSave() -> Task<Void, Never> {
        let previous = saveChain
        let task = Task {
            await previous?.value
            await performSave()
        }
        saveChain = task
        return task
    }

    private func performSave() async {
        guard isDirty else { return }
        isDirty = false
        // An empty set is passed through as-is: workspace-only dirt (a tab
        // switch, a shared-slot change) must rewrite no document record.
        // `nil` — rewrite everything — is a caller-level contract this class
        // never sends.
        let dirtyIds = dirtyDocIds
        dirtyDocIds.removeAll()
        do {
            try await save(getSnapshot(), dirtyIds)
        } catch {
            // Restore the dirty state so the next debounce or flush retries.
            isDirty = true
            dirtyDocIds.formUnion(dirtyIds)
        }
    }
}
