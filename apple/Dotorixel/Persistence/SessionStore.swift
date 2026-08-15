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

/// A Reference Layer Placement in stored form. `rotation` is the persisted
/// quarter-turn count (`0...3`); nothing on this shell produces a non-zero
/// value yet, but the field keeps rotated documents representable (web
/// schema parity).
struct StoredReferencePlacement: Codable, Equatable {
    var x: Float
    var y: Float
    var scale: Float
    var rotation: Int
}

/// The singleton Reference Layer's stored form: display fields, the
/// PNG-compressed source with its natural dimensions (web parity: the
/// blob approach), and the placement. Optional on `DocumentRecord`, so
/// stores written before reference persistence restore reference-free.
struct StoredReference: Codable, Equatable {
    var id: String
    var name: String
    var visible: Bool
    var opacity: Float
    /// The RGBA source losslessly PNG-encoded (web parity: `sourceBlob`) —
    /// decode must reproduce the imported buffer bit-for-bit.
    var sourcePng: Data
    var naturalWidth: Int
    var naturalHeight: Int
    var placement: StoredReferencePlacement
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

/// A Document's persisted Marquee. Optional on `DocumentRecord` so stores
/// written before Marquee persistence restore as having no selection.
struct StoredMarquee: Codable, Equatable {
    var x: Int
    var y: Int
    var width: Int
    var height: Int
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

/// What the saved-work browser shows per saved document (web parity:
/// `SavedDocumentSummary`): identity, display name, dimensions, the export
/// composite for the thumbnail, and the last update time.
struct SavedDocumentSummary: Equatable {
    let id: String
    let name: String
    let width: UInt32
    let height: UInt32
    /// RGBA row-major export composite (`width * height * 4` bytes).
    let pixels: Data
    let updatedAt: Date
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
    /// The Pixel Layer stack in stack order (bottom first).
    var layers: [StoredLayer]
    /// The singleton Reference Layer; `nil` when the document carries none
    /// (including every record written before reference persistence).
    var reference: StoredReference?
    var activeLayerId: String
    var nextLayerNumber: Int
    var marquee: StoredMarquee?
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
        reference: StoredReference? = nil,
        activeLayerId: String,
        nextLayerNumber: Int,
        marquee: StoredMarquee? = nil,
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
        self.reference = reference
        self.activeLayerId = activeLayerId
        self.nextLayerNumber = nextLayerNumber
        self.marquee = marquee
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
