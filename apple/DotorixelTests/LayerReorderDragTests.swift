import CoreGraphics
import Testing
@testable import Dotorixel

/// The layer sidebar's Reorder Interaction (issue 260, `CONTEXT.md` §
/// Reorder Interaction): the drag's clamped preview and the panel index it
/// would drop into. Pure geometry — no SwiftUI, so the snap thresholds and
/// clamps are pinned without a rendered view.
@Suite("LayerReorderDrag — clamped preview and drop target")
struct LayerReorderDragTests {

    /// The panel's row extent (`DesignTokens.btnSize`), spelled out here so a
    /// token change can't silently rewrite what these thresholds mean.
    private let rowHeight: CGFloat = 44

    /// A drag begun on the middle row of a three-row panel.
    private func dragFromMiddleRow(translation: CGFloat) -> LayerReorderDrag {
        LayerReorderDrag(
            layerId: "middle",
            baseIndex: 1,
            rowCount: 3,
            rowHeight: rowHeight,
            translation: translation
        )
    }

    @Test("the drop target snaps to the nearest row: half a row of travel is the threshold")
    func dropTargetSnapsToTheNearestRow() {
        // Held near the origin, the drag still targets the row it began on.
        #expect(dragFromMiddleRow(translation: 0).targetPanelIndex == 1)
        #expect(dragFromMiddleRow(translation: rowHeight * 0.4).targetPanelIndex == 1)
        #expect(dragFromMiddleRow(translation: -rowHeight * 0.4).targetPanelIndex == 1)

        // Past half a row, the next row down (panel indices grow downward)…
        #expect(dragFromMiddleRow(translation: rowHeight * 0.6).targetPanelIndex == 2)
        #expect(dragFromMiddleRow(translation: rowHeight).targetPanelIndex == 2)

        // …and the row above when dragged up.
        #expect(dragFromMiddleRow(translation: -rowHeight * 0.6).targetPanelIndex == 0)
    }

    @Test("a drag pulled past the panel's ends targets the end row and its preview stops there")
    func dragPastThePanelEndsClampsTargetAndPreview() {
        let pastBottom = dragFromMiddleRow(translation: rowHeight * 10)
        #expect(pastBottom.targetPanelIndex == 2)
        // The row follows the finger only as far as the last slot — a preview
        // that kept going would render outside the sidebar.
        #expect(pastBottom.offset(forPanelIndex: 1) == rowHeight)

        let pastTop = dragFromMiddleRow(translation: -rowHeight * 10)
        #expect(pastTop.targetPanelIndex == 0)
        #expect(pastTop.offset(forPanelIndex: 1) == -rowHeight)

        // Within the panel the row tracks the finger continuously, so the
        // preview reads as dragging rather than as snapping between slots.
        #expect(dragFromMiddleRow(translation: rowHeight * 0.4).offset(forPanelIndex: 1) == rowHeight * 0.4)
    }

    @Test("the rows the drag passes over open a gap by shifting one row the other way")
    func passedRowsShiftToOpenTheDropSlot() {
        // Dragged down onto row 2: that row moves up into the vacated slot,
        // and the untouched row 0 stays put.
        let downOne = dragFromMiddleRow(translation: rowHeight)
        #expect(downOne.offset(forPanelIndex: 2) == -rowHeight)
        #expect(downOne.offset(forPanelIndex: 0) == 0)

        // Dragged up onto row 0: it moves down instead.
        let upOne = dragFromMiddleRow(translation: -rowHeight)
        #expect(upOne.offset(forPanelIndex: 0) == rowHeight)
        #expect(upOne.offset(forPanelIndex: 2) == 0)

        // A drag spanning several rows shifts every row it passed.
        let topRowToBottom = LayerReorderDrag(
            layerId: "top",
            baseIndex: 0,
            rowCount: 3,
            rowHeight: rowHeight,
            translation: rowHeight * 2
        )
        #expect(topRowToBottom.offset(forPanelIndex: 1) == -rowHeight)
        #expect(topRowToBottom.offset(forPanelIndex: 2) == -rowHeight)
    }
}
