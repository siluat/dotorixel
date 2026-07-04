use crate::canvas::PixelCanvas;
use crate::color::Color;
use serde::{Deserialize, Serialize};

/// Captured row-major RGBA pixels for the active Marquee clipboard.
///
/// Producers and FFI boundaries must preserve the invariant that
/// `pixels.len() == width * height * 4`.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SelectionClipboard {
    pub pixels: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct MarqueeRegion {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

impl MarqueeRegion {
    pub fn from_drag(x0: i32, y0: i32, x1: i32, y1: i32) -> Self {
        let min_x = x0.min(x1);
        let max_x = x0.max(x1);
        let min_y = y0.min(y1);
        let max_y = y0.max(y1);

        Self {
            x: min_x,
            y: min_y,
            width: (max_x - min_x + 1) as u32,
            height: (max_y - min_y + 1) as u32,
        }
    }

    pub fn x(&self) -> i32 {
        self.x
    }

    pub fn y(&self) -> i32 {
        self.y
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn contains(&self, x: i32, y: i32) -> bool {
        let left = i64::from(self.x);
        let top = i64::from(self.y);
        let right = left + i64::from(self.width);
        let bottom = top + i64::from(self.height);
        let x = i64::from(x);
        let y = i64::from(y);

        x >= left && y >= top && x < right && y < bottom
    }

    pub fn translate(&self, dx: i32, dy: i32) -> Self {
        Self {
            x: self.x + dx,
            y: self.y + dy,
            width: self.width,
            height: self.height,
        }
    }

    /// Returns the region a horizontal canvas flip carries it to: mirrored
    /// across the canvas's vertical center line, `x → canvas_w − x − width`.
    pub fn mirrored_horizontal(&self, canvas_w: u32) -> Self {
        Self {
            x: canvas_w as i32 - self.x - self.width as i32,
            ..*self
        }
    }

    /// Returns the region a vertical canvas flip carries it to: mirrored
    /// across the canvas's horizontal center line, `y → canvas_h − y − height`.
    pub fn mirrored_vertical(&self, canvas_h: u32) -> Self {
        Self {
            y: canvas_h as i32 - self.y - self.height as i32,
            ..*self
        }
    }

    /// Returns the region rotated 90° about its own center: a `W×H` region
    /// becomes `H×W` sharing the same center. Clockwise and counter-clockwise
    /// rotation share this footprint; only the pixel buffer differs. Truncating
    /// division makes the transform its own inverse, so rotating twice restores
    /// the original region exactly.
    pub fn rotated_90(&self) -> Self {
        let width = self.width as i32;
        let height = self.height as i32;
        Self {
            x: self.x + (width - height) / 2,
            y: self.y + (height - width) / 2,
            width: self.height,
            height: self.width,
        }
    }

    pub fn clip_to(&self, canvas_w: u32, canvas_h: u32) -> Option<Self> {
        let left = i64::from(self.x).max(0);
        let top = i64::from(self.y).max(0);
        let right = (i64::from(self.x) + i64::from(self.width)).min(i64::from(canvas_w));
        let bottom = (i64::from(self.y) + i64::from(self.height)).min(i64::from(canvas_h));

        if left >= right || top >= bottom {
            return None;
        }

        Some(Self {
            x: left as i32,
            y: top as i32,
            width: (right - left) as u32,
            height: (bottom - top) as u32,
        })
    }
}

fn region_buffer_len(region: MarqueeRegion) -> usize {
    let width = usize::try_from(region.width).expect("region width fits usize");
    let height = usize::try_from(region.height).expect("region height fits usize");
    width
        .checked_mul(height)
        .and_then(|pixels| pixels.checked_mul(4))
        .expect("region byte length fits usize")
}

/// Extracts `region` from `canvas` as row-major RGBA bytes.
///
/// Pixels outside the canvas are returned as [`Color::TRANSPARENT`], so the
/// returned buffer always has `region.width * region.height * 4` bytes.
pub fn lift_region(canvas: &PixelCanvas, region: MarqueeRegion) -> Vec<u8> {
    let mut buffer = Vec::with_capacity(region_buffer_len(region));
    for row in 0..region.height {
        for col in 0..region.width {
            let x = i64::from(region.x) + i64::from(col);
            let y = i64::from(region.y) + i64::from(row);
            let color = if x >= 0
                && y >= 0
                && x < i64::from(canvas.width())
                && y < i64::from(canvas.height())
            {
                canvas
                    .get_pixel(x as u32, y as u32)
                    .expect("region coordinate checked against canvas bounds")
            } else {
                Color::TRANSPARENT
            };
            buffer.extend([color.r, color.g, color.b, color.a]);
        }
    }
    buffer
}

/// Clears the overlapping portion of `region` on `canvas` to transparent.
///
/// The region is clipped to the canvas bounds; a fully out-of-bounds region is
/// a no-op.
pub fn clear_region(canvas: &mut PixelCanvas, region: MarqueeRegion) {
    let Some(overlap) = region.clip_to(canvas.width(), canvas.height()) else {
        return;
    };

    for y in overlap.y..overlap.y + overlap.height as i32 {
        for x in overlap.x..overlap.x + overlap.width as i32 {
            canvas
                .set_pixel(x as u32, y as u32, Color::TRANSPARENT)
                .expect("region clipped to canvas bounds");
        }
    }
}

/// Source-over composites row-major RGBA `buffer` into `canvas` at `dest_region`.
///
/// Pixels outside the canvas are skipped. Panics when `buffer.len()` is not
/// exactly `dest_region.width * dest_region.height * 4`.
pub fn composite_region(canvas: &mut PixelCanvas, buffer: &[u8], dest_region: MarqueeRegion) {
    assert_eq!(
        buffer.len(),
        region_buffer_len(dest_region),
        "region buffer length must match dest_region.width * dest_region.height * 4"
    );

    for row in 0..dest_region.height {
        for col in 0..dest_region.width {
            let dest_x = i64::from(dest_region.x) + i64::from(col);
            let dest_y = i64::from(dest_region.y) + i64::from(row);
            if dest_x < 0
                || dest_y < 0
                || dest_x >= i64::from(canvas.width())
                || dest_y >= i64::from(canvas.height())
            {
                continue;
            }

            let src_index = ((row * dest_region.width + col) * 4) as usize;
            let src = Color::new(
                buffer[src_index],
                buffer[src_index + 1],
                buffer[src_index + 2],
                buffer[src_index + 3],
            );
            if src.a == 0 {
                continue;
            }

            let dst = canvas
                .get_pixel(dest_x as u32, dest_y as u32)
                .expect("destination coordinate checked against canvas bounds");
            canvas
                .set_pixel(dest_x as u32, dest_y as u32, source_over(src, dst))
                .expect("destination coordinate checked against canvas bounds");
        }
    }
}

fn source_over(src: Color, dst: Color) -> Color {
    let src_a = src.a as f32 / 255.0;
    let dst_a = dst.a as f32 / 255.0;
    let out_a = src_a + dst_a * (1.0 - src_a);
    if out_a == 0.0 {
        return Color::TRANSPARENT;
    }

    let blend_channel = |src_channel: u8, dst_channel: u8| {
        let src_channel = src_channel as f32 / 255.0;
        let dst_channel = dst_channel as f32 / 255.0;
        ((src_channel * src_a + dst_channel * dst_a * (1.0 - src_a)) / out_a * 255.0).round() as u8
    };

    Color::new(
        blend_channel(src.r, dst.r),
        blend_channel(src.g, dst.g),
        blend_channel(src.b, dst.b),
        (out_a * 255.0).round() as u8,
    )
}

#[cfg(test)]
mod tests {
    use crate::canvas::PixelCanvas;
    use crate::color::Color;

    use super::{MarqueeRegion, SelectionClipboard};

    const RED: Color = Color::new(255, 0, 0, 255);
    const GREEN: Color = Color::new(0, 255, 0, 255);
    const BLUE: Color = Color::new(0, 0, 255, 255);
    const WHITE: Color = Color::new(255, 255, 255, 255);
    const SEMI_TRANSPARENT_BLUE: Color = Color::new(0, 0, 255, 128);

    fn rgba(colors: &[Color]) -> Vec<u8> {
        colors
            .iter()
            .flat_map(|color| [color.r, color.g, color.b, color.a])
            .collect()
    }

    #[test]
    fn selection_clipboard_round_trips_through_serialization() {
        let clipboard = SelectionClipboard {
            pixels: rgba(&[RED, GREEN, BLUE, WHITE]),
            width: 2,
            height: 2,
        };

        let encoded = serde_json::to_vec(&clipboard).expect("clipboard serializes");
        let decoded: SelectionClipboard =
            serde_json::from_slice(&encoded).expect("clipboard deserializes");

        assert_eq!(decoded, clipboard);
    }

    #[test]
    fn from_drag_normalizes_drag_direction_to_inclusive_region() {
        let region = MarqueeRegion::from_drag(5, 7, 2, 3);

        assert_eq!(region.x(), 2);
        assert_eq!(region.y(), 3);
        assert_eq!(region.width(), 4);
        assert_eq!(region.height(), 5);
    }

    #[test]
    fn contains_includes_only_pixels_inside_the_region() {
        let region = MarqueeRegion::from_drag(2, 3, 5, 7);

        assert!(region.contains(2, 3));
        assert!(region.contains(5, 7));
        assert!(!region.contains(1, 3));
        assert!(!region.contains(6, 7));
        assert!(!region.contains(5, 8));
    }

    #[test]
    fn translate_moves_origin_and_preserves_size() {
        let region = MarqueeRegion::from_drag(2, 3, 5, 7).translate(-4, 6);

        assert_eq!(region.x(), -2);
        assert_eq!(region.y(), 9);
        assert_eq!(region.width(), 4);
        assert_eq!(region.height(), 5);
    }

    #[test]
    fn rotated_90_swaps_dimensions_and_recenters_on_the_same_center() {
        // A 4×2 region at (1, 1) spans x∈[1,5), y∈[1,3); its center is (3, 2).
        // Rotating to 2×4 keeps that center, so the origin shifts by
        // ((4-2)/2, (2-4)/2) = (1, -1) to (2, 0).
        let rotated = MarqueeRegion::from_drag(1, 1, 4, 2).rotated_90();

        assert_eq!(rotated.x(), 2);
        assert_eq!(rotated.y(), 0);
        assert_eq!(rotated.width(), 2);
        assert_eq!(rotated.height(), 4);
    }

    #[test]
    fn rotated_90_applied_twice_restores_the_original_region() {
        // Odd dimension difference: truncating division keeps the round-trip
        // exact, so clockwise-then-counter-clockwise returns the same Marquee.
        let original = MarqueeRegion::from_drag(2, 3, 6, 4);

        assert_eq!(original.rotated_90().rotated_90(), original);
    }

    #[test]
    fn clip_to_canvas_returns_only_the_in_bounds_region() {
        let clipped = MarqueeRegion::from_drag(-2, 1, 3, 6)
            .clip_to(4, 4)
            .expect("region overlaps the canvas");

        assert_eq!(clipped.x(), 0);
        assert_eq!(clipped.y(), 1);
        assert_eq!(clipped.width(), 4);
        assert_eq!(clipped.height(), 3);
    }

    #[test]
    fn clip_to_canvas_returns_none_when_region_does_not_overlap() {
        assert_eq!(MarqueeRegion::from_drag(-4, 1, -1, 3).clip_to(4, 4), None);
        assert_eq!(MarqueeRegion::from_drag(1, 4, 3, 7).clip_to(4, 4), None);
    }

    #[test]
    fn clip_to_canvas_uses_wide_arithmetic_for_large_regions() {
        let region = MarqueeRegion {
            x: i32::MAX - 1,
            y: 0,
            width: 4,
            height: 1,
        };

        let clipped = region
            .clip_to(u32::MAX, 1)
            .expect("wide canvas overlaps the large region");

        assert_eq!(clipped.x(), i32::MAX - 1);
        assert_eq!(clipped.y(), 0);
        assert_eq!(clipped.width(), 4);
        assert_eq!(clipped.height(), 1);
    }

    #[test]
    fn contains_uses_wide_arithmetic_for_large_regions() {
        let region = MarqueeRegion {
            x: i32::MAX - 1,
            y: i32::MAX - 1,
            width: 4,
            height: 4,
        };

        assert!(region.contains(i32::MAX, i32::MAX));
        assert!(!region.contains(i32::MAX - 2, i32::MAX));
    }

    #[test]
    fn from_drag_keeps_degenerate_input_as_one_pixel_region() {
        let region = MarqueeRegion::from_drag(3, 5, 3, 5);

        assert_eq!(region.x(), 3);
        assert_eq!(region.y(), 5);
        assert_eq!(region.width(), 1);
        assert_eq!(region.height(), 1);
        assert!(region.contains(3, 5));
    }

    #[test]
    fn lift_region_extracts_pixels_in_row_major_order() {
        let mut canvas = PixelCanvas::new(3, 3).unwrap();
        canvas.set_pixel(1, 1, RED).unwrap();
        canvas.set_pixel(2, 1, GREEN).unwrap();
        canvas.set_pixel(1, 2, BLUE).unwrap();
        canvas.set_pixel(2, 2, WHITE).unwrap();

        let lifted = super::lift_region(&canvas, MarqueeRegion::from_drag(1, 1, 2, 2));

        assert_eq!(lifted, rgba(&[RED, GREEN, BLUE, WHITE]));
    }

    #[test]
    fn lift_region_pads_out_of_bounds_pixels_with_transparency() {
        let mut canvas = PixelCanvas::new(2, 2).unwrap();
        canvas.set_pixel(0, 0, RED).unwrap();
        canvas.set_pixel(1, 0, GREEN).unwrap();
        canvas.set_pixel(0, 1, BLUE).unwrap();
        canvas.set_pixel(1, 1, WHITE).unwrap();

        let lifted = super::lift_region(&canvas, MarqueeRegion::from_drag(-1, -1, 1, 1));

        assert_eq!(
            lifted,
            rgba(&[
                Color::TRANSPARENT,
                Color::TRANSPARENT,
                Color::TRANSPARENT,
                Color::TRANSPARENT,
                RED,
                GREEN,
                Color::TRANSPARENT,
                BLUE,
                WHITE,
            ])
        );
    }

    #[test]
    fn clear_region_sets_only_overlapping_pixels_to_transparent() {
        let mut canvas = PixelCanvas::with_color(3, 3, RED).unwrap();

        super::clear_region(&mut canvas, MarqueeRegion::from_drag(1, 1, 3, 3));

        assert_eq!(canvas.get_pixel(0, 0).unwrap(), RED);
        assert_eq!(canvas.get_pixel(2, 0).unwrap(), RED);
        assert_eq!(canvas.get_pixel(0, 2).unwrap(), RED);
        assert_eq!(canvas.get_pixel(1, 1).unwrap(), Color::TRANSPARENT);
        assert_eq!(canvas.get_pixel(2, 1).unwrap(), Color::TRANSPARENT);
        assert_eq!(canvas.get_pixel(1, 2).unwrap(), Color::TRANSPARENT);
        assert_eq!(canvas.get_pixel(2, 2).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn composite_region_alpha_blends_buffer_over_destination() {
        let mut canvas = PixelCanvas::with_color(1, 1, RED).unwrap();

        super::composite_region(
            &mut canvas,
            &rgba(&[SEMI_TRANSPARENT_BLUE]),
            MarqueeRegion::from_drag(0, 0, 0, 0),
        );

        assert_eq!(
            canvas.get_pixel(0, 0).unwrap(),
            Color::new(127, 0, 128, 255)
        );
    }

    #[test]
    #[should_panic(
        expected = "region buffer length must match dest_region.width * dest_region.height * 4"
    )]
    fn composite_region_panics_when_buffer_size_does_not_match_region() {
        let mut canvas = PixelCanvas::new(1, 1).unwrap();

        super::composite_region(
            &mut canvas,
            &[0, 0, 0, 0],
            MarqueeRegion::from_drag(0, 0, 1, 1),
        );
    }

    #[test]
    fn lift_clear_and_composite_at_same_region_preserves_pixels() {
        let mut canvas = PixelCanvas::new(3, 3).unwrap();
        canvas.set_pixel(0, 0, RED).unwrap();
        canvas.set_pixel(1, 1, GREEN).unwrap();
        canvas.set_pixel(2, 2, BLUE).unwrap();
        let before = canvas.pixels().to_vec();
        let region = MarqueeRegion::from_drag(0, 0, 2, 2);

        let lifted = super::lift_region(&canvas, region);
        super::clear_region(&mut canvas, region);
        super::composite_region(&mut canvas, &lifted, region);

        assert_eq!(canvas.pixels(), before);
    }

    #[test]
    fn region_operations_treat_fully_out_of_bounds_regions_as_transparent_no_ops() {
        let mut canvas = PixelCanvas::with_color(2, 2, RED).unwrap();
        let before = canvas.pixels().to_vec();
        let region = MarqueeRegion::from_drag(3, 3, 4, 4);

        let lifted = super::lift_region(&canvas, region);
        super::clear_region(&mut canvas, region);
        super::composite_region(&mut canvas, &lifted, region);

        assert_eq!(
            lifted,
            rgba(&[
                Color::TRANSPARENT,
                Color::TRANSPARENT,
                Color::TRANSPARENT,
                Color::TRANSPARENT,
            ])
        );
        assert_eq!(canvas.pixels(), before);
    }
}
