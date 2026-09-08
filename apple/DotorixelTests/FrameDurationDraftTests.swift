import Testing
@testable import Dotorixel

/// Input validation exercised through the same lifecycle as the Timeline,
/// including actual Edit admission, stored-value reconciliation, and History.
@Suite("Frame Duration Draft — input validation through the lifecycle")
struct FrameDurationDraftTests {
    private static let inputCases: [(String, UInt32, UInt32)] = [
        ("250", UInt32(100), UInt32(250)),
        (" 250 ", 100, 250),
        ("250\n", 100, 250),
        ("\n 250", 100, 250),
        ("", 100, 100),
        ("   ", 100, 100),
        ("abc", 100, 100),
        ("100.5", 100, 100),
        ("12a", 100, 100),
        ("1e3", 100, 100),
        ("100", 100, 100),
        ("0", 100, frameMinDurationMs()),
        ("-5", 100, frameMinDurationMs()),
        (String(UInt64(frameMaxDurationMs()) + 1), 100, frameMaxDurationMs()),
        ("99999999999999999999", 100, frameMaxDurationMs()),
        ("-5", frameMinDurationMs(), frameMinDurationMs()),
        ("99999999999999999999", frameMaxDurationMs(), frameMaxDurationMs())
    ]

    @Test("confirmation clamps or reverts input without destroying a no-op's redo future", arguments: inputCases)
    func confirmInput(inputCase: (input: String, initial: UInt32, expected: UInt32)) throws {
        let (input, initial, expected) = inputCase
        let prepared = makeSingleLayerDocument(width: 8, height: 8)
        try prepared.setFrameDuration(id: prepared.activeFrameId(), durationMs: initial)
        let tab = workspaceWithDocument(prepared).activeTab
        tab.setFrameDuration(id: tab.activeFrameId, durationMs: 500)
        tab.handleUndo()
        #expect(tab.canRedo)

        let draft = FrameDurationDraft(tab: tab)
        draft.focusChanged(isFocused: true)
        draft.text = input
        draft.confirm()
        #expect(draft.text == String(expected))
        #expect(tab.frameColumns[0].durationMs == expected)
        if expected == initial {
            #expect(!tab.canUndo)
            #expect(tab.canRedo)
            tab.handleRedo()
            #expect(tab.frameColumns[0].durationMs == 500)
        } else {
            #expect(!tab.canRedo)
            tab.handleUndo()
            #expect(tab.frameColumns[0].durationMs == initial)
            #expect(!tab.canUndo)
        }
    }
}
