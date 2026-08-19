import Foundation
@testable import Dotorixel

/// A tab whose document carries a second frame, with the first frame
/// re-activated so tests start at ordinal 1, plus the hand-driven clock its
/// playback controller schedules against — the shared fixture of the
/// playback and onion-skin suites.
func makeTwoFrameTab() throws -> (
    tab: TabState, first: String, second: String, clock: FakeFrameScheduler
) {
    let clock = FakeFrameScheduler()
    let workspace = Workspace(width: 8, height: 8, frameScheduler: clock)
    let tab = workspace.activeTab
    let first = tab.document.activeFrameId()
    let second = makeFrameId()
    try tab.document.addFrame(newId: second)
    try tab.document.setActiveFrame(id: first)
    return (tab, first, second, clock)
}

/// A hand-driven stand-in for the display-linked playback clock (web parity:
/// `fake-frame-scheduler.ts`): it records the pending callback so a test can
/// fire ticks at chosen timestamps, making the playback clock deterministic.
/// Only one tick is ever pending at a time, matching how the controller
/// reschedules a single tick per fire.
final class FakeFrameScheduler: FrameScheduler {
    private var scheduled: ((Double) -> Void)?
    private var nextHandle = 1

    /// Whether a tick is currently scheduled — i.e., the clock is still running.
    var hasScheduled: Bool { scheduled != nil }

    func request(_ callback: @escaping (Double) -> Void) -> Int {
        // The controller keeps exactly one tick pending; trapping on a second
        // schedule surfaces a double-schedule regression instead of silently
        // dropping the earlier callback.
        precondition(scheduled == nil, "Animation frame already scheduled")
        scheduled = callback
        defer { nextHandle += 1 }
        return nextHandle
    }

    func cancel(_ handle: Int) {
        scheduled = nil
    }

    /// Fires the currently-scheduled tick at absolute `timestampMs` (mirrors
    /// the display-link contract: monotonic non-decreasing timestamps).
    func fireAt(_ timestampMs: Double) {
        guard let callback = scheduled else {
            preconditionFailure("No animation frame scheduled")
        }
        scheduled = nil
        callback(timestampMs)
    }
}
