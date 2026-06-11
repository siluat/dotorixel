use std::fmt;

use uuid::Uuid;

use crate::canvas::{PixelCanvas, PixelCanvasError};
use crate::color::Color;
use crate::reference_placement::ReferencePlacement;

/// A single layer in a [`Document`](crate::Document) — an addressable slot
/// with display state ([`visible`], [`opacity`] in `[0.0, 1.0]`) and a
/// [`LayerKind`] that determines whether the layer holds editable pixels
/// (Pixel Layer) or a tracing reference image (Reference Layer).
#[derive(Debug, Clone, PartialEq)]
pub struct Layer {
    pub id: Uuid,
    pub name: String,
    pub visible: bool,
    pub opacity: f32,
    pub kind: LayerKind,
}

/// The two layer variants. Drawing tools target Pixel Layers; Reference
/// Layers carry a tracing image that is composited on-screen but excluded
/// from exports.
#[derive(Debug, Clone, PartialEq)]
pub enum LayerKind {
    Pixel(PixelCanvas),
    Reference(ReferenceData),
}

/// Lightweight discriminant of [`LayerKind`] for shell-facing accessors that
/// must report a layer's kind without exposing the per-variant payload.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum LayerKindTag {
    Pixel,
    Reference,
}

impl LayerKind {
    pub fn tag(&self) -> LayerKindTag {
        match self {
            LayerKind::Pixel(_) => LayerKindTag::Pixel,
            LayerKind::Reference(_) => LayerKindTag::Reference,
        }
    }
}

impl Layer {
    /// Creates a fully-transparent Pixel Layer of `width × height`. New
    /// layers start `visible = true` and `opacity = 1.0`.
    pub fn new(id: Uuid, name: String, width: u32, height: u32) -> Result<Self, PixelCanvasError> {
        Ok(Self {
            id,
            name,
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Pixel(PixelCanvas::new(width, height)?),
        })
    }
}

/// Errors returned by [`ReferenceData::new`] when the supplied source buffer
/// is inconsistent with the declared natural dimensions.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReferenceDataError {
    InvalidDimension {
        value: u32,
    },
    InvalidBufferLength {
        expected: usize,
        actual: usize,
    },
    DimensionsTooLarge {
        natural_width: u32,
        natural_height: u32,
    },
}

impl fmt::Display for ReferenceDataError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidDimension { value } => {
                write!(
                    f,
                    "Reference Layer natural dimension must be at least 1; got {value}."
                )
            }
            Self::InvalidBufferLength { expected, actual } => {
                write!(
                    f,
                    "Reference Layer source buffer length must be {expected} bytes (natural_width × natural_height × 4); got {actual}.",
                )
            }
            Self::DimensionsTooLarge {
                natural_width,
                natural_height,
            } => {
                write!(
                    f,
                    "Reference Layer natural dimensions {natural_width}×{natural_height} exceed this platform's usize range.",
                )
            }
        }
    }
}

impl std::error::Error for ReferenceDataError {}

/// A Reference Layer's data: the decoded source RGBA buffer, its natural
/// pixel dimensions, and the current [`ReferencePlacement`].
///
/// The source buffer is immutable after construction — only the placement
/// changes during the layer's lifetime.
#[derive(Debug, Clone, PartialEq)]
pub struct ReferenceData {
    source_rgba: Vec<u8>,
    natural_width: u32,
    natural_height: u32,
    source_fingerprint: u64,
    placement: ReferencePlacement,
}

impl ReferenceData {
    /// Constructs a `ReferenceData` after validating the buffer length matches
    /// `natural_width × natural_height × 4` and both dimensions are at least 1.
    pub fn new(
        source_rgba: Vec<u8>,
        natural_width: u32,
        natural_height: u32,
        placement: ReferencePlacement,
    ) -> Result<Self, ReferenceDataError> {
        if natural_width == 0 {
            return Err(ReferenceDataError::InvalidDimension {
                value: natural_width,
            });
        }
        if natural_height == 0 {
            return Err(ReferenceDataError::InvalidDimension {
                value: natural_height,
            });
        }
        let expected = (natural_width as usize)
            .checked_mul(natural_height as usize)
            .and_then(|n| n.checked_mul(4))
            .ok_or(ReferenceDataError::DimensionsTooLarge {
                natural_width,
                natural_height,
            })?;
        if source_rgba.len() != expected {
            return Err(ReferenceDataError::InvalidBufferLength {
                expected,
                actual: source_rgba.len(),
            });
        }
        let source_fingerprint = fingerprint_rgba(&source_rgba);
        Ok(Self {
            source_rgba,
            natural_width,
            natural_height,
            source_fingerprint,
            placement,
        })
    }

    pub fn source_rgba(&self) -> &[u8] {
        &self.source_rgba
    }

    pub fn source_fingerprint(&self) -> u64 {
        self.source_fingerprint
    }

    pub fn natural_width(&self) -> u32 {
        self.natural_width
    }

    pub fn natural_height(&self) -> u32 {
        self.natural_height
    }

    pub fn placement(&self) -> ReferencePlacement {
        self.placement
    }

    pub fn set_placement(&mut self, placement: ReferencePlacement) {
        self.placement = placement;
    }

    /// Returns the source pixel that projects onto document coordinate
    /// `(x, y)` under the current placement, or `None` if `(x, y)` lies
    /// outside the source's projected footprint. Sampling is integer-floor
    /// nearest-neighbor — appropriate for the pixel-art aesthetic; no
    /// smoothing.
    pub fn sample_at(&self, x: u32, y: u32) -> Option<Color> {
        let source_x = ((x as f32 - self.placement.x()) / self.placement.scale()).floor();
        let source_y = ((y as f32 - self.placement.y()) / self.placement.scale()).floor();

        if source_x < 0.0 || source_y < 0.0 {
            return None;
        }
        let source_x = source_x as u32;
        let source_y = source_y as u32;
        if source_x >= self.natural_width || source_y >= self.natural_height {
            return None;
        }

        let idx = (source_y as usize * self.natural_width as usize + source_x as usize) * 4;
        Some(Color::new(
            self.source_rgba[idx],
            self.source_rgba[idx + 1],
            self.source_rgba[idx + 2],
            self.source_rgba[idx + 3],
        ))
    }
}

fn fingerprint_rgba(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf29ce484222325, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::color::Color;
    use uuid::Uuid;

    #[test]
    fn new_creates_transparent_pixel_kind_layer_with_default_visibility_and_opacity() {
        let id = Uuid::new_v4();
        let layer = Layer::new(id, "Layer 1".to_string(), 8, 8).unwrap();
        assert_eq!(layer.id, id);
        assert_eq!(layer.name, "Layer 1");
        assert!(layer.visible);
        assert_eq!(layer.opacity, 1.0);
        let LayerKind::Pixel(canvas) = &layer.kind else {
            panic!("Layer::new must create a Pixel-kind layer");
        };
        assert_eq!(canvas.width(), 8);
        assert_eq!(canvas.height(), 8);
        assert_eq!(canvas.get_pixel(0, 0).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn reference_data_new_accepts_buffer_matching_dimensions() {
        let rgba = vec![0u8; 4 * 4 * 4];
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        let data = ReferenceData::new(rgba, 4, 4, placement).unwrap();
        assert_eq!(data.natural_width(), 4);
        assert_eq!(data.natural_height(), 4);
        assert_eq!(data.source_rgba().len(), 64);
        assert_eq!(data.placement(), placement);
    }

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

    fn positional_reference(x: f32, y: f32, scale: f32) -> ReferenceData {
        let placement = ReferencePlacement::new(x, y, scale).unwrap();
        ReferenceData::new(positional_rgba(4, 4), 4, 4, placement).unwrap()
    }

    #[test]
    fn sample_at_maps_document_pixel_to_source_pixel_under_identity_placement() {
        let color = Color::new(10, 20, 30, 255);
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        let data = ReferenceData::new(solid_rgba(4, 4, color), 4, 4, placement).unwrap();

        assert_eq!(data.sample_at(2, 1), Some(color));
    }

    #[test]
    fn sample_at_scale_up_by_2x_maps_consecutive_document_pixels_to_same_source_pixel() {
        let data = positional_reference(0.0, 0.0, 2.0);

        assert_eq!(data.sample_at(0, 0), Some(Color::new(0, 0, 0, 255)));
        assert_eq!(data.sample_at(1, 0), Some(Color::new(0, 0, 0, 255)));
        assert_eq!(data.sample_at(2, 0), Some(Color::new(1, 0, 0, 255)));
        assert_eq!(data.sample_at(3, 0), Some(Color::new(1, 0, 0, 255)));
    }

    #[test]
    fn sample_at_scale_up_by_3x_uses_three_consecutive_document_pixels_per_source_pixel() {
        let data = positional_reference(0.0, 0.0, 3.0);

        let footprint: Vec<_> = (0..6).map(|x| data.sample_at(x, 0)).collect();

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
    fn sample_at_scale_down_by_half_floors_to_every_second_source_pixel() {
        let data = positional_reference(0.0, 0.0, 0.5);

        let row: Vec<_> = (0..2).map(|x| data.sample_at(x, 0)).collect();

        assert_eq!(
            row,
            vec![
                Some(Color::new(0, 0, 0, 255)),
                Some(Color::new(2, 0, 0, 255)),
            ],
        );
    }

    #[test]
    fn sample_at_sub_pixel_placement_offsets_snap_to_integer_source_coords() {
        let data = positional_reference(-0.3, 0.7, 1.0);

        assert_eq!(data.sample_at(2, 1), Some(Color::new(2, 0, 0, 255)));
    }

    #[test]
    fn sample_at_reaches_last_row_and_last_column_pixels() {
        let data = positional_reference(0.0, 0.0, 1.0);

        assert_eq!(data.sample_at(3, 3), Some(Color::new(3, 3, 0, 255)));
        assert_eq!(data.sample_at(3, 0), Some(Color::new(3, 0, 0, 255)));
        assert_eq!(data.sample_at(0, 3), Some(Color::new(0, 3, 0, 255)));
    }

    #[test]
    fn sample_at_returns_none_when_document_coord_falls_before_shifted_source_origin() {
        let data = positional_reference(2.0, 0.0, 1.0);

        assert_eq!(data.sample_at(0, 0), None);
    }

    #[test]
    fn sample_at_returns_none_when_document_coord_is_past_source_right_edge() {
        let data = positional_reference(0.0, 0.0, 1.0);

        assert_eq!(data.sample_at(4, 0), None);
    }

    #[test]
    fn sample_at_returns_none_when_document_coord_is_past_source_bottom_edge() {
        let data = positional_reference(0.0, 0.0, 1.0);

        assert_eq!(data.sample_at(0, 4), None);
    }

    #[test]
    fn reference_data_new_rejects_buffer_length_mismatch() {
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        let err = ReferenceData::new(vec![0u8; 10], 4, 4, placement).unwrap_err();
        assert_eq!(
            err,
            ReferenceDataError::InvalidBufferLength {
                expected: 64,
                actual: 10
            }
        );
    }

    #[test]
    fn reference_data_new_rejects_zero_dimension() {
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        let err = ReferenceData::new(vec![], 0, 4, placement).unwrap_err();
        assert_eq!(err, ReferenceDataError::InvalidDimension { value: 0 });
    }

    #[test]
    #[cfg(target_pointer_width = "32")]
    fn reference_data_new_rejects_dimensions_that_overflow_usize_on_32_bit() {
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        let err = ReferenceData::new(vec![], 65536, 65536, placement).unwrap_err();
        assert_eq!(
            err,
            ReferenceDataError::DimensionsTooLarge {
                natural_width: 65536,
                natural_height: 65536,
            }
        );
    }
}
