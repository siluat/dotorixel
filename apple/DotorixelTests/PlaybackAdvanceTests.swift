import Foundation
import Testing
@testable import Dotorixel

/// The pure playhead-advance decision under the playback clock (issue 288) —
/// the Swift port of the web's `advancePlayhead` matrix, driven with synthetic
/// elapsed values so no real clock is involved.
@Suite("Playback — pure advance")
struct PlaybackAdvanceTests {

    @Test("a frame advances once its own duration has elapsed")
    func advancesAtItsOwnDuration() {
        let result = advancePlayhead(
            playheadIndex: 0,
            accumulatedMs: 100,
            durations: [100, 200],
            isLooping: false
        )

        #expect(result == PlayheadAdvance(nextIndex: 1, carryMs: 0, stopped: false))
    }

    @Test("a frame holds while less than its own duration has accumulated")
    func holdsProportionallyToItsOwnDuration() {
        let result = advancePlayhead(
            playheadIndex: 1,
            accumulatedMs: 199,
            durations: [100, 200],
            isLooping: false
        )

        // The banked 199ms stays banked: the 200ms frame has not completed.
        #expect(result == PlayheadAdvance(nextIndex: 1, carryMs: 199, stopped: false))
    }

    @Test("leftover time carries across frames without drift")
    func carriesLeftoverTimeAcrossFrames() {
        let result = advancePlayhead(
            playheadIndex: 0,
            accumulatedMs: 250,
            durations: [100, 100, 100],
            isLooping: false
        )

        // 250ms crosses two 100ms frames in one call; the 50ms remainder is
        // carried, not dropped, so variable tick sizes never drift the timing.
        #expect(result == PlayheadAdvance(nextIndex: 2, carryMs: 50, stopped: false))
    }

    @Test("with Loop on, the sequence end wraps back to the first frame")
    func loopOnWrapsToTheFirstFrame() {
        let result = advancePlayhead(
            playheadIndex: 1,
            accumulatedMs: 250,
            durations: [100, 200],
            isLooping: true
        )

        // 200ms completes the last frame and wraps; the remaining 50ms banks
        // against the first frame's fresh hold.
        #expect(result == PlayheadAdvance(nextIndex: 0, carryMs: 50, stopped: false))
    }

    @Test("with Loop off, running off the last frame stops on it")
    func loopOffStopsOnTheLastFrame() {
        let result = advancePlayhead(
            playheadIndex: 1,
            accumulatedMs: 250,
            durations: [100, 200],
            isLooping: false
        )

        // The last frame completed and there is nothing to advance to: stop,
        // dropping the leftover time.
        #expect(result == PlayheadAdvance(nextIndex: 1, carryMs: 0, stopped: true))
    }

    @Test("a single-frame sequence neither advances nor auto-stops", arguments: [false, true])
    func singleFrameSequenceHoldsForever(isLooping: Bool) {
        let result = advancePlayhead(
            playheadIndex: 0,
            accumulatedMs: 250,
            durations: [100],
            isLooping: isLooping
        )

        // One frame holds forever regardless of Loop; banked time is dropped
        // rather than accumulated toward an advance that can never come.
        #expect(result == PlayheadAdvance(nextIndex: 0, carryMs: 0, stopped: false))
    }
}
