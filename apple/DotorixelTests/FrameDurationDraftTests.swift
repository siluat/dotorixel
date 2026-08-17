import Foundation
import Testing
@testable import Dotorixel

/// Draft-commit resolution for the Timeline's duration editor (issue 287):
/// how the field's raw in-progress text resolves on commit — a value to
/// dispatch, or `nil` to revert the draft to the stored duration. Web parity
/// (`commitFrameDuration` in `TimelinePanel.svelte`), except that the web
/// forwards out-of-range integers for the WASM boundary to clamp; the Swift
/// shell resolves them here because a `UInt32` dispatch cannot carry them.
@Suite("Frame duration draft resolution")
struct FrameDurationDraftTests {

    @Test("a changed in-range integer resolves to its value")
    func changedInRangeIntegerResolves() {
        #expect(FrameDurationDraft.resolveCommit(draft: "250", current: 100) == 250)
    }

    @Test("surrounding whitespace and newlines do not invalidate the entry")
    func whitespaceAndNewlinesAreTrimmed() {
        #expect(FrameDurationDraft.resolveCommit(draft: " 250 ", current: 100) == 250)
        // A pasted value can carry a line break; the web's `trim()` strips it.
        #expect(FrameDurationDraft.resolveCommit(draft: "250\n", current: 100) == 250)
        #expect(FrameDurationDraft.resolveCommit(draft: "\n 250", current: 100) == 250)
    }

    @Test(
        "empty, non-numeric, and fractional entries revert — duration is integer ms",
        arguments: ["", "   ", "abc", "100.5", "12a", "1e3"]
    )
    func invalidEntriesRevert(draft: String) {
        #expect(FrameDurationDraft.resolveCommit(draft: draft, current: 250) == nil)
    }

    @Test("committing the stored value reverts without dispatching")
    func unchangedCommitReverts() {
        #expect(FrameDurationDraft.resolveCommit(draft: "250", current: 250) == nil)
    }

    @Test("an entry above the range resolves to the binding-owned maximum")
    func aboveRangeClampsToTheBindingMaximum() {
        let overMax = String(UInt64(frameMaxDurationMs()) + 1)
        #expect(FrameDurationDraft.resolveCommit(draft: overMax, current: 100) == frameMaxDurationMs())
        // Far past what a UInt32 dispatch could even carry — still the maximum.
        #expect(
            FrameDurationDraft.resolveCommit(draft: "99999999999999999999", current: 100)
                == frameMaxDurationMs()
        )
    }

    @Test("a zero or negative entry resolves to the binding-owned minimum")
    func zeroOrNegativeClampsToTheBindingMinimum() {
        #expect(FrameDurationDraft.resolveCommit(draft: "0", current: 100) == frameMinDurationMs())
        #expect(FrameDurationDraft.resolveCommit(draft: "-5", current: 100) == frameMinDurationMs())
    }

    @Test("a clamp that lands on the stored value reverts without dispatching")
    func clampLandingOnTheStoredValueReverts() {
        let overMax = String(UInt64(frameMaxDurationMs()) + 1)
        #expect(
            FrameDurationDraft.resolveCommit(draft: overMax, current: frameMaxDurationMs()) == nil
        )
    }
}
