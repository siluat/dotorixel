use crate::canvas::PixelCanvas;
use crate::color::Color;

/// Drawing tool type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "uniffi", derive(uniffi::Enum))]
pub enum ToolType {
    Pencil,
    Eraser,
    Line,
    Rectangle,
    Ellipse,
}

impl ToolType {
    /// Applies this tool to the canvas at the given coordinates.
    ///
    /// Pencil, Line, Rectangle, and Ellipse set the pixel to `foreground_color`; Eraser sets it to transparent.
    /// Returns `false` if the coordinates are outside canvas bounds (including
    /// negative values). The canvas is not modified for out-of-bounds coordinates.
    pub fn apply(&self, canvas: &mut PixelCanvas, x: i32, y: i32, foreground_color: Color) -> bool {
        if x < 0 || y < 0 {
            return false;
        }
        let ux = x as u32;
        let uy = y as u32;
        if !canvas.is_inside_bounds(ux, uy) {
            return false;
        }
        let color = match self {
            ToolType::Pencil | ToolType::Line | ToolType::Rectangle | ToolType::Ellipse => {
                foreground_color
            }
            ToolType::Eraser => Color::TRANSPARENT,
        };
        canvas
            .set_pixel(ux, uy, color)
            .expect("bounds already validated");
        true
    }
}

/// Computes the pixel coordinates along a line between two points using
/// Bresenham's line algorithm.
///
/// Returns a contiguous sequence of `(x, y)` pairs where every consecutive
/// pair differs by at most 1 in each axis (8-connected). The first element
/// is always `(x0, y0)` and the last is `(x1, y1)`.
pub fn interpolate_pixels(x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<(i32, i32)> {
    let dx = (x1 - x0).abs();
    let dy = -(y1 - y0).abs();
    let mut points = Vec::with_capacity(dx.max(-dy) as usize + 1);
    let sx = if x0 < x1 { 1 } else { -1 };
    let sy = if y0 < y1 { 1 } else { -1 };
    let mut err = dx + dy;
    let mut x = x0;
    let mut y = y0;

    loop {
        points.push((x, y));
        if x == x1 && y == y1 {
            break;
        }
        let e2 = 2 * err;
        if e2 >= dy {
            err += dy;
            x += sx;
        }
        if e2 <= dx {
            err += dx;
            y += sy;
        }
    }

    points
}

/// Computes the pixel coordinates forming the outline of a rectangle defined
/// by two opposite corner points.
///
/// The corners are normalized so drag direction doesn't matter. Edges are
/// generated without duplicate pixels at corners:
/// - Top and bottom edges span the full width.
/// - Left and right edges span only the interior height.
///
/// Degenerate cases: a single point returns `vec![(x0, y0)]`; a 1-pixel-tall
/// rectangle returns only the top edge; a 1-pixel-wide rectangle returns only
/// the left edge.
pub fn rectangle_outline(x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<(i32, i32)> {
    let min_x = x0.min(x1);
    let max_x = x0.max(x1);
    let min_y = y0.min(y1);
    let max_y = y0.max(y1);

    let w = (max_x - min_x + 1) as usize;
    let h = (max_y - min_y + 1) as usize;

    // Perimeter pixel count: 2*(w+h) - 4 for w,h >= 2; degenerate cases handled by the
    // conditional edge generation below.
    let capacity = if w == 1 || h == 1 {
        w.max(h)
    } else {
        2 * (w + h) - 4
    };
    let mut points = Vec::with_capacity(capacity);

    // Top edge (full width)
    for x in min_x..=max_x {
        points.push((x, min_y));
    }

    // Bottom edge (full width, skip if height is 1)
    if max_y > min_y {
        for x in min_x..=max_x {
            points.push((x, max_y));
        }
    }

    // Left edge (interior only, between top and bottom)
    for y in (min_y + 1)..max_y {
        points.push((min_x, y));
    }

    // Right edge (interior only, skip if width is 1)
    if max_x > min_x {
        for y in (min_y + 1)..max_y {
            points.push((max_x, y));
        }
    }

    points
}

/// Computes the pixel coordinates forming the outline of an ellipse inscribed
/// in the bounding box defined by two opposite corner points.
///
/// The corners are normalized so drag direction doesn't matter. Degenerate
/// cases: a single point returns `vec![(x0, y0)]`; a 1-pixel-tall or
/// 1-pixel-wide bounding box returns a horizontal or vertical line.
///
/// Uses Zingl's Bresenham-style ellipse algorithm with integer arithmetic.
/// Even-width or even-height bounding boxes (half-pixel center) are handled
/// naturally via the `height_parity` flag.
pub fn ellipse_outline(x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<(i32, i32)> {
    let min_x = x0.min(x1);
    let max_x = x0.max(x1);
    let min_y = y0.min(y1);
    let max_y = y0.max(y1);

    let w = max_x - min_x + 1;
    let h = max_y - min_y + 1;

    // Degenerate: single point
    if w == 1 && h == 1 {
        return vec![(min_x, min_y)];
    }

    // Degenerate: horizontal line
    if h == 1 {
        return (min_x..=max_x).map(|x| (x, min_y)).collect();
    }

    // Degenerate: vertical line
    if w == 1 {
        return (min_y..=max_y).map(|y| (min_x, y)).collect();
    }

    let mut points = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut add = |px: i32, py: i32| {
        if seen.insert((px, py)) {
            points.push((px, py));
        }
    };

    let a = (max_x - min_x) as i64;
    let b = (max_y - min_y) as i64;
    let height_parity = b & 1;

    // Scanning cursors that narrow from bounding box edges toward center
    let mut left_x = min_x;
    let mut right_x = max_x;
    let mut y_down = min_y + ((b as i32 + 1) / 2);
    let mut y_up = y_down - height_parity as i32;

    let mut dx = 4 * (1 - a) * b * b;
    let mut dy = 4 * (height_parity + 1) * a * a;
    let mut err = dx + dy + height_parity * a * a;

    let a8 = 8 * a * a;
    let b8 = 8 * b * b;

    loop {
        add(right_x, y_down);
        add(left_x, y_down);
        add(left_x, y_up);
        add(right_x, y_up);

        let e2 = 2 * err;
        if e2 <= dy {
            y_down += 1;
            y_up -= 1;
            dy += a8;
            err += dy;
        }
        if e2 >= dx || 2 * err > dy {
            left_x += 1;
            right_x -= 1;
            dx += b8;
            err += dx;
        }

        if left_x > right_x {
            break;
        }
    }

    // Finish tips of flat ellipses (when x-scanning converged before
    // y-scanning reached the bounding box edges)
    while ((y_down - y_up) as i64) <= b {
        add(left_x - 1, y_down);
        add(right_x + 1, y_down);
        y_down += 1;
        add(left_x - 1, y_up);
        add(right_x + 1, y_up);
        y_up -= 1;
    }

    points
}

#[cfg(test)]
mod tests {
    use super::*;

    const BLACK: Color = Color::new(0, 0, 0, 255);
    const RED: Color = Color::new(255, 0, 0, 255);

    // ── ToolType::apply — pencil ────────────────────────────────

    #[test]
    fn pencil_applies_foreground_color() {
        let mut canvas = PixelCanvas::new(8, 8).unwrap();
        ToolType::Pencil.apply(&mut canvas, 3, 4, RED);
        assert_eq!(canvas.get_pixel(3, 4).unwrap(), RED);
    }

    #[test]
    fn pencil_overwrites_existing_color() {
        let mut canvas = PixelCanvas::with_color(8, 8, BLACK).unwrap();
        ToolType::Pencil.apply(&mut canvas, 0, 0, RED);
        assert_eq!(canvas.get_pixel(0, 0).unwrap(), RED);
    }

    #[test]
    fn pencil_does_not_affect_adjacent_pixels() {
        let mut canvas = PixelCanvas::new(8, 8).unwrap();
        ToolType::Pencil.apply(&mut canvas, 3, 3, RED);
        assert_eq!(canvas.get_pixel(2, 3).unwrap(), Color::TRANSPARENT);
        assert_eq!(canvas.get_pixel(4, 3).unwrap(), Color::TRANSPARENT);
        assert_eq!(canvas.get_pixel(3, 2).unwrap(), Color::TRANSPARENT);
        assert_eq!(canvas.get_pixel(3, 4).unwrap(), Color::TRANSPARENT);
    }

    // ── ToolType::apply — eraser ────────────────────────────────

    #[test]
    fn eraser_sets_pixel_to_transparent() {
        let mut canvas = PixelCanvas::with_color(8, 8, BLACK).unwrap();
        ToolType::Eraser.apply(&mut canvas, 2, 2, RED);
        assert_eq!(canvas.get_pixel(2, 2).unwrap(), Color::TRANSPARENT);
    }

    // ── ToolType::apply — boundary handling ─────────────────────

    #[test]
    fn returns_false_for_positive_out_of_bounds() {
        let mut canvas = PixelCanvas::new(8, 8).unwrap();
        assert!(!ToolType::Pencil.apply(&mut canvas, 8, 0, BLACK));
        assert!(!ToolType::Pencil.apply(&mut canvas, 0, 8, BLACK));
    }

    #[test]
    fn returns_false_for_negative_coordinates() {
        let mut canvas = PixelCanvas::new(8, 8).unwrap();
        assert!(!ToolType::Pencil.apply(&mut canvas, -1, 0, BLACK));
        assert!(!ToolType::Pencil.apply(&mut canvas, 0, -1, BLACK));
    }

    #[test]
    fn does_not_modify_canvas_for_out_of_bounds() {
        let mut canvas = PixelCanvas::new(8, 8).unwrap();
        ToolType::Pencil.apply(&mut canvas, -1, 0, BLACK);
        for y in 0..8 {
            for x in 0..8 {
                assert_eq!(canvas.get_pixel(x, y).unwrap(), Color::TRANSPARENT);
            }
        }
    }

    #[test]
    fn returns_true_for_valid_coordinates() {
        let mut canvas = PixelCanvas::new(8, 8).unwrap();
        assert!(ToolType::Pencil.apply(&mut canvas, 0, 0, BLACK));
        assert!(ToolType::Pencil.apply(&mut canvas, 7, 7, BLACK));
    }

    // ── interpolate_pixels ──────────────────────────────────────

    #[test]
    fn single_point_when_start_equals_end() {
        assert_eq!(interpolate_pixels(3, 5, 3, 5), vec![(3, 5)]);
    }

    #[test]
    fn horizontal_line() {
        assert_eq!(
            interpolate_pixels(1, 2, 5, 2),
            vec![(1, 2), (2, 2), (3, 2), (4, 2), (5, 2)]
        );
    }

    #[test]
    fn vertical_line() {
        assert_eq!(
            interpolate_pixels(3, 0, 3, 3),
            vec![(3, 0), (3, 1), (3, 2), (3, 3)]
        );
    }

    #[test]
    fn diagonal_45_degrees() {
        assert_eq!(
            interpolate_pixels(0, 0, 3, 3),
            vec![(0, 0), (1, 1), (2, 2), (3, 3)]
        );
    }

    #[test]
    fn shallow_slope_is_continuous() {
        let points = interpolate_pixels(0, 0, 4, 2);
        assert_eq!(points[0], (0, 0));
        assert_eq!(*points.last().unwrap(), (4, 2));
        for i in 1..points.len() {
            let dx = (points[i].0 - points[i - 1].0).abs();
            let dy = (points[i].1 - points[i - 1].1).abs();
            assert!(dx <= 1, "x gap at index {i}");
            assert!(dy <= 1, "y gap at index {i}");
        }
    }

    #[test]
    fn adjacent_pixels() {
        assert_eq!(interpolate_pixels(2, 3, 3, 3), vec![(2, 3), (3, 3)]);
    }

    #[test]
    fn reverse_x_direction() {
        let points = interpolate_pixels(5, 2, 1, 2);
        assert_eq!(points[0], (5, 2));
        assert_eq!(*points.last().unwrap(), (1, 2));
        assert_eq!(points.len(), 5);
    }

    #[test]
    fn reverse_y_direction() {
        let points = interpolate_pixels(2, 5, 2, 1);
        assert_eq!(points[0], (2, 5));
        assert_eq!(*points.last().unwrap(), (2, 1));
        assert_eq!(points.len(), 5);
    }

    // ── ToolType::apply — line ────────────────────────────────────

    #[test]
    fn line_applies_foreground_color() {
        let mut canvas = PixelCanvas::new(8, 8).unwrap();
        ToolType::Line.apply(&mut canvas, 3, 4, RED);
        assert_eq!(canvas.get_pixel(3, 4).unwrap(), RED);
    }

    #[test]
    fn line_overwrites_existing_color() {
        let mut canvas = PixelCanvas::with_color(8, 8, BLACK).unwrap();
        ToolType::Line.apply(&mut canvas, 0, 0, RED);
        assert_eq!(canvas.get_pixel(0, 0).unwrap(), RED);
    }

    // ── ToolType::apply — rectangle ─────────────────────────────────

    #[test]
    fn rectangle_applies_foreground_color() {
        let mut canvas = PixelCanvas::new(8, 8).unwrap();
        ToolType::Rectangle.apply(&mut canvas, 3, 4, RED);
        assert_eq!(canvas.get_pixel(3, 4).unwrap(), RED);
    }

    // ── ToolType::apply — ellipse ──────────────────────────────────

    #[test]
    fn ellipse_applies_foreground_color() {
        let mut canvas = PixelCanvas::new(8, 8).unwrap();
        ToolType::Ellipse.apply(&mut canvas, 3, 4, RED);
        assert_eq!(canvas.get_pixel(3, 4).unwrap(), RED);
    }

    // ── rectangle_outline ────────────────────────────────────────────

    #[test]
    fn rectangle_single_point() {
        let points = rectangle_outline(3, 5, 3, 5);
        assert_eq!(points, vec![(3, 5)]);
    }

    #[test]
    fn rectangle_horizontal_line() {
        let mut points = rectangle_outline(1, 2, 4, 2);
        points.sort();
        assert_eq!(points, vec![(1, 2), (2, 2), (3, 2), (4, 2)]);
    }

    #[test]
    fn rectangle_vertical_line() {
        let mut points = rectangle_outline(3, 0, 3, 3);
        points.sort();
        assert_eq!(points, vec![(3, 0), (3, 1), (3, 2), (3, 3)]);
    }

    #[test]
    fn rectangle_3x3_outline() {
        let mut points = rectangle_outline(1, 1, 3, 3);
        points.sort();
        // 3×3 outline = 8 pixels (interior excluded)
        assert_eq!(
            points,
            vec![
                (1, 1),
                (1, 2),
                (1, 3),
                (2, 1),
                (2, 3),
                (3, 1),
                (3, 2),
                (3, 3),
            ]
        );
    }

    #[test]
    fn rectangle_no_duplicate_pixels() {
        let points = rectangle_outline(0, 0, 4, 3);
        let mut sorted = points.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(points.len(), sorted.len(), "duplicate pixels found");
    }

    #[test]
    fn rectangle_reverse_coordinates() {
        let mut forward = rectangle_outline(1, 1, 4, 3);
        let mut reverse = rectangle_outline(4, 3, 1, 1);
        forward.sort();
        reverse.sort();
        assert_eq!(forward, reverse);
    }

    // ── ellipse_outline ────────────────────────────────────────────

    #[test]
    fn ellipse_single_point() {
        assert_eq!(ellipse_outline(3, 5, 3, 5), vec![(3, 5)]);
    }

    #[test]
    fn ellipse_horizontal_line() {
        let mut points = ellipse_outline(1, 2, 4, 2);
        points.sort();
        assert_eq!(points, vec![(1, 2), (2, 2), (3, 2), (4, 2)]);
    }

    #[test]
    fn ellipse_vertical_line() {
        let mut points = ellipse_outline(3, 0, 3, 3);
        points.sort();
        assert_eq!(points, vec![(3, 0), (3, 1), (3, 2), (3, 3)]);
    }

    #[test]
    fn ellipse_odd_square_5x5() {
        let points = ellipse_outline(0, 0, 4, 4);
        let mut sorted = points.clone();
        sorted.sort();
        // 5×5 circle: axis endpoints must touch bounding box edges
        assert!(sorted.contains(&(2, 0)), "top axis endpoint");
        assert!(sorted.contains(&(2, 4)), "bottom axis endpoint");
        assert!(sorted.contains(&(0, 2)), "left axis endpoint");
        assert!(sorted.contains(&(4, 2)), "right axis endpoint");
    }

    #[test]
    fn ellipse_even_square_4x4() {
        let points = ellipse_outline(0, 0, 3, 3);
        let mut sorted = points.clone();
        sorted.sort();
        // 4×4 circle: axis endpoints on bounding box edges
        assert!(sorted.iter().any(|&(_, y)| y == 0), "touches top edge");
        assert!(sorted.iter().any(|&(_, y)| y == 3), "touches bottom edge");
        assert!(sorted.iter().any(|&(x, _)| x == 0), "touches left edge");
        assert!(sorted.iter().any(|&(x, _)| x == 3), "touches right edge");
    }

    #[test]
    fn ellipse_rectangular_7x5() {
        let points = ellipse_outline(0, 0, 6, 4);
        let mut sorted = points.clone();
        sorted.sort();
        assert!(sorted.contains(&(3, 0)), "top axis endpoint");
        assert!(sorted.contains(&(3, 4)), "bottom axis endpoint");
        assert!(sorted.contains(&(0, 2)), "left axis endpoint");
        assert!(sorted.contains(&(6, 2)), "right axis endpoint");
    }

    #[test]
    fn ellipse_2x2() {
        let mut points = ellipse_outline(0, 0, 1, 1);
        points.sort();
        // 2×2: all 4 pixels should be filled
        assert_eq!(points, vec![(0, 0), (0, 1), (1, 0), (1, 1)]);
    }

    #[test]
    fn ellipse_2x3() {
        let mut points = ellipse_outline(0, 0, 1, 2);
        points.sort();
        // 2×3: all 6 pixels form the outline
        assert_eq!(points, vec![(0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2)]);
    }

    #[test]
    fn ellipse_3x2() {
        let mut points = ellipse_outline(0, 0, 2, 1);
        points.sort();
        assert_eq!(points, vec![(0, 0), (0, 1), (1, 0), (1, 1), (2, 0), (2, 1)]);
    }

    #[test]
    fn ellipse_3x3() {
        let points = ellipse_outline(0, 0, 2, 2);
        let mut sorted = points.clone();
        sorted.sort();
        // 3×3 circle: axis endpoints + corners form the outline
        assert!(sorted.contains(&(1, 0)), "top");
        assert!(sorted.contains(&(1, 2)), "bottom");
        assert!(sorted.contains(&(0, 1)), "left");
        assert!(sorted.contains(&(2, 1)), "right");
    }

    #[test]
    fn ellipse_odd_x_even_mixed() {
        // 5×4 bounding box
        let points = ellipse_outline(0, 0, 4, 3);
        let mut sorted = points.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(points.len(), sorted.len(), "no duplicates in odd×even");
        assert!(sorted.iter().any(|&(_, y)| y == 0), "touches top");
        assert!(sorted.iter().any(|&(_, y)| y == 3), "touches bottom");
        assert!(sorted.iter().any(|&(x, _)| x == 0), "touches left");
        assert!(sorted.iter().any(|&(x, _)| x == 4), "touches right");
    }

    #[test]
    fn ellipse_even_x_odd_mixed() {
        // 4×5 bounding box
        let points = ellipse_outline(0, 0, 3, 4);
        let mut sorted = points.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(points.len(), sorted.len(), "no duplicates in even×odd");
        assert!(sorted.iter().any(|&(_, y)| y == 0), "touches top");
        assert!(sorted.iter().any(|&(_, y)| y == 4), "touches bottom");
        assert!(sorted.iter().any(|&(x, _)| x == 0), "touches left");
        assert!(sorted.iter().any(|&(x, _)| x == 3), "touches right");
    }

    #[test]
    fn ellipse_no_duplicate_pixels() {
        for &(x1, y1) in &[
            (4, 4),
            (3, 3),
            (6, 4),
            (3, 4),
            (4, 3),
            (1, 1),
            (1, 2),
            (2, 1),
        ] {
            let points = ellipse_outline(0, 0, x1, y1);
            let mut sorted = points.clone();
            sorted.sort();
            sorted.dedup();
            assert_eq!(
                points.len(),
                sorted.len(),
                "duplicates in ellipse_outline(0,0,{x1},{y1})"
            );
        }
    }

    #[test]
    fn ellipse_reverse_coordinates() {
        let mut forward = ellipse_outline(1, 1, 5, 4);
        let mut reverse = ellipse_outline(5, 4, 1, 1);
        forward.sort();
        reverse.sort();
        assert_eq!(forward, reverse);
    }

    #[test]
    fn ellipse_x_axis_symmetry() {
        let points = ellipse_outline(0, 0, 6, 4);
        let mid_y = 2; // center y for 5-pixel height
        for &(x, y) in &points {
            let mirror_y = 2 * mid_y - y;
            assert!(
                points.contains(&(x, mirror_y)),
                "({x},{y}) missing mirror ({x},{mirror_y})"
            );
        }
    }

    #[test]
    fn ellipse_y_axis_symmetry() {
        let points = ellipse_outline(0, 0, 6, 4);
        let mid_x = 3; // center x for 7-pixel width
        for &(x, y) in &points {
            let mirror_x = 2 * mid_x - x;
            assert!(
                points.contains(&(mirror_x, y)),
                "({x},{y}) missing mirror ({mirror_x},{y})"
            );
        }
    }

    #[test]
    fn ellipse_inscribed_in_bounding_box() {
        // Verify axis endpoints lie on the bounding box edges
        for &(x1, y1) in &[(4, 4), (5, 3), (6, 4), (3, 5), (7, 7)] {
            let points = ellipse_outline(0, 0, x1, y1);
            assert!(
                points.iter().any(|&(_, y)| y == 0),
                "no point on top edge for (0,0)-({x1},{y1})"
            );
            assert!(
                points.iter().any(|&(_, y)| y == y1),
                "no point on bottom edge for (0,0)-({x1},{y1})"
            );
            assert!(
                points.iter().any(|&(x, _)| x == 0),
                "no point on left edge for (0,0)-({x1},{y1})"
            );
            assert!(
                points.iter().any(|&(x, _)| x == x1),
                "no point on right edge for (0,0)-({x1},{y1})"
            );
        }
    }

    #[test]
    fn ellipse_all_points_within_bounds() {
        for &(x1, y1) in &[(4, 4), (3, 3), (6, 4), (1, 1), (2, 2)] {
            let points = ellipse_outline(0, 0, x1, y1);
            for &(x, y) in &points {
                assert!(
                    x >= 0 && x <= x1 && y >= 0 && y <= y1,
                    "point ({x},{y}) out of bounds (0,0)-({x1},{y1})"
                );
            }
        }
    }

    // ── Snapshot-restore performance guard ─────────────────────────

    #[test]
    fn max_dimension_within_snapshot_restore_safe_range() {
        assert!(
            PixelCanvas::MAX_DIMENSION <= 512,
            "MAX_DIMENSION is now {} which exceeds the snapshot-restore safe threshold (512). \
             At this size, per-move buffer copies may cause jank during line/shape tool preview. \
             Either confirm performance is acceptable and raise this threshold, \
             or switch to an overlay preview strategy.",
            PixelCanvas::MAX_DIMENSION
        );
    }

}
