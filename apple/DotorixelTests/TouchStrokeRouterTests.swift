import CoreGraphics
import Testing
@testable import Dotorixel

/// Drives `TouchStrokeRouter` commands into a real `EditorState`, so tests
/// assert stroke outcomes — pixels and history — rather than routing call
/// sequences. Mirrors the production wiring: the view feeds touch events to
/// the router and executes the returned commands against the editor.
private final class RoutedEditor {
    let state = EditorState(width: 16, height: 16)
    private var router = TouchStrokeRouter<Int>()

    func fingerDown(_ id: Int, x: Int, y: Int) {
        apply(router.touchBegan(id, kind: .direct, at: point(x, y)))
    }

    func fingerMove(_ id: Int, x: Int, y: Int) {
        apply(router.touchMoved(id, to: point(x, y)))
    }

    func fingerUp(_ id: Int) {
        apply(router.touchEnded(id))
    }

    func fingerCancel(_ id: Int) {
        apply(router.touchCancelled(id))
    }

    /// Mirrors the view's begin-boundary reconciliation: before routing a
    /// begin, the view hands the router the event-wide snapshot of touches
    /// on the glass (`event.allTouches`), which still contains touches a
    /// gesture recognizer claimed away from the view.
    func sync(_ snapshot: [Int: TouchKind]) {
        router.syncDownTouches(snapshot)
    }

    func pencilDown(_ id: Int, x: Int, y: Int) {
        apply(router.touchBegan(id, kind: .pencil, at: point(x, y)))
    }

    func pencilMove(_ id: Int, x: Int, y: Int) {
        apply(router.touchMoved(id, to: point(x, y)))
    }

    func pencilUp(_ id: Int) {
        apply(router.touchEnded(id))
    }

    private func point(_ x: Int, _ y: Int) -> CGPoint {
        CGPoint(x: x, y: y)
    }

    private func apply(_ commands: [StrokeRoutingCommand]) {
        for command in commands {
            switch command {
            case .begin(let point, _):
                state.beginStroke(at: coords(point))
            case .move(let point):
                state.continueStroke(to: coords(point))
            case .end:
                state.endStroke()
            case .cancel:
                state.cancelStroke()
            }
        }
    }

    /// Tests map view points 1:1 onto canvas pixels — the viewport transform
    /// is the coordinator's concern, not the router's.
    private func coords(_ point: CGPoint) -> ScreenCanvasCoords {
        ScreenCanvasCoords(x: Int32(point.x), y: Int32(point.y))
    }
}

@Suite("TouchStrokeRouter — single-finger drawing")
struct TouchStrokeRouterSingleFingerTests {

    @Test("a one-finger drag paints from the touch-down point and commits one undo entry")
    func dragPaintsFromDownPointWithOneUndoEntry() throws {
        let editor = RoutedEditor()

        editor.fingerDown(1, x: 2, y: 2)
        editor.fingerMove(1, x: 3, y: 2)
        editor.fingerMove(1, x: 4, y: 2)
        editor.fingerUp(1)

        for x: UInt32 in 2...4 {
            #expect(try editor.state.pixelCanvas.getPixel(x: x, y: 2) == editor.state.foregroundColor)
        }
        #expect(editor.state.canUndo)
        editor.state.handleUndo()
        #expect(editor.state.pixelCanvas.pixels().allSatisfy { $0 == 0 })
        #expect(!editor.state.canUndo)
    }

    @Test("a finger tap paints its dot on release, not on touch-down")
    func tapPaintsDotOnRelease() throws {
        let editor = RoutedEditor()

        editor.fingerDown(1, x: 5, y: 5)
        #expect(try editor.state.pixelCanvas.getPixel(x: 5, y: 5).a == 0)

        editor.fingerUp(1)
        #expect(try editor.state.pixelCanvas.getPixel(x: 5, y: 5) == editor.state.foregroundColor)
        #expect(editor.state.canUndo)
    }
}

@Suite("TouchStrokeRouter — multi-touch gate")
struct TouchStrokeRouterMultiTouchTests {

    @Test("a second finger before any movement leaves canvas and history untouched")
    func quickSecondFingerLeavesNoTrace() {
        let editor = RoutedEditor()

        editor.fingerDown(1, x: 2, y: 2)
        editor.fingerDown(2, x: 8, y: 8)
        editor.fingerUp(1)
        editor.fingerUp(2)

        #expect(editor.state.pixelCanvas.pixels().allSatisfy { $0 == 0 })
        #expect(!editor.state.canUndo)
    }

    @Test("a second finger after dragging commits the drawn stroke; further moves of either finger draw nothing")
    func secondFingerAfterDragCommitsDrawnStroke() throws {
        let editor = RoutedEditor()

        editor.fingerDown(1, x: 2, y: 2)
        editor.fingerMove(1, x: 4, y: 2)
        editor.fingerDown(2, x: 8, y: 8)
        editor.fingerMove(1, x: 6, y: 2)
        editor.fingerMove(2, x: 9, y: 8)
        editor.fingerUp(1)
        editor.fingerUp(2)

        for x: UInt32 in 2...4 {
            #expect(try editor.state.pixelCanvas.getPixel(x: x, y: 2) == editor.state.foregroundColor)
        }
        #expect(try editor.state.pixelCanvas.getPixel(x: 6, y: 2).a == 0)
        #expect(try editor.state.pixelCanvas.getPixel(x: 8, y: 8).a == 0)
        #expect(try editor.state.pixelCanvas.getPixel(x: 9, y: 8).a == 0)

        // Exactly one undo entry — the committed drag.
        #expect(editor.state.canUndo)
        editor.state.handleUndo()
        #expect(editor.state.pixelCanvas.pixels().allSatisfy { $0 == 0 })
        #expect(!editor.state.canUndo)
    }

    @Test("no stroke begins until every touch lifts; the next single touch then draws normally")
    func drawingResumesOnlyAfterAllTouchesLift() throws {
        let editor = RoutedEditor()

        editor.fingerDown(1, x: 2, y: 2)
        editor.fingerDown(2, x: 8, y: 8)
        editor.fingerUp(1)

        // Finger 2 is still down — a fresh touch must not start a stroke.
        editor.fingerDown(3, x: 5, y: 5)
        editor.fingerMove(3, x: 6, y: 5)
        editor.fingerUp(3)
        editor.fingerUp(2)
        #expect(editor.state.pixelCanvas.pixels().allSatisfy { $0 == 0 })
        #expect(!editor.state.canUndo)

        // Every touch lifted — the next tap draws again.
        editor.fingerDown(4, x: 1, y: 1)
        editor.fingerUp(4)
        #expect(try editor.state.pixelCanvas.getPixel(x: 1, y: 1) == editor.state.foregroundColor)
    }

    @Test("touches a gesture recognizer claimed keep blocking new strokes until they lift")
    func recognizerClaimedTouchesKeepBlockingStrokes() throws {
        let editor = RoutedEditor()

        // Two fingers enter a pinch; the recognizer claims them (cancelled
        // for the view) while both stay on the glass.
        editor.fingerDown(1, x: 2, y: 2)
        editor.fingerDown(2, x: 8, y: 8)
        editor.fingerCancel(1)
        editor.fingerCancel(2)

        // A third finger lands mid-pinch: the begin-boundary sync restores
        // the claimed fingers to the census, so it must stay blocked.
        editor.sync([1: .direct, 2: .direct, 3: .direct])
        editor.fingerDown(3, x: 5, y: 5)
        editor.fingerMove(3, x: 6, y: 5)
        editor.fingerUp(3)
        #expect(editor.state.pixelCanvas.pixels().allSatisfy { $0 == 0 })
        #expect(!editor.state.canUndo)

        // Everything lifted — the view never hears the claimed touches' ends,
        // but the next begin's snapshot carries only itself. Drawing resumes.
        editor.sync([4: .direct])
        editor.fingerDown(4, x: 1, y: 1)
        editor.fingerUp(4)
        #expect(try editor.state.pixelCanvas.getPixel(x: 1, y: 1) == editor.state.foregroundColor)
    }
}

@Suite("TouchStrokeRouter — cancellation")
struct TouchStrokeRouterCancellationTests {

    @Test("system cancellation of a dragged stroke keeps its pixels and resolves the edit")
    func cancellationOfDraggedStrokeResolvesEdit() throws {
        let editor = RoutedEditor()

        editor.fingerDown(1, x: 2, y: 2)
        editor.fingerMove(1, x: 4, y: 2)
        editor.fingerCancel(1)

        // Freehand cancel keeps what it painted (existing semantics) and the
        // edit resolves — the stroke is over, not stuck mid-flight.
        for x: UInt32 in 2...4 {
            #expect(try editor.state.pixelCanvas.getPixel(x: x, y: 2) == editor.state.foregroundColor)
        }
        #expect(editor.state.canUndo)
        #expect(!editor.state.isDrawing)
    }

    @Test("a cancelled touch that never moved draws nothing, and the next tap draws normally")
    func cancelledPendingTouchDrawsNothing() throws {
        let editor = RoutedEditor()

        // E.g. a gesture recognizer claims the touch right after it lands.
        editor.fingerDown(1, x: 2, y: 2)
        editor.fingerCancel(1)
        #expect(editor.state.pixelCanvas.pixels().allSatisfy { $0 == 0 })
        #expect(!editor.state.canUndo)

        editor.fingerDown(2, x: 5, y: 5)
        editor.fingerUp(2)
        #expect(try editor.state.pixelCanvas.getPixel(x: 5, y: 5) == editor.state.foregroundColor)
    }
}

@Suite("TouchStrokeRouter — pencil")
struct TouchStrokeRouterPencilTests {

    @Test("a pencil touch paints immediately on touch-down, no deferral")
    func pencilPaintsOnTouchDown() throws {
        let editor = RoutedEditor()

        editor.pencilDown(1, x: 3, y: 3)
        #expect(try editor.state.pixelCanvas.getPixel(x: 3, y: 3) == editor.state.foregroundColor)

        editor.pencilUp(1)
        #expect(editor.state.canUndo)
    }

    @Test("a single resting finger neither replaces, feeds, nor ends a pencil stroke")
    func restingFingerDoesNotDisturbPencilStroke() throws {
        let editor = RoutedEditor()

        editor.pencilDown(1, x: 2, y: 2)
        editor.pencilMove(1, x: 3, y: 2)
        editor.fingerDown(2, x: 10, y: 10)
        editor.fingerMove(2, x: 11, y: 10)
        editor.pencilMove(1, x: 4, y: 2)
        editor.fingerUp(2)
        editor.pencilMove(1, x: 5, y: 2)
        editor.pencilUp(1)

        for x: UInt32 in 2...5 {
            #expect(try editor.state.pixelCanvas.getPixel(x: x, y: 2) == editor.state.foregroundColor)
        }
        #expect(try editor.state.pixelCanvas.getPixel(x: 10, y: 10).a == 0)
        #expect(try editor.state.pixelCanvas.getPixel(x: 11, y: 10).a == 0)

        // One continuous stroke — a single undo entry reverts it all.
        #expect(editor.state.canUndo)
        editor.state.handleUndo()
        #expect(editor.state.pixelCanvas.pixels().allSatisfy { $0 == 0 })
        #expect(!editor.state.canUndo)
    }
}
