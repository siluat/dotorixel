/// A Reference Layer's source-to-document geometry — position and uniform
/// scale that map the source image onto the document canvas.
///
/// Fields are private so the invariant established by [`Self::new`] — finite
/// position, scale finite and strictly greater than 0 — holds for every value
/// of this type.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ReferencePlacement {
    x: f32,
    y: f32,
    scale: f32,
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
        Ok(Self { x, y, scale })
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

    /// Internal builder for placement translation; callers must keep the
    /// coordinates finite.
    pub(crate) fn with_position(self, x: f32, y: f32) -> Self {
        debug_assert!(
            x.is_finite() && y.is_finite(),
            "with_position requires finite coordinates"
        );
        Self { x, y, ..self }
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
        debug_assert!(
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
        debug_assert!(
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
        }
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
}
