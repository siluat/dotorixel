import Foundation
import Testing
@testable import Dotorixel

@Suite("Edit lifecycle — transition policy")
struct EditLifecycleTests {
    @Test("Playback cannot start over a live stroke, and the stroke still commits and undoes")
    func playbackStartPreservesLiveStroke() throws {
        let shared = SharedState()
        let clock = FakeFrameScheduler()
        let edit = EditLifecycle(shared: shared, width: 4, height: 4, frameScheduler: clock)

        edit.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        edit.startPlayback()

        #expect(!edit.isPlaying)
        #expect(!clock.hasScheduled)
        #expect(edit.isDrawing)
        edit.endStroke()
        #expect(try edit.content.getPixel(x: 1, y: 1) == shared.foregroundColor)
        edit.handleUndo()
        #expect(edit.content.composite().allSatisfy { $0 == 0 })
        #expect(edit.canRedo)
    }

    @Test("a failed Floating commit vetoes Playback but its partial edit remains undoable")
    func failedFloatingCommitVetoesPlayback() throws {
        let document = makeSingleLayerDocument(width: 4, height: 4)
        try document.setPixel(x: 1, y: 1, color: Color(r: 255, g: 0, b: 0, a: 255))
        try document.setMarquee(region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1))
        let faults = EditBindingFaults()
        let clock = FakeFrameScheduler()
        var failures: [String] = []
        let edit = try EditLifecycle(
            shared: SharedState(), snapshot: DocumentSnapshot.capture(document), frameScheduler: clock,
            restoreDocument: faults.restore, reportFailure: { failures.append($0) }
        )
        edit.nudgeMarquee(by: FloatingSelectionOffset(dx: 1, dy: 0))
        faults.refusesCommit = true

        edit.startPlayback()

        #expect(!edit.isPlaying)
        #expect(!clock.hasScheduled)
        #expect(!failures.isEmpty)
        #expect(edit.floatingSelectionOffset == nil)
        #expect(edit.hasUndoableEdit)
        edit.handleUndo()
        #expect(try edit.content.getPixel(x: 1, y: 1) == Color(r: 255, g: 0, b: 0, a: 255))
        #expect(!edit.hasUndoableEdit)
        #expect(edit.canRedo)
    }

    @Test("failed recovery vetoes Playback and structural edits, then Undo repairs it without consuming History")
    func recoveryVetoesFollowingTransitions() throws {
        let (edit, faults) = try makeRecoveryEdit()
        let initialFrames = edit.content.frames().map(\.id)
        #expect(!edit.cancelFloatingSelection())

        edit.startPlayback()
        edit.addFrame()
        edit.handleRedo()

        #expect(!edit.isPlaying)
        #expect(edit.content.frames().map(\.id) == initialFrames)
        #expect(edit.canUndo)
        #expect(!edit.hasUndoableEdit)
        #expect(!edit.canRedo)
        faults.refusesPixelRestore = false
        edit.handleUndo()
        #expect(try edit.content.getPixel(x: 1, y: 1) == Color(r: 255, g: 0, b: 0, a: 255))
        #expect(!edit.canUndo)
    }

    @Test("preview, committed Edit, and Frame navigation produce different persistence effects")
    func followUpEffectsDistinguishPreviewEditAndNavigation() throws {
        let document = makeSingleLayerDocument(width: 4, height: 4)
        let first = document.activeFrameId()
        try document.addFrame(newId: makeFrameId())
        let effects = EditEffectRecorder()
        let edit = try EditLifecycle(shared: SharedState(), snapshot: DocumentSnapshot.capture(document),
                                     frameScheduler: FakeFrameScheduler(), effects: effects.record)
        edit.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        #expect(effects.hasDisplayChange)
        #expect(!effects.hasDocumentChange)
        #expect(!edit.hasUndoableEdit)

        edit.endStroke()
        #expect(effects.hasDocumentChange)
        #expect(edit.hasUndoableEdit)
        effects.reset()
        edit.startPlayback()
        #expect(effects.hasDisplayChange)
        #expect(!effects.hasDocumentChange)
        effects.reset()
        edit.setActiveFrame(id: first)
        #expect(edit.isPlaying)
        #expect(effects.hasDocumentChange)
        #expect(!effects.hasHistoryChange)
    }

    @Test("content ownership isolates fixture writes and retained reads follow Undo replacement")
    func ownershipAndLiveReadsSurviveDocumentReplacement() throws {
        let document = makeSingleLayerDocument(width: 4, height: 4)
        try document.setPixel(x: 1, y: 1, color: Color(r: 255, g: 0, b: 0, a: 255))
        let edit = try EditLifecycle(shared: SharedState(), snapshot: DocumentSnapshot.capture(document))
        let content = edit.content
        document.clear()
        #expect(try content.getPixel(x: 1, y: 1) == Color(r: 255, g: 0, b: 0, a: 255))
        edit.resizeCanvas(width: 2, height: 2)
        #expect(content.width() == 2)
        edit.handleUndo()
        #expect(content.width() == 4)
        #expect(try content.getPixel(x: 1, y: 1) == Color(r: 255, g: 0, b: 0, a: 255))
    }

}


private final class EditEffectRecorder {
    var hasDisplayChange = false
    var hasDocumentChange = false
    var hasHistoryChange = false

    func record(_ effect: EditEffect) {
        switch effect {
        case .displayChanged: hasDisplayChange = true
        case .persistDocument: hasDocumentChange = true
        case .historyChanged: hasHistoryChange = true
        default: break
        }
    }

    func reset() {
        hasDisplayChange = false
        hasDocumentChange = false
        hasHistoryChange = false
    }
}
