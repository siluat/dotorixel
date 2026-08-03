import Foundation
import SwiftData

// The SwiftData session schema (web parity: the record types in
// `session-storage-types.ts`). Stored value types are `Codable` structs —
// SwiftData persists them as composites — kept separate from the in-memory
// snapshot types so the stored format can only change deliberately: a field
// added to a snapshot type does not silently change what is on disk.

/// One Pixel Layer's stored form: the `AppleLayerSnapshot` fields with the
/// pixel buffer as `Data`.
struct StoredLayer: Codable, Equatable {
    var id: String
    var name: String
    var visible: Bool
    var opacity: Float
    var pixels: Data
}

/// RGBA color in stored form.
struct StoredColor: Codable, Equatable {
    var r: UInt8
    var g: UInt8
    var b: UInt8
    var a: UInt8
}

/// A tab's persisted viewport in stored form.
struct StoredViewport: Codable, Equatable {
    var pixelSize: Int
    var zoom: Double
    var panX: Double
    var panY: Double
    var showGrid: Bool
}

/// The shared slots in stored form. `activeTool` is the `EditorTool` raw
/// value; an unknown value (a case renamed without migration) restores as
/// the default tool rather than corrupting the whole session.
struct StoredSharedState: Codable, Equatable {
    var activeTool: String
    var foregroundColor: StoredColor
    var backgroundColor: StoredColor
    var recentColors: [StoredColor]
    var pixelPerfect: Bool
}

/// Per-document record (web parity: `DocumentRecord`). `saved` is written
/// `false` until the save dialog (issue 266) gives it meaning; the
/// tab-close cleanup already respects it.
@Model
final class DocumentRecord {
    @Attribute(.unique) var id: String
    var name: String
    var width: Int
    var height: Int
    /// The layer stack in stack order (bottom first).
    var layers: [StoredLayer]
    var activeLayerId: String
    var nextLayerNumber: Int
    var timelinePanelCollapsed: Bool
    var saved: Bool
    var createdAt: Date
    var updatedAt: Date

    init(
        id: String,
        name: String,
        width: Int,
        height: Int,
        layers: [StoredLayer],
        activeLayerId: String,
        nextLayerNumber: Int,
        timelinePanelCollapsed: Bool,
        saved: Bool,
        createdAt: Date,
        updatedAt: Date
    ) {
        self.id = id
        self.name = name
        self.width = width
        self.height = height
        self.layers = layers
        self.activeLayerId = activeLayerId
        self.nextLayerNumber = nextLayerNumber
        self.timelinePanelCollapsed = timelinePanelCollapsed
        self.saved = saved
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// The singleton workspace record (web parity: `WorkspaceRecord`, id
/// `"current"`): tab order, active tab, shared state, and each tab's
/// viewport keyed by document id.
@Model
final class WorkspaceRecord {
    @Attribute(.unique) var id: String
    var tabOrder: [String]
    var activeTabIndex: Int
    var sharedState: StoredSharedState
    var viewports: [String: StoredViewport]

    /// The one id `SessionPersistence` reads and writes.
    static let singletonId = "current"

    init(
        id: String = WorkspaceRecord.singletonId,
        tabOrder: [String],
        activeTabIndex: Int,
        sharedState: StoredSharedState,
        viewports: [String: StoredViewport]
    ) {
        self.id = id
        self.tabOrder = tabOrder
        self.activeTabIndex = activeTabIndex
        self.sharedState = sharedState
        self.viewports = viewports
    }
}
