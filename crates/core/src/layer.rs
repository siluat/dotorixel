use std::fmt;

use uuid::Uuid;

use crate::canvas::{PixelCanvas, PixelCanvasError};
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

impl Layer {
    /// Creates a fully-transparent Pixel Layer of `width × height`. New
    /// layers start `visible = true` and `opacity = 1.0`.
    pub fn new(
        id: Uuid,
        name: String,
        width: u32,
        height: u32,
    ) -> Result<Self, PixelCanvasError> {
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
    InvalidDimension { value: u32 },
    InvalidBufferLength { expected: usize, actual: usize },
    DimensionsTooLarge { natural_width: u32, natural_height: u32 },
}

impl fmt::Display for ReferenceDataError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidDimension { value } => {
                write!(f, "Reference Layer natural dimension must be at least 1; got {value}.")
            }
            Self::InvalidBufferLength { expected, actual } => {
                write!(
                    f,
                    "Reference Layer source buffer length must be {expected} bytes (natural_width × natural_height × 4); got {actual}.",
                )
            }
            Self::DimensionsTooLarge { natural_width, natural_height } => {
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
/// pixel dimensions (preserved for "Restore original size"), and the current
/// [`ReferencePlacement`].
///
/// The source buffer is immutable after construction — only the placement
/// changes during the layer's lifetime.
#[derive(Debug, Clone, PartialEq)]
pub struct ReferenceData {
    source_rgba: Vec<u8>,
    natural_width: u32,
    natural_height: u32,
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
            return Err(ReferenceDataError::InvalidDimension { value: natural_width });
        }
        if natural_height == 0 {
            return Err(ReferenceDataError::InvalidDimension { value: natural_height });
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
        Ok(Self {
            source_rgba,
            natural_width,
            natural_height,
            placement,
        })
    }

    pub fn source_rgba(&self) -> &[u8] {
        &self.source_rgba
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
        let placement = ReferencePlacement { x: 0.0, y: 0.0, scale: 1.0 };
        let data = ReferenceData::new(rgba, 4, 4, placement).unwrap();
        assert_eq!(data.natural_width(), 4);
        assert_eq!(data.natural_height(), 4);
        assert_eq!(data.source_rgba().len(), 64);
        assert_eq!(data.placement(), placement);
    }

    #[test]
    fn reference_data_new_rejects_buffer_length_mismatch() {
        let placement = ReferencePlacement { x: 0.0, y: 0.0, scale: 1.0 };
        let err = ReferenceData::new(vec![0u8; 10], 4, 4, placement).unwrap_err();
        assert_eq!(
            err,
            ReferenceDataError::InvalidBufferLength { expected: 64, actual: 10 }
        );
    }

    #[test]
    fn reference_data_new_rejects_zero_dimension() {
        let placement = ReferencePlacement { x: 0.0, y: 0.0, scale: 1.0 };
        let err = ReferenceData::new(vec![], 0, 4, placement).unwrap_err();
        assert_eq!(err, ReferenceDataError::InvalidDimension { value: 0 });
    }

    #[test]
    #[cfg(target_pointer_width = "32")]
    fn reference_data_new_rejects_dimensions_that_overflow_usize_on_32_bit() {
        let placement = ReferencePlacement { x: 0.0, y: 0.0, scale: 1.0 };
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
