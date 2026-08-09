import Foundation
import Testing
@testable import Dotorixel

/// Selection tool session behavior, exercised through the `TabState` public
/// stroke API (web parity: `selection-tool.ts`): a drag defines the Marquee,
/// a click without a meaningful drag deselects.
@Suite("Selection strokes — define, deselect, persistence")
struct SelectionStrokeSessionTests {

    @Test("a drag in any direction defines the normalized Marquee")
    func dragDefinesNormalizedMarquee() {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .selection

        // Dragged up-left: the corners arrive reversed and must normalize.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 7))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 3))
        state.activeTab.endStroke()

        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 3, width: 4, height: 5)
        )
    }

    @Test("a drag past the canvas edge clips the Marquee to the canvas")
    func dragPastEdgeClipsToCanvas() {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .selection

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 6, y: 5))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 10, y: 9))
        state.activeTab.endStroke()

        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 6, y: 5, width: 2, height: 3)
        )
    }

    @Test("a click outside the Marquee deselects")
    func clickOutsideMarqueeDeselects() {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .selection
        defineMarquee(state, from: (2, 2), to: (4, 4))

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 6, y: 6))
        state.activeTab.endStroke()

        #expect(state.activeTab.document.marquee() == nil)
    }

    @Test("a click inside the Marquee leaves it in place — the Floating seam")
    func clickInsideMarqueePersists() {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .selection
        defineMarquee(state, from: (2, 2), to: (4, 4))

        // Web parity: an inside click belongs to the Floating Selection
        // lifecycle (issue 272), never a deselect.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        state.activeTab.endStroke()

        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 2, width: 3, height: 3)
        )
    }

    @Test("a click with no Marquee changes nothing and records no history entry")
    func clickWithoutMarqueeRecordsNothing() {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .selection

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        state.activeTab.endStroke()

        #expect(state.activeTab.document.marquee() == nil)
        #expect(!state.activeTab.canUndo)
    }

    @Test("undo after a define restores the prior Marquee; redo re-applies")
    func undoRestoresPriorMarquee() {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .selection
        defineMarquee(state, from: (2, 2), to: (4, 4))
        defineMarquee(state, from: (5, 5), to: (7, 7))

        state.activeTab.handleUndo()
        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 2, width: 3, height: 3)
        )

        state.activeTab.handleRedo()
        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 5, y: 5, width: 3, height: 3)
        )
    }

    @Test("undo after a deselect restores the Marquee")
    func undoRestoresDeselectedMarquee() {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .selection
        defineMarquee(state, from: (2, 2), to: (4, 4))

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 6, y: 6))
        state.activeTab.endStroke()
        #expect(state.activeTab.document.marquee() == nil)

        state.activeTab.handleUndo()
        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 2, width: 3, height: 3)
        )
    }

    @Test("re-defining the identical Marquee records no history entry")
    func identicalRedefineRecordsNothing() {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .selection
        defineMarquee(state, from: (2, 2), to: (4, 4))
        // The same drag again: the document ends where it began, so the Edit
        // Baseline resolves without an entry (web parity: a no-op define).
        defineMarquee(state, from: (2, 2), to: (4, 4))

        // One undo steps past the single define — back to no Marquee at all.
        state.activeTab.handleUndo()
        #expect(state.activeTab.document.marquee() == nil)
        #expect(!state.activeTab.canUndo)
    }

    @Test("cancel mid-define restores the initial Marquee and records nothing")
    func cancelRestoresInitialMarquee() {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .selection
        defineMarquee(state, from: (2, 2), to: (4, 4))

        // A pinch begun mid-define routes here (touch routing cancels the
        // stroke): the preview must vanish, the prior Marquee must survive.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 7, y: 7))
        state.activeTab.cancelStroke()

        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 2, width: 3, height: 3)
        )

        // The cancelled stroke resolved as a no-op — one undo steps past the
        // original define, not the cancelled preview.
        state.activeTab.handleUndo()
        #expect(state.activeTab.document.marquee() == nil)
        #expect(!state.activeTab.canUndo)
    }

    @Test("the Marquee persists across a tool switch and a pencil stroke")
    func marqueePersistsAcrossToolSwitchAndEdits() throws {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .selection
        defineMarquee(state, from: (2, 2), to: (4, 4))

        // Inside the Marquee: an edit outside it paints nothing (271 clips
        // drawing tools), which would say nothing about persistence.
        state.shared.activeTool = .pencil
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 3, y: 3) == state.shared.foregroundColor)
        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 2, width: 3, height: 3)
        )
    }

    @Test("a drag entirely outside the canvas keeps the prior Marquee and records nothing")
    func fullyOffCanvasDragKeepsPriorMarquee() {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .selection
        defineMarquee(state, from: (2, 2), to: (4, 4))

        // Both corners past the canvas: the clip yields no region, so the
        // define commits nothing (web parity: a null draft restores the
        // initial Marquee).
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 9, y: 9))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 11, y: 11))
        state.activeTab.endStroke()

        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 2, width: 3, height: 3)
        )

        // No entry recorded: one undo steps past the original define.
        state.activeTab.handleUndo()
        #expect(state.activeTab.document.marquee() == nil)
        #expect(!state.activeTab.canUndo)
    }

    /// Defines a Marquee through the public stroke API — the arrange step
    /// the deselect/persistence tests build on.
    private func defineMarquee(
        _ state: Workspace, from: (Int32, Int32), to: (Int32, Int32)
    ) {
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: from.0, y: from.1))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: to.0, y: to.1))
        state.activeTab.endStroke()
    }
}
