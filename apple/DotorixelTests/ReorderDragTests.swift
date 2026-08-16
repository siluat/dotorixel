import CoreGraphics
import Testing
@testable import Dotorixel

/// The Timeline's Reorder Interaction (`CONTEXT.md` § Reorder Interaction): the
/// drag's clamped preview and the index it would drop into, along whichever
/// axis the surface runs. Pure geometry — no SwiftUI, so the snap thresholds
/// and clamps are pinned without a rendered view.
///
/// One type serves both surfaces (web parity: one interaction with two
/// adapters) — the layer sidebar's vertical rows (issue 260) and the frame
/// ruler's horizontal columns (issue 286) — so these suites are the two axes
/// of the same geometry.
@Suite("ReorderDrag — clamped preview and drop target")
struct ReorderDragTests {

    /// The frame ruler's column extent (`DesignTokens.btnSize`), spelled out
    /// here so a token change can't silently rewrite what these mean.
    private let columnWidth: CGFloat = 44

    /// A drag begun on the first column of a four-column frame axis.
    private func dragFromFirstColumn(translation: CGFloat) -> ReorderDrag {
        ReorderDrag(
            itemId: "first",
            baseIndex: 0,
            itemCount: 4,
            itemExtent: columnWidth,
            translation: translation
        )
    }

    @Test("a frame dragged along the ruler snaps to the nearest column and stops at the axis end")
    func frameAxisDragSnapsAndClampsAtTheAxisEnd() {
        // Held near the origin, the drag still targets the column it began on.
        #expect(dragFromFirstColumn(translation: columnWidth * 0.4).targetIndex == 0)
        // Past half a column, the next one along — axis indices grow rightward,
        // so rightward travel raises the index.
        #expect(dragFromFirstColumn(translation: columnWidth * 0.6).targetIndex == 1)
        #expect(dragFromFirstColumn(translation: columnWidth * 2).targetIndex == 2)

        // Pulled past the last column, the drag targets the axis end and its
        // preview stops there — a preview that kept going would render outside
        // the ruler's pane.
        let pastEnd = dragFromFirstColumn(translation: columnWidth * 10)
        #expect(pastEnd.targetIndex == 3)
        #expect(pastEnd.offset(forIndex: 0) == columnWidth * 3)

        // The first column has nothing to its left, so leftward travel neither
        // moves the target nor previews off the head of the axis.
        let pastHead = dragFromFirstColumn(translation: -columnWidth * 10)
        #expect(pastHead.targetIndex == 0)
        #expect(pastHead.offset(forIndex: 0) == 0)
    }

    @Test("the columns a frame drag passes over open its drop slot by shifting one column back")
    func passedColumnsShiftToOpenTheDropSlot() {
        // Dragged two columns along: both passed columns move left into the
        // slot the dragged one left behind, and the untouched one stays put.
        let alongTwo = dragFromFirstColumn(translation: columnWidth * 2)
        #expect(alongTwo.offset(forIndex: 1) == -columnWidth)
        #expect(alongTwo.offset(forIndex: 2) == -columnWidth)
        #expect(alongTwo.offset(forIndex: 3) == 0)
    }

    // MARK: - Layer sidebar (vertical axis, issue 260)

    /// The panel's row extent (`DesignTokens.btnSize`), spelled out here so a
    /// token change can't silently rewrite what these thresholds mean.
    private let rowHeight: CGFloat = 44

    /// A drag begun on the middle row of a three-row panel.
    private func dragFromMiddleRow(translation: CGFloat) -> ReorderDrag {
        ReorderDrag(
            itemId: "middle",
            baseIndex: 1,
            itemCount: 3,
            itemExtent: rowHeight,
            translation: translation
        )
    }

    @Test("the drop target snaps to the nearest row: half a row of travel is the threshold")
    func dropTargetSnapsToTheNearestRow() {
        // Held near the origin, the drag still targets the row it began on.
        #expect(dragFromMiddleRow(translation: 0).targetIndex == 1)
        #expect(dragFromMiddleRow(translation: rowHeight * 0.4).targetIndex == 1)
        #expect(dragFromMiddleRow(translation: -rowHeight * 0.4).targetIndex == 1)

        // Past half a row, the next row down (panel indices grow downward)…
        #expect(dragFromMiddleRow(translation: rowHeight * 0.6).targetIndex == 2)
        #expect(dragFromMiddleRow(translation: rowHeight).targetIndex == 2)

        // …and the row above when dragged up.
        #expect(dragFromMiddleRow(translation: -rowHeight * 0.6).targetIndex == 0)
    }

    @Test("a drag pulled past the panel's ends targets the end row and its preview stops there")
    func dragPastThePanelEndsClampsTargetAndPreview() {
        let pastBottom = dragFromMiddleRow(translation: rowHeight * 10)
        #expect(pastBottom.targetIndex == 2)
        // The row follows the finger only as far as the last slot — a preview
        // that kept going would render outside the sidebar.
        #expect(pastBottom.offset(forIndex: 1) == rowHeight)

        let pastTop = dragFromMiddleRow(translation: -rowHeight * 10)
        #expect(pastTop.targetIndex == 0)
        #expect(pastTop.offset(forIndex: 1) == -rowHeight)

        // Within the panel the row tracks the finger continuously, so the
        // preview reads as dragging rather than as snapping between slots.
        #expect(dragFromMiddleRow(translation: rowHeight * 0.4).offset(forIndex: 1) == rowHeight * 0.4)
    }

    @Test("the rows the drag passes over open a gap by shifting one row the other way")
    func passedRowsShiftToOpenTheDropSlot() {
        // Dragged down onto row 2: that row moves up into the vacated slot,
        // and the untouched row 0 stays put.
        let downOne = dragFromMiddleRow(translation: rowHeight)
        #expect(downOne.offset(forIndex: 2) == -rowHeight)
        #expect(downOne.offset(forIndex: 0) == 0)

        // Dragged up onto row 0: it moves down instead.
        let upOne = dragFromMiddleRow(translation: -rowHeight)
        #expect(upOne.offset(forIndex: 0) == rowHeight)
        #expect(upOne.offset(forIndex: 2) == 0)

        // A drag spanning several rows shifts every row it passed.
        let topRowToBottom = ReorderDrag(
            itemId: "top",
            baseIndex: 0,
            itemCount: 3,
            itemExtent: rowHeight,
            translation: rowHeight * 2
        )
        #expect(topRowToBottom.offset(forIndex: 1) == -rowHeight)
        #expect(topRowToBottom.offset(forIndex: 2) == -rowHeight)
    }
}
