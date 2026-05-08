use std::fmt;

use uuid::Uuid;

use crate::canvas::{PixelCanvasError, ResizeAnchor};
use crate::color::Color;
use crate::layer::Layer;
use crate::tool::ToolType;

/// Errors that can occur during layer-stack operations on a [`Document`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LayerError {
    LayerNotFound { id: Uuid },
    RemoveLastLayer,
}

impl fmt::Display for LayerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::LayerNotFound { id } => write!(f, "Layer with id {id} not found"),
            Self::RemoveLastLayer => write!(
                f,
                "Cannot remove the last remaining layer. A document must contain at least one layer."
            ),
        }
    }
}

impl std::error::Error for LayerError {}

/// Errors returned by [`Document::from_layers`] when the supplied layer stack
/// is inconsistent with the requested document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DocumentBuildError {
    EmptyLayers,
    DuplicateLayerId(Uuid),
    LayerDimensionsMismatch {
        layer_id: Uuid,
        expected: (u32, u32),
        actual: (u32, u32),
    },
    UnknownActiveLayer(Uuid),
}

impl fmt::Display for DocumentBuildError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyLayers => {
                write!(f, "Document must contain at least one layer.")
            }
            Self::DuplicateLayerId(id) => {
                write!(f, "Layer id {id} appears more than once in the supplied layer stack.")
            }
            Self::LayerDimensionsMismatch {
                layer_id,
                expected: (ew, eh),
                actual: (aw, ah),
            } => {
                write!(
                    f,
                    "Layer {layer_id} has pixel dimensions {aw}x{ah}; document expects {ew}x{eh}.",
                )
            }
            Self::UnknownActiveLayer(id) => {
                write!(f, "Active layer id {id} is not present in the supplied layer stack.")
            }
        }
    }
}

impl std::error::Error for DocumentBuildError {}

/// A pixel art document: an ordered stack of layers, an active-layer pointer,
/// and presentation state.
///
/// The first element of `layers()` is the bottom of the visible stack; the
/// last element is the top. All layers share the document's `width`/`height`.
#[derive(Debug, Clone)]
pub struct Document {
    width: u32,
    height: u32,
    layers: Vec<Layer>,
    active_layer_id: Uuid,
    next_layer_number: u32,
    timeline_panel_collapsed: bool,
}

impl Document {
    /// Creates a new document with one transparent layer (`first_layer_id` /
    /// `first_layer_name`) marked active. `next_layer_number` starts at 2 and
    /// the timeline panel begins expanded.
    pub fn new(
        width: u32,
        height: u32,
        first_layer_id: Uuid,
        first_layer_name: String,
    ) -> Result<Self, PixelCanvasError> {
        let layer = Layer::new(first_layer_id, first_layer_name, width, height)?;
        Ok(Self {
            width,
            height,
            layers: vec![layer],
            active_layer_id: first_layer_id,
            next_layer_number: 2,
            timeline_panel_collapsed: false,
        })
    }

    /// Constructs a document from an existing layer stack with caller-supplied
    /// layer ids, names, pixel buffers, visibility, and opacity. Returns
    /// [`DocumentBuildError`] when the stack is empty, contains duplicate ids,
    /// contains a layer whose pixel dimensions don't match `width × height`,
    /// or when `active_layer_id` is not present in the supplied stack.
    pub fn from_layers(
        width: u32,
        height: u32,
        layers: Vec<Layer>,
        active_layer_id: Uuid,
        next_layer_number: u32,
        timeline_panel_collapsed: bool,
    ) -> Result<Self, DocumentBuildError> {
        if layers.is_empty() {
            return Err(DocumentBuildError::EmptyLayers);
        }
        for (i, layer) in layers.iter().enumerate() {
            if layers[..i].iter().any(|prior| prior.id == layer.id) {
                return Err(DocumentBuildError::DuplicateLayerId(layer.id));
            }
            let actual = (layer.pixels.width(), layer.pixels.height());
            if actual != (width, height) {
                return Err(DocumentBuildError::LayerDimensionsMismatch {
                    layer_id: layer.id,
                    expected: (width, height),
                    actual,
                });
            }
        }
        if !layers.iter().any(|l| l.id == active_layer_id) {
            return Err(DocumentBuildError::UnknownActiveLayer(active_layer_id));
        }
        Ok(Self {
            width,
            height,
            layers,
            active_layer_id,
            next_layer_number,
            timeline_panel_collapsed,
        })
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn layers(&self) -> &[Layer] {
        &self.layers
    }

    pub fn active_layer_id(&self) -> Uuid {
        self.active_layer_id
    }

    pub fn next_layer_number(&self) -> u32 {
        self.next_layer_number
    }

    pub fn is_timeline_panel_collapsed(&self) -> bool {
        self.timeline_panel_collapsed
    }

    /// Inserts a new transparent layer directly above the active layer and
    /// makes it active.
    ///
    /// Increments [`next_layer_number`](Self::next_layer_number); the counter
    /// is not decremented by [`remove_layer`](Self::remove_layer), so layer
    /// numbers remain monotonic across the document's lifetime.
    pub fn add_layer(&mut self, new_id: Uuid, name: String) {
        debug_assert!(
            !self.layers.iter().any(|l| l.id == new_id),
            "add_layer called with a UUID already present in the stack"
        );
        let active_idx = self
            .layers
            .iter()
            .position(|l| l.id == self.active_layer_id)
            .expect("active layer id is always present in the stack");
        let layer = Layer::new(new_id, name, self.width, self.height)
            .expect("document dimensions are validated at construction");
        self.layers.insert(active_idx + 1, layer);
        self.active_layer_id = new_id;
        self.next_layer_number += 1;
    }

    /// Sets the active layer by id.
    ///
    /// Returns [`LayerError::LayerNotFound`] when no layer with `id` exists;
    /// in that case the previous active layer is preserved.
    pub fn set_active_layer(&mut self, id: Uuid) -> Result<(), LayerError> {
        if !self.layers.iter().any(|l| l.id == id) {
            return Err(LayerError::LayerNotFound { id });
        }
        self.active_layer_id = id;
        Ok(())
    }

    /// Removes the layer with `id`.
    ///
    /// Returns [`LayerError::RemoveLastLayer`] when the document has only one
    /// layer (a document must always contain at least one). Returns
    /// [`LayerError::LayerNotFound`] for an unknown id.
    ///
    /// When the removed layer was active, the active pointer moves to the
    /// layer immediately below; if the removed layer was at the bottom, it
    /// falls back to the layer immediately above.
    pub fn remove_layer(&mut self, id: Uuid) -> Result<(), LayerError> {
        let idx = self
            .layers
            .iter()
            .position(|l| l.id == id)
            .ok_or(LayerError::LayerNotFound { id })?;
        if self.layers.len() == 1 {
            return Err(LayerError::RemoveLastLayer);
        }
        self.layers.remove(idx);
        if self.active_layer_id == id {
            // Prefer the layer immediately below; fall back to the layer
            // immediately above when the removed layer was at the bottom.
            let new_active_idx = idx.saturating_sub(1);
            self.active_layer_id = self.layers[new_active_idx].id;
        }
        Ok(())
    }

    /// Moves the layer with `id` to `new_index`.
    ///
    /// `new_index` is silently clamped to `[0, layers.len() - 1]`. Returns
    /// [`LayerError::LayerNotFound`] for an unknown id. The active layer
    /// pointer is preserved across reordering (it's tracked by id, not by
    /// index).
    pub fn reorder_layer(&mut self, id: Uuid, new_index: usize) -> Result<(), LayerError> {
        let from = self
            .layers
            .iter()
            .position(|l| l.id == id)
            .ok_or(LayerError::LayerNotFound { id })?;
        let to = new_index.min(self.layers.len() - 1);
        if from != to {
            let layer = self.layers.remove(from);
            self.layers.insert(to, layer);
        }
        Ok(())
    }

    /// Returns a freshly-allocated row-major RGBA byte buffer
    /// (`width * height * 4`) with all visible layers blended bottom-to-top
    /// using straight (non-premultiplied) source-over alpha.
    ///
    /// Each layer's `opacity` is multiplied into its source alpha; layers with
    /// `visible = false` are skipped entirely.
    pub fn composite(&self) -> Vec<u8> {
        let mut buf = vec![0u8; (self.width * self.height * 4) as usize];
        for layer in &self.layers {
            if !layer.visible {
                continue;
            }
            blend_layer_over(&mut buf, layer);
        }
        buf
    }

    /// Reads the color at `(x, y)` on the active layer.
    pub fn get_pixel(&self, x: u32, y: u32) -> Result<Color, PixelCanvasError> {
        self.active_layer().pixels.get_pixel(x, y)
    }

    /// Writes `color` to `(x, y)` on the active layer. Other layers are
    /// unaffected.
    pub fn set_pixel(&mut self, x: u32, y: u32, color: Color) -> Result<(), PixelCanvasError> {
        self.active_layer_mut().pixels.set_pixel(x, y, color)
    }

    /// Applies `tool` at `(x, y)` to the active layer. Returns `true` when a
    /// pixel was written, `false` when the coordinates are out of bounds.
    pub fn apply_tool(&mut self, tool: ToolType, x: i32, y: i32, color: Color) -> bool {
        tool.apply(&mut self.active_layer_mut().pixels, x, y, color)
    }

    /// 4-connected flood fill on the active layer starting at `(x, y)`.
    /// Returns `true` when at least one pixel was changed.
    pub fn flood_fill(&mut self, x: u32, y: u32, color: Color) -> bool {
        self.active_layer_mut().pixels.flood_fill(x, y, color)
    }

    /// Clears the active layer to fully transparent. Other layers are
    /// unaffected.
    pub fn clear(&mut self) {
        self.active_layer_mut().pixels.clear();
    }

    /// Returns the RGBA pixel buffer of the layer at `index`, or `None` when
    /// `index` is out of range.
    pub fn layer_pixels_at(&self, index: usize) -> Option<&[u8]> {
        self.layers.get(index).map(|l| l.pixels.pixels())
    }

    /// Resizes every layer to `new_width × new_height` using the same
    /// `anchor`, preserving each layer's id, name, visibility, and opacity.
    /// The active layer pointer is preserved.
    pub fn resize(
        &mut self,
        new_width: u32,
        new_height: u32,
        anchor: ResizeAnchor,
    ) -> Result<(), PixelCanvasError> {
        let resized = self
            .layers
            .iter()
            .map(|layer| {
                layer
                    .pixels
                    .resize_with_anchor(new_width, new_height, anchor)
                    .map(|pixels| Layer {
                        id: layer.id,
                        name: layer.name.clone(),
                        pixels,
                        visible: layer.visible,
                        opacity: layer.opacity,
                    })
            })
            .collect::<Result<Vec<_>, _>>()?;
        self.layers = resized;
        self.width = new_width;
        self.height = new_height;
        Ok(())
    }

    fn active_layer(&self) -> &Layer {
        let id = self.active_layer_id;
        self.layers
            .iter()
            .find(|l| l.id == id)
            .expect("active layer is always present in the stack")
    }

    fn active_layer_mut(&mut self) -> &mut Layer {
        let id = self.active_layer_id;
        self.layers
            .iter_mut()
            .find(|l| l.id == id)
            .expect("active layer is always present in the stack")
    }
}

/// Source-over alpha composite of `layer` onto `dst` (straight RGBA, u8 per channel).
///
/// `dst` must already match the layer's `width * height * 4` byte length.
fn blend_layer_over(dst: &mut [u8], layer: &Layer) {
    let opacity = layer.opacity.clamp(0.0, 1.0);
    for (chunk, src) in dst.chunks_exact_mut(4).zip(layer.pixels.pixels().chunks_exact(4)) {
        let src_a = (src[3] as f32 / 255.0) * opacity;
        if src_a == 0.0 {
            continue;
        }
        let dst_a = chunk[3] as f32 / 255.0;
        let out_a = src_a + dst_a * (1.0 - src_a);
        for c in 0..3 {
            let s = src[c] as f32 / 255.0;
            let d = chunk[c] as f32 / 255.0;
            let out = (s * src_a + d * dst_a * (1.0 - src_a)) / out_a;
            chunk[c] = (out * 255.0).round() as u8;
        }
        chunk[3] = (out_a * 255.0).round() as u8;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn layer_pixels_at_returns_buffer_for_each_layer_or_none_for_out_of_range() {
        use crate::canvas::PixelCanvas;
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);

        let mut doc = Document::new(1, 1, a, "A".to_string()).unwrap();
        doc.layers[0].pixels = PixelCanvas::with_color(1, 1, red).unwrap();
        doc.add_layer(b, "B".to_string());
        doc.layers[1].pixels = PixelCanvas::with_color(1, 1, green).unwrap();

        assert_eq!(doc.layer_pixels_at(0), Some([255, 0, 0, 255].as_slice()));
        assert_eq!(doc.layer_pixels_at(1), Some([0, 255, 0, 255].as_slice()));
        assert_eq!(doc.layer_pixels_at(2), None);
    }

    #[test]
    fn clear_resets_only_active_layer_to_transparent() {
        use crate::canvas::PixelCanvas;
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);

        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        doc.layers[0].pixels = PixelCanvas::with_color(2, 2, red).unwrap();
        doc.add_layer(b, "B".to_string()); // active = B
        doc.layers[1].pixels = PixelCanvas::with_color(2, 2, green).unwrap();

        doc.clear();

        for y in 0..2 {
            for x in 0..2 {
                assert_eq!(doc.layers[0].pixels.get_pixel(x, y).unwrap(), red);
                assert_eq!(
                    doc.layers[1].pixels.get_pixel(x, y).unwrap(),
                    Color::TRANSPARENT
                );
            }
        }
    }

    #[test]
    fn flood_fill_writes_only_to_active_layer() {
        use crate::canvas::PixelCanvas;
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let blue = Color::new(0, 0, 255, 255);

        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        // Bottom (a): solid red — must remain red.
        doc.layers[0].pixels = PixelCanvas::with_color(2, 2, red).unwrap();
        // Top (b, active): transparent — flood_fill should turn it solid blue.
        doc.add_layer(b, "B".to_string());

        let painted = doc.flood_fill(0, 0, blue);

        assert!(painted);
        for y in 0..2 {
            for x in 0..2 {
                assert_eq!(doc.layers[1].pixels.get_pixel(x, y).unwrap(), blue);
                assert_eq!(doc.layers[0].pixels.get_pixel(x, y).unwrap(), red);
            }
        }
    }

    #[test]
    fn apply_tool_writes_only_to_active_layer() {
        use crate::color::Color;
        use crate::tool::ToolType;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        doc.add_layer(b, "B".to_string()); // active = B

        let red = Color::new(255, 0, 0, 255);
        let drew = doc.apply_tool(ToolType::Pencil, 0, 0, red);

        assert!(drew);
        assert_eq!(doc.layers[1].pixels.get_pixel(0, 0).unwrap(), red);
        assert_eq!(
            doc.layers[0].pixels.get_pixel(0, 0).unwrap(),
            Color::TRANSPARENT
        );
    }

    #[test]
    fn from_layers_rejects_active_id_not_present_in_stack() {
        let a = Uuid::new_v4();
        let stranger = Uuid::new_v4();
        let layers = vec![Layer::new(a, "A".to_string(), 4, 4).unwrap()];
        let result = Document::from_layers(4, 4, layers, stranger, 1, false);
        assert_eq!(
            result.unwrap_err(),
            DocumentBuildError::UnknownActiveLayer(stranger)
        );
    }

    #[test]
    fn from_layers_rejects_layer_with_mismatched_dimensions() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let layers = vec![
            Layer::new(a, "A".to_string(), 8, 8).unwrap(),
            // Layer b has the wrong size for an 8x8 document.
            Layer::new(b, "B".to_string(), 4, 4).unwrap(),
        ];
        let result = Document::from_layers(8, 8, layers, a, 1, false);
        assert_eq!(
            result.unwrap_err(),
            DocumentBuildError::LayerDimensionsMismatch {
                layer_id: b,
                expected: (8, 8),
                actual: (4, 4),
            }
        );
    }

    #[test]
    fn from_layers_rejects_duplicate_layer_ids() {
        let dup = Uuid::new_v4();
        let other = Uuid::new_v4();
        let layers = vec![
            Layer::new(dup, "A".to_string(), 4, 4).unwrap(),
            Layer::new(other, "B".to_string(), 4, 4).unwrap(),
            Layer::new(dup, "C".to_string(), 4, 4).unwrap(),
        ];
        let result = Document::from_layers(4, 4, layers, dup, 1, false);
        assert_eq!(
            result.unwrap_err(),
            DocumentBuildError::DuplicateLayerId(dup)
        );
    }

    #[test]
    fn from_layers_rejects_empty_layer_stack() {
        let dummy_id = Uuid::new_v4();
        let result = Document::from_layers(8, 8, vec![], dummy_id, 1, false);
        assert_eq!(result.unwrap_err(), DocumentBuildError::EmptyLayers);
    }

    #[test]
    fn from_layers_constructs_document_with_supplied_layer_stack() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let layers = vec![
            Layer::new(a, "A".to_string(), 4, 4).unwrap(),
            Layer::new(b, "B".to_string(), 4, 4).unwrap(),
        ];

        let doc = Document::from_layers(4, 4, layers, b, 7, true).unwrap();

        assert_eq!(doc.width(), 4);
        assert_eq!(doc.height(), 4);
        assert_eq!(doc.layers().len(), 2);
        assert_eq!(doc.layers()[0].id, a);
        assert_eq!(doc.layers()[1].id, b);
        assert_eq!(doc.active_layer_id(), b);
        assert_eq!(doc.next_layer_number(), 7);
        assert!(doc.is_timeline_panel_collapsed());
    }

    #[test]
    fn new_creates_document_with_one_active_layer_and_counter_at_two() {
        let id = Uuid::new_v4();
        let doc = Document::new(8, 8, id, "Layer 1".to_string()).unwrap();

        assert_eq!(doc.width(), 8);
        assert_eq!(doc.height(), 8);
        assert_eq!(doc.layers().len(), 1);
        assert_eq!(doc.layers()[0].id, id);
        assert_eq!(doc.layers()[0].name, "Layer 1");
        assert_eq!(doc.active_layer_id(), id);
        assert_eq!(doc.next_layer_number(), 2);
        assert!(!doc.is_timeline_panel_collapsed());
    }

    #[test]
    fn add_layer_inserts_above_active_and_becomes_active() {
        let first_id = Uuid::new_v4();
        let new_id = Uuid::new_v4();
        let mut doc = Document::new(8, 8, first_id, "Layer 1".to_string()).unwrap();

        doc.add_layer(new_id, "Layer 2".to_string());

        assert_eq!(doc.layers().len(), 2);
        let ids: Vec<Uuid> = doc.layers().iter().map(|l| l.id).collect();
        assert_eq!(ids, vec![first_id, new_id]);
        assert_eq!(doc.active_layer_id(), new_id);
        assert_eq!(doc.layers()[1].name, "Layer 2");
        assert_eq!(doc.next_layer_number(), 3);
    }

    #[test]
    fn add_layer_inserts_directly_above_active_when_active_is_mid_stack() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let c = Uuid::new_v4();
        let d = Uuid::new_v4();
        let mut doc = Document::new(8, 8, a, "A".to_string()).unwrap();
        doc.add_layer(b, "B".to_string()); // [A, B], active=B
        doc.add_layer(c, "C".to_string()); // [A, B, C], active=C
        doc.set_active_layer(b).unwrap(); // active=B (middle)
        doc.add_layer(d, "D".to_string()); // expect [A, B, D, C], active=D

        let ids: Vec<Uuid> = doc.layers().iter().map(|l| l.id).collect();
        assert_eq!(ids, vec![a, b, d, c]);
        assert_eq!(doc.active_layer_id(), d);
    }

    #[test]
    fn add_layer_starts_transparent() {
        use crate::color::Color;
        let first = Uuid::new_v4();
        let new_id = Uuid::new_v4();
        let mut doc = Document::new(2, 2, first, "L1".to_string()).unwrap();
        doc.add_layer(new_id, "L2".to_string());

        let new_layer = &doc.layers()[1];
        for y in 0..2 {
            for x in 0..2 {
                assert_eq!(
                    new_layer.pixels.get_pixel(x, y).unwrap(),
                    Color::TRANSPARENT
                );
            }
        }
    }

    #[test]
    fn remove_layer_rejects_last_layer() {
        let id = Uuid::new_v4();
        let mut doc = Document::new(8, 8, id, "Layer 1".to_string()).unwrap();

        assert_eq!(doc.remove_layer(id), Err(LayerError::RemoveLastLayer));
        assert_eq!(doc.layers().len(), 1);
        assert_eq!(doc.active_layer_id(), id);
    }

    #[test]
    fn remove_layer_relocates_active_to_adjacent_layer() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(8, 8, a, "A".to_string()).unwrap();
        doc.add_layer(b, "B".to_string()); // [A, B], active=B

        doc.remove_layer(b).unwrap();

        assert_eq!(doc.layers().len(), 1);
        assert_eq!(doc.layers()[0].id, a);
        assert_eq!(doc.active_layer_id(), a);
    }

    #[test]
    fn remove_layer_returns_layer_not_found_for_unknown_id() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let unknown = Uuid::new_v4();
        let mut doc = Document::new(8, 8, a, "A".to_string()).unwrap();
        doc.add_layer(b, "B".to_string());

        assert_eq!(
            doc.remove_layer(unknown),
            Err(LayerError::LayerNotFound { id: unknown })
        );
        assert_eq!(doc.layers().len(), 2);
    }

    #[test]
    fn remove_layer_prefers_layer_not_found_over_remove_last_layer_on_single_layer_document() {
        let a = Uuid::new_v4();
        let unknown = Uuid::new_v4();
        let mut doc = Document::new(8, 8, a, "A".to_string()).unwrap();

        // Single-layer document: an unknown id must surface LayerNotFound, not
        // RemoveLastLayer. The two errors mean different things to callers
        // (stale id vs. minimum-layer-count), and the doc comment promises
        // LayerNotFound takes precedence.
        assert_eq!(
            doc.remove_layer(unknown),
            Err(LayerError::LayerNotFound { id: unknown })
        );
        assert_eq!(doc.layers().len(), 1);
    }

    #[test]
    fn next_layer_number_is_monotonic_across_add_and_delete() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let c = Uuid::new_v4();
        let d = Uuid::new_v4();
        let mut doc = Document::new(8, 8, a, "A".to_string()).unwrap();
        assert_eq!(doc.next_layer_number(), 2);

        doc.add_layer(b, "B".to_string());
        assert_eq!(doc.next_layer_number(), 3);

        doc.add_layer(c, "C".to_string());
        assert_eq!(doc.next_layer_number(), 4);

        doc.remove_layer(b).unwrap();
        assert_eq!(doc.next_layer_number(), 4, "delete must not decrement counter");

        doc.add_layer(d, "D".to_string());
        assert_eq!(doc.next_layer_number(), 5);
    }

    #[test]
    fn reorder_layer_rearranges_stack() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let c = Uuid::new_v4();
        let mut doc = Document::new(8, 8, a, "A".to_string()).unwrap();
        doc.add_layer(b, "B".to_string());
        doc.add_layer(c, "C".to_string()); // [A, B, C]

        // Move B from index 1 to index 2 → [A, C, B]
        doc.reorder_layer(b, 2).unwrap();

        let ids: Vec<Uuid> = doc.layers().iter().map(|l| l.id).collect();
        assert_eq!(ids, vec![a, c, b]);
    }

    #[test]
    fn reorder_layer_preserves_active_layer_id() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let c = Uuid::new_v4();
        let mut doc = Document::new(8, 8, a, "A".to_string()).unwrap();
        doc.add_layer(b, "B".to_string());
        doc.add_layer(c, "C".to_string()); // [A, B, C], active=C

        // Move the active layer C from top (idx 2) to bottom (idx 0).
        doc.reorder_layer(c, 0).unwrap();

        let ids: Vec<Uuid> = doc.layers().iter().map(|l| l.id).collect();
        assert_eq!(ids, vec![c, a, b]);
        assert_eq!(
            doc.active_layer_id(),
            c,
            "active id is tracked by uuid, not by index"
        );
    }

    #[test]
    fn reorder_layer_clamps_out_of_range_index() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let c = Uuid::new_v4();
        let mut doc = Document::new(8, 8, a, "A".to_string()).unwrap();
        doc.add_layer(b, "B".to_string());
        doc.add_layer(c, "C".to_string()); // [A, B, C], len=3

        // Move A to a wildly out-of-range index → clamps to len-1 = 2 → [B, C, A]
        doc.reorder_layer(a, 99).unwrap();

        let ids: Vec<Uuid> = doc.layers().iter().map(|l| l.id).collect();
        assert_eq!(ids, vec![b, c, a]);
    }

    #[test]
    fn set_active_layer_returns_layer_not_found_for_unknown_id() {
        let a = Uuid::new_v4();
        let unknown = Uuid::new_v4();
        let mut doc = Document::new(8, 8, a, "A".to_string()).unwrap();

        assert_eq!(
            doc.set_active_layer(unknown),
            Err(LayerError::LayerNotFound { id: unknown })
        );
        assert_eq!(doc.active_layer_id(), a, "active must remain unchanged on error");
    }

    #[test]
    fn composite_of_single_transparent_layer_is_all_zero() {
        let id = Uuid::new_v4();
        let doc = Document::new(2, 2, id, "L1".to_string()).unwrap();
        assert_eq!(doc.composite(), vec![0u8; 16]);
    }

    #[test]
    fn composite_of_single_opaque_layer_returns_layer_pixels() {
        use crate::canvas::PixelCanvas;
        use crate::color::Color;

        let id = Uuid::new_v4();
        let mut doc = Document::new(2, 2, id, "L1".to_string()).unwrap();
        // Replace the active layer's pixels with solid red.
        let red = Color::new(255, 0, 0, 255);
        doc.layers[0].pixels = PixelCanvas::with_color(2, 2, red).unwrap();

        let expected: Vec<u8> = std::iter::repeat_n([255, 0, 0, 255], 4).flatten().collect();
        assert_eq!(doc.composite(), expected);
    }

    #[test]
    fn composite_blends_top_layer_source_over_bottom() {
        use crate::canvas::PixelCanvas;
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(1, 1, a, "A".to_string()).unwrap();
        // Bottom: opaque red.
        doc.layers[0].pixels =
            PixelCanvas::with_color(1, 1, Color::new(255, 0, 0, 255)).unwrap();
        // Top: 50%-alpha blue (alpha = 128).
        doc.add_layer(b, "B".to_string());
        doc.layers[1].pixels =
            PixelCanvas::with_color(1, 1, Color::new(0, 0, 255, 128)).unwrap();

        // src_a = 128/255, dst_a = 1.0 → out_a = 1.0 (255).
        // R: 0*128/255 + 255*1*(1 - 128/255) = 255 - 128 = 127
        // B: 255*128/255 + 0 = 128
        assert_eq!(doc.composite(), vec![127, 0, 128, 255]);
    }

    #[test]
    fn composite_skips_invisible_layers() {
        use crate::canvas::PixelCanvas;
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(1, 1, a, "A".to_string()).unwrap();
        // Bottom: opaque red, visible.
        doc.layers[0].pixels =
            PixelCanvas::with_color(1, 1, Color::new(255, 0, 0, 255)).unwrap();
        // Top: opaque green, hidden — should not affect composite.
        doc.add_layer(b, "B".to_string());
        doc.layers[1].pixels =
            PixelCanvas::with_color(1, 1, Color::new(0, 255, 0, 255)).unwrap();
        doc.layers[1].visible = false;

        assert_eq!(doc.composite(), vec![255, 0, 0, 255]);
    }

    #[test]
    fn composite_multiplies_layer_opacity_into_source_alpha() {
        use crate::canvas::PixelCanvas;
        use crate::color::Color;

        let id = Uuid::new_v4();
        let mut doc = Document::new(1, 1, id, "L1".to_string()).unwrap();
        doc.layers[0].pixels =
            PixelCanvas::with_color(1, 1, Color::new(255, 0, 0, 255)).unwrap();
        doc.layers[0].opacity = 0.5;

        // src_a = 1.0 * 0.5 = 0.5 → out_a = 0.5 → alpha byte = 128
        // RGB unchanged (only red has color, divided by out_a).
        assert_eq!(doc.composite(), vec![255, 0, 0, 128]);
    }

    #[test]
    fn get_pixel_reads_from_active_layer() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        doc.add_layer(b, "B".to_string()); // active=B

        let red = Color::new(255, 0, 0, 255);
        doc.set_pixel(0, 0, red).unwrap();

        assert_eq!(doc.get_pixel(0, 0).unwrap(), red);

        // Switching active layer surfaces the other layer's pixel.
        doc.set_active_layer(a).unwrap();
        assert_eq!(doc.get_pixel(0, 0).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn get_pixel_out_of_bounds_returns_error() {
        let id = Uuid::new_v4();
        let doc = Document::new(2, 2, id, "A".to_string()).unwrap();
        assert!(doc.get_pixel(2, 0).is_err());
        assert!(doc.get_pixel(0, 2).is_err());
    }

    #[test]
    fn set_pixel_writes_only_to_active_layer() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        doc.add_layer(b, "B".to_string()); // active=B

        let red = Color::new(255, 0, 0, 255);
        doc.set_pixel(0, 0, red).unwrap();

        // Active (B) is changed.
        assert_eq!(doc.layers[1].pixels.get_pixel(0, 0).unwrap(), red);
        // Inactive (A) is unchanged.
        assert_eq!(doc.layers[0].pixels.get_pixel(0, 0).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn set_pixel_follows_active_layer_after_switch() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        doc.add_layer(b, "B".to_string()); // active=B
        doc.set_active_layer(a).unwrap(); // active=A now

        let red = Color::new(255, 0, 0, 255);
        doc.set_pixel(0, 0, red).unwrap();

        assert_eq!(doc.layers[0].pixels.get_pixel(0, 0).unwrap(), red);
        assert_eq!(doc.layers[1].pixels.get_pixel(0, 0).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn resize_applies_same_anchor_to_every_layer() {
        use crate::canvas::{PixelCanvas, ResizeAnchor};
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);

        let mut doc = Document::new(4, 4, a, "A".to_string()).unwrap();
        doc.layers[0].pixels = PixelCanvas::with_color(4, 4, red).unwrap();
        doc.add_layer(b, "B".to_string());
        doc.layers[1].pixels = PixelCanvas::with_color(4, 4, green).unwrap();

        doc.resize(8, 8, ResizeAnchor::Center).unwrap();

        assert_eq!(doc.width(), 8);
        assert_eq!(doc.height(), 8);
        assert_eq!(doc.layers().len(), 2);
        // Center, 4→8, delta=4, offset=2. Original content sits at x,y ∈ [2, 6).
        for y in 0..8 {
            for x in 0..8 {
                let in_anchor = (2..6).contains(&x) && (2..6).contains(&y);
                let expected_a = if in_anchor { red } else { Color::TRANSPARENT };
                let expected_b = if in_anchor { green } else { Color::TRANSPARENT };
                assert_eq!(
                    doc.layers[0].pixels.get_pixel(x, y).unwrap(),
                    expected_a,
                    "layer A at ({x}, {y})"
                );
                assert_eq!(
                    doc.layers[1].pixels.get_pixel(x, y).unwrap(),
                    expected_b,
                    "layer B at ({x}, {y})"
                );
            }
        }
    }
}
