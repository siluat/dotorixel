/// A Reference Layer's source-to-document geometry — position and uniform
/// scale that map the source image onto the document canvas.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ReferencePlacement {
    pub x: f32,
    pub y: f32,
    pub scale: f32,
}
