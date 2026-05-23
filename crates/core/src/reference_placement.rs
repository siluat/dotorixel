/// A Reference Layer's source-to-document geometry — position and uniform
/// scale that map the source image onto the document canvas.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ReferencePlacement {
    pub x: f32,
    pub y: f32,
    pub scale: f32,
}

impl ReferencePlacement {
    pub fn with_position(self, x: f32, y: f32) -> Self {
        Self { x, y, ..self }
    }

    pub fn with_scale(self, scale: f32) -> Self {
        Self { scale, ..self }
    }

    /// Scales the source image aspect-preservingly so it fits entirely inside
    /// the document canvas, then centers the projected footprint.
    pub fn fit_to_canvas(
        canvas_width: u32,
        canvas_height: u32,
        natural_width: u32,
        natural_height: u32,
    ) -> Self {
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
    fn with_position_returns_placement_with_new_position_and_unchanged_scale() {
        let placement = ReferencePlacement {
            x: 10.0,
            y: 20.0,
            scale: 2.0,
        };
        let moved = placement.with_position(-5.5, 7.25);
        assert_eq!(
            moved,
            ReferencePlacement {
                x: -5.5,
                y: 7.25,
                scale: 2.0
            }
        );
    }

    #[test]
    fn with_scale_returns_placement_with_new_scale_and_unchanged_position() {
        let placement = ReferencePlacement {
            x: 10.0,
            y: 20.0,
            scale: 2.0,
        };
        let scaled = placement.with_scale(3.5);
        assert_eq!(
            scaled,
            ReferencePlacement {
                x: 10.0,
                y: 20.0,
                scale: 3.5
            }
        );
    }

    #[test]
    fn fit_to_canvas_downscales_and_centers_large_sources() {
        let fitted = ReferencePlacement::fit_to_canvas(10, 10, 20, 5);
        assert_eq!(
            fitted,
            ReferencePlacement {
                x: 0.0,
                y: 3.75,
                scale: 0.5
            }
        );
    }

    #[test]
    fn fit_to_canvas_upscales_and_centers_small_sources() {
        let fitted = ReferencePlacement::fit_to_canvas(20, 20, 4, 2);
        assert_eq!(
            fitted,
            ReferencePlacement {
                x: 0.0,
                y: 5.0,
                scale: 5.0
            }
        );
    }

    #[test]
    fn builders_leave_original_placement_unchanged() {
        let original = ReferencePlacement {
            x: 10.0,
            y: 20.0,
            scale: 2.0,
        };
        let _ = original.with_position(99.0, 99.0);
        let _ = original.with_scale(99.0);
        let _ = ReferencePlacement::fit_to_canvas(16, 16, 16, 8);
        assert_eq!(
            original,
            ReferencePlacement {
                x: 10.0,
                y: 20.0,
                scale: 2.0
            }
        );
    }
}
