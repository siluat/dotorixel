import CoreGraphics

/// The species of touch feeding the router — mirrors `UITouch.TouchType`,
/// kept platform-neutral so the router (and its tests) compile without UIKit.
enum TouchKind {
    case direct
    case pencil
    case indirectPointer
}

/// A drawing command the router tells its owner to forward to the
/// `CanvasInputDelegate` — the router decides *whether* an event drives the
/// stroke; the owner only executes.
enum StrokeRoutingCommand: Equatable {
    case begin(point: CGPoint, kind: TouchKind)
    case move(point: CGPoint)
    case end
    case cancel
}

/// Routes raw multi-touch events into single-stroke drawing commands
/// (issue 245, web parity with the canvas interaction machine).
///
/// One stroke at a time, bound to its originating touch: other touches'
/// events never feed it.
struct TouchStrokeRouter<TouchID: Hashable> {

    /// The one stroke the router drives. A direct-finger begin is held
    /// `pending` until the touch moves or lifts (web parity: the interaction
    /// machine defers touch draws so a pinch start never paints).
    private enum Stroke {
        case none
        case pending(touch: TouchID, point: CGPoint)
        case active(touch: TouchID)
    }

    private var stroke: Stroke = .none

    /// Every touch currently down, drawing or not — the owner must feed all
    /// touch events, not just the originating touch's. Drawing only resumes
    /// once this empties: a touch left over from a gesture must not draw.
    private var downTouches: [TouchID: TouchKind] = [:]

    /// Two fingers down is the gesture signal (pinch/pan) — pencil and
    /// indirect pointers never count toward it (web parity: only `touch`
    /// pointers enter the two-pointer gesture check).
    private var isGestureSignal: Bool {
        downTouches.values.count(where: { $0 == .direct }) >= 2
    }

    /// The begin a pending stroke flushes on its first move or lift — always
    /// a direct finger, because only fingers defer their begin.
    private static func deferredBegin(at point: CGPoint) -> StrokeRoutingCommand {
        .begin(point: point, kind: .direct)
    }

    /// Replaces the down-touch set with the platform's authoritative
    /// snapshot (`event.allTouches` at a begin boundary). Touches a gesture
    /// recognizer claimed leave via `touchCancelled` while their fingers stay
    /// on the glass — the snapshot restores them so the episode keeps
    /// blocking new strokes — and touches whose lift never reached the view
    /// drop out. The stroke itself is untouched: only begin admission reads
    /// this set.
    mutating func syncDownTouches(_ snapshot: [TouchID: TouchKind]) {
        downTouches = snapshot
    }

    mutating func touchBegan(_ id: TouchID, kind: TouchKind, at point: CGPoint) -> [StrokeRoutingCommand] {
        downTouches[id] = kind
        switch stroke {
        case .none:
            guard downTouches.count == 1 else { return [] }
            // Only a direct finger defers its begin (it may turn out to be a
            // gesture start); pencil and indirect pointers draw immediately
            // (web parity: only `touch` pointers are deferred).
            guard kind == .direct else {
                stroke = .active(touch: id)
                return [.begin(point: point, kind: kind)]
            }
            stroke = .pending(touch: id, point: point)
            return []
        case .pending:
            // A second finger before the deferred begin flushed is a gesture
            // start, not drawing — discard the pending begin so a pinch never
            // paints (web parity). A pencil landing here is not a gesture
            // signal and is simply ignored.
            guard isGestureSignal else { return [] }
            stroke = .none
            return []
        case .active:
            // The gesture signal ends the stroke, committing what was drawn
            // (web parity: second touch ends the draw). A single resting
            // finger during a pencil stroke is not a gesture — ignore it.
            guard isGestureSignal else { return [] }
            stroke = .none
            return [.end]
        }
    }

    mutating func touchMoved(_ id: TouchID, to point: CGPoint) -> [StrokeRoutingCommand] {
        switch stroke {
        case .pending(let touch, let downPoint) where touch == id:
            stroke = .active(touch: id)
            return [Self.deferredBegin(at: downPoint), .move(point: point)]
        case .active(let touch) where touch == id:
            return [.move(point: point)]
        default:
            return []
        }
    }

    mutating func touchEnded(_ id: TouchID) -> [StrokeRoutingCommand] {
        downTouches.removeValue(forKey: id)
        switch stroke {
        case .pending(let touch, let downPoint) where touch == id:
            // A tap: the deferred begin flushes on release, so the dot lands
            // only when the touch turned out not to be a gesture start.
            stroke = .none
            return [Self.deferredBegin(at: downPoint), .end]
        case .active(let touch) where touch == id:
            stroke = .none
            return [.end]
        default:
            return []
        }
    }

    mutating func touchCancelled(_ id: TouchID) -> [StrokeRoutingCommand] {
        downTouches.removeValue(forKey: id)
        switch stroke {
        case .pending(let touch, _) where touch == id:
            // The deferred begin never fired — nothing to tear down.
            stroke = .none
            return []
        case .active(let touch) where touch == id:
            stroke = .none
            return [.cancel]
        default:
            return []
        }
    }
}
