import Foundation
import Testing
@testable import Dotorixel

@Suite("Frame Duration Draft lifecycle")
struct FrameDurationLifecycleTests {
    @Test("focus loss after Undo cannot restore stale input before the observation callback arrives")
    func undoBeforeFocusLoss() {
        let tab = Workspace(width: 8, height: 8).activeTab
        tab.setFrameDuration(id: tab.activeFrameId, durationMs: 250)
        let draft = FrameDurationDraft(tab: tab)
        draft.focusChanged(isFocused: true)
        draft.text = "300"
        tab.handleUndo()
        draft.focusChanged(isFocused: false)

        #expect(draft.text == "100")
        #expect(tab.frameColumns[0].durationMs == 100)
        #expect(!tab.canUndo)
        #expect(tab.canRedo)
    }

    @Test("a missing originating Frame never redirects a pending duration to its replacement")
    func removedFrame() {
        let tab = Workspace(width: 8, height: 8).activeTab
        let surviving = tab.activeFrameId
        tab.addFrame()
        let removed = tab.activeFrameId
        let draft = FrameDurationDraft(tab: tab)
        draft.focusChanged(isFocused: true)
        draft.text = "250"
        tab.removeFrame(id: removed)
        draft.synchronize()
        draft.finish()

        #expect(tab.activeFrameId == surviving)
        #expect(tab.frameColumns[0].durationMs == 100)
        #expect(draft.text == "100")
        tab.handleUndo()
        #expect(tab.frameColumns.contains(where: { $0.id == removed && $0.durationMs == 100 }))
    }

    @Test("a rejected confirmation reconciles immediately and never retries after the stroke")
    func rejectedWhileDrawing() {
        let tab = Workspace(width: 8, height: 8).activeTab
        let draft = FrameDurationDraft(tab: tab)
        draft.focusChanged(isFocused: true)
        draft.text = "250"
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        draft.confirm()
        #expect(draft.text == "100")
        #expect(tab.frameColumns[0].durationMs == 100)
        tab.endStroke()
        draft.finish()
        tab.handleUndo()
        #expect(!tab.canUndo)
        #expect(tab.frameColumns[0].durationMs == 100)
    }

    @Test("ending the old input cannot release a newly focused input's shortcut claim")
    func focusClaimsSurviveLateTeardown() {
        let workspace = Workspace(width: 8, height: 8)
        let firstOwner = UUID()
        let secondOwner = UUID()
        let first = FrameDurationDraft(tab: workspace.activeTab, onFocusChange: {
            workspace.setTextInputFocus(owner: .frameDurationEditor(firstOwner), isFocused: $0)
        })
        let second = FrameDurationDraft(tab: workspace.activeTab, onFocusChange: {
            workspace.setTextInputFocus(owner: .frameDurationEditor(secondOwner), isFocused: $0)
        })
        first.focusChanged(isFocused: true)
        second.focusChanged(isFocused: true)
        first.finish()
        first.focusChanged(isFocused: false)
        #expect(workspace.isTextInputFocused)
        second.finish()
        #expect(!workspace.isTextInputFocused)
    }

    enum Completion: CaseIterable {
        case submit
        case blur
        case cancel
        case finish
    }

    @Test("completion and late focus events resolve a draft once", arguments: Completion.allCases)
    func completesOnce(completion: Completion) {
        let tab = Workspace(width: 8, height: 8).activeTab
        let draft = FrameDurationDraft(tab: tab)
        draft.focusChanged(isFocused: true)
        draft.text = "250"
        switch completion {
        case .submit: draft.confirm()
        case .blur: draft.focusChanged(isFocused: false)
        case .cancel: draft.cancel()
        case .finish: draft.finish()
        }
        draft.finish()
        draft.focusChanged(isFocused: false)
        draft.focusChanged(isFocused: true)
        draft.text = "900"
        draft.confirm()

        #expect(!draft.isFocused)
        if completion == .cancel {
            #expect(tab.frameColumns[0].durationMs == 100)
            #expect(!tab.canUndo)
        } else {
            #expect(tab.frameColumns[0].durationMs == 250)
            tab.handleUndo()
            #expect(tab.frameColumns[0].durationMs == 100)
            #expect(!tab.canUndo)
        }
    }

    @Test("a confirmation echo preserves newly typed text; Undo and Redo reconcile the stored value")
    func reconcilesStoredChanges() {
        let tab = Workspace(width: 8, height: 8).activeTab
        let draft = FrameDurationDraft(tab: tab)
        draft.focusChanged(isFocused: true)
        draft.text = "250"
        draft.confirm()
        draft.text = "300"
        draft.synchronize()
        #expect(draft.text == "300")

        tab.handleUndo()
        draft.synchronize()
        #expect(draft.text == "100")
        tab.handleRedo()
        draft.synchronize()
        #expect(draft.text == "250")
    }

    @Test("switching Frames confirms the originating Frame and displays the destination's duration")
    func switchesFrame() {
        let tab = Workspace(width: 8, height: 8).activeTab
        let first = tab.activeFrameId
        tab.addFrame()
        let second = tab.activeFrameId
        tab.setFrameDuration(id: second, durationMs: 500)
        tab.setActiveFrame(id: first)
        let draft = FrameDurationDraft(tab: tab)
        draft.focusChanged(isFocused: true)
        draft.text = "250"

        tab.setActiveFrame(id: second)
        draft.synchronize()

        #expect(tab.frameColumns.first(where: { $0.id == first })?.durationMs == 250)
        #expect(tab.frameColumns.first(where: { $0.id == second })?.durationMs == 500)
        #expect(draft.text == "500")
        #expect(draft.isFocused)
        tab.handleUndo()
        #expect(tab.frameColumns.first(where: { $0.id == first })?.durationMs == 100)
    }

    @Test("typing stays transient; confirming retimes the Frame once and supports Undo/Redo")
    func confirmsThroughEdit() {
        let tab = Workspace(width: 8, height: 8).activeTab
        let draft = FrameDurationDraft(tab: tab)
        draft.focusChanged(isFocused: true)
        draft.text = "250"

        #expect(tab.frameColumns[0].durationMs == 100)
        #expect(!tab.canUndo)
        draft.confirm()

        #expect(draft.text == "250")
        #expect(draft.isFocused)
        #expect(tab.frameColumns[0].durationMs == 250)
        tab.handleUndo()
        #expect(tab.frameColumns[0].durationMs == 100)
        #expect(!tab.canUndo)
        tab.handleRedo()
        #expect(tab.frameColumns[0].durationMs == 250)
    }
}
