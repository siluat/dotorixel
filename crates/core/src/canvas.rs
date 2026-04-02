use std::fmt;

use crate::color::Color;

/// Anchor position for canvas resize operations.
///
/// Determines where existing pixel content is placed within the resized canvas.
/// For example, `Center` places existing content in the middle of the new canvas,
/// adding (or removing) equal space on all sides.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
#[cfg_attr(feature = "uniffi", derive(uniffi::Enum))]
pub enum ResizeAnchor {
    #[default]
    TopLeft,
    TopCenter,
    TopRight,
    MiddleLeft,
    Center,
    MiddleRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
}

impl ResizeAnchor {
    /// Returns the (x, y) pixel offset for placing source content in the destination canvas.
    ///
    /// Uses integer factors (0, 1, 2) divided by 2 to avoid floating point.
    /// For odd deltas, integer division truncates toward zero — this is standard
    /// pixel editor behavior (matches Aseprite).
    fn content_offset(
        self,
        old_width: u32,
        old_height: u32,
        new_width: u32,
        new_height: u32,
    ) -> (i32, i32) {
        let dw = new_width as i32 - old_width as i32;
        let dh = new_height as i32 - old_height as i32;
        let (fx, fy) = match self {
            Self::TopLeft => (0, 0),
            Self::TopCenter => (1, 0),
            Self::TopRight => (2, 0),
            Self::MiddleLeft => (0, 1),
            Self::Center => (1, 1),
            Self::MiddleRight => (2, 1),
            Self::BottomLeft => (0, 2),
            Self::BottomCenter => (1, 2),
            Self::BottomRight => (2, 2),
        };
        (dw * fx / 2, dh * fy / 2)
    }
}

/// Canvas pixel coordinates.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "uniffi", derive(uniffi::Record))]
pub struct CanvasCoords {
    pub x: u32,
    pub y: u32,
}

impl CanvasCoords {
    pub const fn new(x: u32, y: u32) -> Self {
        Self { x, y }
    }
}

/// Errors that can occur during pixel canvas operations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PixelCanvasError {
    OutOfBounds {
        x: u32,
        y: u32,
        width: u32,
        height: u32,
    },
    InvalidDimension {
        value: u32,
    },
    InvalidBufferLength {
        expected: usize,
        actual: usize,
    },
}

impl fmt::Display for PixelCanvasError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::OutOfBounds {
                x,
                y,
                width,
                height,
            } => {
                write!(
                    f,
                    "Pixel coordinates ({x}, {y}) are out of bounds for {width}x{height} canvas. \
                     Valid range: x in [0, {}], y in [0, {}]",
                    width - 1,
                    height - 1
                )
            }
            Self::InvalidDimension { value } => {
                write!(
                    f,
                    "Canvas dimension {value} is out of valid range [{}, {}]",
                    PixelCanvas::MIN_DIMENSION,
                    PixelCanvas::MAX_DIMENSION
                )
            }
            Self::InvalidBufferLength { expected, actual } => {
                write!(
                    f,
                    "Buffer length {actual} does not match expected {expected} (width * height * 4)"
                )
            }
        }
    }
}

impl std::error::Error for PixelCanvasError {}

/// A 2D pixel canvas backed by a flat RGBA buffer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PixelCanvas {
    width: u32,
    height: u32,
    pixels: Vec<u8>,
}

impl PixelCanvas {
    pub const MIN_DIMENSION: u32 = 1;
    pub const MAX_DIMENSION: u32 = 256;
    pub const PRESETS: &[u32] = &[8, 16, 32, 64];

    /// Returns `true` if the given value is a valid canvas dimension.
    pub fn is_valid_dimension(value: u32) -> bool {
        (Self::MIN_DIMENSION..=Self::MAX_DIMENSION).contains(&value)
    }

    fn validate_dimensions(width: u32, height: u32) -> Result<(), PixelCanvasError> {
        if !Self::is_valid_dimension(width) {
            return Err(PixelCanvasError::InvalidDimension { value: width });
        }
        if !Self::is_valid_dimension(height) {
            return Err(PixelCanvasError::InvalidDimension { value: height });
        }
        Ok(())
    }

    /// Creates a transparent canvas.
    pub fn new(width: u32, height: u32) -> Result<Self, PixelCanvasError> {
        Self::validate_dimensions(width, height)?;
        let pixels = vec![0u8; (width * height * 4) as usize];
        Ok(Self {
            width,
            height,
            pixels,
        })
    }

    /// Creates a canvas from raw RGBA pixel data with the given dimensions.
    ///
    /// The buffer length must equal `width * height * 4`.
    pub fn from_pixels(width: u32, height: u32, pixels: Vec<u8>) -> Result<Self, PixelCanvasError> {
        Self::validate_dimensions(width, height)?;
        let expected = (width * height * 4) as usize;
        if pixels.len() != expected {
            return Err(PixelCanvasError::InvalidBufferLength {
                expected,
                actual: pixels.len(),
            });
        }
        Ok(Self {
            width,
            height,
            pixels,
        })
    }

    /// Creates a canvas filled with the given color.
    pub fn with_color(width: u32, height: u32, color: Color) -> Result<Self, PixelCanvasError> {
        Self::validate_dimensions(width, height)?;
        let mut pixels = vec![0u8; (width * height * 4) as usize];
        for chunk in pixels.chunks_exact_mut(4) {
            chunk[0] = color.r;
            chunk[1] = color.g;
            chunk[2] = color.b;
            chunk[3] = color.a;
        }
        Ok(Self {
            width,
            height,
            pixels,
        })
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn pixels(&self) -> &[u8] {
        &self.pixels
    }

    pub fn pixels_mut(&mut self) -> &mut [u8] {
        &mut self.pixels
    }

    fn pixel_index(&self, x: u32, y: u32) -> usize {
        ((y * self.width + x) * 4) as usize
    }

    /// Returns `true` if the given coordinates are within canvas bounds.
    pub fn is_inside_bounds(&self, x: u32, y: u32) -> bool {
        x < self.width && y < self.height
    }

    /// Returns the color at the given pixel coordinates.
    pub fn get_pixel(&self, x: u32, y: u32) -> Result<Color, PixelCanvasError> {
        if !self.is_inside_bounds(x, y) {
            return Err(PixelCanvasError::OutOfBounds {
                x,
                y,
                width: self.width,
                height: self.height,
            });
        }
        let i = self.pixel_index(x, y);
        Ok(Color::new(
            self.pixels[i],
            self.pixels[i + 1],
            self.pixels[i + 2],
            self.pixels[i + 3],
        ))
    }

    /// Sets the color at the given pixel coordinates.
    pub fn set_pixel(&mut self, x: u32, y: u32, color: Color) -> Result<(), PixelCanvasError> {
        if !self.is_inside_bounds(x, y) {
            return Err(PixelCanvasError::OutOfBounds {
                x,
                y,
                width: self.width,
                height: self.height,
            });
        }
        let i = self.pixel_index(x, y);
        self.pixels[i] = color.r;
        self.pixels[i + 1] = color.g;
        self.pixels[i + 2] = color.b;
        self.pixels[i + 3] = color.a;
        Ok(())
    }

    /// Replaces the entire pixel buffer with the given data.
    ///
    /// The slice length must equal `width * height * 4`.
    pub fn restore_pixels(&mut self, data: &[u8]) -> Result<(), PixelCanvasError> {
        let expected = (self.width * self.height * 4) as usize;
        if data.len() != expected {
            return Err(PixelCanvasError::InvalidBufferLength {
                expected,
                actual: data.len(),
            });
        }
        self.pixels.copy_from_slice(data);
        Ok(())
    }

    /// Fills all pixels with transparent black.
    pub fn clear(&mut self) {
        self.pixels.fill(0);
    }

    /// Returns a new canvas with the given dimensions, copying overlapping
    /// pixel data from the original. The source canvas is not modified.
    /// Content is anchored to the top-left corner.
    pub fn resize(&self, new_width: u32, new_height: u32) -> Result<Self, PixelCanvasError> {
        self.resize_with_anchor(new_width, new_height, ResizeAnchor::TopLeft)
    }

    /// Returns a new canvas with the given dimensions, placing existing content
    /// according to the specified anchor position.
    pub fn resize_with_anchor(
        &self,
        new_width: u32,
        new_height: u32,
        anchor: ResizeAnchor,
    ) -> Result<Self, PixelCanvasError> {
        let mut dest = Self::new(new_width, new_height)?;
        let (offset_x, offset_y) =
            anchor.content_offset(self.width, self.height, new_width, new_height);

        for src_y in 0..self.height {
            let dest_y = src_y as i32 + offset_y;
            if dest_y < 0 || dest_y >= new_height as i32 {
                continue;
            }

            // Determine the overlapping x range for row-level bulk copy
            let src_x_start = 0.max(-offset_x) as u32;
            let src_x_end = self.width.min((new_width as i32 - offset_x) as u32);
            if src_x_start >= src_x_end {
                continue;
            }

            let dest_x_start = (src_x_start as i32 + offset_x) as u32;
            let copy_len = (src_x_end - src_x_start) as usize * 4;

            let src_offset = self.pixel_index(src_x_start, src_y);
            let dest_offset = (dest_y as u32 * new_width + dest_x_start) as usize * 4;
            dest.pixels[dest_offset..dest_offset + copy_len]
                .copy_from_slice(&self.pixels[src_offset..src_offset + copy_len]);
        }
        Ok(dest)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RED: Color = Color::new(255, 0, 0, 255);
    const SEMI_TRANSPARENT_BLUE: Color = Color::new(0, 0, 255, 128);

    // ── PixelCanvas::new ────────────────────────────────────────

    #[test]
    fn new_creates_canvas_with_correct_dimensions() {
        for size in [8, 16, 32] {
            let canvas = PixelCanvas::new(size, size).unwrap();
            assert_eq!(canvas.width(), size);
            assert_eq!(canvas.height(), size);
        }
    }

    #[test]
    fn new_allocates_correct_buffer_size() {
        for size in [8, 16, 32] {
            let canvas = PixelCanvas::new(size, size).unwrap();
            assert_eq!(canvas.pixels().len(), (size * size * 4) as usize);
        }
    }

    #[test]
    fn new_initializes_all_pixels_to_transparent() {
        let canvas = PixelCanvas::new(8, 8).unwrap();
        for y in 0..8 {
            for x in 0..8 {
                assert_eq!(canvas.get_pixel(x, y).unwrap(), Color::TRANSPARENT);
            }
        }
    }

    #[test]
    fn new_creates_rectangular_canvas() {
        let canvas = PixelCanvas::new(16, 8).unwrap();
        assert_eq!(canvas.width(), 16);
        assert_eq!(canvas.height(), 8);
        assert_eq!(canvas.pixels().len(), 16 * 8 * 4);
    }

    #[test]
    fn new_rejects_zero_width() {
        assert_eq!(
            PixelCanvas::new(0, 8),
            Err(PixelCanvasError::InvalidDimension { value: 0 })
        );
    }

    #[test]
    fn new_rejects_zero_height() {
        assert_eq!(
            PixelCanvas::new(8, 0),
            Err(PixelCanvasError::InvalidDimension { value: 0 })
        );
    }

    #[test]
    fn new_rejects_width_above_max() {
        assert_eq!(
            PixelCanvas::new(257, 8),
            Err(PixelCanvasError::InvalidDimension { value: 257 })
        );
    }

    #[test]
    fn new_rejects_height_above_max() {
        assert_eq!(
            PixelCanvas::new(8, 257),
            Err(PixelCanvasError::InvalidDimension { value: 257 })
        );
    }

    // ── PixelCanvas::with_color ─────────────────────────────────

    #[test]
    fn with_color_fills_all_pixels_with_opaque_color() {
        let canvas = PixelCanvas::with_color(8, 8, RED).unwrap();
        for y in 0..8 {
            for x in 0..8 {
                assert_eq!(canvas.get_pixel(x, y).unwrap(), RED);
            }
        }
    }

    #[test]
    fn with_color_fills_all_pixels_with_semi_transparent_color() {
        let canvas = PixelCanvas::with_color(8, 8, SEMI_TRANSPARENT_BLUE).unwrap();
        for y in 0..8 {
            for x in 0..8 {
                assert_eq!(canvas.get_pixel(x, y).unwrap(), SEMI_TRANSPARENT_BLUE);
            }
        }
    }

    // ── get_pixel / set_pixel ───────────────────────────────────

    #[test]
    fn round_trips_a_color_through_set_and_get() {
        let mut canvas = PixelCanvas::new(8, 8).unwrap();
        canvas.set_pixel(3, 4, RED).unwrap();
        assert_eq!(canvas.get_pixel(3, 4).unwrap(), RED);
    }

    #[test]
    fn overwrites_an_existing_pixel() {
        let mut canvas = PixelCanvas::with_color(8, 8, RED).unwrap();
        canvas.set_pixel(0, 0, SEMI_TRANSPARENT_BLUE).unwrap();
        assert_eq!(canvas.get_pixel(0, 0).unwrap(), SEMI_TRANSPARENT_BLUE);
    }

    #[test]
    fn does_not_affect_adjacent_pixels() {
        let mut canvas = PixelCanvas::new(8, 8).unwrap();
        canvas.set_pixel(3, 3, RED).unwrap();
        assert_eq!(canvas.get_pixel(2, 3).unwrap(), Color::TRANSPARENT);
        assert_eq!(canvas.get_pixel(4, 3).unwrap(), Color::TRANSPARENT);
        assert_eq!(canvas.get_pixel(3, 2).unwrap(), Color::TRANSPARENT);
        assert_eq!(canvas.get_pixel(3, 4).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn accesses_boundary_pixels_correctly() {
        let mut canvas = PixelCanvas::new(16, 16).unwrap();
        canvas.set_pixel(0, 0, RED).unwrap();
        canvas.set_pixel(15, 15, SEMI_TRANSPARENT_BLUE).unwrap();
        assert_eq!(canvas.get_pixel(0, 0).unwrap(), RED);
        assert_eq!(canvas.get_pixel(15, 15).unwrap(), SEMI_TRANSPARENT_BLUE);
    }

    #[test]
    fn get_pixel_returns_error_for_x_at_width() {
        let canvas = PixelCanvas::new(8, 8).unwrap();
        assert_eq!(
            canvas.get_pixel(8, 0),
            Err(PixelCanvasError::OutOfBounds {
                x: 8,
                y: 0,
                width: 8,
                height: 8
            })
        );
    }

    #[test]
    fn get_pixel_returns_error_for_y_at_height() {
        let canvas = PixelCanvas::new(8, 8).unwrap();
        assert_eq!(
            canvas.get_pixel(0, 8),
            Err(PixelCanvasError::OutOfBounds {
                x: 0,
                y: 8,
                width: 8,
                height: 8
            })
        );
    }

    #[test]
    fn set_pixel_returns_error_for_x_at_width() {
        let mut canvas = PixelCanvas::new(8, 8).unwrap();
        assert_eq!(
            canvas.set_pixel(8, 0, RED),
            Err(PixelCanvasError::OutOfBounds {
                x: 8,
                y: 0,
                width: 8,
                height: 8
            })
        );
    }

    #[test]
    fn set_pixel_returns_error_for_y_at_height() {
        let mut canvas = PixelCanvas::new(8, 8).unwrap();
        assert_eq!(
            canvas.set_pixel(0, 8, RED),
            Err(PixelCanvasError::OutOfBounds {
                x: 0,
                y: 8,
                width: 8,
                height: 8
            })
        );
    }

    #[test]
    fn error_message_includes_coordinates_and_canvas_size() {
        let canvas = PixelCanvas::new(16, 16).unwrap();
        let err = canvas.get_pixel(20, 5).unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("(20, 5)"));
        assert!(msg.contains("16x16"));
        assert!(msg.contains("x in [0, 15]"));
    }

    // ── is_inside_bounds ────────────────────────────────────────

    #[test]
    fn is_inside_bounds_true_for_origin() {
        let canvas = PixelCanvas::new(8, 8).unwrap();
        assert!(canvas.is_inside_bounds(0, 0));
    }

    #[test]
    fn is_inside_bounds_true_for_max_valid_coordinates() {
        let canvas = PixelCanvas::new(8, 8).unwrap();
        assert!(canvas.is_inside_bounds(7, 7));
    }

    #[test]
    fn is_inside_bounds_false_at_boundary() {
        let canvas = PixelCanvas::new(8, 8).unwrap();
        assert!(!canvas.is_inside_bounds(8, 0));
        assert!(!canvas.is_inside_bounds(0, 8));
    }

    // ── is_valid_dimension ──────────────────────────────────────

    #[test]
    fn is_valid_dimension_accepts_valid_values() {
        for value in [1, 8, 64, 256] {
            assert!(PixelCanvas::is_valid_dimension(value));
        }
    }

    #[test]
    fn is_valid_dimension_rejects_invalid_values() {
        assert!(!PixelCanvas::is_valid_dimension(0));
        assert!(!PixelCanvas::is_valid_dimension(257));
    }

    // ── clear ───────────────────────────────────────────────────

    #[test]
    fn clear_sets_all_pixels_to_transparent() {
        let mut canvas = PixelCanvas::with_color(8, 8, RED).unwrap();
        canvas.clear();
        for y in 0..8 {
            for x in 0..8 {
                assert_eq!(canvas.get_pixel(x, y).unwrap(), Color::TRANSPARENT);
            }
        }
    }

    // ── from_pixels ───────────────────────────────────────────────

    #[test]
    fn from_pixels_creates_canvas_with_given_data() {
        let pixels = vec![255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0];
        let canvas = PixelCanvas::from_pixels(2, 2, pixels).unwrap();
        assert_eq!(canvas.width(), 2);
        assert_eq!(canvas.height(), 2);
        assert_eq!(canvas.get_pixel(0, 0).unwrap(), Color::new(255, 0, 0, 255));
        assert_eq!(canvas.get_pixel(1, 0).unwrap(), Color::new(0, 255, 0, 255));
    }

    #[test]
    fn from_pixels_rejects_wrong_buffer_length() {
        assert_eq!(
            PixelCanvas::from_pixels(2, 2, vec![0u8; 8]),
            Err(PixelCanvasError::InvalidBufferLength {
                expected: 16,
                actual: 8,
            })
        );
    }

    #[test]
    fn from_pixels_rejects_invalid_dimensions() {
        assert!(matches!(
            PixelCanvas::from_pixels(0, 1, vec![]),
            Err(PixelCanvasError::InvalidDimension { value: 0 })
        ));
        assert!(matches!(
            PixelCanvas::from_pixels(1, 257, vec![0u8; 4]),
            Err(PixelCanvasError::InvalidDimension { value: 257 })
        ));
    }

    // ── restore_pixels ────────────────────────────────────────────

    #[test]
    fn restore_pixels_replaces_buffer() {
        let mut canvas = PixelCanvas::new(2, 2).unwrap();
        let data = vec![
            255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 128, 128, 128, 255,
        ];
        canvas.restore_pixels(&data).unwrap();
        assert_eq!(canvas.get_pixel(0, 0).unwrap(), Color::new(255, 0, 0, 255));
        assert_eq!(canvas.get_pixel(1, 0).unwrap(), Color::new(0, 255, 0, 255));
        assert_eq!(canvas.get_pixel(0, 1).unwrap(), Color::new(0, 0, 255, 255));
        assert_eq!(
            canvas.get_pixel(1, 1).unwrap(),
            Color::new(128, 128, 128, 255)
        );
    }

    #[test]
    fn restore_pixels_rejects_wrong_length() {
        let mut canvas = PixelCanvas::new(2, 2).unwrap();
        let short = vec![0u8; 8];
        assert_eq!(
            canvas.restore_pixels(&short),
            Err(PixelCanvasError::InvalidBufferLength {
                expected: 16,
                actual: 8
            })
        );
    }

    // ── resize ──────────────────────────────────────────────────

    #[test]
    fn resize_same_size_preserves_all_pixels() {
        let source = PixelCanvas::with_color(8, 8, RED).unwrap();
        let result = source.resize(8, 8).unwrap();
        assert_eq!(result.width(), 8);
        assert_eq!(result.height(), 8);
        for y in 0..8 {
            for x in 0..8 {
                assert_eq!(result.get_pixel(x, y).unwrap(), RED);
            }
        }
    }

    #[test]
    fn resize_expanding_preserves_existing_and_fills_transparent() {
        let source = PixelCanvas::with_color(4, 4, RED).unwrap();
        let result = source.resize(8, 8).unwrap();
        assert_eq!(result.width(), 8);
        assert_eq!(result.height(), 8);
        for y in 0..4 {
            for x in 0..4 {
                assert_eq!(result.get_pixel(x, y).unwrap(), RED);
            }
        }
        assert_eq!(result.get_pixel(4, 0).unwrap(), Color::TRANSPARENT);
        assert_eq!(result.get_pixel(0, 4).unwrap(), Color::TRANSPARENT);
        assert_eq!(result.get_pixel(7, 7).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn resize_shrinking_clips_pixels() {
        let mut source = PixelCanvas::with_color(8, 8, RED).unwrap();
        source.set_pixel(0, 0, SEMI_TRANSPARENT_BLUE).unwrap();
        let result = source.resize(4, 4).unwrap();
        assert_eq!(result.width(), 4);
        assert_eq!(result.height(), 4);
        assert_eq!(result.get_pixel(0, 0).unwrap(), SEMI_TRANSPARENT_BLUE);
        assert_eq!(result.get_pixel(3, 3).unwrap(), RED);
    }

    #[test]
    fn resize_width_only_expansion() {
        let source = PixelCanvas::with_color(4, 4, RED).unwrap();
        let result = source.resize(8, 4).unwrap();
        assert_eq!(result.width(), 8);
        assert_eq!(result.height(), 4);
        assert_eq!(result.get_pixel(3, 3).unwrap(), RED);
        assert_eq!(result.get_pixel(4, 0).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn resize_height_only_expansion() {
        let source = PixelCanvas::with_color(4, 4, RED).unwrap();
        let result = source.resize(4, 8).unwrap();
        assert_eq!(result.width(), 4);
        assert_eq!(result.height(), 8);
        assert_eq!(result.get_pixel(3, 3).unwrap(), RED);
        assert_eq!(result.get_pixel(0, 4).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn resize_1x1_canvas() {
        let source = PixelCanvas::with_color(1, 1, RED).unwrap();
        let result = source.resize(4, 4).unwrap();
        assert_eq!(result.get_pixel(0, 0).unwrap(), RED);
        assert_eq!(result.get_pixel(1, 0).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn resize_does_not_mutate_source() {
        let source = PixelCanvas::with_color(4, 4, RED).unwrap();
        let _result = source.resize(8, 8).unwrap();
        assert_eq!(source.width(), 4);
        assert_eq!(source.height(), 4);
        assert_eq!(source.get_pixel(0, 0).unwrap(), RED);
    }

    #[test]
    fn resize_rejects_invalid_dimensions() {
        let source = PixelCanvas::new(8, 8).unwrap();
        assert_eq!(
            source.resize(0, 8),
            Err(PixelCanvasError::InvalidDimension { value: 0 })
        );
        assert_eq!(
            source.resize(8, 257),
            Err(PixelCanvasError::InvalidDimension { value: 257 })
        );
    }

    // ── PixelCanvasError Display ────────────────────────────────

    #[test]
    fn display_out_of_bounds_error() {
        let err = PixelCanvasError::OutOfBounds {
            x: 20,
            y: 5,
            width: 16,
            height: 16,
        };
        assert_eq!(
            err.to_string(),
            "Pixel coordinates (20, 5) are out of bounds for 16x16 canvas. \
             Valid range: x in [0, 15], y in [0, 15]"
        );
    }

    #[test]
    fn display_invalid_dimension_error() {
        let err = PixelCanvasError::InvalidDimension { value: 0 };
        assert_eq!(
            err.to_string(),
            "Canvas dimension 0 is out of valid range [1, 256]"
        );
    }

    #[test]
    fn error_implements_std_error() {
        let err = PixelCanvasError::InvalidDimension { value: 0 };
        let _dyn_err: &dyn std::error::Error = &err;
    }

    // ── resize_with_anchor ────────────────────────────────────

    #[test]
    fn resize_with_anchor_top_left_matches_legacy_resize() {
        let source = PixelCanvas::with_color(4, 4, RED).unwrap();
        let legacy = source.resize(8, 8).unwrap();
        let anchored = source
            .resize_with_anchor(8, 8, ResizeAnchor::TopLeft)
            .unwrap();
        assert_eq!(legacy.pixels(), anchored.pixels());
    }

    #[test]
    fn resize_with_anchor_center_expanding() {
        let source = PixelCanvas::with_color(4, 4, RED).unwrap();
        let result = source
            .resize_with_anchor(8, 8, ResizeAnchor::Center)
            .unwrap();
        // 4→8 = delta 4, offset = 4*1/2 = 2
        // RED should be at (2,2) to (5,5)
        for y in 0..8 {
            for x in 0..8 {
                let expected = if (2..6).contains(&x) && (2..6).contains(&y) {
                    RED
                } else {
                    Color::TRANSPARENT
                };
                assert_eq!(result.get_pixel(x, y).unwrap(), expected, "at ({x}, {y})");
            }
        }
    }

    #[test]
    fn resize_with_anchor_bottom_right_expanding() {
        let source = PixelCanvas::with_color(4, 4, RED).unwrap();
        let result = source
            .resize_with_anchor(8, 8, ResizeAnchor::BottomRight)
            .unwrap();
        // 4→8 = delta 4, offset = 4*2/2 = 4
        // RED should be at (4,4) to (7,7)
        for y in 0..8 {
            for x in 0..8 {
                let expected = if x >= 4 && y >= 4 {
                    RED
                } else {
                    Color::TRANSPARENT
                };
                assert_eq!(result.get_pixel(x, y).unwrap(), expected, "at ({x}, {y})");
            }
        }
    }

    #[test]
    fn resize_with_anchor_center_shrinking() {
        // 8x8 canvas, mark center 4x4 as RED
        let mut source = PixelCanvas::new(8, 8).unwrap();
        for y in 2..6 {
            for x in 2..6 {
                source.set_pixel(x, y, RED).unwrap();
            }
        }
        let result = source
            .resize_with_anchor(4, 4, ResizeAnchor::Center)
            .unwrap();
        // 8→4 = delta -4, offset = -4*1/2 = -2
        // Source pixels at (2,2)-(5,5) map to dest (0,0)-(3,3)
        for y in 0..4 {
            for x in 0..4 {
                assert_eq!(result.get_pixel(x, y).unwrap(), RED, "at ({x}, {y})");
            }
        }
    }

    #[test]
    fn resize_with_anchor_top_right_shrinking() {
        // 8x8 RED canvas, shrink to 4x4 with TopRight anchor
        let source = PixelCanvas::with_color(8, 8, RED).unwrap();
        let result = source
            .resize_with_anchor(4, 4, ResizeAnchor::TopRight)
            .unwrap();
        // 8→4 = delta -4, x offset = -4*2/2 = -4, y offset = 0
        // Clips 4 columns from left, 4 rows from bottom
        // Source pixels at (4,0)-(7,3) map to dest (0,0)-(3,3)
        for y in 0..4 {
            for x in 0..4 {
                assert_eq!(result.get_pixel(x, y).unwrap(), RED, "at ({x}, {y})");
            }
        }
    }

    #[test]
    fn resize_with_anchor_asymmetric() {
        // 4x4 RED → 7x5, Center anchor
        let source = PixelCanvas::with_color(4, 4, RED).unwrap();
        let result = source
            .resize_with_anchor(7, 5, ResizeAnchor::Center)
            .unwrap();
        // x: 7-4=3, offset=3*1/2=1 (truncated), so RED at x [1..5)
        // y: 5-4=1, offset=1*1/2=0 (truncated), so RED at y [0..4)
        for y in 0..5 {
            for x in 0..7 {
                let expected = if (1..5).contains(&x) && y < 4 {
                    RED
                } else {
                    Color::TRANSPARENT
                };
                assert_eq!(result.get_pixel(x, y).unwrap(), expected, "at ({x}, {y})");
            }
        }
    }

    #[test]
    fn resize_with_anchor_1x1_center_expand() {
        let source = PixelCanvas::with_color(1, 1, RED).unwrap();
        let result = source
            .resize_with_anchor(5, 5, ResizeAnchor::Center)
            .unwrap();
        // 1→5 = delta 4, offset = 4*1/2 = 2
        assert_eq!(result.get_pixel(2, 2).unwrap(), RED);
        assert_eq!(result.get_pixel(0, 0).unwrap(), Color::TRANSPARENT);
        assert_eq!(result.get_pixel(4, 4).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn resize_with_anchor_default_is_top_left() {
        assert_eq!(ResizeAnchor::default(), ResizeAnchor::TopLeft);
    }

    #[test]
    fn resize_with_anchor_rejects_invalid_dimensions() {
        let source = PixelCanvas::new(8, 8).unwrap();
        assert_eq!(
            source.resize_with_anchor(0, 8, ResizeAnchor::Center),
            Err(PixelCanvasError::InvalidDimension { value: 0 })
        );
        assert_eq!(
            source.resize_with_anchor(8, 257, ResizeAnchor::Center),
            Err(PixelCanvasError::InvalidDimension { value: 257 })
        );
    }

    // ── CanvasCoords ────────────────────────────────────────────

    #[test]
    fn canvas_coords_new() {
        let coords = CanvasCoords::new(3, 7);
        assert_eq!(coords.x, 3);
        assert_eq!(coords.y, 7);
    }

    #[test]
    fn canvas_coords_equality() {
        assert_eq!(CanvasCoords::new(1, 2), CanvasCoords::new(1, 2));
        assert_ne!(CanvasCoords::new(1, 2), CanvasCoords::new(2, 1));
    }

    #[test]
    fn canvas_coords_copy_semantics() {
        let a = CanvasCoords::new(5, 10);
        let b = a;
        assert_eq!(a, b);
    }
}
