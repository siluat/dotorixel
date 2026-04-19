//! Pixel Perfect stroke filter.
//!
//! Removes the middle pixel of L-corner joints from a stream of pen path
//! coordinates so free-hand strokes don't leave double-pixel artifacts at
//! diagonal bends. The filter is stateless — callers thread the `TailState`
//! between successive calls so window-based judgments spanning call
//! boundaries stay consistent.
//!
//! An L-corner is three consecutive points `(prev, cur, next)` where
//! `prev`–`cur` and `cur`–`next` are orthogonal neighbors but `prev` and
//! `next` differ on both axes. See [`is_l_corner`] for the exact rule.

/// An action the caller applies to the canvas.
///
/// `Paint(x, y)` commits a new pixel. `Revert(x, y)` restores the coordinate
/// to the color it held before the current stroke began — paired with a
/// caller-side first-touch cache.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "uniffi", derive(uniffi::Enum))]
pub enum Action {
    Paint(i32, i32),
    Revert(i32, i32),
}

/// Carry state between filter calls. Represents the 0–2 most recent points
/// whose L-corner judgment may still be pending.
///
/// Variants use positional `i32` fields rather than tuple payloads so the
/// type is compatible with UniFFI's automatic enum bindings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "uniffi", derive(uniffi::Enum))]
pub enum TailState {
    Empty,
    One(i32, i32),
    Two(i32, i32, i32, i32),
}

/// Actions produced by one filter call, plus the updated tail to feed into
/// the next call.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "uniffi", derive(uniffi::Record))]
pub struct FilterResult {
    pub actions: Vec<Action>,
    pub new_tail: TailState,
}

/// Applies the L-corner filter to a batch of points.
///
/// `points` is a coordinate sequence (typically one `pointermove` worth of
/// Bresenham output). `prev_tail` carries the last 0–2 points of the
/// *effective* (post-revert) path from a prior call so L-corners that span
/// the call boundary are still judged against the same shortened sequence.
///
/// The returned `actions` are ordered as all `Paint`s first (one per input
/// point, in input order), followed by any `Revert`s emitted for L-corner
/// tips discovered while building the effective path. A reverted tip is
/// dropped from the path so it can't participate in further 3-window
/// judgments — otherwise a staircase of successive L-corners cascades and
/// wipes out the diagonal pixels the filter is meant to preserve.
pub fn pixel_perfect_filter(
    points: &[(i32, i32)],
    prev_tail: TailState,
) -> FilterResult {
    let mut actions: Vec<Action> = points
        .iter()
        .map(|&(x, y)| Action::Paint(x, y))
        .collect();

    let mut effective: Vec<(i32, i32)> = Vec::with_capacity(2 + points.len());
    match prev_tail {
        TailState::Empty => {}
        TailState::One(x, y) => effective.push((x, y)),
        TailState::Two(ax, ay, bx, by) => {
            effective.push((ax, ay));
            effective.push((bx, by));
        }
    }

    for &pt in points {
        effective.push(pt);
        let n = effective.len();
        if n >= 3 && is_l_corner(effective[n - 3], effective[n - 2], effective[n - 1]) {
            let (cx, cy) = effective[n - 2];
            actions.push(Action::Revert(cx, cy));
            effective.remove(n - 2);
        }
    }

    let new_tail = match effective.as_slice() {
        [] => TailState::Empty,
        [(x, y)] => TailState::One(*x, *y),
        [.., (ax, ay), (bx, by)] => TailState::Two(*ax, *ay, *bx, *by),
    };

    FilterResult { actions, new_tail }
}

/// Returns `true` when `cur` is the middle of an L-corner.
///
/// The rule: `prev` and `cur` share an axis (orthogonal neighbor), `cur` and
/// `next` share an axis, and `prev` differs from `next` on both axes
/// (diagonal relation). Matches Aseprite's `IntertwineAsPixelPerfect`.
pub fn is_l_corner(prev: (i32, i32), cur: (i32, i32), next: (i32, i32)) -> bool {
    (prev.0 == cur.0 || prev.1 == cur.1)
        && (cur.0 == next.0 || cur.1 == next.1)
        && prev.0 != next.0
        && prev.1 != next.1
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── tracer: single point ────────────────────────────────────

    #[test]
    fn single_point_paints_once_and_tail_transitions_to_one() {
        let result = pixel_perfect_filter(&[(3, 5)], TailState::Empty);
        assert_eq!(result.actions, vec![Action::Paint(3, 5)]);
        assert_eq!(result.new_tail, TailState::One(3, 5));
    }

    // ── two points ──────────────────────────────────────────────

    #[test]
    fn two_points_paint_in_order_and_tail_transitions_to_two() {
        let result = pixel_perfect_filter(&[(1, 2), (3, 4)], TailState::Empty);
        assert_eq!(
            result.actions,
            vec![Action::Paint(1, 2), Action::Paint(3, 4)]
        );
        assert_eq!(result.new_tail, TailState::Two(1, 2, 3, 4));
    }

    // ── three collinear points (not an L-corner) ───────────────

    #[test]
    fn three_collinear_points_paint_only_no_revert() {
        for (name, points) in [
            ("horizontal", vec![(0, 0), (1, 0), (2, 0)]),
            ("vertical", vec![(0, 0), (0, 1), (0, 2)]),
            ("diagonal-ne", vec![(0, 0), (1, 1), (2, 2)]),
            ("diagonal-se", vec![(0, 2), (1, 1), (2, 0)]),
        ] {
            let result = pixel_perfect_filter(&points, TailState::Empty);
            let expected: Vec<_> = points.iter().map(|&(x, y)| Action::Paint(x, y)).collect();
            assert_eq!(result.actions, expected, "case: {name}");
            assert!(
                result.actions.iter().all(|a| matches!(a, Action::Paint(_, _))),
                "case: {name} — unexpected Revert"
            );
        }
    }

    // ── three points forming an L-corner ───────────────────────

    #[test]
    fn three_points_with_l_corner_emit_revert_for_middle() {
        // (0,0) → (1,0): right (orthogonal)
        // (1,0) → (1,1): down  (orthogonal)
        // (0,0) ↔ (1,1): diagonal — middle (1,0) is the L-corner tip
        let result = pixel_perfect_filter(&[(0, 0), (1, 0), (1, 1)], TailState::Empty);
        assert_eq!(
            result.actions,
            vec![
                Action::Paint(0, 0),
                Action::Paint(1, 0),
                Action::Paint(1, 1),
                Action::Revert(1, 0),
            ]
        );
        // Tail reflects the effective (post-revert) path: the reverted tip
        // (1,0) is gone so subsequent batches judge new points against the
        // shortened sequence (0,0)(1,1), not the raw input.
        assert_eq!(result.new_tail, TailState::Two(0, 0, 1, 1));
    }

    // ── L-corner in all 8 orientations ─────────────────────────

    #[test]
    fn l_corner_detected_in_every_orientation() {
        // Origin → cardinal → perpendicular. 4 cardinals × 2 turns = 8 shapes.
        // Tip is always the middle point; both turn directions must emit Revert.
        let cases: &[(&str, [(i32, i32); 3])] = &[
            ("right→down", [(0, 0), (1, 0), (1, 1)]),
            ("right→up", [(0, 0), (1, 0), (1, -1)]),
            ("left→down", [(0, 0), (-1, 0), (-1, 1)]),
            ("left→up", [(0, 0), (-1, 0), (-1, -1)]),
            ("down→right", [(0, 0), (0, 1), (1, 1)]),
            ("down→left", [(0, 0), (0, 1), (-1, 1)]),
            ("up→right", [(0, 0), (0, -1), (1, -1)]),
            ("up→left", [(0, 0), (0, -1), (-1, -1)]),
        ];
        for (name, pts) in cases {
            let result = pixel_perfect_filter(pts, TailState::Empty);
            let expected = vec![
                Action::Paint(pts[0].0, pts[0].1),
                Action::Paint(pts[1].0, pts[1].1),
                Action::Paint(pts[2].0, pts[2].1),
                Action::Revert(pts[1].0, pts[1].1),
            ];
            assert_eq!(result.actions, expected, "case: {name}");
        }
    }

    // ── consecutive L-corners (staircase) ──────────────────────

    #[test]
    fn staircase_reverts_only_joint_pixels_preserving_diagonal() {
        // A Bresenham staircase looks like three overlapping L-corners. The
        // filter must revert only the joint pixels (1,0), (2,1) and keep the
        // diagonal (0,0), (1,1), (2,2) intact — reverting (1,1) as well
        // would cascade and collapse the line to its two endpoints, which
        // is the exact bug that pixel-perfect is supposed to hide.
        let points = vec![(0, 0), (1, 0), (1, 1), (2, 1), (2, 2)];
        let result = pixel_perfect_filter(&points, TailState::Empty);
        assert_eq!(
            result.actions,
            vec![
                Action::Paint(0, 0),
                Action::Paint(1, 0),
                Action::Paint(1, 1),
                Action::Paint(2, 1),
                Action::Paint(2, 2),
                Action::Revert(1, 0),
                Action::Revert(2, 1),
            ]
        );
        // Tail is the last two points of the effective path (0,0)(1,1)(2,2).
        assert_eq!(result.new_tail, TailState::Two(1, 1, 2, 2));
    }

    // ── L-corner spanning batch boundary via prev_tail ─────────

    #[test]
    fn prev_tail_enables_l_corner_detection_across_batches() {
        // Prior batch left tail Two((0,0), (1,0)). New batch adds (1,1).
        // The 3-window (0,0)→(1,0)→(1,1) forms an L-corner whose tip
        // was already painted in the prior batch — must still emit Revert.
        let result = pixel_perfect_filter(&[(1, 1)], TailState::Two(0, 0, 1, 0));
        assert_eq!(
            result.actions,
            vec![Action::Paint(1, 1), Action::Revert(1, 0)]
        );
        // new_tail carries the last two points of the effective (post-revert)
        // path. Dropping the reverted tip here is what stops the next batch
        // from judging new points against the stale raw sequence — see the
        // staircase test for the concrete cascade this prevents.
        assert_eq!(result.new_tail, TailState::Two(0, 0, 1, 1));
    }

    // ── self-crossing path (revisit) ────────────────────────────

    #[test]
    fn self_crossing_revisit_is_judged_on_path_not_pixel_identity() {
        // Closed 2x2 square revisiting origin. Two L-corners are visible in
        // the effective path — the tip (1,0) at the first turn and the tip
        // (0,1) at the last — because reverting (1,0) leaves (0,0)→(1,1) as
        // a diagonal segment, and the middle corner (1,1)→(0,1) is no longer
        // a 3-point L with (1,0) dropped. The final Paint(0,0) revisits the
        // first pixel — the filter emits it anyway and the caller's
        // first-touch cache handles the no-op recolor.
        let points = vec![(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)];
        let result = pixel_perfect_filter(&points, TailState::Empty);
        assert_eq!(
            result.actions,
            vec![
                Action::Paint(0, 0),
                Action::Paint(1, 0),
                Action::Paint(1, 1),
                Action::Paint(0, 1),
                Action::Paint(0, 0),
                Action::Revert(1, 0),
                Action::Revert(0, 1),
            ]
        );
        assert_eq!(result.new_tail, TailState::Two(1, 1, 0, 0));
    }

    // ── is_l_corner predicate truth table ──────────────────────

    #[test]
    fn is_l_corner_truth_table() {
        let true_cases: &[(&str, (i32, i32), (i32, i32), (i32, i32))] = &[
            ("right→down", (0, 0), (1, 0), (1, 1)),
            ("right→up", (0, 0), (1, 0), (1, -1)),
            ("left→down", (0, 0), (-1, 0), (-1, 1)),
            ("left→up", (0, 0), (-1, 0), (-1, -1)),
            ("down→right", (0, 0), (0, 1), (1, 1)),
            ("down→left", (0, 0), (0, 1), (-1, 1)),
            ("up→right", (0, 0), (0, -1), (1, -1)),
            ("up→left", (0, 0), (0, -1), (-1, -1)),
        ];
        for (name, p, c, n) in true_cases {
            assert!(is_l_corner(*p, *c, *n), "expected L-corner: {name}");
        }

        let false_cases: &[(&str, (i32, i32), (i32, i32), (i32, i32))] = &[
            ("horizontal line", (0, 0), (1, 0), (2, 0)),
            ("vertical line", (0, 0), (0, 1), (0, 2)),
            ("pure diagonal", (0, 0), (1, 1), (2, 2)),
            ("anti-diagonal", (0, 2), (1, 1), (2, 0)),
            ("prev == cur", (0, 0), (0, 0), (1, 0)),
            ("cur == next", (0, 0), (1, 0), (1, 0)),
            ("prev == next", (0, 0), (1, 0), (0, 0)),
            ("all identical", (5, 5), (5, 5), (5, 5)),
        ];
        for (name, p, c, n) in false_cases {
            assert!(!is_l_corner(*p, *c, *n), "expected not L-corner: {name}");
        }
    }

    // ── empty input ─────────────────────────────────────────────

    #[test]
    fn empty_input_is_noop_preserving_prev_tail() {
        for tail in [
            TailState::Empty,
            TailState::One(2, 3),
            TailState::Two(1, 2, 3, 4),
        ] {
            let result = pixel_perfect_filter(&[], tail);
            assert_eq!(result.actions, vec![], "prev_tail={tail:?}");
            assert_eq!(result.new_tail, tail, "prev_tail={tail:?}");
        }
    }
}
