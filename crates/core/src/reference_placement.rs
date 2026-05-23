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

    /// Resets `scale` to `1.0`, repositioning so the projected footprint's
    /// center stays at its current document coordinate.
    pub fn restore_to_natural(self, natural_width: u32, natural_height: u32) -> Self {
        let center_x = self.x + (natural_width as f32) * self.scale / 2.0;
        let center_y = self.y + (natural_height as f32) * self.scale / 2.0;
        Self {
            x: center_x - (natural_width as f32) / 2.0,
            y: center_y - (natural_height as f32) / 2.0,
            scale: 1.0,
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
    fn restore_to_natural_resets_scale_to_one_and_preserves_center_when_scaled_up() {
        let original = ReferencePlacement {
            x: 10.0,
            y: 20.0,
            scale: 2.0,
        };
        let center_before = projected_center(original, 16, 8);

        let restored = original.restore_to_natural(16, 8);

        assert_eq!(restored.scale, 1.0);
        assert_eq!(projected_center(restored, 16, 8), center_before);
    }

    #[test]
    fn restore_to_natural_preserves_center_when_scaled_down() {
        let original = ReferencePlacement {
            x: 0.0,
            y: 0.0,
            scale: 0.5,
        };
        let center_before = projected_center(original, 200, 100);

        let restored = original.restore_to_natural(200, 100);

        assert_eq!(restored.scale, 1.0);
        assert_eq!(projected_center(restored, 200, 100), center_before);
    }

    fn projected_center(
        p: ReferencePlacement,
        natural_width: u32,
        natural_height: u32,
    ) -> (f32, f32) {
        (
            p.x + (natural_width as f32) * p.scale / 2.0,
            p.y + (natural_height as f32) * p.scale / 2.0,
        )
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
        let _ = original.restore_to_natural(16, 8);
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
