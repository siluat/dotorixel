import CoreGraphics

/// One in-flight Reorder Interaction on the Timeline (`CONTEXT.md` § Reorder
/// Interaction): the drag's live translation resolved into the index it would
/// drop into.
///
/// Axis-neutral by construction — the two Timeline surfaces differ only in
/// which component of the gesture's translation they feed it. The layer
/// sidebar's rows travel vertically (indices grow downward) and the frame
/// ruler's columns horizontally (indices grow rightward); everything below is
/// the same geometry over "items along one axis".
///
/// Pure geometry over indices — it holds no view state and touches no
/// document, so the panel owns one of these only while a drag is live.
struct ReorderDrag {
    /// The layer or frame the drag picked up.
    let itemId: String
    /// The index that item started at (top of panel / head of axis = 0).
    let baseIndex: Int
    let itemCount: Int
    /// One item's extent along the drag axis, in points.
    let itemExtent: CGFloat
    /// Live travel along the axis since the drag began, in points.
    var translation: CGFloat

    /// The index the drag would drop into: travel snapped to the nearest item
    /// and bounded to the run.
    var targetIndex: Int {
        let steps = Int((translation / itemExtent).rounded())
        return min(max(baseIndex + steps, 0), itemCount - 1)
    }

    /// The preview travel to render the item at `index` with, in points.
    ///
    /// The dragged item tracks the finger — bounded to the run's ends, so it
    /// never previews a slot it could not drop into. Every item it has passed
    /// shifts one place the other way, opening the gap the drop would land in;
    /// the rest stay put.
    func offset(forIndex index: Int) -> CGFloat {
        if index == baseIndex { return draggedItemOffset }
        let isPastDraggedItem = index > baseIndex
        let hasBeenPassed = isPastDraggedItem
            ? index <= targetIndex
            : index >= targetIndex
        guard hasBeenPassed else { return 0 }
        // Passed items move toward the slot the dragged item left behind.
        return isPastDraggedItem ? -itemExtent : itemExtent
    }

    private var draggedItemOffset: CGFloat {
        let lowestTravel = CGFloat(-baseIndex) * itemExtent
        let highestTravel = CGFloat(itemCount - 1 - baseIndex) * itemExtent
        return min(max(translation, lowestTravel), highestTravel)
    }
}
