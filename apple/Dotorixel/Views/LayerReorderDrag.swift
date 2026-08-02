import CoreGraphics

/// One in-flight Reorder Interaction on the layer sidebar (`CONTEXT.md` §
/// Reorder Interaction): the drag's live translation resolved into the panel
/// index it would drop into.
///
/// Pure geometry over panel indices — it holds no view state and touches no
/// document, so the panel owns one of these only while a handle is down.
struct LayerReorderDrag {
    /// The layer whose row the drag picked up.
    let layerId: String
    /// The panel index that row started at (top of panel = 0).
    let baseIndex: Int
    let rowCount: Int
    let rowHeight: CGFloat
    /// Live vertical travel since the handle went down, in points.
    var translation: CGFloat

    /// The panel index the drag would drop into: travel snapped to the
    /// nearest row and bounded to the panel. Panel indices grow downward, so
    /// downward travel raises the index.
    var targetPanelIndex: Int {
        let steps = Int((translation / rowHeight).rounded())
        return min(max(baseIndex + steps, 0), rowCount - 1)
    }

    /// The preview travel to render the row at `panelIndex` with, in points.
    ///
    /// The dragged row tracks the finger — bounded to the panel's ends, so it
    /// never previews a slot it could not drop into. Every row it has passed
    /// shifts one row the other way, opening the gap the drop would land in;
    /// the rest stay put.
    func offset(forPanelIndex panelIndex: Int) -> CGFloat {
        if panelIndex == baseIndex { return draggedRowOffset }
        let isBelowDraggedRow = panelIndex > baseIndex
        let hasBeenPassed = isBelowDraggedRow
            ? panelIndex <= targetPanelIndex
            : panelIndex >= targetPanelIndex
        guard hasBeenPassed else { return 0 }
        // Passed rows move toward the slot the dragged row left behind.
        return isBelowDraggedRow ? -rowHeight : rowHeight
    }

    private var draggedRowOffset: CGFloat {
        let highestTravel = CGFloat(-baseIndex) * rowHeight
        let lowestTravel = CGFloat(rowCount - 1 - baseIndex) * rowHeight
        return min(max(translation, highestTravel), lowestTravel)
    }
}
