import Foundation
import QuartzCore

/// One frame's playback-relevant data: its identity and display duration
/// (web parity: `PlaybackFrame` in `playback-controller.svelte.ts`).
struct PlaybackFrame {
    let id: String
    let durationMs: UInt32
}

/// Schedules animation callbacks for the playback clock. Mirrors the
/// requestAnimationFrame/cancelAnimationFrame contract the web controller is
/// built over, so production wraps a display-linked clock while tests drive
/// the clock by hand.
///
/// The callback's `timestampMs` must be monotonic non-decreasing (the
/// display-link contract). The clock loop relies on this: it clamps only the
/// upper bound of a delta (a backgrounded-app resume), never a backward jump.
protocol FrameScheduler {
    @discardableResult
    func request(_ callback: @escaping (_ timestampMs: Double) -> Void) -> Int
    func cancel(_ handle: Int)
}

/// The default scheduler: one display-linked fire per request. iOS arms a
/// `CADisplayLink`; macOS 14 has no standalone `CADisplayLink` constructor
/// (only view/screen-anchored ones), so it falls back to a 60 Hz one-shot
/// timer — a revisit candidate if playback smoothness ever demands it.
final class DisplayLinkFrameScheduler: FrameScheduler {
    private var pending: [Int: PendingTick] = [:]
    private var nextHandle = 1

    @discardableResult
    func request(_ callback: @escaping (_ timestampMs: Double) -> Void) -> Int {
        let handle = nextHandle
        nextHandle += 1
        let tick = PendingTick { [weak self] timestampMs in
            self?.pending[handle] = nil
            callback(timestampMs)
        }
        pending[handle] = tick
        tick.arm()
        return handle
    }

    func cancel(_ handle: Int) {
        pending.removeValue(forKey: handle)?.disarm()
    }

    deinit {
        // The platform timer sources retain their PendingTick target, so an
        // armed entry would outlive this scheduler unless disarmed here.
        pending.values.forEach { $0.disarm() }
    }
}

/// One armed one-shot clock fire, owning its platform timer source.
private final class PendingTick: NSObject {
    private let fire: (_ timestampMs: Double) -> Void
    #if os(macOS)
    private var timer: Timer?
    #else
    private var link: CADisplayLink?
    #endif

    init(fire: @escaping (_ timestampMs: Double) -> Void) {
        self.fire = fire
    }

    func arm() {
        #if os(macOS)
        // Added to .common (not the scheduled default mode) so the tick keeps
        // firing while the run loop is event-tracking (menu open, drag) — the
        // same modes the iOS display link registers for.
        let timer = Timer(timeInterval: 1.0 / 60.0, repeats: false) { [weak self] _ in
            self?.fire(CACurrentMediaTime() * 1000)
        }
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
        #else
        let link = CADisplayLink(target: self, selector: #selector(handleFire(_:)))
        link.add(to: .main, forMode: .common)
        self.link = link
        #endif
    }

    func disarm() {
        #if os(macOS)
        timer?.invalidate()
        timer = nil
        #else
        link?.invalidate()
        link = nil
        #endif
    }

    #if !os(macOS)
    @objc private func handleFire(_ link: CADisplayLink) {
        disarm()
        fire(link.timestamp * 1000)
    }
    #endif
}

struct PlaybackControllerDeps {
    /// The Document's frames in axis order, read live each tick. Never empty —
    /// a Document always holds at least one frame, so `start()` trusts the
    /// first element.
    let getFrames: () -> [PlaybackFrame]
    /// Request a re-composite of the display buffer. Called only when the
    /// displayed frame changes — on start, on each playhead advance, and on
    /// stop — never on a tick that leaves the playhead frame unchanged.
    let requestRender: () -> Void
    let frameScheduler: FrameScheduler
}

/// The headless playback engine for one tab (web parity: `PlaybackController`
/// in `playback-controller.svelte.ts`): it owns the transient playhead and a
/// clock, feeding the playhead composite into the display buffer the renderer
/// already reads. Playback never mutates the Document — no dirty mark, no
/// history entry, no moved Active Frame.
///
/// `isPlaying`, `isLooping`, and `playheadFrameId` are transient state, never
/// persisted; a tab always starts stopped. The clock loop is a thin wrapper
/// over the pure `advancePlayhead` decision, which it feeds real wall-clock
/// deltas.
@Observable
final class PlaybackController {
    @ObservationIgnored private let deps: PlaybackControllerDeps

    private(set) var isPlaying = false
    private(set) var isLooping = false
    /// The frame the display buffer should show, or `nil` while stopped.
    private(set) var playheadFrameId: String?

    /// A backgrounded app hands the clock a multi-second delta on resume;
    /// clamp it so playback never fast-forwards through a burst of frames
    /// when the app returns (web parity: `MAX_FRAME_DELTA_MS`).
    private static let maxFrameDeltaMs: Double = 1000

    @ObservationIgnored private var accumulatedMs: Double = 0
    @ObservationIgnored private var lastTimestampMs: Double?
    @ObservationIgnored private var scheduledHandle: Int?

    init(deps: PlaybackControllerDeps) {
        self.deps = deps
    }

    /// Starts playback from the first frame — a predictable, repeatable
    /// preview. No-op when already playing. Edit-state resolution (committing
    /// an in-flight Floating Selection) is the caller's contract, upheld at
    /// the `TabState` boundary.
    func start() {
        guard !isPlaying else { return }
        isPlaying = true
        playheadFrameId = deps.getFrames()[0].id
        accumulatedMs = 0
        lastTimestampMs = nil
        deps.requestRender()
        scheduleNextFrame()
    }

    /// Stops playback and discards the playhead, returning the display to the
    /// Active Frame. Serves Pause, a loop-off completion, and lifecycle
    /// teardown alike. No-op when already stopped.
    func stop() {
        guard isPlaying else { return }
        cancelScheduledFrame()
        isPlaying = false
        playheadFrameId = nil
        accumulatedMs = 0
        lastTimestampMs = nil
        deps.requestRender()
    }

    func toggleLoop() {
        isLooping.toggle()
    }

    private func scheduleNextFrame() {
        scheduledHandle = deps.frameScheduler.request { [weak self] timestampMs in
            self?.onFrame(timestampMs: timestampMs)
        }
    }

    private func cancelScheduledFrame() {
        if let handle = scheduledHandle {
            deps.frameScheduler.cancel(handle)
            scheduledHandle = nil
        }
    }

    private func onFrame(timestampMs: Double) {
        scheduledHandle = nil
        guard isPlaying else { return }

        // The first tick after start only primes the clock baseline — no time
        // has elapsed against the playhead yet.
        guard let lastTimestamp = lastTimestampMs else {
            lastTimestampMs = timestampMs
            scheduleNextFrame()
            return
        }

        lastTimestampMs = timestampMs
        accumulatedMs += min(timestampMs - lastTimestamp, Self.maxFrameDeltaMs)

        let frames = deps.getFrames()
        guard let currentIndex = frames.firstIndex(where: { $0.id == playheadFrameId }) else {
            // The playhead frame vanished from under us — stop defensively.
            stop()
            return
        }

        let result = advancePlayhead(
            playheadIndex: currentIndex,
            accumulatedMs: accumulatedMs,
            durations: frames.map(\.durationMs),
            isLooping: isLooping
        )
        accumulatedMs = result.carryMs

        if result.stopped {
            // Stopping returns the display to the Active Frame, so rendering
            // the last playhead frame first is pointless — stop() supersedes
            // it within this same tick.
            stop()
            return
        }

        if result.nextIndex != currentIndex {
            playheadFrameId = frames[result.nextIndex].id
            deps.requestRender()
        }

        scheduleNextFrame()
    }
}
