import Foundation

/// Workspace-shared snapshot captured from a Marquee for Copy, Cut, and
/// Paste. The Selection Clipboard is app-local — it never reaches the OS
/// clipboard or enters a Document's Layer stack.
struct SelectionClipboard: Equatable {
    let pixels: Data
    let width: UInt32
    let height: UInt32

    private static let rgbaBytesPerPixel: UInt64 = 4

    init?(pixels: Data, width: UInt32, height: UInt32) {
        guard width > 0, height > 0 else { return nil }
        let (pixelCount, pixelCountOverflowed) = UInt64(width)
            .multipliedReportingOverflow(by: UInt64(height))
        let (byteCount, byteCountOverflowed) = pixelCount
            .multipliedReportingOverflow(by: Self.rgbaBytesPerPixel)
        guard !pixelCountOverflowed,
              !byteCountOverflowed,
              byteCount == UInt64(pixels.count) else { return nil }

        self.pixels = pixels
        self.width = width
        self.height = height
    }
}

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

/// A Floating Selection's translation from its initial region, in canvas
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

/// Owns one tab's transient Floating Selection: its pixel buffer, target
/// Layer, initial region, baseline, origin, and non-mutating translation.
/// A Floating Selection never enters the Layer stack.
final class FloatingSelectionLifecycle {
    enum CommitOutcome {
        case committed
        case unchanged
        case failed(didCommit: Bool, message: String)
    }

    enum CancelOutcome {
        case restored
        case degraded(
            didRestoreLayerPixels: Bool,
            didRestoreMarquee: Bool,
            message: String
        )
    }

    enum RecoveryOutcome {
        case noRecovery
        case restored
        case failed(didMutateDocument: Bool, message: String)
    }

    private enum FloatingSelectionOrigin {
        case liftedMarquee
        case selectionClipboard
    }

    private struct FloatingSelection {
        let buffer: Data
        let layerId: String
        let initialRegion: AppleMarqueeRegion
        let baselineLayerPixels: Data
        let baselineMarquee: AppleMarqueeRegion?
        let origin: FloatingSelectionOrigin
        var offset: FloatingSelectionOffset
    }

    private struct PersistenceRecovery {
        let layerId: String
        let baselineLayerPixels: Data
        let activeLayerIdBeforeRecovery: String
    }

    private var floating: FloatingSelection?
    private var persistenceRecovery: PersistenceRecovery?

    var isActive: Bool { floating != nil }
    var hasPendingRecovery: Bool { persistenceRecovery != nil }
    var offset: FloatingSelectionOffset? { floating?.offset }

    /// Captures the active Floating Selection or committed Marquee without
    /// mutating the Document. An absent Marquee and the binding's empty-buffer
    /// cases both produce no value.
    func clipboardSnapshot(
        in document: any FloatingSelectionDocument
    ) -> SelectionClipboard? {
        if let floating {
            return SelectionClipboard(
                pixels: floating.buffer,
                width: floating.initialRegion.width,
                height: floating.initialRegion.height
            )
        }
        guard let marquee = document.marquee() else { return nil }
        let pixels = document.liftMarqueePixels()
        guard !pixels.isEmpty else { return nil }
        return SelectionClipboard(
            pixels: pixels,
            width: marquee.width,
            height: marquee.height
        )
    }

    /// Lifts the active Marquee once and clears its source pixels immediately.
    /// The destination remains a render-only patch until an explicit commit.
    func liftFromMarquee(
        _ sourceRegion: AppleMarqueeRegion,
        in document: any FloatingSelectionDocument
    ) -> Bool {
        guard floating == nil, persistenceRecovery == nil else { return false }

        do {
            let layerId = document.activeLayerId()
            let baselineLayerPixels = try document.activeLayerPixels()
            let baselineMarquee = document.marquee()
            try document.setMarquee(region: sourceRegion)
            let buffer = document.liftMarqueePixels()
            guard !buffer.isEmpty else { return false }

            document.clearMarqueePixels()
            floating = FloatingSelection(
                buffer: buffer,
                layerId: layerId,
                initialRegion: sourceRegion,
                baselineLayerPixels: baselineLayerPixels,
                baselineMarquee: baselineMarquee,
                origin: .liftedMarquee,
                offset: .zero
            )
            return true
        } catch {
            assertionFailure("Failed to lift Floating Selection: \(error)")
            return false
        }
    }

    /// Starts a non-mutating Floating Selection from the app-local clipboard.
    /// The destination Marquee is projected by the lifecycle while the live
    /// Document retains the exact baseline needed by Cancel and Undo.
    func pasteClipboard(
        _ clipboard: SelectionClipboard,
        at destination: AppleMarqueeRegion,
        in document: any FloatingSelectionDocument
    ) -> Bool {
        guard floating == nil, persistenceRecovery == nil else { return false }

        do {
            floating = FloatingSelection(
                buffer: clipboard.pixels,
                layerId: document.activeLayerId(),
                initialRegion: destination,
                baselineLayerPixels: try document.activeLayerPixels(),
                baselineMarquee: document.marquee(),
                origin: .selectionClipboard,
                offset: .zero
            )
            return true
        } catch {
            assertionFailure("Failed to paste Selection Clipboard: \(error)")
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

    /// Renderer-facing composite that overlays the Floating buffer without
    /// mutating its destination and preserves its Layer's stack position.
    func renderPixels(in document: any FloatingSelectionDocument) throws -> Data {
        guard let floating, let destination = projectedRegion(for: floating) else {
            return document.composite()
        }
        return try document.compositeWithLayerPatch(
            layerId: floating.layerId,
            patch: floating.buffer,
            patchWidth: floating.initialRegion.width,
            patchHeight: floating.initialRegion.height,
            destX: destination.x,
            destY: destination.y
        )
    }

    /// Persistence projection for one Layer. A live Floating Selection — or a
    /// degraded cancellation awaiting recovery — saves its baseline pixels
    /// rather than any transient preview mutation in the live document.
    func snapshotPixels(for layerId: String, currentPixels: Data) -> Data {
        if let floating, floating.layerId == layerId {
            return floating.baselineLayerPixels
        }
        if let persistenceRecovery, persistenceRecovery.layerId == layerId {
            return persistenceRecovery.baselineLayerPixels
        }
        return currentPixels
    }

    /// Persistence projection for the active-Layer pointer. A retry may have
    /// restored the baseline pixels but failed to reinstate the pointer; saving
    /// the pre-recovery identity keeps that partial boundary failure transient.
    func snapshotActiveLayerId(currentActiveLayerId: String) -> String {
        persistenceRecovery?.activeLayerIdBeforeRecovery ?? currentActiveLayerId
    }

    /// Restores the Floating Selection baseline before opening the Edit
    /// Baseline, then applies the origin-specific pixel policy and destination
    /// Marquee as one History entry. A zero-offset lifted Marquee takes the
    /// exact-restore path; clipboard content always composites at its destination.
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
        guard document.activeLayerId() == floating.layerId else {
            assertionFailure("Floating Selection Layer changed before commit")
            return nil
        }

        do {
            // Validate the Marquee first. Pixel restore is atomic and uses the
            // exact buffer captured from this document, so this order leaves
            // the transient preview intact if boundary validation fails.
            try document.setMarquee(region: floating.baselineMarquee)
            try document.restoreActiveLayerPixels(
                data: floating.baselineLayerPixels
            )
        } catch {
            assertionFailure("Failed to restore Floating Selection baseline: \(error)")
            return nil
        }

        history.beginEdit(document: document)

        var applyError: Error?
        do {
            var shouldComposite = true
            switch floating.origin {
            case .liftedMarquee:
                if floating.offset == .zero {
                    shouldComposite = false
                } else {
                    try document.setMarquee(region: floating.initialRegion)
                    document.clearMarqueePixels()
                }
            case .selectionClipboard:
                break
            }
            if shouldComposite {
                try document.compositeBufferAt(buffer: floating.buffer, region: destination)
                try document.setMarquee(region: destination)
            }
        } catch {
            applyError = error
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
        let isFloatingLayerActive = activeLayerIdBeforeRecovery == floating.layerId
        var didRestoreLayerPixels = false
        var failures: [String] = []

        if isFloatingLayerActive {
            do {
                try document.restoreActiveLayerPixels(
                    data: floating.baselineLayerPixels
                )
                didRestoreLayerPixels = true
            } catch {
                failures.append("baseline Layer pixels: \(error)")
            }
        } else {
            // The protocol intentionally exposes only active-Layer writes. Do
            // not risk replacing a different Layer with the baseline snapshot.
            failures.append("Floating Selection Layer is no longer active")
        }

        var didRestoreMarquee = false
        do {
            try document.setMarquee(region: floating.baselineMarquee)
            didRestoreMarquee = true
        } catch {
            failures.append("Marquee: \(error)")
        }

        guard didRestoreLayerPixels, didRestoreMarquee else {
            if !didRestoreLayerPixels {
                persistenceRecovery = PersistenceRecovery(
                    layerId: floating.layerId,
                    baselineLayerPixels: floating.baselineLayerPixels,
                    activeLayerIdBeforeRecovery: activeLayerIdBeforeRecovery
                )
            }
            return .degraded(
                didRestoreLayerPixels: didRestoreLayerPixels,
                didRestoreMarquee: didRestoreMarquee,
                message: "Failed to restore Floating Selection exactly (\(failures.joined(separator: "; ")))"
            )
        }
        return .restored
    }

    /// Retries a baseline-pixel recovery left by degraded cancellation. The
    /// Floating Selection Layer becomes active only for the restore and the caller's
    /// original active Layer is reinstated before recovery is considered
    /// complete. Any failure keeps the persistence projection available.
    func retryPendingRecovery(
        in document: any FloatingSelectionDocument
    ) -> RecoveryOutcome {
        guard let recovery = persistenceRecovery else { return .noRecovery }

        let desiredActiveLayerId = recovery.activeLayerIdBeforeRecovery
        var failures: [String] = []
        var didActivateFloatingLayer = document.activeLayerId() == recovery.layerId

        if !didActivateFloatingLayer {
            do {
                try document.setActiveLayer(id: recovery.layerId)
                didActivateFloatingLayer = true
            } catch {
                failures.append("activate Floating Selection Layer: \(error)")
            }
        }

        var didRestoreLayerPixels = false
        if didActivateFloatingLayer {
            do {
                try document.restoreActiveLayerPixels(
                    data: recovery.baselineLayerPixels
                )
                didRestoreLayerPixels = true
            } catch {
                failures.append("baseline Layer pixels: \(error)")
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

        guard didRestoreLayerPixels, didRestoreActiveLayer else {
            return .failed(
                didMutateDocument: didRestoreLayerPixels
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
                origin: floating.initialRegion.x,
                span: floating.initialRegion.width,
                delta: floating.offset.dx
            ),
            let y = projectedCoordinate(
                origin: floating.initialRegion.y,
                span: floating.initialRegion.height,
                delta: floating.offset.dy
            )
        else { return nil }
        return AppleMarqueeRegion(
            x: x,
            y: y,
            width: floating.initialRegion.width,
            height: floating.initialRegion.height
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
