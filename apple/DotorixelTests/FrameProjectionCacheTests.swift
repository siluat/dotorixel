import Foundation
import Testing
@testable import Dotorixel

/// The timeline projection's invalidation policy (issue 285). Occupancy is the
/// expensive read — a cel-buffer scan per `[layer × frame]` — and the panel
/// re-reads the projection on every render, including each sample of a live
/// stroke. These pin *how much* a re-read costs, which the `TabState` frame
/// tests (correctness of what it returns) cannot observe.
@Suite("FrameProjectionCache — occupancy invalidation")
struct FrameProjectionCacheTests {

    private let document = makeSingleLayerDocument(width: 4, height: 4)
    private let frameId = "frame-1"
    private let otherFrameId = "frame-2"
    private let layerId = "layer-1"

    private func columns(occupied: Bool) -> [FrameColumn] {
        [
            FrameColumn(
                id: frameId,
                durationMs: 100,
                occupiedLayerIds: occupied ? [layerId] : []
            ),
            FrameColumn(id: otherFrameId, durationMs: 100, occupiedLayerIds: [layerId])
        ]
    }

    @Test("a repeat read at the same version costs nothing")
    func repeatReadIsServedFromTheCache() {
        let cache = FrameProjectionCache()
        var loadCount = 0

        for _ in 1...3 {
            _ = cache.columns(
                for: document,
                canvasVersion: 1,
                liveStroke: nil,
                load: { loadCount += 1; return columns(occupied: false) },
                probe: { _ in Issue.record("probed without a live stroke"); return false }
            )
        }

        #expect(loadCount == 1)
    }

    @Test("a live stroke's version bump re-probes its own Cel instead of rescanning the axis")
    func liveStrokeReprobesOnlyItsOwnCel() {
        let cache = FrameProjectionCache()
        let strokeCel = CelAddress(frameId: frameId, layerId: layerId)
        var loadCount = 0
        var probedCels: [CelAddress] = []

        _ = cache.columns(
            for: document,
            canvasVersion: 1,
            liveStroke: nil,
            load: { loadCount += 1; return columns(occupied: false) },
            probe: { _ in false }
        )

        // Each sample of the stroke bumps the version. Only the stroke's own
        // Cel can have changed, so the other column — and every other layer on
        // this one — must not be rescanned.
        var read: [FrameColumn] = []
        for version in 2...4 {
            read = cache.columns(
                for: document,
                canvasVersion: version,
                liveStroke: LiveStroke(cel: strokeCel, startedAtVersion: 1),
                load: { loadCount += 1; return columns(occupied: true) },
                probe: { cel in probedCels.append(cel); return true }
            )
        }

        #expect(loadCount == 1)
        #expect(probedCels == Array(repeating: strokeCel, count: 3))
        // The probe's answer reaches the column it addressed…
        #expect(read[0].occupiedLayerIds == [layerId])
        // …and the untouched column keeps the occupancy it was loaded with.
        #expect(read[1].occupiedLayerIds == [layerId])
    }

    @Test("a probe that comes back empty clears the Cel's occupancy")
    func anEmptyProbeClearsTheCelsOccupancy() {
        let cache = FrameProjectionCache()

        _ = cache.columns(
            for: document,
            canvasVersion: 1,
            liveStroke: nil,
            load: { columns(occupied: true) },
            probe: { _ in false }
        )

        // An erasing stroke empties its target Cel: occupancy is a re-read, not
        // a one-way latch.
        let read = cache.columns(
            for: document,
            canvasVersion: 2,
            liveStroke: LiveStroke(
                cel: CelAddress(frameId: frameId, layerId: layerId),
                startedAtVersion: 1
            ),
            load: { Issue.record("rescanned the axis for a live stroke"); return [] },
            probe: { _ in false }
        )

        #expect(read[0].occupiedLayerIds.isEmpty)
    }

    @Test("a stroke that begins before the axis was ever read falls back to a full scan")
    func aFirstReadMidStrokeStillScansTheAxis() {
        let cache = FrameProjectionCache()
        var loadCount = 0

        let read = cache.columns(
            for: document,
            canvasVersion: 1,
            liveStroke: LiveStroke(
                cel: CelAddress(frameId: frameId, layerId: layerId),
                startedAtVersion: 1
            ),
            load: { loadCount += 1; return columns(occupied: true) },
            probe: { _ in Issue.record("patched a projection that was never loaded"); return false }
        )

        #expect(loadCount == 1)
        #expect(read.count == 2)
    }

    @Test("a projection older than the stroke rescans: edits nobody was reading never survive into a patch")
    func aProjectionOlderThanTheStrokeIsRescanned() {
        let cache = FrameProjectionCache()
        var loadCount = 0

        _ = cache.columns(
            for: document,
            canvasVersion: 1,
            liveStroke: nil,
            load: { loadCount += 1; return columns(occupied: false) },
            probe: { _ in false }
        )

        // Versions 2 and 3 changed the document while nothing read the
        // projection — a collapsed Timeline panel renders no ruler and no grid,
        // and undo can drop whole frames while it is closed. The stroke that
        // begins at 3 is not what those versions did, so its patch would carry
        // the stale axis forward.
        let read = cache.columns(
            for: document,
            canvasVersion: 4,
            liveStroke: LiveStroke(
                cel: CelAddress(frameId: frameId, layerId: layerId),
                startedAtVersion: 3
            ),
            load: { loadCount += 1; return columns(occupied: true) },
            probe: { _ in Issue.record("patched a projection older than the stroke"); return false }
        )

        #expect(loadCount == 2)
        #expect(read[0].occupiedLayerIds == [layerId])
    }

    @Test("a structural change rescans even under a live stroke's Cel address")
    func anUnknownFrameFallsBackToAFullScan() {
        let cache = FrameProjectionCache()
        var loadCount = 0

        _ = cache.columns(
            for: document,
            canvasVersion: 1,
            liveStroke: nil,
            load: { loadCount += 1; return columns(occupied: false) },
            probe: { _ in false }
        )

        // The addressed frame is not on the cached axis — the projection the
        // patch would edit does not exist, so the read reloads instead.
        _ = cache.columns(
            for: document,
            canvasVersion: 2,
            liveStroke: LiveStroke(
                cel: CelAddress(frameId: "frame-3", layerId: layerId),
                startedAtVersion: 1
            ),
            load: { loadCount += 1; return columns(occupied: false) },
            probe: { _ in Issue.record("patched a column that is not on the axis"); return false }
        )

        #expect(loadCount == 2)
    }
}
