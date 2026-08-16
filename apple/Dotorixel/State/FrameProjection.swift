import Foundation

/// One frame projected into the timeline ruler's read model (web parity:
/// `DocumentFrameRead` in `document-frame-projection.ts`). A Frame is
/// identity-only, so this carries its `id`, its playback `durationMs`, and the
/// Pixel Layers whose Cel at this frame is content-bearing — the grid draws an
/// occupancy dot for each. The 1-based ordinal a column shows is its index + 1.
struct FrameColumn: Equatable {
    let id: String
    let durationMs: UInt32
    let occupiedLayerIds: Set<String>

    /// The same column with one layer's occupancy replaced — how a single-Cel
    /// re-probe folds back into a loaded projection.
    func settingOccupancy(of layerId: String, to isOccupied: Bool) -> FrameColumn {
        var ids = occupiedLayerIds
        if isOccupied {
            ids.insert(layerId)
        } else {
            ids.remove(layerId)
        }
        return FrameColumn(id: id, durationMs: durationMs, occupiedLayerIds: ids)
    }
}

/// One Cel's address on the timeline grid — where a layer crosses a frame.
struct CelAddress: Equatable {
    let frameId: String
    let layerId: String
}

/// Memoizes the frame projection for one `(document, canvasVersion)` pair.
///
/// Occupancy is the expensive part — the binding scans every Pixel Layer's cel
/// buffer per frame — while the panel re-reads the projection on every render,
/// including each sample of a live stroke. One entry is enough: a version bump
/// invalidates it, and nothing reads two versions at once (web parity:
/// `#frameProjectionCache` in `tab-state.svelte.ts`).
///
/// A version bump under a live stroke is the one bump that does *not* mean a
/// full rescan. The mid-stroke seal keeps every other mutator out while a
/// stroke runs, so the stroke's own Cel is the only one whose occupancy can
/// have changed — the caller names it, and the cached projection is patched
/// from a single-Cel probe instead of `O(layers × frames × pixels)` of rescan
/// on the pointer path.
final class FrameProjectionCache {
    private var cachedKey: Key?
    private var cachedColumns: [FrameColumn] = []

    private struct Key: Equatable {
        let document: ObjectIdentifier
        let canvasVersion: Int
    }

    /// The projection at `canvasVersion`, loaded, patched, or served as cached.
    ///
    /// - Parameters:
    ///   - liveStrokeCel: the only Cel whose occupancy can have changed since
    ///     the cached version, or `nil` when any of them can have. Naming a Cel
    ///     is what buys the patch path; anything else reloads.
    ///   - load: reads the whole axis, occupancy included.
    ///   - probe: reads one Cel's occupancy.
    func columns(
        for document: AppleDocument,
        canvasVersion: Int,
        liveStrokeCel: CelAddress?,
        load: () -> [FrameColumn],
        probe: (CelAddress) -> Bool
    ) -> [FrameColumn] {
        let key = Key(document: ObjectIdentifier(document), canvasVersion: canvasVersion)
        if cachedKey == key {
            return cachedColumns
        }
        // The patch needs a projection of this same document to edit: a first
        // read mid-stroke, or one addressing a frame the cached axis does not
        // carry, has nothing to patch and falls back to the full scan.
        if let cel = liveStrokeCel,
           cachedKey?.document == key.document,
           let columnIndex = cachedColumns.firstIndex(where: { $0.id == cel.frameId }) {
            cachedColumns[columnIndex] = cachedColumns[columnIndex]
                .settingOccupancy(of: cel.layerId, to: probe(cel))
        } else {
            cachedColumns = load()
        }
        cachedKey = key
        return cachedColumns
    }
}
