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

/// A stroke in progress: the Cel it paints into, and the `canvasVersion` it
/// began at. The version is what makes the Cel a *complete* account of what has
/// changed — see `FrameProjectionCache.columns`.
struct LiveStroke: Equatable {
    let cel: CelAddress
    let startedAtVersion: Int
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
///
/// That reasoning covers only the stroke's own span, so the patch also demands
/// a cached read no older than the stroke: nothing reads the projection while
/// the Timeline is collapsed, and the edits made in that gap are not the
/// stroke's to account for.
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
    ///   - liveStroke: the stroke in progress, or `nil` while none is. Its Cel
    ///     accounts for every change since the cached version only when the
    ///     cached read is no older than the stroke — see the patch conditions
    ///     below. Anything else reloads.
    ///   - load: reads the whole axis, occupancy included.
    ///   - probe: reads one Cel's occupancy.
    func columns(
        for document: AppleDocument,
        canvasVersion: Int,
        liveStroke: LiveStroke?,
        load: () -> [FrameColumn],
        probe: (CelAddress) -> Bool
    ) -> [FrameColumn] {
        let key = Key(document: ObjectIdentifier(document), canvasVersion: canvasVersion)
        if cachedKey == key {
            return cachedColumns
        }
        // Three conditions make the stroke's Cel the whole diff:
        //
        // - the cached projection is of this same document,
        // - it was read no earlier than the stroke began, so every version
        //   since is one of this stroke's samples. A projection older than the
        //   stroke is missing edits nothing was reading at the time — a
        //   collapsed Timeline renders neither ruler nor grid, and undo can
        //   drop whole frames while it is closed — and patching one Cel would
        //   carry that stale axis forward,
        // - and it carries the column the patch would edit.
        //
        // Any of them failing falls back to the full scan.
        if let stroke = liveStroke,
           let cached = cachedKey,
           cached.document == key.document,
           cached.canvasVersion >= stroke.startedAtVersion,
           let columnIndex = cachedColumns.firstIndex(where: { $0.id == stroke.cel.frameId }) {
            cachedColumns[columnIndex] = cachedColumns[columnIndex]
                .settingOccupancy(of: stroke.cel.layerId, to: probe(stroke.cel))
        } else {
            cachedColumns = load()
        }
        cachedKey = key
        return cachedColumns
    }
}
