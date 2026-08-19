// Value snapshots of the workspace for session persistence (web parity:
// `WorkspaceSnapshot` / `TabSnapshot` in `workspace-snapshot.ts`).
// "Snapshot" here is the persistence vocabulary — the full state a session
// store writes and restores — distinct from the History `Snapshot` (the
// undo/redo value type). Layers reuse the UniFFI `AppleLayerSnapshot`
// record, the same shape the hydration constructor consumes.

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

/// One tab's full persistence record — the document parts the hydration
/// constructor consumes plus the tab-scoped presentation state.
struct TabSnapshot {
    let id: String
    let name: String
    let width: UInt32
    let height: UInt32
    /// The Pixel Layer stack in stack order (bottom first), each layer
    /// carrying one Cel per frame (and its active-frame buffer in `pixels`).
    let layers: [AppleLayerSnapshot]
    /// The frame axis in order (id + display duration) with its active
    /// pointer. `nil` when the stored record predates animation persistence —
    /// hydration then restores a one-frame document from each layer's
    /// `pixels`. Reuses the UniFFI `AppleFrameMetadata` record, the shape the
    /// hydration constructor consumes (the `AppleLayerSnapshot` precedent).
    let frames: [AppleFrameMetadata]?
    let activeFrameId: String?
    /// The singleton Reference Layer with its source buffer, placement, and
    /// display state; `nil` when the document carries none.
    let reference: AppleReferenceLayerSnapshot?
    let activeLayerId: String
    let nextLayerNumber: UInt32
    let marquee: AppleMarqueeRegion?
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
