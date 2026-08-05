import Foundation
import SwiftData
import SwiftUI

/// Owns the editor session's persistence wiring (web parity: `openSession`
/// in `session.ts`): the workspace, the SwiftData store, and the debounced
/// auto-save between them.
///
/// The app starts on a fresh workspace and `start()` swaps in the restored
/// one — SwiftUI's scene body needs a workspace synchronously while the
/// store restore is async. Restore failing (or finding nothing) keeps the
/// fresh workspace; storage failing entirely leaves the session running
/// without persistence (web parity: a no-op session handle).
@MainActor
@Observable
final class AppSession {
    private(set) var workspace: Workspace
    /// The keep/discard flow over the workspace and store (issue 266).
    /// Rebuilt alongside every workspace swap so its references never go
    /// stale; until persistence is armed it runs with a `nil` store.
    private(set) var saveFlow: SaveFlow
    @ObservationIgnored private var autoSave: AutoSave?
    @ObservationIgnored private let notifierProxy = ProxyDirtyNotifier()
    /// Set synchronously at the first `start()` — `autoSave` alone can't
    /// gate re-entry because it is only assigned after the async restore,
    /// and `.task` can re-fire (macOS window reopen) before that completes.
    @ObservationIgnored private var hasStarted = false

    init() {
        let workspace = Workspace(notifier: notifierProxy)
        self.workspace = workspace
        self.saveFlow = SaveFlow(workspace: workspace, persistence: nil, flush: {})
    }

    /// Restores the stored session and arms auto-save. Called from the
    /// scene's `.task`; only the first call runs. Mutations before
    /// persistence is armed are dropped (they either belong to the
    /// pre-restore workspace this replaces, or re-mark on the next
    /// mutation).
    func start() {
        guard !hasStarted else { return }
        hasStarted = true
        let persistence: SessionPersistence
        do {
            let container = try ModelContainer(
                for: DocumentRecord.self, WorkspaceRecord.self
            )
            persistence = SessionPersistence(modelContainer: container)
        } catch {
            // No store, no persistence — the editor still works (web
            // parity: the no-op session handle).
            return
        }

        Task {
            if let snapshot = await persistence.restore(),
               let restored = try? Workspace(restoring: snapshot, notifier: notifierProxy) {
                workspace = restored
            }
            let autoSave = AutoSave(
                save: { try await persistence.save($0, dirtyDocIds: $1) },
                getSnapshot: { [weak self] in
                    guard let self else {
                        preconditionFailure("AutoSave outlived its AppSession")
                    }
                    return self.workspace.toSnapshot()
                }
            )
            self.autoSave = autoSave
            // Armed only after the restored workspace is in place, so
            // hydration never reaches the store as a save.
            notifierProxy.target = AutoSaveDirtyNotifier(autoSave: autoSave)
            // The flow follows the (possibly swapped) workspace and gains
            // the armed store + flush.
            self.saveFlow = SaveFlow(
                workspace: workspace,
                persistence: persistence,
                flush: { await autoSave.flush() }
            )
        }
    }

    /// Persists pending changes immediately — the scenePhase analog of the
    /// web's `visibilitychange` / `beforeunload` flush.
    func flush() async {
        await autoSave?.flush()
    }
}

/// Bridges the `DirtyNotifier` port onto `AutoSave` (web parity:
/// `createAutoSaveDirtyNotifier`).
///
/// Dirty marks originate from UI mutations, which run on the main actor;
/// `assumeIsolated` makes that contract explicit at the port boundary.
private struct AutoSaveDirtyNotifier: DirtyNotifier {
    let autoSave: AutoSave

    func markDirty(documentId: String) {
        MainActor.assumeIsolated { autoSave.markDirty(documentId) }
    }

    func markWorkspaceDirty() {
        MainActor.assumeIsolated { autoSave.markDirty() }
    }

    func notifyTabRemoved(documentId: String) {
        MainActor.assumeIsolated { autoSave.notifyTabRemoved(documentId) }
    }
}

/// A notifier whose destination can be armed after the workspace exists —
/// the workspace takes its notifier at init, but auto-save can only be
/// built once the (async-restored) workspace is in place. Signals before
/// arming are dropped by design (see `AppSession.start`).
private final class ProxyDirtyNotifier: DirtyNotifier {
    var target: DirtyNotifier?

    func markDirty(documentId: String) {
        target?.markDirty(documentId: documentId)
    }

    func markWorkspaceDirty() {
        target?.markWorkspaceDirty()
    }

    func notifyTabRemoved(documentId: String) {
        target?.notifyTabRemoved(documentId: documentId)
    }
}
