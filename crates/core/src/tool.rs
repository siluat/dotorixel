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
}

impl ToolType {
    /// Applies this tool to the canvas at the given coordinates.
    ///
    /// Pencil, Line, and Rectangle set the pixel to `foreground_color`; Eraser sets it to transparent.
    /// Returns `false` if the coordinates are outside canvas bounds (including
    /// negative values). The canvas is not modified for out-of-bounds coordinates.
    pub fn apply(
        &self,
        canvas: &mut PixelCanvas,
        x: i32,
        y: i32,
        foreground_color: Color,
    ) -> bool {
        if x < 0 || y < 0 {
            return false;
        }
        let ux = x as u32;
        let uy = y as u32;
        if !canvas.is_inside_bounds(ux, uy) {
            return false;
        }
        let color = match self {
            ToolType::Pencil | ToolType::Line | ToolType::Rectangle => foreground_color,
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
    let capacity = if w == 1 || h == 1 { w.max(h) } else { 2 * (w + h) - 4 };
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
                (1, 1), (1, 2), (1, 3),
                (2, 1), (2, 3),
                (3, 1), (3, 2), (3, 3),
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
