import CoreGraphics

/// The frame ruler's Reorder Interaction (`CONTEXT.md` § Reorder Interaction):
/// one press on an ordinal header, tracked from touch-down and resolved at the
/// release into the one thing that press can mean.
///
/// The header carries two roles — it selects the Active Frame and it drags its
/// frame along the axis — and SwiftUI's `DragGesture` hands the view no
/// per-gesture state to tell them apart, so the tracking lives here instead of
/// in the view. Pure state: it touches no document and renders nothing.
struct FrameReorderInteraction {
    /// One frame column's extent along the drag axis, in points.
    let itemExtent: CGFloat
    /// Travel a press must exceed before it counts as a drag rather than a tap.
    let tapThreshold: CGFloat

    /// The drag in flight, or nil while the press has not opened one.
    private(set) var drag: ReorderDrag?

    /// The header whose drag an axis change cancelled while its gesture was
    /// still down. That gesture keeps delivering events with nothing behind
    /// them, and its travel cannot tell the two cases apart — a finger
    /// returned near its origin looks exactly like a press that never left tap
    /// range — so the cancellation is recorded when it happens.
    private(set) var cancelledItemId: String?

    /// What a release resolved to.
    enum Release: Equatable {
        /// The press dragged; commit the move to this axis index.
        case reorder(toIndex: Int)
        /// The press stayed in tap range; make the header's frame active.
        case select
        /// The press means nothing: it belonged to a cancelled drag, to a
        /// second pointer, or to an axis with nowhere to reorder to.
        case ignore
    }

    /// Tracks a press in flight on `itemId`, opening a drag once it travels
    /// past the tap threshold. Only the first pointer to open one drives it —
    /// a press on another header while a drag is live is tracked by neither
    /// branch, so its release resolves to `.ignore` (web parity).
    mutating func track(itemId: String, axisIndex: Int, travel: CGFloat, axisCount: Int) {
        if drag?.itemId == itemId {
            drag?.translation = travel
            return
        }
        guard drag == nil,
              cancelledItemId != itemId,
              axisCount > 1,
              abs(travel) > tapThreshold
        else { return }
        drag = ReorderDrag(
            itemId: itemId,
            baseIndex: axisIndex,
            itemCount: axisCount,
            itemExtent: itemExtent,
            translation: travel
        )
    }

    /// Resolves the release of the press on `itemId`, clearing whatever state
    /// that press was holding.
    mutating func release(itemId: String, travel: CGFloat) -> Release {
        guard var releasing = drag else {
            if cancelledItemId == itemId {
                cancelledItemId = nil
                return .ignore
            }
            return abs(travel) <= tapThreshold ? .select : .ignore
        }
        guard releasing.itemId == itemId else { return .ignore }
        releasing.translation = travel
        drag = nil
        return .reorder(toIndex: releasing.targetIndex)
    }

    /// The axis changed under a live drag, invalidating the geometry it was
    /// captured against: cancel the preview and remember which press it
    /// belonged to.
    ///
    /// A cancellation is only worth holding while its header is still on the
    /// axis. Once the header goes, so does the gesture on it — torn down
    /// without a release — and a latch nothing can spend would cost that
    /// header its next press if the axis ever brought it back.
    mutating func axisChanged(to itemIds: [String]) {
        if let cancelled = cancelledItemId, !itemIds.contains(cancelled) {
            cancelledItemId = nil
        }
        guard let cancelling = drag else { return }
        drag = nil
        cancelledItemId = itemIds.contains(cancelling.itemId) ? cancelling.itemId : nil
    }

    /// The ruler went away — the panel collapsed — taking every gesture on it
    /// down without a release. Nothing is left to resolve, so no preview
    /// offset, scroll lock, or pending cancellation survives into the next
    /// expand.
    mutating func reset() {
        drag = nil
        cancelledItemId = nil
    }
}
