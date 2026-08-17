import Foundation
@testable import Dotorixel

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
