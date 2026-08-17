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

    /// The headers whose drags an axis change cancelled while their gestures
    /// were still down. Such a gesture keeps delivering events with nothing
    /// behind it, and its travel cannot tell the two cases apart — a finger
    /// returned near its origin looks exactly like a press that never left tap
    /// range — so the cancellation is recorded when it happens.
    ///
    /// A set, not one id: several presses can be down at once, and a later
    /// cancellation replacing an earlier one would let the earlier press
    /// release as a tap. Keyed by header so only the press it belongs to can
    /// spend it.
    private(set) var cancelledItemIds: Set<String> = []

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
              !cancelledItemIds.contains(itemId),
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
        // A cancelled press means nothing whatever else is in flight, and this
        // release is the only thing that can spend its cancellation — so it is
        // resolved before any live drag, which may well belong to another
        // header and would otherwise leave the cancellation behind.
        if cancelledItemIds.remove(itemId) != nil { return .ignore }
        guard var releasing = drag, releasing.itemId == itemId else {
            // What is left is a press that opened no drag: a tap when it
            // stayed in range, and nothing at all when it travelled without a
            // drag to show for it (a sole-frame axis) or when another header's
            // drag owns the interaction.
            return drag == nil && abs(travel) <= tapThreshold ? .select : .ignore
        }
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
        cancelledItemIds.formIntersection(itemIds)
        guard let cancelling = drag else { return }
        drag = nil
        if itemIds.contains(cancelling.itemId) {
            cancelledItemIds.insert(cancelling.itemId)
        }
    }

    /// The ruler went away — the panel collapsed — taking every gesture on it
    /// down without a release. Nothing is left to resolve, so no preview
    /// offset, scroll lock, or pending cancellation survives into the next
    /// expand.
    mutating func reset() {
        drag = nil
        cancelledItemIds.removeAll()
    }
}
