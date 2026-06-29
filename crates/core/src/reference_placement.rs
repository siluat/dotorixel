/// A Reference Layer's source-to-document geometry — position, uniform scale,
/// and a quarter-turn rotation that map the source image onto the document
/// canvas.
///
/// Fields are private so the invariant established by [`Self::new`] — finite
/// position, scale finite and strictly greater than 0, rotation a quarter-turn
/// in `0..=3` — holds for every value of this type.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ReferencePlacement {
    x: f32,
    y: f32,
    scale: f32,
    /// Number of 90° clockwise turns applied to the source image, in `0..=3`.
    rotation: u8,
}

/// Rejection reasons for [`ReferencePlacement::new`].
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ReferencePlacementError {
    NonFiniteCoordinates { x: f32, y: f32 },
    InvalidScale { scale: f32 },
}

impl std::fmt::Display for ReferencePlacementError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NonFiniteCoordinates { x, y } => {
                write!(
                    f,
                    "Reference placement coordinates must be finite, got ({x}, {y})"
                )
            }
            Self::InvalidScale { scale } => {
                write!(
                    f,
                    "Reference placement scale must be finite and greater than 0, got {scale}"
                )
            }
        }
    }
}

impl std::error::Error for ReferencePlacementError {}

impl ReferencePlacement {
    /// Constructs a placement after validating the Reference Layer Placement
    /// invariant: `x` and `y` must be finite, `scale` finite and strictly
    /// greater than 0.
    pub fn new(x: f32, y: f32, scale: f32) -> Result<Self, ReferencePlacementError> {
        if !x.is_finite() || !y.is_finite() {
            return Err(ReferencePlacementError::NonFiniteCoordinates { x, y });
        }
        if !scale.is_finite() || scale <= 0.0 {
            return Err(ReferencePlacementError::InvalidScale { scale });
        }
        Ok(Self {
            x,
            y,
            scale,
            rotation: 0,
        })
    }

    pub fn x(&self) -> f32 {
        self.x
    }

    pub fn y(&self) -> f32 {
        self.y
    }

    pub fn scale(&self) -> f32 {
        self.scale
    }

    /// Number of 90° clockwise turns applied to the source image, in `0..=3`.
    pub fn rotation(&self) -> u8 {
        self.rotation
    }

    /// Internal builder for placement translation; callers must keep the
    /// coordinates finite. The quarter-turn rotation is preserved.
    pub(crate) fn with_position(self, x: f32, y: f32) -> Self {
        debug_assert!(
            x.is_finite() && y.is_finite(),
            "with_position requires finite coordinates"
        );
        Self { x, y, ..self }
    }

    /// Returns this placement with its quarter-turn rotation set to `rotation`,
    /// normalized into `0..=3` (number of 90° clockwise turns). Position and
    /// scale are unchanged.
    pub fn with_rotation(self, rotation: u8) -> Self {
        Self {
            rotation: rotation % 4,
            ..self
        }
    }

    /// Aspect-preserving auto-fit: scales the source down so the longest axis
    /// fits the canvas, never enlarges (`scale ≤ 1.0`), and centers the
    /// projected footprint within the canvas.
    pub(crate) fn auto_fit(
        canvas_width: u32,
        canvas_height: u32,
        source_width: u32,
        source_height: u32,
    ) -> Self {
        // Release-active: a zero dimension would yield scale == 0 and break
        // the type invariant, so this must hold even when callers are wrong.
        assert!(
            canvas_width > 0 && canvas_height > 0 && source_width > 0 && source_height > 0,
            "auto_fit requires non-zero canvas and source dimensions"
        );
        let fit_x = canvas_width as f32 / source_width as f32;
        let fit_y = canvas_height as f32 / source_height as f32;
        let scale = fit_x.min(fit_y).min(1.0);
        let projected_w = source_width as f32 * scale;
        let projected_h = source_height as f32 * scale;
        Self {
            x: (canvas_width as f32 - projected_w) / 2.0,
            y: (canvas_height as f32 - projected_h) / 2.0,
            scale,
            rotation: 0,
        }
    }

    /// Scales the source image aspect-preservingly so it fits entirely inside
    /// the document canvas, then centers the projected footprint.
    pub fn fit_to_canvas(
        canvas_width: u32,
        canvas_height: u32,
        natural_width: u32,
        natural_height: u32,
    ) -> Self {
        // Release-active: a zero dimension would yield scale == 0 and break
        // the type invariant, so this must hold even when callers are wrong.
        assert!(
            canvas_width > 0 && canvas_height > 0 && natural_width > 0 && natural_height > 0,
            "fit_to_canvas requires non-zero canvas and source dimensions"
        );
        let scale = (canvas_width as f32 / natural_width as f32)
            .min(canvas_height as f32 / natural_height as f32);
        let projected_width = natural_width as f32 * scale;
        let projected_height = natural_height as f32 * scale;
        Self {
            x: (canvas_width as f32 - projected_width) / 2.0,
            y: (canvas_height as f32 - projected_height) / 2.0,
            scale,
            rotation: 0,
        }
    }

    /// This placement's [`ReferenceFootprint`] — the projected axis-aligned
    /// bounding box of a `natural_width × natural_height` source, in canvas-pixel
    /// coordinates. The min corner is the placement origin; the extent is the
    /// source dimensions scaled by [`scale`](Self::scale), with width and height
    /// swapped for an odd quarter-turn [`rotation`](Self::rotation) (the box
    /// turns with the source). Takes the natural dimensions as parameters, like
    /// [`fit_to_canvas`](Self::fit_to_canvas).
    pub fn footprint(&self, natural_width: u32, natural_height: u32) -> ReferenceFootprint {
        let projected_width = natural_width as f32 * self.scale;
        let projected_height = natural_height as f32 * self.scale;
        let (width, height) = if self.rotation % 2 == 0 {
            (projected_width, projected_height)
        } else {
            (projected_height, projected_width)
        };
        ReferenceFootprint {
            min_x: self.x,
            min_y: self.y,
            max_x: self.x + width,
            max_y: self.y + height,
        }
    }
}

/// A Reference Layer's projected axis-aligned bounding box on the document
/// canvas, in canvas-pixel coordinates — produced solely by
/// [`ReferencePlacement::footprint`]. Stored as min/max corners; its fractional
/// `f32` coordinates are why it is not a [`CanvasRect`](crate::canvas::CanvasRect),
/// which is integer-pixel.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ReferenceFootprint {
    min_x: f32,
    min_y: f32,
    max_x: f32,
    max_y: f32,
}

impl ReferenceFootprint {
    pub fn min_x(&self) -> f32 {
        self.min_x
    }

    pub fn min_y(&self) -> f32 {
        self.min_y
    }

    pub fn max_x(&self) -> f32 {
        self.max_x
    }

    pub fn max_y(&self) -> f32 {
        self.max_y
    }

    pub fn width(&self) -> f32 {
        self.max_x - self.min_x
    }

    pub fn height(&self) -> f32 {
        self.max_y - self.min_y
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_accepts_finite_coordinates_and_positive_scale() {
        let placement = ReferencePlacement::new(10.0, -20.5, 2.0).unwrap();
        assert_eq!(placement.x(), 10.0);
        assert_eq!(placement.y(), -20.5);
        assert_eq!(placement.scale(), 2.0);
    }

    #[test]
    fn new_rejects_non_finite_coordinates() {
        for (x, y) in [
            (f32::NAN, 0.0),
            (f32::INFINITY, 0.0),
            (0.0, f32::NEG_INFINITY),
            (0.0, f32::NAN),
        ] {
            let error = ReferencePlacement::new(x, y, 1.0).unwrap_err();
            assert!(matches!(
                error,
                ReferencePlacementError::NonFiniteCoordinates { .. }
            ));
        }
    }

    #[test]
    fn non_finite_coordinates_error_message_names_the_constraint() {
        let error = ReferencePlacement::new(f32::NAN, 0.0, 1.0).unwrap_err();
        assert_eq!(
            error.to_string(),
            "Reference placement coordinates must be finite, got (NaN, 0)"
        );
    }

    #[test]
    fn new_rejects_zero_negative_and_non_finite_scale() {
        for scale in [0.0, -1.0, f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
            let error = ReferencePlacement::new(0.0, 0.0, scale).unwrap_err();
            assert!(matches!(
                error,
                ReferencePlacementError::InvalidScale { .. }
            ));
        }
    }

    #[test]
    fn invalid_scale_error_message_names_the_constraint() {
        let error = ReferencePlacement::new(0.0, 0.0, 0.0).unwrap_err();
        assert_eq!(
            error.to_string(),
            "Reference placement scale must be finite and greater than 0, got 0"
        );
    }

    #[test]
    fn new_defaults_to_an_unrotated_quarter_turn() {
        let placement = ReferencePlacement::new(1.0, 2.0, 1.0).unwrap();
        assert_eq!(placement.rotation(), 0);
    }

    #[test]
    fn with_rotation_sets_the_quarter_turn_and_wraps_modulo_four() {
        let placement = ReferencePlacement::new(1.0, 2.0, 1.0).unwrap();
        assert_eq!(placement.with_rotation(1).rotation(), 1);
        assert_eq!(placement.with_rotation(3).rotation(), 3);
        assert_eq!(placement.with_rotation(4).rotation(), 0);
        assert_eq!(placement.with_rotation(7).rotation(), 3);
    }

    #[test]
    fn with_position_preserves_the_quarter_turn() {
        let placement = ReferencePlacement::new(1.0, 2.0, 1.0)
            .unwrap()
            .with_rotation(2);
        assert_eq!(placement.with_position(9.0, 9.0).rotation(), 2);
    }

    #[test]
    fn with_position_returns_placement_with_new_position_and_unchanged_scale() {
        let placement = ReferencePlacement::new(10.0, 20.0, 2.0).unwrap();
        let moved = placement.with_position(-5.5, 7.25);
        assert_eq!(moved, ReferencePlacement::new(-5.5, 7.25, 2.0).unwrap());
    }

    #[test]
    fn auto_fit_downscales_and_centers_large_sources() {
        let fitted = ReferencePlacement::auto_fit(10, 10, 20, 5);
        assert_eq!(fitted, ReferencePlacement::new(0.0, 3.75, 0.5).unwrap());
    }

    #[test]
    fn auto_fit_never_enlarges_small_sources() {
        let fitted = ReferencePlacement::auto_fit(20, 20, 4, 2);
        assert_eq!(fitted, ReferencePlacement::new(8.0, 9.0, 1.0).unwrap());
    }

    #[test]
    #[should_panic(expected = "auto_fit requires non-zero canvas and source dimensions")]
    fn auto_fit_panics_on_zero_dimension() {
        let _ = ReferencePlacement::auto_fit(0, 10, 1, 1);
    }

    #[test]
    #[should_panic(expected = "fit_to_canvas requires non-zero canvas and source dimensions")]
    fn fit_to_canvas_panics_on_zero_dimension() {
        let _ = ReferencePlacement::fit_to_canvas(0, 10, 1, 1);
    }

    #[test]
    fn fit_to_canvas_downscales_and_centers_large_sources() {
        let fitted = ReferencePlacement::fit_to_canvas(10, 10, 20, 5);
        assert_eq!(fitted, ReferencePlacement::new(0.0, 3.75, 0.5).unwrap());
    }

    #[test]
    fn fit_to_canvas_upscales_and_centers_small_sources() {
        let fitted = ReferencePlacement::fit_to_canvas(20, 20, 4, 2);
        assert_eq!(fitted, ReferencePlacement::new(0.0, 5.0, 5.0).unwrap());
    }

    #[test]
    fn builders_leave_original_placement_unchanged() {
        let original = ReferencePlacement::new(10.0, 20.0, 2.0).unwrap();
        let _ = original.with_position(99.0, 99.0);
        let _ = ReferencePlacement::fit_to_canvas(16, 16, 16, 8);
        assert_eq!(original, ReferencePlacement::new(10.0, 20.0, 2.0).unwrap());
    }

    #[test]
    fn footprint_of_unrotated_placement_spans_source_dimensions_from_the_origin() {
        let placement = ReferencePlacement::new(3.0, 5.0, 1.0).unwrap();
        let footprint = placement.footprint(4, 2);
        assert_eq!(footprint.min_x(), 3.0);
        assert_eq!(footprint.min_y(), 5.0);
        assert_eq!(footprint.max_x(), 7.0);
        assert_eq!(footprint.max_y(), 7.0);
        assert_eq!(footprint.width(), 4.0);
        assert_eq!(footprint.height(), 2.0);
    }

    #[test]
    fn footprint_swaps_width_and_height_for_odd_quarter_turns() {
        // A non-square 4×2 source at scale 3, placed at (1, 2). Even turns keep
        // the 12×6 projected extent; odd turns swap it to 6×12. The min corner
        // stays the placement origin regardless of rotation.
        let base = ReferencePlacement::new(1.0, 2.0, 3.0).unwrap();

        for rotation in [0, 2] {
            let footprint = base.with_rotation(rotation).footprint(4, 2);
            assert_eq!((footprint.min_x(), footprint.min_y()), (1.0, 2.0));
            assert_eq!(footprint.width(), 12.0);
            assert_eq!(footprint.height(), 6.0);
            assert_eq!(footprint.max_x(), 13.0);
            assert_eq!(footprint.max_y(), 8.0);
        }

        for rotation in [1, 3] {
            let footprint = base.with_rotation(rotation).footprint(4, 2);
            assert_eq!((footprint.min_x(), footprint.min_y()), (1.0, 2.0));
            assert_eq!(footprint.width(), 6.0);
            assert_eq!(footprint.height(), 12.0);
            assert_eq!(footprint.max_x(), 7.0);
            assert_eq!(footprint.max_y(), 14.0);
        }
    }
}
