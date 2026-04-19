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
/// Bresenham output). `prev_tail` carries the last 0–2 points from a prior
/// call so L-corners that span the call boundary are still judged.
///
/// The returned `actions` are ordered as all `Paint`s first (one per input
/// point, in input order), followed by any `Revert`s emitted for L-corners
/// discovered in the combined `prev_tail ++ points` sequence.
pub fn pixel_perfect_filter(
    points: &[(i32, i32)],
    prev_tail: TailState,
) -> FilterResult {
    let mut actions: Vec<Action> = points
        .iter()
        .map(|&(x, y)| Action::Paint(x, y))
        .collect();

    let prefix_len = match prev_tail {
        TailState::Empty => 0,
        TailState::One(..) => 1,
        TailState::Two(..) => 2,
    };
    let mut combined: Vec<(i32, i32)> = Vec::with_capacity(prefix_len + points.len());
    match prev_tail {
        TailState::Empty => {}
        TailState::One(x, y) => combined.push((x, y)),
        TailState::Two(ax, ay, bx, by) => {
            combined.push((ax, ay));
            combined.push((bx, by));
        }
    }
    combined.extend_from_slice(points);

    for w in combined.windows(3) {
        let (prev, cur, next) = (w[0], w[1], w[2]);
        if is_l_corner(prev, cur, next) {
            actions.push(Action::Revert(cur.0, cur.1));
        }
    }

    let new_tail = match combined.as_slice() {
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
        assert_eq!(result.new_tail, TailState::Two(1, 0, 1, 1));
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
    fn staircase_reverts_every_middle_pixel() {
        // Each step is an L-corner: three overlapping 3-windows.
        // After reverts, effective path is only the two endpoints — a clean
        // diagonal — matching Aseprite's stair-stepping fix.
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
                Action::Revert(1, 1),
                Action::Revert(2, 1),
            ]
        );
        assert_eq!(result.new_tail, TailState::Two(2, 1, 2, 2));
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
        // new_tail must carry the last two points of the combined path so the
        // next batch can judge 3-windows through (1,0)→(1,1).
        assert_eq!(result.new_tail, TailState::Two(1, 0, 1, 1));
    }

    // ── self-crossing path (revisit) ────────────────────────────

    #[test]
    fn self_crossing_revisit_is_judged_on_path_not_pixel_identity() {
        // Closed 2x2 square revisiting origin. Three L-corners; the final
        // Paint(0,0) revisits the first pixel — the filter emits it anyway
        // and the caller's first-touch cache handles the no-op recolor.
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
                Action::Revert(1, 1),
                Action::Revert(0, 1),
            ]
        );
        assert_eq!(result.new_tail, TailState::Two(0, 1, 0, 0));
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
