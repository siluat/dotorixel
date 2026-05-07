use uuid::Uuid;

use crate::canvas::{PixelCanvas, PixelCanvasError};

/// A single drawable layer in a [`Document`](crate::Document): an addressable
/// pixel buffer with display state. `opacity` is in `[0.0, 1.0]`.
#[derive(Debug, Clone, PartialEq)]
pub struct Layer {
    pub id: Uuid,
    pub name: String,
    pub pixels: PixelCanvas,
    pub visible: bool,
    pub opacity: f32,
}

impl Layer {
    /// Creates a fully-transparent layer of `width × height`. New layers start
    /// `visible = true` and `opacity = 1.0`.
    pub fn new(
        id: Uuid,
        name: String,
        width: u32,
        height: u32,
    ) -> Result<Self, PixelCanvasError> {
        Ok(Self {
            id,
            name,
            pixels: PixelCanvas::new(width, height)?,
            visible: true,
            opacity: 1.0,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::color::Color;
    use uuid::Uuid;

    #[test]
    fn new_creates_transparent_layer_with_default_visibility_and_opacity() {
        let id = Uuid::new_v4();
        let layer = Layer::new(id, "Layer 1".to_string(), 8, 8).unwrap();
        assert_eq!(layer.id, id);
        assert_eq!(layer.name, "Layer 1");
        assert_eq!(layer.pixels.width(), 8);
        assert_eq!(layer.pixels.height(), 8);
        assert!(layer.visible);
        assert_eq!(layer.opacity, 1.0);
        assert_eq!(layer.pixels.get_pixel(0, 0).unwrap(), Color::TRANSPARENT);
    }
}
