use crate::canvas::PixelCanvas;
use crate::color::Color;

/// Drawing tool type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "uniffi", derive(uniffi::Enum))]
pub enum ToolType {
    Pencil,
    Eraser,
}

impl ToolType {
    /// Applies this tool to the canvas at the given coordinates.
    ///
    /// Pencil sets the pixel to `foreground_color`; Eraser sets it to transparent.
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
            ToolType::Pencil => foreground_color,
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
}
