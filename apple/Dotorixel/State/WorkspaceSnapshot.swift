// Value snapshots of the workspace for session persistence (web parity:
// `WorkspaceSnapshot` / `TabSnapshot` in `workspace-snapshot.ts`).
// "Snapshot" here is the persistence vocabulary — the full state a session
// store writes and restores — distinct from the History `Snapshot` (the
// undo/redo value type). DocumentSnapshot owns the document content;
// these values add only the workspace and tab presentation around it.

/// A tab's persisted viewport — zoom/pan geometry plus the grid and onion
/// skin flags (web parity: the per-tab viewport record in the workspace
/// store).
struct TabViewportSnapshot: Equatable {
    let pixelSize: UInt32
    let zoom: Double
    let panX: Double
    let panY: Double
    let showGrid: Bool
    let showOnionSkin: Bool
}

/// The workspace-shared slots every tab sees (web parity:
/// `SharedStateRecord`).
struct SharedStateSnapshot {
    let activeTool: EditorTool
    let foregroundColor: Color
    let backgroundColor: Color
    let recentColors: [Color]
    let pixelPerfect: Bool
}

/// One tab's persistence record — preserved Document content plus tab state.
struct TabSnapshot {
    let id: String
    let name: String
    let document: DocumentSnapshot
    let timelinePanelCollapsed: Bool
    let viewport: TabViewportSnapshot
}

/// The whole-workspace persistence record: every tab in tab order, the
/// active tab, and the shared state.
struct WorkspaceSnapshot {
    let tabs: [TabSnapshot]
    let activeTabIndex: Int
    let sharedState: SharedStateSnapshot
}
