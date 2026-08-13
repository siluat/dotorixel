import Foundation

/// Display-space rectangle for a Reference underlay after viewport projection.
struct ReferenceLayerUnderlayRect: Equatable {
    let left: Float
    let top: Float
    let width: Float
    let height: Float
}

/// Complete Metal input for one visible Reference after combining the core's
/// placement footprint with the live viewport. Tests exercise this same value
/// that the renderer consumes rather than a parallel coordinate oracle.
struct ReferenceLayerRenderProjection: Equatable {
    let sourceKey: String
    let sourceRgba: Data
    let naturalWidth: UInt32
    let naturalHeight: UInt32
    let viewportRect: ReferenceLayerUnderlayRect
    let opacity: Float
    let rotation: UInt32
}

/// Immutable source payload cached at the Swift boundary. Reference pixels do
/// not change in place: import/replace creates a new Layer id, so identity is a
/// complete invalidation key while placement and visibility remain live reads.
struct ReferenceLayerSource: Equatable {
    let id: String
    let rgba: Data
    let width: UInt32
    let height: UInt32
}

/// Avoids repeating the UniFFI `Vec<u8>` → `Data` copy on every SwiftUI canvas
/// update. Keeps only the current source; undo/redo or replacement naturally
/// misses by Layer id, and whole-Document replacement clears it explicitly.
final class ReferenceLayerSourceCache {
    private var cachedSource: ReferenceLayerSource?

    func source(
        for id: String,
        load: () -> ReferenceLayerSource?
    ) -> ReferenceLayerSource? {
        if cachedSource?.id == id {
            return cachedSource
        }
        let source = load()
        cachedSource = source
        return source
    }

    func clear() {
        cachedSource = nil
    }
}

/// Shell-facing projection of the visible singleton Reference Layer. The
/// source stays outside the Pixel composite and crosses into Metal as its own
/// texture, preserving the original image for viewport rendering.
struct ReferenceLayerUnderlay: Equatable {
    let sourceKey: String
    let sourceRgba: Data
    let naturalWidth: UInt32
    let naturalHeight: UInt32
    let placement: AppleReferencePlacement
    let footprint: AppleReferenceFootprint
    let opacity: Float

    func projectForRendering(
        effectivePixelSize: Float,
        panX: Float,
        panY: Float
    ) -> ReferenceLayerRenderProjection {
        ReferenceLayerRenderProjection(
            sourceKey: sourceKey,
            sourceRgba: sourceRgba,
            naturalWidth: naturalWidth,
            naturalHeight: naturalHeight,
            viewportRect: ReferenceLayerUnderlayRect(
                left: panX.rounded() + footprint.minX * effectivePixelSize,
                top: panY.rounded() + footprint.minY * effectivePixelSize,
                width: (footprint.maxX - footprint.minX) * effectivePixelSize,
                height: (footprint.maxY - footprint.minY) * effectivePixelSize
            ),
            opacity: min(max(opacity, 0), 1),
            rotation: UInt32(placement.rotation % 4)
        )
    }
}
