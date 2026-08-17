import Foundation

/// The outcome of advancing the playhead by some banked wall-clock time
/// (web parity: `PlayheadAdvance` in `playback-advance.ts`). `carryMs` is the
/// leftover time that did not complete the next frame — banked toward the
/// following tick so variable durations never drift.
struct PlayheadAdvance: Equatable {
    let nextIndex: Int
    let carryMs: Double
    let stopped: Bool
}

/// Pure advance decision for the playback clock — the testability seam under
/// the display-linked tick (web parity: `advancePlayhead`). Given the current
/// `playheadIndex`, the `accumulatedMs` of banked wall-clock time, the
/// per-frame `durations` in axis order, and whether playback `isLooping`, it
/// returns the frame to show next, the leftover time to carry, and whether
/// playback ran off the end.
///
/// Each frame holds for its own `durations[index]` before the playhead
/// advances; a large banked time can cross several frames in one call.
/// `durations` are the Document's `durationMs` values, which the binding
/// boundary clamps to `>= 1` ms.
func advancePlayhead(
    playheadIndex: Int,
    accumulatedMs: Double,
    durations: [UInt32],
    isLooping: Bool
) -> PlayheadAdvance {
    // A single-frame sequence holds forever: it neither advances nor auto-stops.
    if durations.count <= 1 {
        return PlayheadAdvance(nextIndex: playheadIndex, carryMs: 0, stopped: false)
    }
    var index = playheadIndex
    var remaining = accumulatedMs
    while remaining >= Double(durations[index]) {
        remaining -= Double(durations[index])
        if index < durations.count - 1 {
            index += 1
        } else if isLooping {
            index = 0
        } else {
            // Loop off: ran off the last frame — stop, dropping leftover time.
            return PlayheadAdvance(nextIndex: index, carryMs: 0, stopped: true)
        }
    }
    return PlayheadAdvance(nextIndex: index, carryMs: remaining, stopped: false)
}
