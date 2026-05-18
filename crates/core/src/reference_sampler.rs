use crate::color::Color;
use crate::reference_placement::ReferencePlacement;

/// Returns the source pixel that projects onto document coordinate `(x, y)`
/// under `placement`, or `None` if `(x, y)` lies outside the source's
/// projected footprint. Sampling is integer-floor nearest-neighbor —
/// appropriate for the pixel-art aesthetic; no smoothing.
pub fn sample_reference(
    source_rgba: &[u8],
    source_dims: (u32, u32),
    placement: &ReferencePlacement,
    x: u32,
    y: u32,
) -> Option<Color> {
    let (width, height) = source_dims;
    let source_x = ((x as f32 - placement.x) / placement.scale).floor();
    let source_y = ((y as f32 - placement.y) / placement.scale).floor();

    if source_x < 0.0 || source_y < 0.0 {
        return None;
    }
    let source_x = source_x as u32;
    let source_y = source_y as u32;
    if source_x >= width || source_y >= height {
        return None;
    }

    let idx = ((source_y * width + source_x) * 4) as usize;
    Some(Color::new(
        source_rgba[idx],
        source_rgba[idx + 1],
        source_rgba[idx + 2],
        source_rgba[idx + 3],
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid_rgba(width: u32, height: u32, color: Color) -> Vec<u8> {
        (0..width * height)
            .flat_map(|_| [color.r, color.g, color.b, color.a])
            .collect()
    }

    // Each pixel's red channel encodes its `x` and green channel encodes its
    // `y`, so the sampled `Color` reveals the source coordinate it was read from.
    fn positional_rgba(width: u32, height: u32) -> Vec<u8> {
        let mut buf = Vec::with_capacity((width * height * 4) as usize);
        for y in 0..height {
            for x in 0..width {
                buf.extend_from_slice(&[x as u8, y as u8, 0, 255]);
            }
        }
        buf
    }

    #[test]
    fn identity_placement_maps_document_pixel_to_same_source_pixel() {
        let source = solid_rgba(4, 4, Color::new(10, 20, 30, 255));
        let placement = ReferencePlacement { x: 0.0, y: 0.0, scale: 1.0 };

        let sampled = sample_reference(&source, (4, 4), &placement, 2, 1);

        assert_eq!(sampled, Some(Color::new(10, 20, 30, 255)));
    }

    #[test]
    fn scale_up_by_2x_maps_consecutive_document_pixels_to_same_source_pixel() {
        let source = positional_rgba(4, 4);
        let placement = ReferencePlacement { x: 0.0, y: 0.0, scale: 2.0 };

        let s00 = sample_reference(&source, (4, 4), &placement, 0, 0);
        let s10 = sample_reference(&source, (4, 4), &placement, 1, 0);
        let s20 = sample_reference(&source, (4, 4), &placement, 2, 0);
        let s30 = sample_reference(&source, (4, 4), &placement, 3, 0);

        assert_eq!(s00, Some(Color::new(0, 0, 0, 255)));
        assert_eq!(s10, Some(Color::new(0, 0, 0, 255)));
        assert_eq!(s20, Some(Color::new(1, 0, 0, 255)));
        assert_eq!(s30, Some(Color::new(1, 0, 0, 255)));
    }

    #[test]
    fn scale_up_by_3x_uses_three_consecutive_document_pixels_per_source_pixel() {
        let source = positional_rgba(4, 4);
        let placement = ReferencePlacement { x: 0.0, y: 0.0, scale: 3.0 };

        let footprint: Vec<_> = (0..6)
            .map(|x| sample_reference(&source, (4, 4), &placement, x, 0))
            .collect();

        assert_eq!(
            footprint,
            vec![
                Some(Color::new(0, 0, 0, 255)),
                Some(Color::new(0, 0, 0, 255)),
                Some(Color::new(0, 0, 0, 255)),
                Some(Color::new(1, 0, 0, 255)),
                Some(Color::new(1, 0, 0, 255)),
                Some(Color::new(1, 0, 0, 255)),
            ],
        );
    }

    #[test]
    fn scale_down_by_half_floors_to_every_second_source_pixel() {
        let source = positional_rgba(4, 4);
        let placement = ReferencePlacement { x: 0.0, y: 0.0, scale: 0.5 };

        let row: Vec<_> = (0..2)
            .map(|x| sample_reference(&source, (4, 4), &placement, x, 0))
            .collect();

        assert_eq!(
            row,
            vec![
                Some(Color::new(0, 0, 0, 255)),
                Some(Color::new(2, 0, 0, 255)),
            ],
        );
    }

    #[test]
    fn sub_pixel_placement_offsets_snap_to_integer_source_coords() {
        let source = positional_rgba(4, 4);
        let placement = ReferencePlacement { x: -0.3, y: 0.7, scale: 1.0 };

        let sampled = sample_reference(&source, (4, 4), &placement, 2, 1);

        assert_eq!(sampled, Some(Color::new(2, 0, 0, 255)));
    }

    #[test]
    fn last_row_and_last_column_pixels_are_reachable() {
        let source = positional_rgba(4, 4);
        let placement = ReferencePlacement { x: 0.0, y: 0.0, scale: 1.0 };

        let bottom_right = sample_reference(&source, (4, 4), &placement, 3, 3);
        let last_column = sample_reference(&source, (4, 4), &placement, 3, 0);
        let last_row = sample_reference(&source, (4, 4), &placement, 0, 3);

        assert_eq!(bottom_right, Some(Color::new(3, 3, 0, 255)));
        assert_eq!(last_column, Some(Color::new(3, 0, 0, 255)));
        assert_eq!(last_row, Some(Color::new(0, 3, 0, 255)));
    }

    #[test]
    fn returns_none_when_document_coord_falls_before_shifted_source_origin() {
        let source = positional_rgba(4, 4);
        let placement = ReferencePlacement { x: 2.0, y: 0.0, scale: 1.0 };

        let sampled = sample_reference(&source, (4, 4), &placement, 0, 0);

        assert_eq!(sampled, None);
    }

    #[test]
    fn returns_none_when_document_coord_is_past_source_right_edge() {
        let source = solid_rgba(4, 4, Color::new(10, 20, 30, 255));
        let placement = ReferencePlacement { x: 0.0, y: 0.0, scale: 1.0 };

        let sampled = sample_reference(&source, (4, 4), &placement, 4, 0);

        assert_eq!(sampled, None);
    }
}
