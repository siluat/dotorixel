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
}

/// Memoizes the frame projection for one `(document, canvasVersion)` pair.
///
/// Occupancy is the expensive part — the binding scans every Pixel Layer's cel
/// buffer per frame — while the panel re-reads the projection on every render,
/// including each sample of a live stroke. One entry is enough: a version bump
/// invalidates it, and nothing reads two versions at once (web parity:
/// `#frameProjectionCache` in `tab-state.svelte.ts`).
final class FrameProjectionCache {
    private var cachedKey: Key?
    private var cachedColumns: [FrameColumn] = []

    private struct Key: Equatable {
        let document: ObjectIdentifier
        let canvasVersion: Int
    }

    func columns(
        for document: AppleDocument,
        canvasVersion: Int,
        load: () -> [FrameColumn]
    ) -> [FrameColumn] {
        let key = Key(document: ObjectIdentifier(document), canvasVersion: canvasVersion)
        if cachedKey == key {
            return cachedColumns
        }
        cachedColumns = load()
        cachedKey = key
        return cachedColumns
    }
}
