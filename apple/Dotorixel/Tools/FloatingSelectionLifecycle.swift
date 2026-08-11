import Foundation

/// The document operations one tab's Floating Selection lifecycle owns.
/// Keeping this surface narrow isolates the shell orchestration from the
/// generated UniFFI object and gives boundary failures a direct test seam.
protocol FloatingSelectionDocument: AnyObject {
    func activeLayerId() -> String
    func setActiveLayer(id: String) throws
    func activeLayerPixels() throws -> Data
    func restoreActiveLayerPixels(data: Data) throws
    func marquee() -> AppleMarqueeRegion?
    func setMarquee(region: AppleMarqueeRegion?) throws
    func liftMarqueePixels() -> Data
    func clearMarqueePixels()
    func composite() -> Data
    func compositeWithLayerPatch(
        layerId: String,
        patch: Data,
        patchWidth: UInt32,
        patchHeight: UInt32,
        destX: Int32,
        destY: Int32
    ) throws -> Data
    func compositeBufferAt(buffer: Data, region: AppleMarqueeRegion) throws
}

extension AppleDocument: FloatingSelectionDocument {}

/// The Edit Baseline authority paired with a Floating Selection document.
/// The associated document type prevents mixing a fake or future adapter with
/// a History implementation that snapshots a different representation.
protocol FloatingSelectionHistory<Document>: AnyObject {
    associatedtype Document: FloatingSelectionDocument

    func beginEdit(document: Document)
    func endEdit(current: Document) -> Bool
}

extension AppleDocumentHistory: FloatingSelectionHistory {
    typealias Document = AppleDocument
}

/// A Floating Selection's translation from its source Marquee, in canvas
/// pixels. Kept as wide arithmetic so repeated off-canvas drags cannot trap
/// before a projected region is validated for the FFI boundary.
struct FloatingSelectionOffset: Equatable {
    let dx: Int64
    let dy: Int64

    static let zero = FloatingSelectionOffset(dx: 0, dy: 0)

    static func + (lhs: FloatingSelectionOffset, rhs: FloatingSelectionOffset) -> Self {
        FloatingSelectionOffset(
            dx: addingWithoutOverflow(lhs.dx, rhs.dx),
            dy: addingWithoutOverflow(lhs.dy, rhs.dy)
        )
    }

    private static func addingWithoutOverflow(_ lhs: Int64, _ rhs: Int64) -> Int64 {
        let (sum, overflowed) = lhs.addingReportingOverflow(rhs)
        guard overflowed else { return sum }
        return rhs >= 0 ? .max : .min
    }
}

/// Owns one tab's transient Floating Selection: the lifted pixels, their
/// source identity, and the translation used for non-mutating render and
/// Marquee projections. A Floating Selection never enters the Layer stack.
final class FloatingSelectionLifecycle {
    enum CommitOutcome {
        case committed
        case unchanged
        case failed(didCommit: Bool, message: String)
    }

    enum CancelOutcome {
        case restored
        case degraded(
            didRestoreSourcePixels: Bool,
            didRestoreMarquee: Bool,
            message: String
        )
    }

    enum RecoveryOutcome {
        case noRecovery
        case restored
        case failed(didMutateDocument: Bool, message: String)
    }

    private struct FloatingSelection {
        let buffer: Data
        let sourceLayerId: String
        let sourceRegion: AppleMarqueeRegion
        let sourceLayerPixelsBeforeLift: Data
        let marqueeBeforeLift: AppleMarqueeRegion?
        var offset: FloatingSelectionOffset
    }

    private struct PersistenceRecovery {
        let sourceLayerId: String
        let sourceLayerPixelsBeforeLift: Data
        let activeLayerIdBeforeRecovery: String
    }

    private var floating: FloatingSelection?
    private var persistenceRecovery: PersistenceRecovery?

    var isActive: Bool { floating != nil }
    var hasPendingRecovery: Bool { persistenceRecovery != nil }
    var offset: FloatingSelectionOffset? { floating?.offset }

    /// Lifts the active Marquee once and clears its source pixels immediately.
    /// The destination remains a render-only patch until an explicit commit.
    func liftFromMarquee(
        _ sourceRegion: AppleMarqueeRegion,
        in document: any FloatingSelectionDocument
    ) -> Bool {
        guard floating == nil, persistenceRecovery == nil else { return false }

        do {
            let sourceLayerId = document.activeLayerId()
            let sourceLayerPixelsBeforeLift = try document.activeLayerPixels()
            let marqueeBeforeLift = document.marquee()
            try document.setMarquee(region: sourceRegion)
            let buffer = document.liftMarqueePixels()
            guard !buffer.isEmpty else { return false }

            document.clearMarqueePixels()
            floating = FloatingSelection(
                buffer: buffer,
                sourceLayerId: sourceLayerId,
                sourceRegion: sourceRegion,
                sourceLayerPixelsBeforeLift: sourceLayerPixelsBeforeLift,
                marqueeBeforeLift: marqueeBeforeLift,
                offset: .zero
            )
            return true
        } catch {
            assertionFailure("Failed to lift Floating Selection: \(error)")
            return false
        }
    }

    /// Replaces the translation with the current gesture's resolved offset.
    func moveTo(_ offset: FloatingSelectionOffset) -> Bool {
        guard var candidate = floating, candidate.offset != offset else { return false }
        candidate.offset = offset
        // Keep the last valid destination when a synthetic/extreme pointer
        // would extend the Marquee beyond the FFI's Int32 coordinate space.
        guard projectedRegion(for: candidate) != nil else { return false }
        floating = candidate
        return true
    }

    /// Adds one keyboard translation to the current offset. Repeated nudges
    /// stay inside this lifecycle so they resolve as the Floating Selection's
    /// single commit instead of separate History edits.
    func nudge(by delta: FloatingSelectionOffset) -> Bool {
        guard let offset = floating?.offset else { return false }
        return moveTo(offset + delta)
    }

    /// The Marquee projected to the Floating Selection's current destination.
    /// Without a Floating Selection, the live Document Marquee passes through.
    func displayedMarquee(
        in document: any FloatingSelectionDocument
    ) -> AppleMarqueeRegion? {
        guard let floating else { return document.marquee() }
        return projectedRegion(for: floating)
    }

    /// Renderer-facing composite. The lifted source is already transparent in
    /// the live Document; the patch read overlays the buffer without mutating
    /// its destination and preserves the source Layer's stack position.
    func renderPixels(in document: any FloatingSelectionDocument) throws -> Data {
        guard let floating, let destination = projectedRegion(for: floating) else {
            return document.composite()
        }
        return try document.compositeWithLayerPatch(
            layerId: floating.sourceLayerId,
            patch: floating.buffer,
            patchWidth: floating.sourceRegion.width,
            patchHeight: floating.sourceRegion.height,
            destX: destination.x,
            destY: destination.y
        )
    }

    /// Persistence projection for one Layer. A live Floating Selection — or a
    /// degraded cancellation awaiting source recovery — saves the complete
    /// pre-lift pixels rather than the transparent hole in the live document.
    func snapshotPixels(for layerId: String, currentPixels: Data) -> Data {
        if let floating, floating.sourceLayerId == layerId {
            return floating.sourceLayerPixelsBeforeLift
        }
        if let persistenceRecovery, persistenceRecovery.sourceLayerId == layerId {
            return persistenceRecovery.sourceLayerPixelsBeforeLift
        }
        return currentPixels
    }

    /// Persistence projection for the active-Layer pointer. A retry may have
    /// restored the source pixels but failed to reinstate the pointer; saving
    /// the pre-recovery identity keeps that partial boundary failure transient.
    func snapshotActiveLayerId(currentActiveLayerId: String) -> String {
        persistenceRecovery?.activeLayerIdBeforeRecovery ?? currentActiveLayerId
    }

    /// Restores the pre-lift document before opening the Edit Baseline, then
    /// applies source clear, destination composite, and Marquee translation as
    /// one History entry. Restoring first is what keeps source clear from
    /// becoming its own undo step; a net-zero move takes the exact-restore path.
    func commit<Document, History>(
        in document: Document,
        history: History
    ) -> CommitOutcome?
    where
        Document: FloatingSelectionDocument,
        History: FloatingSelectionHistory,
        History.Document == Document
    {
        guard let floating, let destination = projectedRegion(for: floating) else {
            return nil
        }
        guard document.activeLayerId() == floating.sourceLayerId else {
            assertionFailure("Floating Selection source Layer changed before commit")
            return nil
        }

        do {
            // Validate the Marquee first. Pixel restore is atomic and uses the
            // exact buffer captured from this document, so this order leaves
            // the source-hole preview intact if boundary validation fails.
            try document.setMarquee(region: floating.marqueeBeforeLift)
            try document.restoreActiveLayerPixels(
                data: floating.sourceLayerPixelsBeforeLift
            )
        } catch {
            assertionFailure("Failed to restore Floating Selection baseline: \(error)")
            return nil
        }

        history.beginEdit(document: document)

        var applyError: Error?
        if floating.offset != .zero {
            do {
                try document.setMarquee(region: floating.sourceRegion)
                document.clearMarqueePixels()
                try document.compositeBufferAt(buffer: floating.buffer, region: destination)
                try document.setMarquee(region: destination)
            } catch {
                applyError = error
            }
        }

        // `endEdit` is deliberately outside the throwing apply block: every
        // baseline opened above resolves exactly once. A partial mutation is
        // retained as an undoable Edit, matching the deferred-History ADR.
        let didCommit = history.endEdit(current: document)
        self.floating = nil

        if let applyError {
            return .failed(
                didCommit: didCommit,
                message: "Failed to commit Floating Selection: \(applyError)"
            )
        }
        return didCommit ? .committed : .unchanged
    }

    /// Cancels the whole pending Floating edit rather than merely ending its
    /// current pointer gesture. Exact restoration never opens History.
    func cancel(in document: any FloatingSelectionDocument) -> CancelOutcome? {
        guard let floating else { return nil }

        // Cancellation is terminal even when a boundary operation fails. A
        // degraded document must not retain an unresolvable transient owner.
        self.floating = nil

        let activeLayerIdBeforeRecovery = document.activeLayerId()
        let isSourceLayerActive = activeLayerIdBeforeRecovery == floating.sourceLayerId
        var didRestoreSourcePixels = false
        var failures: [String] = []

        if isSourceLayerActive {
            do {
                try document.restoreActiveLayerPixels(
                    data: floating.sourceLayerPixelsBeforeLift
                )
                didRestoreSourcePixels = true
            } catch {
                failures.append("source pixels: \(error)")
            }
        } else {
            // The protocol intentionally exposes only active-Layer writes. Do
            // not risk replacing a different Layer with the source snapshot.
            failures.append("source Layer is no longer active")
        }

        var didRestoreMarquee = false
        do {
            try document.setMarquee(region: floating.marqueeBeforeLift)
            didRestoreMarquee = true
        } catch {
            failures.append("Marquee: \(error)")
        }

        guard didRestoreSourcePixels, didRestoreMarquee else {
            if !didRestoreSourcePixels {
                persistenceRecovery = PersistenceRecovery(
                    sourceLayerId: floating.sourceLayerId,
                    sourceLayerPixelsBeforeLift: floating.sourceLayerPixelsBeforeLift,
                    activeLayerIdBeforeRecovery: activeLayerIdBeforeRecovery
                )
            }
            return .degraded(
                didRestoreSourcePixels: didRestoreSourcePixels,
                didRestoreMarquee: didRestoreMarquee,
                message: "Failed to restore Floating Selection exactly (\(failures.joined(separator: "; ")))"
            )
        }
        return .restored
    }

    /// Retries a source-pixel recovery left by degraded cancellation. The
    /// source Layer becomes active only for the restore and the caller's
    /// original active Layer is reinstated before recovery is considered
    /// complete. Any failure keeps the persistence projection available.
    func retryPendingRecovery(
        in document: any FloatingSelectionDocument
    ) -> RecoveryOutcome {
        guard let recovery = persistenceRecovery else { return .noRecovery }

        let desiredActiveLayerId = recovery.activeLayerIdBeforeRecovery
        var failures: [String] = []
        var didActivateSource = document.activeLayerId() == recovery.sourceLayerId

        if !didActivateSource {
            do {
                try document.setActiveLayer(id: recovery.sourceLayerId)
                didActivateSource = true
            } catch {
                failures.append("activate source Layer: \(error)")
            }
        }

        var didRestoreSourcePixels = false
        if didActivateSource {
            do {
                try document.restoreActiveLayerPixels(
                    data: recovery.sourceLayerPixelsBeforeLift
                )
                didRestoreSourcePixels = true
            } catch {
                failures.append("source pixels: \(error)")
            }
        }

        if document.activeLayerId() != desiredActiveLayerId {
            do {
                try document.setActiveLayer(id: desiredActiveLayerId)
            } catch {
                failures.append("restore active Layer: \(error)")
            }
        }
        let didRestoreActiveLayer = document.activeLayerId() == desiredActiveLayerId

        guard didRestoreSourcePixels, didRestoreActiveLayer else {
            return .failed(
                didMutateDocument: didRestoreSourcePixels
                    || document.activeLayerId() != desiredActiveLayerId,
                message: "Failed to recover Floating Selection (\(failures.joined(separator: "; ")))"
            )
        }

        persistenceRecovery = nil
        return .restored
    }

    private func projectedRegion(for floating: FloatingSelection) -> AppleMarqueeRegion? {
        guard
            let x = projectedCoordinate(
                origin: floating.sourceRegion.x,
                span: floating.sourceRegion.width,
                delta: floating.offset.dx
            ),
            let y = projectedCoordinate(
                origin: floating.sourceRegion.y,
                span: floating.sourceRegion.height,
                delta: floating.offset.dy
            )
        else { return nil }
        return AppleMarqueeRegion(
            x: x,
            y: y,
            width: floating.sourceRegion.width,
            height: floating.sourceRegion.height
        )
    }

    /// Validates both inclusive corners before constructing the public FFI
    /// record; validating only the origin admits a width/height whose far
    /// corner exceeds Int32 and would fail halfway through commit.
    private func projectedCoordinate(origin: Int32, span: UInt32, delta: Int64) -> Int32? {
        let (projectedOrigin, originOverflowed) = Int64(origin).addingReportingOverflow(delta)
        guard !originOverflowed, let exactOrigin = Int32(exactly: projectedOrigin) else {
            return nil
        }
        let (farCorner, cornerOverflowed) = projectedOrigin.addingReportingOverflow(
            Int64(span) - 1
        )
        guard !cornerOverflowed, Int32(exactly: farCorner) != nil else { return nil }
        return exactOrigin
    }
}
