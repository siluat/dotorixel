use std::fmt;

use uuid::Uuid;

use crate::canvas::{
    CanvasRect, PixelCanvas, PixelCanvasError, ResizeAnchor, flip_buffer_horizontal,
    flip_buffer_vertical, rotate_buffer_ccw, rotate_buffer_cw,
};
use crate::color::Color;
use crate::frame::Frame;
use crate::layer::{Cels, Layer, LayerKind, LayerKindTag, ReferenceData, ReferenceDataError};
use crate::reference_placement::ReferencePlacement;
use crate::selection::{MarqueeRegion, clear_region, composite_region, lift_region};
use crate::tool::ToolType;

/// Errors that can occur during layer-stack operations on a [`Document`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LayerError {
    LayerNotFound {
        id: Uuid,
    },
    RemoveLastLayer,
    LayerKindMismatch {
        id: Uuid,
        expected: LayerKindTag,
        actual: LayerKindTag,
    },
}

impl fmt::Display for LayerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::LayerNotFound { id } => write!(f, "Layer with id {id} not found"),
            Self::RemoveLastLayer => write!(
                f,
                "Cannot remove the last remaining layer. A document must contain at least one layer."
            ),
            Self::LayerKindMismatch {
                id,
                expected,
                actual,
            } => write!(
                f,
                "Layer {id} is {actual:?}; this operation requires a {expected:?} Layer.",
            ),
        }
    }
}

impl std::error::Error for LayerError {}

/// Errors that can occur during frame-axis operations on a [`Document`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FrameError {
    FrameNotFound { id: Uuid },
    RemoveLastFrame,
}

impl fmt::Display for FrameError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::FrameNotFound { id } => write!(f, "Frame with id {id} not found"),
            Self::RemoveLastFrame => write!(
                f,
                "Cannot remove the last remaining frame. A document must contain at least one frame."
            ),
        }
    }
}

impl std::error::Error for FrameError {}

/// Errors returned by the active-layer pixel accessors ([`Document::set_pixel`],
/// [`Document::get_pixel`]) when the call is incompatible with the active
/// layer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DrawError {
    OutOfBounds(PixelCanvasError),
    LayerKindMismatch,
}

impl fmt::Display for DrawError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::OutOfBounds(err) => err.fmt(f),
            Self::LayerKindMismatch => write!(
                f,
                "Active layer is not a Pixel Layer; drawing methods cannot mutate or read it.",
            ),
        }
    }
}

impl std::error::Error for DrawError {}

impl From<PixelCanvasError> for DrawError {
    fn from(err: PixelCanvasError) -> Self {
        Self::OutOfBounds(err)
    }
}

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
    MissingInitialFrameCel {
        layer_id: Uuid,
    },
}

impl fmt::Display for DocumentBuildError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyLayers => {
                write!(f, "Document must contain at least one layer.")
            }
            Self::DuplicateLayerId(id) => {
                write!(
                    f,
                    "Layer id {id} appears more than once in the supplied layer stack."
                )
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
                write!(
                    f,
                    "Active layer id {id} is not present in the supplied layer stack."
                )
            }
            Self::MissingInitialFrameCel { layer_id } => {
                write!(
                    f,
                    "Pixel layer {layer_id} has no cel for the document's initial frame; every Pixel Layer must hold one cel per frame."
                )
            }
        }
    }
}

impl std::error::Error for DocumentBuildError {}

/// A pixel art document: an ordered stack of layers, an ordered axis of
/// frames, active pointers into each, and presentation state.
///
/// The first element of `layers()` is the bottom of the visible stack; the
/// last element is the top. All layers share the document's `width`/`height`.
///
/// Layers and frames are orthogonal axes. The first element of `frames()` is
/// the first frame; frames are always non-empty. Every Pixel Layer holds one
/// cel per frame (the **grid invariant**); a Reference Layer is
/// frame-independent. Drawing and compositing act on the active frame's cels.
#[derive(Debug, Clone)]
pub struct Document {
    width: u32,
    height: u32,
    layers: Vec<Layer>,
    active_layer_id: Uuid,
    frames: Vec<Frame>,
    active_frame_id: Uuid,
    marquee: Option<MarqueeRegion>,
    next_layer_number: u32,
    timeline_panel_collapsed: bool,
}

impl Document {
    /// Creates a new document with one transparent layer (`first_layer_id` /
    /// `first_layer_name`) marked active and one [initial frame](Frame::INITIAL)
    /// marked active. `next_layer_number` starts at 2 and the timeline panel
    /// begins expanded.
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
            frames: vec![Frame::INITIAL],
            active_frame_id: Frame::INITIAL.id,
            marquee: None,
            next_layer_number: 2,
            timeline_panel_collapsed: false,
        })
    }

    /// Constructs a document from an existing layer stack with caller-supplied
    /// layer ids, names, pixel buffers, visibility, and opacity. Returns
    /// [`DocumentBuildError`] when the stack is empty, contains duplicate ids,
    /// contains a layer whose pixel dimensions don't match `width × height`,
    /// or when `active_layer_id` is not present in the supplied stack.
    ///
    /// The reconstructed document has a single [initial frame](Frame::INITIAL)
    /// marked active, with each Pixel Layer's sole cel keyed to it.
    /// Multi-frame reconstruction is a later persistence concern.
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
            if let LayerKind::Pixel(cels) = &layer.kind {
                // The reconstructed document has a single initial frame, so every
                // Pixel Layer must carry a cel keyed to it — otherwise the
                // document would build successfully but panic on the first
                // active-frame access. Also rejects an empty `Cels`.
                if cels.get(Frame::INITIAL.id).is_none() {
                    return Err(DocumentBuildError::MissingInitialFrameCel { layer_id: layer.id });
                }
                for canvas in cels.canvases() {
                    let actual = (canvas.width(), canvas.height());
                    if actual != (width, height) {
                        return Err(DocumentBuildError::LayerDimensionsMismatch {
                            layer_id: layer.id,
                            expected: (width, height),
                            actual,
                        });
                    }
                }
            }
        }
        let (layers, active_layer_id) = normalize_reference_underlay(layers, active_layer_id);
        if !layers.iter().any(|l| l.id == active_layer_id) {
            return Err(DocumentBuildError::UnknownActiveLayer(active_layer_id));
        }
        Ok(Self {
            width,
            height,
            layers,
            active_layer_id,
            frames: vec![Frame::INITIAL],
            active_frame_id: Frame::INITIAL.id,
            marquee: None,
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

    pub fn frames(&self) -> &[Frame] {
        &self.frames
    }

    pub fn active_frame_id(&self) -> Uuid {
        self.active_frame_id
    }

    pub fn marquee(&self) -> Option<MarqueeRegion> {
        self.marquee
    }

    pub fn set_marquee(&mut self, marquee: Option<MarqueeRegion>) {
        self.marquee = marquee;
    }

    pub fn next_layer_number(&self) -> u32 {
        self.next_layer_number
    }

    pub fn is_timeline_panel_collapsed(&self) -> bool {
        self.timeline_panel_collapsed
    }

    pub fn set_timeline_panel_collapsed(&mut self, collapsed: bool) {
        self.timeline_panel_collapsed = collapsed;
    }

    /// Inserts a new transparent layer directly above the active layer and
    /// makes it active. The new layer is seeded with a transparent cel for
    /// every frame, preserving the grid invariant.
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
        let frame_ids: Vec<Uuid> = self.frames.iter().map(|f| f.id).collect();
        let cels = Cels::transparent(&frame_ids, self.width, self.height)
            .expect("document dimensions are validated at construction");
        self.layers.insert(
            active_idx + 1,
            Layer {
                id: new_id,
                name,
                visible: true,
                opacity: 1.0,
                kind: LayerKind::Pixel(cels),
            },
        );
        self.active_layer_id = new_id;
        self.next_layer_number += 1;
    }

    /// Sets the singleton Reference Layer, replacing the existing Reference
    /// when one is already present. The Reference Layer is always kept at the
    /// bottom of the stack, below every Pixel Layer.
    ///
    /// Computes the aspect-preserving auto-fit placement (centered,
    /// `scale = min(canvas_w / source_w, canvas_h / source_h, 1.0)`) and makes
    /// the Reference active. Returns [`ReferenceDataError`] when the supplied
    /// buffer does not match `source_width × source_height × 4` bytes or either
    /// dimension is zero.
    pub fn add_reference_layer(
        &mut self,
        new_id: Uuid,
        name: String,
        source_rgba: Vec<u8>,
        source_width: u32,
        source_height: u32,
    ) -> Result<(), ReferenceDataError> {
        debug_assert!(
            !self
                .layers
                .iter()
                .any(|l| l.id == new_id && !matches!(l.kind, LayerKind::Reference(_))),
            "add_reference_layer called with a UUID already present in the Pixel stack"
        );
        let placement =
            ReferencePlacement::auto_fit(self.width, self.height, source_width, source_height);
        let data = ReferenceData::new(source_rgba, source_width, source_height, placement)?;
        let replaced_existing = if let Some(reference_idx) = self
            .layers
            .iter()
            .position(|l| matches!(l.kind, LayerKind::Reference(_)))
        {
            self.layers.remove(reference_idx);
            true
        } else {
            false
        };
        self.layers.insert(
            0,
            Layer {
                id: new_id,
                name,
                visible: true,
                opacity: 1.0,
                kind: LayerKind::Reference(data),
            },
        );
        self.active_layer_id = new_id;
        if !replaced_existing {
            self.next_layer_number += 1;
        }
        Ok(())
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

    /// Sets the visibility flag of the layer with `id`.
    ///
    /// Returns [`LayerError::LayerNotFound`] for an unknown id. The active
    /// layer pointer is preserved (visibility does not affect activity).
    pub fn set_layer_visibility(&mut self, id: Uuid, visible: bool) -> Result<(), LayerError> {
        let layer = self
            .layers
            .iter_mut()
            .find(|l| l.id == id)
            .ok_or(LayerError::LayerNotFound { id })?;
        layer.visible = visible;
        Ok(())
    }

    /// Updates the position and scale of the Reference Layer with `id` from
    /// `placement`. The layer's existing quarter-turn rotation is preserved —
    /// `placement.rotation()` is ignored — because only a whole-Document rotate
    /// turns a reference.
    ///
    /// Returns [`LayerError::LayerNotFound`] for an unknown id and
    /// [`LayerError::LayerKindMismatch`] when the addressed layer is a Pixel
    /// Layer. On error, no document state is mutated.
    pub fn set_reference_placement(
        &mut self,
        id: Uuid,
        placement: ReferencePlacement,
    ) -> Result<(), LayerError> {
        let layer = self
            .layers
            .iter_mut()
            .find(|l| l.id == id)
            .ok_or(LayerError::LayerNotFound { id })?;
        match &mut layer.kind {
            LayerKind::Reference(data) => {
                // The placement's position and scale are updated, but its
                // quarter-turn rotation is preserved: only a whole-Document
                // rotate turns a reference, and a move/scale must not reset it.
                let preserved = placement.with_rotation(data.placement().rotation());
                data.set_placement(preserved);
                Ok(())
            }
            LayerKind::Pixel(_) => Err(LayerError::LayerKindMismatch {
                id,
                expected: LayerKindTag::Reference,
                actual: LayerKindTag::Pixel,
            }),
        }
    }

    /// Moves the layer with `id` to `new_index`.
    ///
    /// Reference Layers are fixed at the bottom of the stack, so reordering one
    /// is a no-op. Pixel Layers are silently clamped to `[1, layers.len() - 1]`
    /// when a Reference exists, or `[0, layers.len() - 1]` otherwise. Returns
    /// [`LayerError::LayerNotFound`] for an unknown id. The active layer pointer
    /// is preserved across reordering (it's tracked by id, not by index).
    pub fn reorder_layer(&mut self, id: Uuid, new_index: usize) -> Result<(), LayerError> {
        let from = self
            .layers
            .iter()
            .position(|l| l.id == id)
            .ok_or(LayerError::LayerNotFound { id })?;
        if matches!(self.layers[from].kind, LayerKind::Reference(_)) {
            return Ok(());
        }
        let min_index = if self
            .layers
            .iter()
            .any(|l| matches!(l.kind, LayerKind::Reference(_)))
        {
            1
        } else {
            0
        };
        let to = new_index.min(self.layers.len() - 1).max(min_index);
        if from != to {
            let layer = self.layers.remove(from);
            self.layers.insert(to, layer);
        }
        Ok(())
    }

    /// Inserts a new frame directly after the active frame, seeds a transparent
    /// cel for it on every Pixel Layer, and makes it active. Mirrors
    /// [`add_layer`](Self::add_layer) on the frame axis.
    pub fn add_frame(&mut self, new_id: Uuid) {
        debug_assert!(
            !self.frames.iter().any(|f| f.id == new_id),
            "add_frame called with a frame id already present on the axis"
        );
        let active_idx = self
            .frames
            .iter()
            .position(|f| f.id == self.active_frame_id)
            .expect("active frame id is always present on the axis");
        self.frames.insert(active_idx + 1, Frame { id: new_id });
        for layer in &mut self.layers {
            if let LayerKind::Pixel(cels) = &mut layer.kind {
                cels.seed_transparent(new_id, self.width, self.height)
                    .expect("document dimensions are validated at construction");
            }
        }
        self.active_frame_id = new_id;
    }

    /// Inserts a copy of the active frame directly after it — cloning every
    /// Pixel Layer's active-frame cel into the new frame — and makes the copy
    /// active. The clone is deep: editing the copy never touches the source.
    pub fn duplicate_frame(&mut self, new_id: Uuid) {
        debug_assert!(
            !self.frames.iter().any(|f| f.id == new_id),
            "duplicate_frame called with a frame id already present on the axis"
        );
        let source_id = self.active_frame_id;
        let active_idx = self
            .frames
            .iter()
            .position(|f| f.id == source_id)
            .expect("active frame id is always present on the axis");
        self.frames.insert(active_idx + 1, Frame { id: new_id });
        for layer in &mut self.layers {
            if let LayerKind::Pixel(cels) = &mut layer.kind {
                cels.duplicate_cel(source_id, new_id);
            }
        }
        self.active_frame_id = new_id;
    }

    /// Removes the frame with `id` and drops its cel from every Pixel Layer.
    ///
    /// Returns [`FrameError::RemoveLastFrame`] when the document has only one
    /// frame (a document must always contain at least one). Returns
    /// [`FrameError::FrameNotFound`] for an unknown id — and prefers it over
    /// `RemoveLastFrame` on a single-frame document.
    ///
    /// When the removed frame was active, the active pointer moves to the frame
    /// immediately below; if the removed frame was the first, it falls back to
    /// the frame immediately above — the same policy as
    /// [`remove_layer`](Self::remove_layer).
    pub fn remove_frame(&mut self, id: Uuid) -> Result<(), FrameError> {
        let idx = self
            .frames
            .iter()
            .position(|f| f.id == id)
            .ok_or(FrameError::FrameNotFound { id })?;
        if self.frames.len() == 1 {
            return Err(FrameError::RemoveLastFrame);
        }
        self.frames.remove(idx);
        for layer in &mut self.layers {
            if let LayerKind::Pixel(cels) = &mut layer.kind {
                cels.remove(id);
            }
        }
        if self.active_frame_id == id {
            // Prefer the frame immediately below; fall back to the frame
            // immediately above when the removed frame was the first.
            let new_active_idx = idx.saturating_sub(1);
            self.active_frame_id = self.frames[new_active_idx].id;
        }
        Ok(())
    }

    /// Moves the frame with `id` to `new_index`, silently clamped to
    /// `[0, frames.len() - 1]`. Returns [`FrameError::FrameNotFound`] for an
    /// unknown id. The active frame pointer is preserved across reordering
    /// (it is tracked by id, not by index), and each Pixel Layer's cels stay
    /// keyed by frame id, so cel contents follow their frame.
    pub fn reorder_frame(&mut self, id: Uuid, new_index: usize) -> Result<(), FrameError> {
        let from = self
            .frames
            .iter()
            .position(|f| f.id == id)
            .ok_or(FrameError::FrameNotFound { id })?;
        let to = new_index.min(self.frames.len() - 1);
        if from != to {
            let frame = self.frames.remove(from);
            self.frames.insert(to, frame);
        }
        Ok(())
    }

    /// Sets the active frame by id.
    ///
    /// Returns [`FrameError::FrameNotFound`] when no frame with `id` exists; in
    /// that case the previous active frame is preserved.
    pub fn set_active_frame(&mut self, id: Uuid) -> Result<(), FrameError> {
        if !self.frames.iter().any(|f| f.id == id) {
            return Err(FrameError::FrameNotFound { id });
        }
        self.active_frame_id = id;
        Ok(())
    }

    /// Returns a freshly-allocated row-major RGBA byte buffer
    /// (`width * height * 4`) with each visible Pixel Layer's active-frame cel
    /// blended bottom-to-top using straight (non-premultiplied) source-over
    /// alpha.
    ///
    /// Each Pixel Layer's `opacity` is multiplied into its source alpha; layers
    /// with `visible = false` are skipped entirely. Reference Layers are
    /// viewport underlays and never contribute to document-pixel buffers.
    pub fn composite(&self) -> Vec<u8> {
        let frame_id = self.active_frame_id;
        let mut buf = vec![0u8; (self.width * self.height * 4) as usize];
        for layer in &self.layers {
            if !layer.visible {
                continue;
            }
            if let LayerKind::Pixel(cels) = &layer.kind {
                let canvas = cels
                    .get(frame_id)
                    .expect("grid invariant: every Pixel Layer has a cel for the active frame");
                blend_pixel_canvas_over(&mut buf, canvas, layer.opacity);
            }
        }
        buf
    }

    /// Returns a freshly-allocated row-major RGBA byte buffer
    /// (`width * height * 4`) of the active frame with Pixel Layers only —
    /// Reference Layers are always excluded, regardless of visibility. Use this
    /// for exports (PNG, SVG, project-file thumbnail) where the tracing
    /// reference must not appear in the user-facing artifact.
    pub fn composite_for_export(&self) -> Vec<u8> {
        self.composite()
    }

    /// Reads the color at `(x, y)` on the active layer.
    ///
    /// Returns [`DrawError::OutOfBounds`] (wrapping [`PixelCanvasError`]) when
    /// `(x, y)` is outside the document's `width × height`, and
    /// [`DrawError::LayerKindMismatch`] when the active layer is a Reference
    /// Layer. Use this when the caller knows the active layer is a Pixel
    /// Layer; sampling-aware reads across kinds belong on a separate accessor.
    pub fn get_pixel(&self, x: u32, y: u32) -> Result<Color, DrawError> {
        match self.active_pixel_canvas() {
            Some(canvas) => Ok(canvas.get_pixel(x, y)?),
            None => Err(DrawError::LayerKindMismatch),
        }
    }

    /// Sampling-aware active-layer read used by non-mutating tools.
    ///
    /// Pixel Layers return the active layer's color inside document bounds and
    /// `None` outside bounds. Reference Layers sample their projected source
    /// footprint; this does not make Reference pixels part of
    /// [`Document::composite`].
    pub fn try_get_pixel(&self, x: u32, y: u32) -> Option<Color> {
        if x >= self.width || y >= self.height {
            return None;
        }
        let frame_id = self.active_frame_id;
        match &self.active_layer().kind {
            LayerKind::Pixel(cels) => {
                let canvas = cels.get(frame_id).expect(
                    "grid invariant: the active Pixel Layer has a cel for the active frame",
                );
                Some(canvas.get_pixel(x, y).unwrap_or_else(|err| {
                    panic!(
                        "active Pixel Layer read failed inside document bounds at ({x}, {y}): {err}"
                    )
                }))
            }
            LayerKind::Reference(data) => data.sample_at(x, y),
        }
    }

    /// Writes `color` to `(x, y)` on the active layer. Other layers are
    /// unaffected.
    ///
    /// Returns [`DrawError::OutOfBounds`] when `(x, y)` is outside the
    /// document's `width × height`, and [`DrawError::LayerKindMismatch`] when
    /// the active layer is a Reference Layer (drawing tools never mutate a
    /// Reference Layer's source).
    pub fn set_pixel(&mut self, x: u32, y: u32, color: Color) -> Result<(), DrawError> {
        match self.active_pixel_canvas_mut() {
            Some(canvas) => Ok(canvas.set_pixel(x, y, color)?),
            None => Err(DrawError::LayerKindMismatch),
        }
    }

    /// Applies `tool` at `(x, y)` to the active layer. Returns `true` when a
    /// pixel was written, `false` when the coordinates are out of bounds or
    /// the active layer is a Reference Layer (drawing tools never mutate a
    /// Reference Layer's source).
    pub fn apply_tool(&mut self, tool: ToolType, x: i32, y: i32, color: Color) -> bool {
        match self.active_pixel_canvas_mut() {
            Some(canvas) => tool.apply(canvas, x, y, color),
            None => false,
        }
    }

    /// 4-connected flood fill on the active layer starting at `(x, y)`.
    /// Returns `true` when at least one pixel was changed, `false` when the
    /// active layer is a Reference Layer.
    pub fn flood_fill(&mut self, x: u32, y: u32, color: Color) -> bool {
        match self.active_pixel_canvas_mut() {
            Some(canvas) => canvas.flood_fill(x, y, color),
            None => false,
        }
    }

    /// 4-connected flood fill on the active layer starting at `(x, y)`,
    /// constrained to `bounds`. Returns `true` when at least one pixel was
    /// changed, `false` when the active layer is a Reference Layer or when no
    /// pixel is filled.
    pub fn flood_fill_bounded(
        &mut self,
        x: u32,
        y: u32,
        color: Color,
        bounds: MarqueeRegion,
    ) -> bool {
        let bounds = CanvasRect::new(bounds.x(), bounds.y(), bounds.width(), bounds.height())
            .expect("MarqueeRegion bounds are always non-empty");

        match self.active_pixel_canvas_mut() {
            Some(canvas) => canvas.flood_fill_rect(x, y, color, bounds),
            None => false,
        }
    }

    /// Clears the active layer to fully transparent. Other layers are
    /// unaffected. No-op when the active layer is a Reference Layer.
    pub fn clear(&mut self) {
        if let Some(canvas) = self.active_pixel_canvas_mut() {
            canvas.clear();
        }
    }

    /// Clears pixels inside the current Marquee on the active Pixel Layer.
    /// The Marquee itself is preserved. No-op when no Marquee exists or when
    /// the active layer is a Reference Layer.
    pub fn clear_marquee_pixels(&mut self) {
        let Some(region) = self.marquee else {
            return;
        };
        if let Some(canvas) = self.active_pixel_canvas_mut() {
            clear_region(canvas, region);
        }
    }

    /// Copies pixels inside the current Marquee from the active Pixel Layer
    /// into a row-major RGBA buffer. Returns an empty buffer when no Marquee
    /// exists or when the active layer is a Reference Layer.
    pub fn lift_marquee_pixels(&self) -> Vec<u8> {
        let Some(region) = self.marquee else {
            return Vec::new();
        };
        match self.active_pixel_canvas() {
            Some(canvas) => lift_region(canvas, region),
            None => Vec::new(),
        }
    }

    /// Source-over composites a row-major RGBA buffer at `region` on the
    /// active Pixel Layer. No-op when the active layer is a Reference Layer.
    ///
    /// Panics when `buffer.len()` is not `region.width * region.height * 4`.
    pub fn composite_buffer_at(&mut self, buffer: &[u8], region: MarqueeRegion) {
        if let Some(canvas) = self.active_pixel_canvas_mut() {
            composite_region(canvas, buffer, region);
        }
    }

    /// Returns the [`LayerKindTag`] of the layer at `index`, or `None` when
    /// `index` is out of range.
    pub fn layer_kind_at(&self, index: usize) -> Option<LayerKindTag> {
        self.layers.get(index).map(|l| l.kind.tag())
    }

    /// Returns the immutable source RGBA buffer of the Reference Layer at
    /// `index`. `None` when `index` is out of range or the layer is a Pixel
    /// Layer.
    pub fn layer_source_pixels_at(&self, index: usize) -> Option<&[u8]> {
        match &self.layers.get(index)?.kind {
            LayerKind::Reference(data) => Some(data.source_rgba()),
            LayerKind::Pixel(_) => None,
        }
    }

    /// Returns a stable fingerprint of the immutable source RGBA buffer of the
    /// Reference Layer at `index`. `None` when `index` is out of range or the
    /// layer is a Pixel Layer.
    pub fn layer_source_fingerprint_at(&self, index: usize) -> Option<u64> {
        match &self.layers.get(index)?.kind {
            LayerKind::Reference(data) => Some(data.source_fingerprint()),
            LayerKind::Pixel(_) => None,
        }
    }

    /// Returns the natural (pre-placement) dimensions of the Reference Layer
    /// at `index`. `None` when `index` is out of range or the layer is a Pixel
    /// Layer.
    pub fn layer_source_dimensions_at(&self, index: usize) -> Option<(u32, u32)> {
        match &self.layers.get(index)?.kind {
            LayerKind::Reference(data) => Some((data.natural_width(), data.natural_height())),
            LayerKind::Pixel(_) => None,
        }
    }

    /// Returns the current [`ReferencePlacement`] of the Reference Layer at
    /// `index`. `None` when `index` is out of range or the layer is a Pixel
    /// Layer.
    pub fn layer_placement_at(&self, index: usize) -> Option<ReferencePlacement> {
        match &self.layers.get(index)?.kind {
            LayerKind::Reference(data) => Some(data.placement()),
            LayerKind::Pixel(_) => None,
        }
    }

    /// Returns the RGBA pixel buffer of the active-frame cel of the layer at
    /// `index`, or `None` when `index` is out of range or the layer is not a
    /// Pixel Layer.
    pub fn layer_pixels_at(&self, index: usize) -> Option<&[u8]> {
        let frame_id = self.active_frame_id;
        match &self.layers.get(index)?.kind {
            LayerKind::Pixel(cels) => Some(
                cels.get(frame_id)
                    .expect("grid invariant: every Pixel Layer has a cel for the active frame")
                    .pixels(),
            ),
            LayerKind::Reference(_) => None,
        }
    }

    /// Overwrites the active layer's pixel buffer with `data`. Used by tools
    /// that take a stroke-start snapshot and restore it during preview
    /// (shape tools, move tool). Other layers are unaffected.
    ///
    /// Returns [`PixelCanvasError::InvalidBufferLength`] when `data.len()` is
    /// not exactly `width * height * 4`. No-op (returns `Ok(())`) when the
    /// active layer is a Reference Layer — preview snapshots only apply to
    /// drawable layers.
    pub fn restore_active_layer_pixels(&mut self, data: &[u8]) -> Result<(), PixelCanvasError> {
        match self.active_pixel_canvas_mut() {
            Some(canvas) => canvas.restore_pixels(data),
            None => Ok(()),
        }
    }

    /// Resizes every cel of every Pixel Layer to `new_width × new_height` using
    /// the same `anchor`. Each Reference Layer's placement is translated by the
    /// `anchor`'s placement factor (`placement.x += (new_w − old_w) × fx`,
    /// `placement.y += (new_h − old_h) × fy`); scale, source buffer, and
    /// natural dimensions are unchanged. The active layer pointer is preserved.
    pub fn resize(
        &mut self,
        new_width: u32,
        new_height: u32,
        anchor: ResizeAnchor,
    ) -> Result<(), PixelCanvasError> {
        let (fx, fy) = anchor.placement_factor();
        let dw = new_width as f32 - self.width as f32;
        let dh = new_height as f32 - self.height as f32;
        let resized = self
            .layers
            .iter()
            .map(|layer| -> Result<Layer, PixelCanvasError> {
                let kind = match &layer.kind {
                    LayerKind::Pixel(cels) => {
                        LayerKind::Pixel(cels.try_map_canvases(|canvas| {
                            canvas.resize_with_anchor(new_width, new_height, anchor)
                        })?)
                    }
                    LayerKind::Reference(data) => {
                        let current = data.placement();
                        let translated_placement =
                            current.with_position(current.x() + dw * fx, current.y() + dh * fy);
                        let mut translated = data.clone();
                        translated.set_placement(translated_placement);
                        LayerKind::Reference(translated)
                    }
                };
                Ok(Layer {
                    id: layer.id,
                    name: layer.name.clone(),
                    visible: layer.visible,
                    opacity: layer.opacity,
                    kind,
                })
            })
            .collect::<Result<Vec<_>, _>>()?;
        self.layers = resized;
        self.width = new_width;
        self.height = new_height;
        Ok(())
    }

    /// Mirrors the active Pixel Layer's active-frame cel horizontally. With a
    /// Marquee active, only the pixels inside it are mirrored (the Marquee
    /// position is unchanged); otherwise the whole cel is mirrored in place.
    /// No-op on a Reference Layer.
    pub fn flip_horizontal(&mut self) {
        self.flip_active_pixel_layer(flip_buffer_horizontal, PixelCanvas::flip_horizontal);
    }

    /// Mirrors the active Pixel Layer's active-frame cel vertically. With a
    /// Marquee active, only the pixels inside it are mirrored (the Marquee
    /// position is unchanged); otherwise the whole cel is mirrored in place.
    /// No-op on a Reference Layer.
    pub fn flip_vertical(&mut self) {
        self.flip_active_pixel_layer(flip_buffer_vertical, PixelCanvas::flip_vertical);
    }

    /// Applies a flip to the active Pixel Layer's active-frame cel, mirroring
    /// either the current Marquee region (via lift → flip → composite) or the
    /// whole cel in place. `flip_buffer` mirrors a lifted region buffer;
    /// `flip_whole` mirrors a full canvas. No-op on a Reference Layer.
    fn flip_active_pixel_layer(
        &mut self,
        flip_buffer: fn(&[u8], u32, u32) -> Vec<u8>,
        flip_whole: fn(&mut PixelCanvas),
    ) {
        let region = self.marquee;
        let Some(canvas) = self.active_pixel_canvas_mut() else {
            return;
        };
        match region {
            Some(region) => {
                let lifted = lift_region(canvas, region);
                let flipped = flip_buffer(&lifted, region.width(), region.height());
                clear_region(canvas, region);
                composite_region(canvas, &flipped, region);
            }
            None => flip_whole(canvas),
        }
    }

    /// Rotates 90° clockwise. With a Marquee, the region's `W×H` pixels on the
    /// active Pixel Layer's active-frame cel become an `H×W` block re-centered
    /// on the region's center and clipped to the canvas, and the Marquee updates
    /// to wrap it (no-op on a Reference Layer). With no Marquee, the whole
    /// Document turns: every cel of every Pixel Layer rotates (all frames), the
    /// Document `width`/`height` swap, and every Reference Layer turns with the
    /// canvas — regardless of which layer or frame is active.
    pub fn rotate_cw(&mut self) {
        match self.marquee {
            Some(_) => self.rotate_active_marquee(rotate_buffer_cw),
            None => self.rotate_whole_document(QuarterTurn::Cw),
        }
    }

    /// Rotates 90° counter-clockwise. Mirror of [`Self::rotate_cw`]: the Marquee
    /// path turns the region counter-clockwise; the no-Marquee path turns the
    /// whole Document counter-clockwise.
    pub fn rotate_ccw(&mut self) {
        match self.marquee {
            Some(_) => self.rotate_active_marquee(rotate_buffer_ccw),
            None => self.rotate_whole_document(QuarterTurn::Ccw),
        }
    }

    /// Turns the whole Document a quarter-turn: every cel of every Pixel Layer
    /// (all frames) is replaced by its rotated canvas, the Document dimensions
    /// swap, and each Reference Layer's placement is remapped into the rotated
    /// document space so it stays visually anchored and turns with the canvas.
    fn rotate_whole_document(&mut self, turn: QuarterTurn) {
        let old_width = self.width;
        let old_height = self.height;
        for layer in &mut self.layers {
            match &mut layer.kind {
                LayerKind::Pixel(cels) => {
                    for canvas in cels.canvases_mut() {
                        *canvas = match turn {
                            QuarterTurn::Cw => canvas.rotate_cw(),
                            QuarterTurn::Ccw => canvas.rotate_ccw(),
                        };
                    }
                }
                LayerKind::Reference(data) => {
                    let remapped = rotate_reference_placement(data, old_width, old_height, turn);
                    data.set_placement(remapped);
                }
            }
        }
        self.width = old_height;
        self.height = old_width;
    }

    /// Rotates the current Marquee region on the active Pixel Layer's
    /// active-frame cel via
    /// lift → rotate → clear (source and destination) → composite, re-centering
    /// the rotated `H×W` block on the region's center and updating the Marquee to
    /// its canvas-clipped bounds.
    /// `rotate_buffer` rotates a lifted region buffer 90°. No-op without a Marquee
    /// or on a Reference Layer.
    fn rotate_active_marquee(&mut self, rotate_buffer: fn(&[u8], u32, u32) -> Vec<u8>) {
        let Some(region) = self.marquee else {
            return;
        };
        let Some(canvas) = self.active_pixel_canvas_mut() else {
            return;
        };
        let lifted = lift_region(canvas, region);
        let rotated = rotate_buffer(&lifted, region.width(), region.height());
        let rotated_region = region.rotated_90();
        clear_region(canvas, region);
        // Clear the destination too: `composite_region` is source-over and skips
        // transparent source pixels, so without this any pixels already under the
        // rotated footprint would bleed through the rotated block's transparent
        // (or blend under its semi-transparent) cells.
        clear_region(canvas, rotated_region);
        composite_region(canvas, &rotated, rotated_region);
        self.marquee = rotated_region.clip_to(canvas.width(), canvas.height());
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

    /// The active layer's active-frame cel, or `None` when the active layer is
    /// a Reference Layer.
    fn active_pixel_canvas(&self) -> Option<&PixelCanvas> {
        let frame_id = self.active_frame_id;
        match &self.active_layer().kind {
            LayerKind::Pixel(cels) => {
                Some(cels.get(frame_id).expect(
                    "grid invariant: the active Pixel Layer has a cel for the active frame",
                ))
            }
            LayerKind::Reference(_) => None,
        }
    }

    /// The active layer's active-frame cel mutably, or `None` when the active
    /// layer is a Reference Layer.
    fn active_pixel_canvas_mut(&mut self) -> Option<&mut PixelCanvas> {
        let frame_id = self.active_frame_id;
        match &mut self.active_layer_mut().kind {
            LayerKind::Pixel(cels) => {
                Some(cels.get_mut(frame_id).expect(
                    "grid invariant: the active Pixel Layer has a cel for the active frame",
                ))
            }
            LayerKind::Reference(_) => None,
        }
    }
}

/// Direction of a whole-Document quarter-turn.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum QuarterTurn {
    Cw,
    Ccw,
}

/// Remaps a Reference Layer's placement into the rotated `H×W` document frame.
///
/// The reference's projected footprint is turned about its center using the
/// same continuous quarter-turn the pixel buffers follow, so it stays visually
/// anchored; its quarter-turn rotation advances by one in `turn`'s direction.
/// `doc_width`/`doc_height` are the document dimensions *before* the rotation.
fn rotate_reference_placement(
    data: &ReferenceData,
    doc_width: u32,
    doc_height: u32,
    turn: QuarterTurn,
) -> ReferencePlacement {
    let placement = data.placement();
    let scale = placement.scale();
    let projected_w = data.natural_width() as f32 * scale;
    let projected_h = data.natural_height() as f32 * scale;
    // A quarter-turn rotation swaps the footprint's axis-aligned bounding box,
    // so an odd current rotation already has its width and height exchanged.
    let (bbox_w, bbox_h) = if placement.rotation() % 2 == 0 {
        (projected_w, projected_h)
    } else {
        (projected_h, projected_w)
    };
    let center_x = placement.x() + bbox_w / 2.0;
    let center_y = placement.y() + bbox_h / 2.0;
    let (new_center_x, new_center_y) = match turn {
        // Clockwise turn of the document frame: (u, v) → (H − v, u).
        QuarterTurn::Cw => (doc_height as f32 - center_y, center_x),
        // Counter-clockwise turn of the document frame: (u, v) → (v, W − u).
        QuarterTurn::Ccw => (center_y, doc_width as f32 - center_x),
    };
    // After the turn the footprint's bounding box swaps dimensions again.
    let new_x = new_center_x - bbox_h / 2.0;
    let new_y = new_center_y - bbox_w / 2.0;
    // Advance the source's own quarter-turn; `+3 ≡ -1 (mod 4)` is one CCW step,
    // and `with_rotation` wraps the result back into `0..=3`.
    let new_rotation = match turn {
        QuarterTurn::Cw => placement.rotation() + 1,
        QuarterTurn::Ccw => placement.rotation() + 3,
    };
    placement
        .with_position(new_x, new_y)
        .with_rotation(new_rotation)
}

fn normalize_reference_underlay(
    mut layers: Vec<Layer>,
    active_layer_id: Uuid,
) -> (Vec<Layer>, Uuid) {
    let kept_reference_idx = layers
        .iter()
        .rposition(|l| matches!(l.kind, LayerKind::Reference(_)));
    let Some(kept_reference_idx) = kept_reference_idx else {
        return (layers, active_layer_id);
    };

    let active_layer_was_reference = layers
        .iter()
        .any(|l| l.id == active_layer_id && matches!(l.kind, LayerKind::Reference(_)));
    let kept_reference = layers.remove(kept_reference_idx);
    let kept_reference_id = kept_reference.id;
    let mut normalized = Vec::with_capacity(layers.len() + 1);
    normalized.push(kept_reference);
    normalized.extend(
        layers
            .into_iter()
            .filter(|layer| matches!(layer.kind, LayerKind::Pixel(_))),
    );

    let normalized_active_id = if active_layer_was_reference {
        kept_reference_id
    } else {
        active_layer_id
    };
    (normalized, normalized_active_id)
}

/// Source-over alpha composite of `canvas` onto `dst` (straight RGBA, u8 per channel).
///
/// `dst` must already match `canvas.width() * canvas.height() * 4` bytes.
fn blend_pixel_canvas_over(dst: &mut [u8], canvas: &PixelCanvas, opacity: f32) {
    let opacity = opacity.clamp(0.0, 1.0);
    for (chunk, src) in dst.chunks_exact_mut(4).zip(canvas.pixels().chunks_exact(4)) {
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

    fn pixel_canvas(layer: &Layer) -> &PixelCanvas {
        let LayerKind::Pixel(cels) = &layer.kind else {
            panic!("layer is not Pixel-kind");
        };
        cels.sole_canvas()
    }

    fn pixel_canvas_mut(layer: &mut Layer) -> &mut PixelCanvas {
        let LayerKind::Pixel(cels) = &mut layer.kind else {
            panic!("layer is not Pixel-kind");
        };
        cels.sole_canvas_mut()
    }

    fn set_pixel_canvas(layer: &mut Layer, canvas: PixelCanvas) {
        *pixel_canvas_mut(layer) = canvas;
    }

    #[test]
    fn marquee_round_trips_through_document_state() {
        let first = Uuid::new_v4();
        let mut doc = Document::new(8, 8, first, "Layer 1".to_string()).unwrap();
        let region = crate::selection::MarqueeRegion::from_drag(1, 2, 4, 5);

        assert_eq!(doc.marquee(), None);

        doc.set_marquee(Some(region));
        assert_eq!(doc.marquee(), Some(region));

        doc.set_marquee(None);
        assert_eq!(doc.marquee(), None);
    }

    #[test]
    fn layer_pixels_at_returns_buffer_for_each_layer_or_none_for_out_of_range() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);

        let mut doc = Document::new(1, 1, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(1, 1, red).unwrap(),
        );
        doc.add_layer(b, "B".to_string());
        set_pixel_canvas(
            &mut doc.layers[1],
            PixelCanvas::with_color(1, 1, green).unwrap(),
        );

        assert_eq!(doc.layer_pixels_at(0), Some([255, 0, 0, 255].as_slice()));
        assert_eq!(doc.layer_pixels_at(1), Some([0, 255, 0, 255].as_slice()));
        assert_eq!(doc.layer_pixels_at(2), None);
    }

    #[test]
    fn clear_resets_only_active_layer_to_transparent() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);

        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, red).unwrap(),
        );
        doc.add_layer(b, "B".to_string()); // active = B
        set_pixel_canvas(
            &mut doc.layers[1],
            PixelCanvas::with_color(2, 2, green).unwrap(),
        );

        doc.clear();

        for y in 0..2 {
            for x in 0..2 {
                assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(x, y).unwrap(), red);
                assert_eq!(
                    pixel_canvas(&doc.layers[1]).get_pixel(x, y).unwrap(),
                    Color::TRANSPARENT
                );
            }
        }
    }

    #[test]
    fn clear_marquee_pixels_clears_only_the_active_pixel_layer_region() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);
        let mut doc = Document::new(3, 3, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(3, 3, red).unwrap(),
        );
        doc.add_layer(b, "B".to_string());
        set_pixel_canvas(
            &mut doc.layers[1],
            PixelCanvas::with_color(3, 3, green).unwrap(),
        );
        let marquee = MarqueeRegion::from_drag(1, 1, 2, 2);
        doc.set_marquee(Some(marquee));

        doc.clear_marquee_pixels();

        assert_eq!(doc.marquee(), Some(marquee));
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(1, 1).unwrap(), red);
        assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(0, 0).unwrap(), green);
        assert_eq!(
            pixel_canvas(&doc.layers[1]).get_pixel(1, 1).unwrap(),
            Color::TRANSPARENT
        );
        assert_eq!(
            pixel_canvas(&doc.layers[1]).get_pixel(2, 2).unwrap(),
            Color::TRANSPARENT
        );
    }

    #[test]
    fn lift_marquee_pixels_reads_only_the_active_pixel_layer_region() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, red).unwrap(),
        );
        doc.add_layer(b, "B".to_string());
        let mut active_canvas = PixelCanvas::new(2, 2).unwrap();
        active_canvas.set_pixel(0, 0, green).unwrap();
        active_canvas.set_pixel(1, 0, blue).unwrap();
        set_pixel_canvas(&mut doc.layers[1], active_canvas);
        doc.set_marquee(Some(MarqueeRegion::from_drag(0, 0, 1, 0)));

        let lifted = doc.lift_marquee_pixels();

        assert_eq!(lifted, vec![0, 255, 0, 255, 0, 0, 255, 255]);
    }

    #[test]
    fn composite_buffer_at_writes_to_active_pixel_layer_only() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, red).unwrap(),
        );
        doc.add_layer(b, "B".to_string());
        set_pixel_canvas(
            &mut doc.layers[1],
            PixelCanvas::with_color(2, 2, Color::TRANSPARENT).unwrap(),
        );

        doc.composite_buffer_at(
            &[0, 255, 0, 255, 0, 0, 255, 255],
            MarqueeRegion::from_drag(0, 0, 1, 0),
        );

        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(0, 0).unwrap(), red);
        assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(0, 0).unwrap(), green);
        assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(1, 0).unwrap(), blue);
    }

    #[test]
    fn region_pixel_mutators_are_no_ops_when_active_layer_is_reference() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, red).unwrap(),
        );
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();
        doc.set_marquee(Some(MarqueeRegion::from_drag(0, 0, 1, 1)));

        assert_eq!(doc.lift_marquee_pixels(), Vec::<u8>::new());
        doc.clear_marquee_pixels();
        doc.composite_buffer_at(
            &[
                0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255,
            ],
            MarqueeRegion::from_drag(0, 0, 1, 1),
        );

        assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(0, 0).unwrap(), red);
        assert_eq!(doc.marquee(), Some(MarqueeRegion::from_drag(0, 0, 1, 1)));
    }

    // ── flip ────────────────────────────────────────────────────

    #[test]
    fn flip_horizontal_mirrors_entire_active_layer_when_no_marquee() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);
        let mut doc = Document::new(2, 1, a, "A".to_string()).unwrap();
        // Bottom layer (a): left red — must stay put.
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::from_pixels(2, 1, vec![255, 0, 0, 255, 0, 0, 0, 0]).unwrap(),
        );
        doc.add_layer(b, "B".to_string()); // active = B
        // Active layer (b): left green, right transparent.
        set_pixel_canvas(
            &mut doc.layers[1],
            PixelCanvas::from_pixels(2, 1, vec![0, 255, 0, 255, 0, 0, 0, 0]).unwrap(),
        );

        doc.flip_horizontal();

        assert_eq!(
            pixel_canvas(&doc.layers[1]).get_pixel(0, 0).unwrap(),
            Color::TRANSPARENT
        );
        assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(1, 0).unwrap(), green);
        // Other layers and canvas dimensions are untouched.
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(0, 0).unwrap(), red);
        assert_eq!((doc.width(), doc.height()), (2, 1));
    }

    #[test]
    fn flip_horizontal_mirrors_only_inside_marquee() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        let mut doc = Document::new(3, 1, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::from_pixels(3, 1, vec![255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255])
                .unwrap(),
        );
        // Marquee covers x = 0..=1; x = 2 lies outside.
        let marquee = MarqueeRegion::from_drag(0, 0, 1, 0);
        doc.set_marquee(Some(marquee));

        doc.flip_horizontal();

        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(0, 0).unwrap(), green);
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(1, 0).unwrap(), red);
        // Outside the Marquee, and the Marquee itself, are untouched.
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(2, 0).unwrap(), blue);
        assert_eq!(doc.marquee(), Some(marquee));
    }

    #[test]
    fn flip_vertical_mirrors_entire_active_layer_when_no_marquee() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);
        let mut doc = Document::new(1, 2, a, "A".to_string()).unwrap();
        // Top red, bottom green.
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::from_pixels(1, 2, vec![255, 0, 0, 255, 0, 255, 0, 255]).unwrap(),
        );

        doc.flip_vertical();

        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(0, 0).unwrap(), green);
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(0, 1).unwrap(), red);
    }

    #[test]
    fn flip_horizontal_on_1x1_marquee_is_identity() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);
        let mut doc = Document::new(2, 1, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::from_pixels(2, 1, vec![255, 0, 0, 255, 0, 255, 0, 255]).unwrap(),
        );
        doc.set_marquee(Some(MarqueeRegion::from_drag(0, 0, 0, 0)));

        doc.flip_horizontal();

        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(0, 0).unwrap(), red);
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(1, 0).unwrap(), green);
    }

    #[test]
    fn flip_horizontal_marquee_flush_against_right_edge() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        let mut doc = Document::new(3, 1, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::from_pixels(3, 1, vec![255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255])
                .unwrap(),
        );
        // Marquee hugs the right edge: x = 1..=2.
        doc.set_marquee(Some(MarqueeRegion::from_drag(1, 0, 2, 0)));

        doc.flip_horizontal();

        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(0, 0).unwrap(), red);
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(1, 0).unwrap(), blue);
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(2, 0).unwrap(), green);
    }

    #[test]
    fn flip_horizontal_partially_off_canvas_marquee_drops_pixels_mirrored_out() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let mut doc = Document::new(3, 1, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::from_pixels(3, 1, vec![255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255])
                .unwrap(),
        );
        // Marquee x = 1..=4 extends two columns past the right edge (canvas
        // width 3). The on-canvas columns (x = 1, 2) mirror to off-canvas
        // positions, so their mirror partners are off-canvas transparent.
        doc.set_marquee(Some(MarqueeRegion::from_drag(1, 0, 4, 0)));

        doc.flip_horizontal();

        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(0, 0).unwrap(), red);
        assert_eq!(
            pixel_canvas(&doc.layers[0]).get_pixel(1, 0).unwrap(),
            Color::TRANSPARENT
        );
        assert_eq!(
            pixel_canvas(&doc.layers[0]).get_pixel(2, 0).unwrap(),
            Color::TRANSPARENT
        );
    }

    #[test]
    fn flip_is_no_op_when_active_layer_is_reference() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, red).unwrap(),
        );
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();
        let marquee = MarqueeRegion::from_drag(0, 0, 1, 1);
        doc.set_marquee(Some(marquee));

        doc.flip_horizontal();
        doc.flip_vertical();

        // The Pixel Layer (now at index 1) and the Marquee are untouched.
        for y in 0..2 {
            for x in 0..2 {
                assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(x, y).unwrap(), red);
            }
        }
        assert_eq!(doc.marquee(), Some(marquee));
    }

    // ── rotate ──────────────────────────────────────────────────

    #[test]
    fn rotate_cw_turns_the_marquee_region_and_recenters_it() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        let mut doc = Document::new(5, 5, a, "A".to_string()).unwrap();
        // A horizontal strip red→green→blue at row y = 2, x = 1..=3.
        let canvas = pixel_canvas_mut(&mut doc.layers[0]);
        canvas.set_pixel(1, 2, red).unwrap();
        canvas.set_pixel(2, 2, green).unwrap();
        canvas.set_pixel(3, 2, blue).unwrap();
        doc.set_marquee(Some(MarqueeRegion::from_drag(1, 2, 3, 2)));

        doc.rotate_cw();

        // The 3×1 strip becomes a 1×3 column re-centered on (2.5, 2.5): the
        // left end (red) is now on top, the right end (blue) at the bottom.
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(2, 1).unwrap(), red);
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(2, 2).unwrap(), green);
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(2, 3).unwrap(), blue);
        // The original horizontal footprint outside the new column is cleared.
        assert_eq!(
            pixel_canvas(&doc.layers[0]).get_pixel(1, 2).unwrap(),
            Color::TRANSPARENT
        );
        assert_eq!(
            pixel_canvas(&doc.layers[0]).get_pixel(3, 2).unwrap(),
            Color::TRANSPARENT
        );
        assert_eq!(doc.marquee(), Some(MarqueeRegion::from_drag(2, 1, 2, 3)));
    }

    #[test]
    fn rotate_ccw_turns_the_marquee_region_counter_clockwise() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        let mut doc = Document::new(5, 5, a, "A".to_string()).unwrap();
        let canvas = pixel_canvas_mut(&mut doc.layers[0]);
        canvas.set_pixel(1, 2, red).unwrap();
        canvas.set_pixel(2, 2, green).unwrap();
        canvas.set_pixel(3, 2, blue).unwrap();
        doc.set_marquee(Some(MarqueeRegion::from_drag(1, 2, 3, 2)));

        doc.rotate_ccw();

        // Counter-clockwise sends the right end (blue) to the top and the left
        // end (red) to the bottom — the mirror image of the clockwise case.
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(2, 1).unwrap(), blue);
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(2, 2).unwrap(), green);
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(2, 3).unwrap(), red);
        assert_eq!(doc.marquee(), Some(MarqueeRegion::from_drag(2, 1, 2, 3)));
    }

    #[test]
    fn rotate_cw_then_ccw_restores_pixels_and_marquee() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let mut doc = Document::new(5, 5, a, "A".to_string()).unwrap();
        let canvas = pixel_canvas_mut(&mut doc.layers[0]);
        canvas.set_pixel(1, 2, Color::new(255, 0, 0, 255)).unwrap();
        canvas.set_pixel(2, 2, Color::new(0, 255, 0, 255)).unwrap();
        canvas.set_pixel(3, 2, Color::new(0, 0, 255, 255)).unwrap();
        let marquee = MarqueeRegion::from_drag(1, 2, 3, 2);
        doc.set_marquee(Some(marquee));
        let before = pixel_canvas(&doc.layers[0]).pixels().to_vec();

        doc.rotate_cw();
        doc.rotate_ccw();

        assert_eq!(pixel_canvas(&doc.layers[0]).pixels(), before.as_slice());
        assert_eq!(doc.marquee(), Some(marquee));
    }

    #[test]
    fn rotate_cw_without_a_marquee_turns_the_whole_document() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        let mut doc = Document::new(3, 2, a, "A".to_string()).unwrap();
        let canvas = pixel_canvas_mut(&mut doc.layers[0]);
        canvas.set_pixel(0, 0, red).unwrap();
        canvas.set_pixel(2, 1, blue).unwrap();

        doc.rotate_cw();

        // 3×2 → 2×3, dimensions swapped.
        assert_eq!((doc.width(), doc.height()), (2, 3));
        // Clockwise: the top-left red lands on the top-right; the bottom-right
        // blue lands on the bottom-left.
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(1, 0).unwrap(), red);
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(0, 2).unwrap(), blue);
    }

    #[test]
    fn rotate_cw_then_ccw_without_a_marquee_restores_pixels_and_dimensions() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let mut doc = Document::new(3, 2, a, "A".to_string()).unwrap();
        let canvas = pixel_canvas_mut(&mut doc.layers[0]);
        canvas.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap();
        canvas.set_pixel(2, 1, Color::new(0, 0, 255, 255)).unwrap();
        let before = pixel_canvas(&doc.layers[0]).pixels().to_vec();

        doc.rotate_cw();
        doc.rotate_ccw();

        assert_eq!((doc.width(), doc.height()), (3, 2));
        assert_eq!(pixel_canvas(&doc.layers[0]).pixels(), before.as_slice());
        assert_eq!(doc.marquee(), None);
    }

    #[test]
    fn rotate_cw_without_a_marquee_turns_every_pixel_layer() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        let mut doc = Document::new(3, 2, a, "A".to_string()).unwrap();
        doc.add_layer(b, "B".to_string());
        pixel_canvas_mut(&mut doc.layers[0])
            .set_pixel(0, 0, red)
            .unwrap();
        pixel_canvas_mut(&mut doc.layers[1])
            .set_pixel(0, 0, blue)
            .unwrap();

        doc.rotate_cw();

        assert_eq!((doc.width(), doc.height()), (2, 3));
        // Both layers turn the same way: the top-left pixel lands top-right.
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(1, 0).unwrap(), red);
        assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(1, 0).unwrap(), blue);
    }

    #[test]
    fn rotate_cw_without_a_marquee_is_independent_of_the_active_layer_kind() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let mut doc = Document::new(3, 2, a, "A".to_string()).unwrap();
        pixel_canvas_mut(&mut doc.layers[0])
            .set_pixel(0, 0, red)
            .unwrap();
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();
        // Make the Reference Layer active — the whole document must still turn.
        doc.set_active_layer(r).unwrap();

        doc.rotate_cw();

        assert_eq!((doc.width(), doc.height()), (2, 3));
        let pixel_index = doc
            .layers()
            .iter()
            .position(|l| matches!(l.kind, LayerKind::Pixel(_)))
            .unwrap();
        assert_eq!(
            pixel_canvas(&doc.layers[pixel_index])
                .get_pixel(1, 0)
                .unwrap(),
            red
        );
    }

    #[test]
    fn rotate_cw_without_a_marquee_remaps_and_advances_reference_placement() {
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        // A wide 2×1 reference footprint anchored at the top-left of a 4×2 doc.
        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        let reference = ReferenceData::new(vec![0u8; 8], 2, 1, placement).unwrap();
        let mut doc = Document::new(4, 2, a, "A".to_string()).unwrap();
        doc.layers.push(Layer {
            id: r,
            name: "Ref".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Reference(reference),
        });

        doc.rotate_cw();

        // The wide box turns into a tall 1×2 box, staying over the same content,
        // and the quarter-turn advances by one.
        let after = doc.layer_placement_at(1).unwrap();
        assert_eq!(after.x(), 1.0);
        assert_eq!(after.y(), 0.0);
        assert_eq!(after.scale(), 1.0);
        assert_eq!(after.rotation(), 1);
    }

    #[test]
    fn rotate_cw_without_a_marquee_preserves_reference_source_and_natural_dimensions() {
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let placement = ReferencePlacement::new(1.0, 0.5, 2.0).unwrap();
        let ref_rgba = vec![1u8, 2, 3, 4, 5, 6, 7, 8];
        let reference = ReferenceData::new(ref_rgba.clone(), 2, 1, placement).unwrap();
        let mut doc = Document::new(4, 2, a, "A".to_string()).unwrap();
        doc.layers.push(Layer {
            id: r,
            name: "Ref".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Reference(reference),
        });

        doc.rotate_cw();

        let LayerKind::Reference(after) = &doc.layers()[1].kind else {
            panic!("Reference Layer must remain Reference-kind after rotate");
        };
        assert_eq!(after.source_rgba(), ref_rgba.as_slice());
        assert_eq!(after.natural_width(), 2);
        assert_eq!(after.natural_height(), 1);
        assert_eq!(after.placement().scale(), 2.0);
    }

    #[test]
    fn four_cw_turns_restore_a_document_with_a_reference() {
        use crate::color::Color;
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        let reference = ReferenceData::new(vec![0u8; 8], 2, 1, placement).unwrap();
        let mut doc = Document::new(4, 2, a, "A".to_string()).unwrap();
        pixel_canvas_mut(&mut doc.layers[0])
            .set_pixel(3, 1, Color::new(0, 0, 255, 255))
            .unwrap();
        doc.layers.push(Layer {
            id: r,
            name: "Ref".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Reference(reference),
        });
        let pixels_before = pixel_canvas(&doc.layers[0]).pixels().to_vec();

        for _ in 0..4 {
            doc.rotate_cw();
        }

        assert_eq!((doc.width(), doc.height()), (4, 2));
        assert_eq!(
            pixel_canvas(&doc.layers[0]).pixels(),
            pixels_before.as_slice()
        );
        assert_eq!(doc.layer_placement_at(1), Some(placement));
    }

    #[test]
    fn rotate_ccw_without_a_marquee_turns_the_whole_document_the_other_way() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let mut doc = Document::new(3, 2, a, "A".to_string()).unwrap();
        pixel_canvas_mut(&mut doc.layers[0])
            .set_pixel(0, 0, red)
            .unwrap();

        doc.rotate_ccw();

        assert_eq!((doc.width(), doc.height()), (2, 3));
        // Counter-clockwise sends the top-left pixel to the bottom-left.
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(0, 2).unwrap(), red);
    }

    #[test]
    fn rotate_is_no_op_when_active_layer_is_reference() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, red).unwrap(),
        );
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();
        let marquee = MarqueeRegion::from_drag(0, 0, 1, 1);
        doc.set_marquee(Some(marquee));

        doc.rotate_cw();
        doc.rotate_ccw();

        for y in 0..2 {
            for x in 0..2 {
                assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(x, y).unwrap(), red);
            }
        }
        assert_eq!(doc.marquee(), Some(marquee));
    }

    #[test]
    fn rotate_cw_clips_a_partially_off_canvas_region_and_drops_outside_pixels() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        let mut doc = Document::new(3, 3, a, "A".to_string()).unwrap();
        // A 3×1 strip along the top edge; rotating it re-centers the column
        // above the canvas, so the top end falls off and is lost.
        let canvas = pixel_canvas_mut(&mut doc.layers[0]);
        canvas.set_pixel(0, 0, red).unwrap();
        canvas.set_pixel(1, 0, green).unwrap();
        canvas.set_pixel(2, 0, blue).unwrap();
        doc.set_marquee(Some(MarqueeRegion::from_drag(0, 0, 2, 0)));

        doc.rotate_cw();

        // red rotates to (1, -1) off-canvas and is dropped; green and blue land.
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(1, 0).unwrap(), green);
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(1, 1).unwrap(), blue);
        assert_eq!(
            pixel_canvas(&doc.layers[0]).get_pixel(0, 0).unwrap(),
            Color::TRANSPARENT
        );
        assert_eq!(
            pixel_canvas(&doc.layers[0]).get_pixel(2, 0).unwrap(),
            Color::TRANSPARENT
        );
        // The Marquee wraps only the on-canvas part of the rotated region.
        assert_eq!(doc.marquee(), Some(MarqueeRegion::from_drag(1, 0, 1, 1)));
    }

    #[test]
    fn rotate_cw_clears_destination_so_pixels_outside_the_marquee_do_not_bleed_through() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        let mut doc = Document::new(5, 5, a, "A".to_string()).unwrap();
        // The 3×1 region holds a single opaque pixel; the rest is transparent.
        // blue sits OUTSIDE the Marquee but inside the rotated footprint.
        let canvas = pixel_canvas_mut(&mut doc.layers[0]);
        canvas.set_pixel(1, 1, red).unwrap();
        canvas.set_pixel(2, 2, blue).unwrap();
        doc.set_marquee(Some(MarqueeRegion::from_drag(1, 1, 3, 1)));

        doc.rotate_cw();

        // red rotates to the top of the H×W column at (2, 0); the column's
        // transparent cells must stay transparent — the pre-existing blue at
        // (2, 2) must not bleed through the rotated block.
        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(2, 0).unwrap(), red);
        assert_eq!(
            pixel_canvas(&doc.layers[0]).get_pixel(2, 2).unwrap(),
            Color::TRANSPARENT
        );
    }

    #[test]
    fn lift_marquee_pixels_returns_empty_when_no_marquee_exists() {
        let id = Uuid::new_v4();
        let doc = Document::new(2, 2, id, "A".to_string()).unwrap();

        assert_eq!(doc.lift_marquee_pixels(), Vec::<u8>::new());
    }

    #[test]
    fn flood_fill_writes_only_to_active_layer() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let blue = Color::new(0, 0, 255, 255);

        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        // Bottom (a): solid red — must remain red.
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, red).unwrap(),
        );
        // Top (b, active): transparent — flood_fill should turn it solid blue.
        doc.add_layer(b, "B".to_string());

        let painted = doc.flood_fill(0, 0, blue);

        assert!(painted);
        for y in 0..2 {
            for x in 0..2 {
                assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(x, y).unwrap(), blue);
                assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(x, y).unwrap(), red);
            }
        }
    }

    #[test]
    fn flood_fill_bounded_writes_only_inside_bounds_on_active_layer() {
        let a = Uuid::new_v4();
        let mut doc = Document::new(4, 4, a, "A".to_string()).unwrap();
        let bounds = MarqueeRegion::from_drag(1, 1, 2, 2);

        let painted = doc.flood_fill_bounded(1, 1, Color::new(0, 0, 255, 255), bounds);

        assert!(painted);
        assert_eq!(
            pixel_canvas(&doc.layers[0]).get_pixel(0, 1).unwrap(),
            Color::TRANSPARENT
        );
        assert_eq!(
            pixel_canvas(&doc.layers[0]).get_pixel(1, 1).unwrap(),
            Color::new(0, 0, 255, 255)
        );
        assert_eq!(
            pixel_canvas(&doc.layers[0]).get_pixel(2, 2).unwrap(),
            Color::new(0, 0, 255, 255)
        );
        assert_eq!(
            pixel_canvas(&doc.layers[0]).get_pixel(3, 2).unwrap(),
            Color::TRANSPARENT
        );
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
        assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(0, 0).unwrap(), red);
        assert_eq!(
            pixel_canvas(&doc.layers[0]).get_pixel(0, 0).unwrap(),
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
    fn from_layers_rejects_a_pixel_layer_not_keyed_to_the_initial_frame() {
        // A Pixel layer whose sole cel is keyed to some other frame id (or an
        // empty `Cels`) would build successfully but panic on the first
        // active-frame access — reject it at the boundary instead.
        let a = Uuid::new_v4();
        let stray_frame = Uuid::new_v4();
        let layer = Layer {
            id: a,
            name: "A".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Pixel(Cels::single(stray_frame, PixelCanvas::new(4, 4).unwrap())),
        };
        let result = Document::from_layers(4, 4, vec![layer], a, 2, false);
        assert_eq!(
            result.unwrap_err(),
            DocumentBuildError::MissingInitialFrameCel { layer_id: a }
        );
    }

    #[test]
    fn from_layers_preserves_kind_and_data_in_mixed_document() {
        use crate::color::Color;
        use crate::layer::{LayerKind, ReferenceData};
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let b = Uuid::new_v4();

        let red_canvas = PixelCanvas::with_color(4, 4, Color::new(255, 0, 0, 255)).unwrap();
        let pixel_a = Layer {
            id: a,
            name: "A".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Pixel(Cels::single(Frame::INITIAL.id, red_canvas.clone())),
        };

        // Reference Layer has its own natural dimensions (different from document)
        // and a non-trivial placement — both must survive round-trip.
        let placement = ReferencePlacement::new(1.5, -2.0, 0.75).unwrap();
        let ref_rgba = vec![10u8, 20, 30, 40, 50, 60, 70, 80];
        let reference = ReferenceData::new(ref_rgba.clone(), 2, 1, placement).unwrap();
        let reference_layer = Layer {
            id: r,
            name: "Ref".to_string(),
            visible: false,
            opacity: 0.5,
            kind: LayerKind::Reference(reference.clone()),
        };

        let green_canvas = PixelCanvas::with_color(4, 4, Color::new(0, 255, 0, 255)).unwrap();
        let pixel_b = Layer {
            id: b,
            name: "B".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Pixel(Cels::single(Frame::INITIAL.id, green_canvas.clone())),
        };

        let layers = vec![pixel_a.clone(), reference_layer.clone(), pixel_b.clone()];
        let doc = Document::from_layers(4, 4, layers, b, 4, false).unwrap();

        assert_eq!(doc.layers(), &[reference_layer, pixel_a, pixel_b]);
        let LayerKind::Reference(restored) = &doc.layers()[0].kind else {
            panic!("bottom layer must be Reference-kind after from_layers");
        };
        assert_eq!(restored.source_rgba(), ref_rgba.as_slice());
        assert_eq!(restored.natural_width(), 2);
        assert_eq!(restored.natural_height(), 1);
        assert_eq!(restored.placement(), placement);
    }

    #[test]
    fn from_layers_normalizes_reference_to_singleton_bottom_underlay() {
        use crate::color::Color;
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        let pixel_a_id = Uuid::new_v4();
        let old_reference_id = Uuid::new_v4();
        let pixel_b_id = Uuid::new_v4();
        let kept_reference_id = Uuid::new_v4();

        let pixel_a = Layer {
            id: pixel_a_id,
            name: "Paint A".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Pixel(Cels::single(
                Frame::INITIAL.id,
                PixelCanvas::with_color(4, 4, Color::new(255, 0, 0, 255)).unwrap(),
            )),
        };
        let old_reference = Layer {
            id: old_reference_id,
            name: "Old reference".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Reference(
                ReferenceData::new(
                    vec![1u8; 4],
                    1,
                    1,
                    ReferencePlacement::new(1.0, 1.0, 1.0).unwrap(),
                )
                .unwrap(),
            ),
        };
        let pixel_b = Layer {
            id: pixel_b_id,
            name: "Paint B".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Pixel(Cels::single(
                Frame::INITIAL.id,
                PixelCanvas::with_color(4, 4, Color::new(0, 0, 255, 255)).unwrap(),
            )),
        };
        let kept_reference = Layer {
            id: kept_reference_id,
            name: "Kept reference".to_string(),
            visible: false,
            opacity: 0.5,
            kind: LayerKind::Reference(
                ReferenceData::new(
                    vec![2u8; 8],
                    2,
                    1,
                    ReferencePlacement::new(3.0, 4.0, 2.0).unwrap(),
                )
                .unwrap(),
            ),
        };

        let doc = Document::from_layers(
            4,
            4,
            vec![
                pixel_a.clone(),
                old_reference,
                pixel_b.clone(),
                kept_reference.clone(),
            ],
            old_reference_id,
            7,
            false,
        )
        .unwrap();

        assert_eq!(doc.layers().len(), 3);
        assert_eq!(doc.layers()[0], kept_reference);
        assert_eq!(doc.layers()[1], pixel_a);
        assert_eq!(doc.layers()[2], pixel_b);
        assert_eq!(doc.active_layer_id(), kept_reference_id);
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
    fn set_timeline_panel_collapsed_toggles_the_flag() {
        let id = Uuid::new_v4();
        let mut doc = Document::new(8, 8, id, "Layer 1".to_string()).unwrap();
        assert!(!doc.is_timeline_panel_collapsed());

        doc.set_timeline_panel_collapsed(true);
        assert!(doc.is_timeline_panel_collapsed());

        doc.set_timeline_panel_collapsed(false);
        assert!(!doc.is_timeline_panel_collapsed());
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
                    pixel_canvas(new_layer).get_pixel(x, y).unwrap(),
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
        assert_eq!(
            doc.next_layer_number(),
            4,
            "delete must not decrement counter"
        );

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
    fn reorder_layer_keeps_reference_fixed_below_pixel_layers() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let r = Uuid::new_v4();
        let mut doc = Document::new(8, 8, a, "A".to_string()).unwrap();
        doc.add_layer(b, "B".to_string());
        doc.add_reference_layer(r, "Reference".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();
        assert_eq!(
            doc.layers().iter().map(|l| l.id).collect::<Vec<_>>(),
            vec![r, a, b]
        );

        doc.reorder_layer(r, 2).unwrap();
        assert_eq!(
            doc.layers().iter().map(|l| l.id).collect::<Vec<_>>(),
            vec![r, a, b],
            "Reference remains bottom-most"
        );

        doc.reorder_layer(b, 0).unwrap();
        assert_eq!(
            doc.layers().iter().map(|l| l.id).collect::<Vec<_>>(),
            vec![r, b, a],
            "Pixel target below Reference is clamped above the Reference row"
        );
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
        assert_eq!(
            doc.active_layer_id(),
            a,
            "active must remain unchanged on error"
        );
    }

    #[test]
    fn set_layer_visibility_flips_visible_flag() {
        let a = Uuid::new_v4();
        let mut doc = Document::new(8, 8, a, "A".to_string()).unwrap();
        assert!(doc.layers[0].visible);

        doc.set_layer_visibility(a, false).unwrap();
        assert!(!doc.layers[0].visible);

        doc.set_layer_visibility(a, true).unwrap();
        assert!(doc.layers[0].visible);
    }

    #[test]
    fn set_layer_visibility_returns_layer_not_found_for_unknown_id() {
        let a = Uuid::new_v4();
        let unknown = Uuid::new_v4();
        let mut doc = Document::new(8, 8, a, "A".to_string()).unwrap();

        assert_eq!(
            doc.set_layer_visibility(unknown, false),
            Err(LayerError::LayerNotFound { id: unknown })
        );
        assert!(
            doc.layers[0].visible,
            "visibility must remain unchanged on error"
        );
    }

    #[test]
    fn composite_of_single_transparent_layer_is_all_zero() {
        let id = Uuid::new_v4();
        let doc = Document::new(2, 2, id, "L1".to_string()).unwrap();
        assert_eq!(doc.composite(), vec![0u8; 16]);
    }

    #[test]
    fn composite_of_single_opaque_layer_returns_layer_pixels() {
        use crate::color::Color;

        let id = Uuid::new_v4();
        let mut doc = Document::new(2, 2, id, "L1".to_string()).unwrap();
        // Replace the active layer's pixels with solid red.
        let red = Color::new(255, 0, 0, 255);
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, red).unwrap(),
        );

        let expected: Vec<u8> = std::iter::repeat_n([255, 0, 0, 255], 4).flatten().collect();
        assert_eq!(doc.composite(), expected);
    }

    #[test]
    fn composite_blends_top_layer_source_over_bottom() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(1, 1, a, "A".to_string()).unwrap();
        // Bottom: opaque red.
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(1, 1, Color::new(255, 0, 0, 255)).unwrap(),
        );
        // Top: 50%-alpha blue (alpha = 128).
        doc.add_layer(b, "B".to_string());
        set_pixel_canvas(
            &mut doc.layers[1],
            PixelCanvas::with_color(1, 1, Color::new(0, 0, 255, 128)).unwrap(),
        );

        // src_a = 128/255, dst_a = 1.0 → out_a = 1.0 (255).
        // R: 0*128/255 + 255*1*(1 - 128/255) = 255 - 128 = 127
        // B: 255*128/255 + 0 = 128
        assert_eq!(doc.composite(), vec![127, 0, 128, 255]);
    }

    #[test]
    fn composite_skips_invisible_layers() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(1, 1, a, "A".to_string()).unwrap();
        // Bottom: opaque red, visible.
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(1, 1, Color::new(255, 0, 0, 255)).unwrap(),
        );
        // Top: opaque green, hidden — should not affect composite.
        doc.add_layer(b, "B".to_string());
        set_pixel_canvas(
            &mut doc.layers[1],
            PixelCanvas::with_color(1, 1, Color::new(0, 255, 0, 255)).unwrap(),
        );
        doc.layers[1].visible = false;

        assert_eq!(doc.composite(), vec![255, 0, 0, 255]);
    }

    #[test]
    fn composite_multiplies_layer_opacity_into_source_alpha() {
        use crate::color::Color;

        let id = Uuid::new_v4();
        let mut doc = Document::new(1, 1, id, "L1".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(1, 1, Color::new(255, 0, 0, 255)).unwrap(),
        );
        doc.layers[0].opacity = 0.5;

        // src_a = 1.0 * 0.5 = 0.5 → out_a = 0.5 → alpha byte = 128
        // RGB unchanged (only red has color, divided by out_a).
        assert_eq!(doc.composite(), vec![255, 0, 0, 128]);
    }

    #[test]
    fn composite_excludes_visible_reference_layer() {
        use crate::color::Color;
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        // Identity placement, 1x1 fully opaque green reference covering the doc.
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        let green_rgba = vec![0u8, 255, 0, 255];
        let reference = ReferenceData::new(green_rgba, 1, 1, placement).unwrap();

        let mut doc = Document::new(1, 1, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(1, 1, red).unwrap(),
        );
        doc.layers.push(Layer {
            id: r,
            name: "Reference".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Reference(reference),
        });

        // Reference is a viewport underlay, not document-pixel state.
        assert_eq!(doc.composite(), vec![255, 0, 0, 255]);
    }

    #[test]
    fn composite_skips_hidden_reference_layer() {
        use crate::color::Color;
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        let green_rgba = vec![0u8, 255, 0, 255];
        let reference = ReferenceData::new(green_rgba, 1, 1, placement).unwrap();

        let mut doc = Document::new(1, 1, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(1, 1, red).unwrap(),
        );
        doc.layers.push(Layer {
            id: r,
            name: "Reference".to_string(),
            visible: false,
            opacity: 1.0,
            kind: LayerKind::Reference(reference),
        });

        // Hidden Reference must not contribute — bottom red shows through.
        assert_eq!(doc.composite(), vec![255, 0, 0, 255]);
    }

    #[test]
    fn composite_for_export_excludes_reference_layers_even_when_visible() {
        use crate::color::Color;
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        // A visible Reference Layer holding solid opaque green pixels — must NOT
        // contribute to the export buffer or the Pixel-only composite.
        let green_rgba = vec![0u8, 255, 0, 255];
        let reference = ReferenceData::new(green_rgba, 1, 1, placement).unwrap();

        let mut doc = Document::new(1, 1, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(1, 1, red).unwrap(),
        );
        doc.layers.push(Layer {
            id: b,
            name: "Reference".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Reference(reference),
        });

        assert_eq!(doc.composite_for_export(), vec![255, 0, 0, 255]);
    }

    #[test]
    fn composite_for_export_equals_composite_when_document_has_only_pixel_layers() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, Color::new(255, 0, 0, 255)).unwrap(),
        );
        doc.add_layer(b, "B".to_string());
        set_pixel_canvas(
            &mut doc.layers[1],
            PixelCanvas::with_color(2, 2, Color::new(0, 0, 255, 128)).unwrap(),
        );

        assert_eq!(doc.composite_for_export(), doc.composite());
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
    fn try_get_pixel_reads_active_pixel_layer_and_returns_none_out_of_bounds() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        doc.add_layer(b, "B".to_string()); // active=B

        let red = Color::new(255, 0, 0, 255);
        doc.set_pixel(1, 0, red).unwrap();

        assert_eq!(doc.try_get_pixel(1, 0), Some(red));
        assert_eq!(doc.try_get_pixel(2, 0), None);
        assert_eq!(doc.try_get_pixel(0, 2), None);

        doc.set_active_layer(a).unwrap();
        assert_eq!(doc.try_get_pixel(1, 0), Some(Color::TRANSPARENT));
    }

    #[test]
    fn try_get_pixel_samples_active_reference_layer_and_returns_none_outside_available_pixels() {
        use crate::color::Color;
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let mut source_rgba = Vec::with_capacity(4 * 4 * 4);
        for y in 0..4 {
            for x in 0..4 {
                source_rgba.extend_from_slice(&[x, y, 0, 255]);
            }
        }

        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        doc.add_reference_layer(r, "Ref".to_string(), source_rgba, 4, 4)
            .unwrap();
        doc.set_reference_placement(r, ReferencePlacement::new(0.0, 0.0, 1.0).unwrap())
            .unwrap();

        assert_eq!(doc.try_get_pixel(1, 1), Some(Color::new(1, 1, 0, 255)));
        assert_eq!(doc.try_get_pixel(2, 0), None);
        assert_eq!(doc.try_get_pixel(0, 2), None);

        doc.set_reference_placement(r, ReferencePlacement::new(1.0, 1.0, 1.0).unwrap())
            .unwrap();
        assert_eq!(doc.try_get_pixel(0, 0), None);
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
        assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(0, 0).unwrap(), red);
        // Inactive (A) is unchanged.
        assert_eq!(
            pixel_canvas(&doc.layers[0]).get_pixel(0, 0).unwrap(),
            Color::TRANSPARENT
        );
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

        assert_eq!(pixel_canvas(&doc.layers[0]).get_pixel(0, 0).unwrap(), red);
        assert_eq!(
            pixel_canvas(&doc.layers[1]).get_pixel(0, 0).unwrap(),
            Color::TRANSPARENT
        );
    }

    #[test]
    fn clear_is_no_op_when_active_layer_is_reference() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, red).unwrap(),
        );
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();

        // Must not panic; must not touch the underlying Pixel Layer.
        doc.clear();

        for y in 0..2 {
            for x in 0..2 {
                assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(x, y).unwrap(), red);
            }
        }
    }

    #[test]
    fn restore_active_layer_pixels_is_no_op_when_active_layer_is_reference() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, red).unwrap(),
        );
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();

        // Wrong-sized buffer that would normally surface an error must be
        // ignored on a Reference-active document — the call is a documented
        // no-op, returning Ok(()).
        doc.restore_active_layer_pixels(&[0u8; 1]).unwrap();

        // Pixel Layer beneath untouched.
        for y in 0..2 {
            for x in 0..2 {
                assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(x, y).unwrap(), red);
            }
        }
    }

    #[test]
    fn set_pixel_returns_layer_kind_mismatch_when_active_layer_is_reference() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, red).unwrap(),
        );
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();

        let err = doc.set_pixel(0, 0, Color::new(0, 0, 255, 255)).unwrap_err();
        assert_eq!(err, DrawError::LayerKindMismatch);

        // Pixel Layer beneath must be untouched.
        for y in 0..2 {
            for x in 0..2 {
                assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(x, y).unwrap(), red);
            }
        }
    }

    #[test]
    fn set_pixel_wraps_canvas_out_of_bounds_in_draw_error() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();

        let err = doc.set_pixel(2, 0, Color::new(255, 0, 0, 255)).unwrap_err();
        assert!(matches!(err, DrawError::OutOfBounds(_)));
    }

    #[test]
    fn get_pixel_returns_layer_kind_mismatch_when_active_layer_is_reference() {
        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();

        let err = doc.get_pixel(0, 0).unwrap_err();
        assert_eq!(err, DrawError::LayerKindMismatch);
    }

    #[test]
    fn apply_tool_returns_false_and_mutates_nothing_when_active_layer_is_reference() {
        use crate::color::Color;
        use crate::tool::ToolType;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, red).unwrap(),
        );
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();

        let drew = doc.apply_tool(ToolType::Pencil, 0, 0, Color::new(0, 0, 255, 255));

        assert!(!drew);
        // Pixel Layer beneath must be untouched.
        for y in 0..2 {
            for x in 0..2 {
                assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(x, y).unwrap(), red);
            }
        }
    }

    #[test]
    fn flood_fill_returns_false_and_mutates_nothing_when_active_layer_is_reference() {
        use crate::color::Color;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(2, 2, red).unwrap(),
        );
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();

        let painted = doc.flood_fill(0, 0, Color::new(0, 0, 255, 255));

        assert!(!painted);
        for y in 0..2 {
            for x in 0..2 {
                assert_eq!(pixel_canvas(&doc.layers[1]).get_pixel(x, y).unwrap(), red);
            }
        }
    }

    #[test]
    fn layer_kind_at_returns_pixel_or_reference_tag_or_none_when_out_of_range() {
        use crate::layer::{LayerKindTag, ReferenceData};
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        let reference = ReferenceData::new(vec![0u8; 4], 1, 1, placement).unwrap();

        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        doc.layers.push(Layer {
            id: r,
            name: "Ref".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Reference(reference),
        });

        assert_eq!(doc.layer_kind_at(0), Some(LayerKindTag::Pixel));
        assert_eq!(doc.layer_kind_at(1), Some(LayerKindTag::Reference));
        assert_eq!(doc.layer_kind_at(2), None);
    }

    #[test]
    fn layer_source_pixels_at_returns_buffer_for_reference_and_none_for_pixel_or_oob() {
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let source_rgba = vec![10u8, 20, 30, 40, 50, 60, 70, 80];
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        let reference = ReferenceData::new(source_rgba.clone(), 2, 1, placement).unwrap();

        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        doc.layers.push(Layer {
            id: r,
            name: "Ref".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Reference(reference),
        });

        assert_eq!(doc.layer_source_pixels_at(0), None);
        assert_eq!(doc.layer_source_pixels_at(1), Some(source_rgba.as_slice()));
        assert_eq!(doc.layer_source_pixels_at(2), None);
    }

    #[test]
    fn layer_source_dimensions_at_returns_natural_dims_for_reference_only() {
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        let reference = ReferenceData::new(vec![0u8; 8], 2, 1, placement).unwrap();

        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        doc.layers.push(Layer {
            id: r,
            name: "Ref".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Reference(reference),
        });

        assert_eq!(doc.layer_source_dimensions_at(0), None);
        assert_eq!(doc.layer_source_dimensions_at(1), Some((2, 1)));
        assert_eq!(doc.layer_source_dimensions_at(2), None);
    }

    #[test]
    fn layer_placement_at_returns_placement_for_reference_only() {
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let placement = ReferencePlacement::new(1.5, -2.0, 0.75).unwrap();
        let reference = ReferenceData::new(vec![0u8; 8], 2, 1, placement).unwrap();

        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        doc.layers.push(Layer {
            id: r,
            name: "Ref".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Reference(reference),
        });

        assert_eq!(doc.layer_placement_at(0), None);
        assert_eq!(doc.layer_placement_at(1), Some(placement));
        assert_eq!(doc.layer_placement_at(2), None);
    }

    #[test]
    fn layer_pixels_at_returns_none_for_reference_layer() {
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let placement = ReferencePlacement::new(0.0, 0.0, 1.0).unwrap();
        let reference = ReferenceData::new(vec![0u8; 4], 1, 1, placement).unwrap();

        let mut doc = Document::new(2, 2, a, "A".to_string()).unwrap();
        doc.layers.push(Layer {
            id: r,
            name: "Ref".to_string(),
            visible: true,
            opacity: 1.0,
            kind: LayerKind::Reference(reference),
        });

        assert!(doc.layer_pixels_at(0).is_some());
        assert_eq!(doc.layer_pixels_at(1), None);
    }

    #[test]
    fn add_reference_layer_replaces_singleton_and_keeps_it_bottom_most() {
        use crate::reference_placement::ReferencePlacement;

        let pixel = Uuid::new_v4();
        let first_reference = Uuid::new_v4();
        let second_reference = Uuid::new_v4();
        let mut doc = Document::new(4, 4, pixel, "Paint".to_string()).unwrap();

        doc.add_reference_layer(
            first_reference,
            "First reference".to_string(),
            vec![1u8; 2 * 2 * 4],
            2,
            2,
        )
        .unwrap();
        doc.set_reference_placement(
            first_reference,
            ReferencePlacement::new(9.0, 9.0, 2.0).unwrap(),
        )
        .unwrap();

        doc.add_reference_layer(
            second_reference,
            "Second reference".to_string(),
            vec![2u8; 8 * 4 * 4],
            8,
            4,
        )
        .unwrap();

        assert_eq!(doc.layers().len(), 2);
        assert_eq!(doc.layers()[0].id, second_reference);
        assert_eq!(doc.layers()[0].name, "Second reference");
        assert_eq!(doc.layers()[1].id, pixel);
        assert_eq!(doc.active_layer_id(), second_reference);

        let LayerKind::Reference(data) = &doc.layers()[0].kind else {
            panic!("bottom layer must be Reference-kind");
        };
        assert_eq!(data.source_rgba(), vec![2u8; 8 * 4 * 4].as_slice());
        assert_eq!(data.natural_width(), 8);
        assert_eq!(data.natural_height(), 4);
        assert_eq!(
            data.placement(),
            ReferencePlacement::new(0.0, 1.0, 0.5).unwrap()
        );
    }

    #[test]
    fn add_reference_layer_sets_bottom_underlay_active_and_centers_at_scale_one_when_source_fits() {
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let source_rgba = vec![0u8; 2 * 2 * 4];
        // 4x4 doc, 2x2 source → scale = min(4/2, 4/2, 1.0) = 1.0,
        // centered: x = (4 - 2) / 2 = 1, y = (4 - 2) / 2 = 1.
        let mut doc = Document::new(4, 4, a, "A".to_string()).unwrap();
        doc.add_reference_layer(r, "Ref".to_string(), source_rgba.clone(), 2, 2)
            .unwrap();

        assert_eq!(doc.layers().len(), 2);
        assert_eq!(doc.layers()[0].id, r);
        assert_eq!(doc.layers()[0].name, "Ref");
        assert_eq!(doc.layers()[1].id, a);
        assert_eq!(doc.active_layer_id(), r);
        assert_eq!(doc.next_layer_number(), 3);

        let LayerKind::Reference(data) = &doc.layers()[0].kind else {
            panic!("add_reference_layer must produce a Reference-kind layer");
        };
        let _: &ReferenceData = data;
        assert_eq!(data.natural_width(), 2);
        assert_eq!(data.natural_height(), 2);
        assert_eq!(data.source_rgba(), source_rgba.as_slice());
        assert_eq!(
            data.placement(),
            ReferencePlacement::new(1.0, 1.0, 1.0).unwrap()
        );
    }

    #[test]
    fn add_reference_layer_scales_down_when_source_exceeds_canvas_on_one_axis() {
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        // 4x4 doc, 8x4 source → scale = min(4/8, 4/4, 1.0) = 0.5.
        // Projected footprint = 4 × 2, centered: x = 0, y = (4 - 2)/2 = 1.
        let mut doc = Document::new(4, 4, a, "A".to_string()).unwrap();
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 8 * 4 * 4], 8, 4)
            .unwrap();

        let LayerKind::Reference(data) = &doc.layers()[0].kind else {
            panic!("Reference Layer expected");
        };
        assert_eq!(
            data.placement(),
            ReferencePlacement::new(0.0, 1.0, 0.5).unwrap()
        );
    }

    #[test]
    fn add_reference_layer_scales_down_to_longest_axis_when_source_exceeds_both_axes_with_different_aspect()
     {
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        // 8x4 doc, 16x16 source → scale = min(8/16, 4/16, 1.0) = 0.25.
        // Projected footprint = 4 × 4, centered: x = (8-4)/2 = 2, y = 0.
        let mut doc = Document::new(8, 4, a, "A".to_string()).unwrap();
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 16 * 16 * 4], 16, 16)
            .unwrap();

        let LayerKind::Reference(data) = &doc.layers()[0].kind else {
            panic!("Reference Layer expected");
        };
        assert_eq!(
            data.placement(),
            ReferencePlacement::new(2.0, 0.0, 0.25).unwrap()
        );
    }

    #[test]
    fn add_reference_layer_rejects_buffer_length_mismatch() {
        use crate::layer::ReferenceDataError;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let mut doc = Document::new(4, 4, a, "A".to_string()).unwrap();
        let err = doc
            .add_reference_layer(r, "Ref".to_string(), vec![0u8; 10], 2, 2)
            .unwrap_err();
        assert_eq!(
            err,
            ReferenceDataError::InvalidBufferLength {
                expected: 16,
                actual: 10
            }
        );
        // Document state must be unchanged on rejection.
        assert_eq!(doc.layers().len(), 1);
        assert_eq!(doc.active_layer_id(), a);
        assert_eq!(doc.next_layer_number(), 2);
    }

    #[test]
    fn set_reference_placement_updates_placement_on_named_reference_layer() {
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let mut doc = Document::new(4, 4, a, "A".to_string()).unwrap();
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();

        let target = ReferencePlacement::new(3.5, -1.0, 2.0).unwrap();
        doc.set_reference_placement(r, target).unwrap();

        assert_eq!(doc.layer_placement_at(0), Some(target));
    }

    #[test]
    fn set_reference_placement_preserves_an_existing_quarter_turn() {
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let mut doc = Document::new(4, 4, a, "A".to_string()).unwrap();
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();
        // A whole-document rotate is the only thing that turns a reference;
        // a subsequent move/scale must not silently reset that quarter-turn.
        doc.rotate_cw();
        assert_eq!(doc.layer_placement_at(0).unwrap().rotation(), 1);

        let moved = ReferencePlacement::new(3.5, -1.0, 2.0).unwrap();
        doc.set_reference_placement(r, moved).unwrap();

        let after = doc.layer_placement_at(0).unwrap();
        assert_eq!((after.x(), after.y(), after.scale()), (3.5, -1.0, 2.0));
        assert_eq!(after.rotation(), 1);
    }

    #[test]
    fn set_reference_placement_returns_layer_not_found_for_unknown_id() {
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let unknown = Uuid::new_v4();
        let mut doc = Document::new(4, 4, a, "A".to_string()).unwrap();
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();
        let before = doc.layer_placement_at(0).unwrap();

        let err = doc
            .set_reference_placement(unknown, ReferencePlacement::new(9.0, 9.0, 9.0).unwrap())
            .unwrap_err();
        assert_eq!(err, LayerError::LayerNotFound { id: unknown });

        // Existing Reference Layer's placement must be untouched.
        assert_eq!(doc.layer_placement_at(0), Some(before));
    }

    #[test]
    fn set_reference_placement_returns_layer_kind_mismatch_when_target_is_pixel_layer() {
        use crate::layer::LayerKindTag;
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let mut doc = Document::new(4, 4, a, "A".to_string()).unwrap();
        doc.add_reference_layer(r, "Ref".to_string(), vec![0u8; 4], 1, 1)
            .unwrap();
        let ref_before = doc.layer_placement_at(0).unwrap();

        // Target the Pixel Layer `a`, not the Reference Layer `r`.
        let err = doc
            .set_reference_placement(a, ReferencePlacement::new(9.0, 9.0, 9.0).unwrap())
            .unwrap_err();
        assert_eq!(
            err,
            LayerError::LayerKindMismatch {
                id: a,
                expected: LayerKindTag::Reference,
                actual: LayerKindTag::Pixel,
            }
        );
        // The Reference Layer's placement is untouched (we addressed the wrong layer).
        assert_eq!(doc.layer_placement_at(0), Some(ref_before));
    }

    #[test]
    fn resize_translates_reference_placement_by_anchor_factor_across_all_anchors_grow_and_shrink() {
        use crate::canvas::ResizeAnchor;
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        let anchors: &[(ResizeAnchor, (f32, f32))] = &[
            (ResizeAnchor::TopLeft, (0.0, 0.0)),
            (ResizeAnchor::TopCenter, (0.5, 0.0)),
            (ResizeAnchor::TopRight, (1.0, 0.0)),
            (ResizeAnchor::MiddleLeft, (0.0, 0.5)),
            (ResizeAnchor::Center, (0.5, 0.5)),
            (ResizeAnchor::MiddleRight, (1.0, 0.5)),
            (ResizeAnchor::BottomLeft, (0.0, 1.0)),
            (ResizeAnchor::BottomCenter, (0.5, 1.0)),
            (ResizeAnchor::BottomRight, (1.0, 1.0)),
        ];
        // (label, new_w, new_h, delta_w, delta_h). Source canvas is 4x4.
        let directions: &[(&str, u32, u32, f32, f32)] =
            &[("grow", 8, 8, 4.0, 4.0), ("shrink", 2, 2, -2.0, -2.0)];

        let original = ReferencePlacement::new(1.0, 0.5, 1.5).unwrap();

        for &(anchor, (fx, fy)) in anchors {
            for &(label, new_w, new_h, dw, dh) in directions {
                let a = Uuid::new_v4();
                let r = Uuid::new_v4();
                let mut doc = Document::new(4, 4, a, "A".to_string()).unwrap();
                let reference = ReferenceData::new(vec![0u8; 4], 1, 1, original).unwrap();
                doc.layers.push(Layer {
                    id: r,
                    name: "Ref".to_string(),
                    visible: true,
                    opacity: 1.0,
                    kind: LayerKind::Reference(reference),
                });

                doc.resize(new_w, new_h, anchor).unwrap();

                let expected = ReferencePlacement::new(
                    original.x() + dw * fx,
                    original.y() + dh * fy,
                    original.scale(),
                )
                .unwrap();
                assert_eq!(
                    doc.layer_placement_at(1),
                    Some(expected),
                    "anchor={anchor:?} direction={label}",
                );
            }
        }
    }

    #[test]
    fn resize_preserves_reference_source_rgba_and_natural_dimensions_under_placement_transform() {
        use crate::canvas::ResizeAnchor;
        use crate::layer::ReferenceData;
        use crate::reference_placement::ReferencePlacement;

        let a = Uuid::new_v4();
        let r = Uuid::new_v4();
        let placement = ReferencePlacement::new(3.0, -1.5, 2.0).unwrap();
        let ref_rgba = vec![1u8, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        let reference = ReferenceData::new(ref_rgba.clone(), 2, 2, placement).unwrap();

        let mut doc = Document::new(4, 4, a, "A".to_string()).unwrap();
        doc.layers.push(Layer {
            id: r,
            name: "Ref".to_string(),
            visible: true,
            opacity: 0.8,
            kind: LayerKind::Reference(reference),
        });

        doc.resize(8, 8, ResizeAnchor::Center).unwrap();

        let LayerKind::Reference(after) = &doc.layers()[1].kind else {
            panic!("Reference Layer must remain Reference-kind after resize");
        };
        // Source buffer is bit-identical; natural dimensions unchanged.
        assert_eq!(after.source_rgba(), ref_rgba.as_slice());
        assert_eq!(after.natural_width(), 2);
        assert_eq!(after.natural_height(), 2);
        // Scale is unchanged by the transform.
        assert_eq!(after.placement().scale(), placement.scale());
    }

    #[test]
    fn resize_applies_same_anchor_to_every_layer() {
        use crate::canvas::ResizeAnchor;
        use crate::color::Color;

        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);

        let mut doc = Document::new(4, 4, a, "A".to_string()).unwrap();
        set_pixel_canvas(
            &mut doc.layers[0],
            PixelCanvas::with_color(4, 4, red).unwrap(),
        );
        doc.add_layer(b, "B".to_string());
        set_pixel_canvas(
            &mut doc.layers[1],
            PixelCanvas::with_color(4, 4, green).unwrap(),
        );

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
                    pixel_canvas(&doc.layers[0]).get_pixel(x, y).unwrap(),
                    expected_a,
                    "layer A at ({x}, {y})"
                );
                assert_eq!(
                    pixel_canvas(&doc.layers[1]).get_pixel(x, y).unwrap(),
                    expected_b,
                    "layer B at ({x}, {y})"
                );
            }
        }
    }

    // -----------------------------------------------------------------------
    // Frame axis
    // -----------------------------------------------------------------------

    #[test]
    fn new_yields_exactly_one_frame_with_it_active() {
        let doc = Document::new(4, 4, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        assert_eq!(doc.frames().len(), 1);
        assert_eq!(doc.active_frame_id(), doc.frames()[0].id);
    }

    #[test]
    fn add_frame_inserts_after_active_and_makes_it_active() {
        let mut doc = Document::new(4, 4, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        let second = Uuid::new_v4();
        doc.add_frame(second);

        assert_eq!(doc.frames().len(), 2);
        assert_eq!(doc.frames()[0].id, first);
        assert_eq!(doc.frames()[1].id, second);
        assert_eq!(doc.active_frame_id(), second);
    }

    #[test]
    fn add_frame_inserts_directly_after_active_when_active_is_not_last() {
        let mut doc = Document::new(4, 4, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        let second = Uuid::new_v4();
        let third = Uuid::new_v4();
        doc.add_frame(second); // order [first, second], active = second
        doc.set_active_frame(first).unwrap();
        doc.add_frame(third); // inserted after first -> [first, third, second]

        let ids: Vec<Uuid> = doc.frames().iter().map(|f| f.id).collect();
        assert_eq!(ids, vec![first, third, second]);
        assert_eq!(doc.active_frame_id(), third);
    }

    #[test]
    fn add_frame_seeds_a_transparent_cel_so_the_new_frame_starts_empty() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap();
        doc.add_frame(Uuid::new_v4());
        // The freshly added frame is active and its cel starts transparent.
        assert!(
            doc.composite().iter().all(|&b| b == 0),
            "a newly added frame must be fully transparent"
        );
        assert_grid_invariant(&mut doc);
    }

    #[test]
    fn set_active_frame_switches_frame_and_composite_reflects_it() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        let red = Color::new(255, 0, 0, 255);
        doc.set_pixel(0, 0, red).unwrap();
        doc.add_frame(Uuid::new_v4()); // new empty frame becomes active

        assert!(doc.composite().iter().all(|&b| b == 0));

        doc.set_active_frame(first).unwrap();
        assert_eq!(&doc.composite()[0..4], &[255, 0, 0, 255]);
    }

    #[test]
    fn set_active_frame_unknown_id_returns_frame_not_found_and_preserves_active() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let original = doc.active_frame_id();
        let unknown = Uuid::new_v4();
        assert_eq!(
            doc.set_active_frame(unknown),
            Err(FrameError::FrameNotFound { id: unknown })
        );
        assert_eq!(doc.active_frame_id(), original);
    }

    #[test]
    fn drawing_writes_only_the_active_frame_cel() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        let red = Color::new(255, 0, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        doc.set_pixel(0, 0, red).unwrap(); // on the first frame

        let second = Uuid::new_v4();
        doc.add_frame(second); // second active and empty
        doc.set_pixel(1, 1, blue).unwrap(); // on the second frame

        doc.set_active_frame(first).unwrap();
        assert_eq!(doc.get_pixel(0, 0).unwrap(), red);
        assert_eq!(doc.get_pixel(1, 1).unwrap(), Color::TRANSPARENT);

        doc.set_active_frame(second).unwrap();
        assert_eq!(doc.get_pixel(0, 0).unwrap(), Color::TRANSPARENT);
        assert_eq!(doc.get_pixel(1, 1).unwrap(), blue);
    }

    #[test]
    fn duplicate_frame_inserts_after_active_clones_the_source_and_becomes_active() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap();

        let copy = Uuid::new_v4();
        doc.duplicate_frame(copy);

        assert_eq!(doc.frames().len(), 2);
        assert_eq!(doc.frames()[0].id, first);
        assert_eq!(doc.frames()[1].id, copy);
        assert_eq!(doc.active_frame_id(), copy);
        // The duplicate reproduces the source frame's full composite.
        assert_eq!(&doc.composite()[0..4], &[255, 0, 0, 255]);
    }

    #[test]
    fn duplicate_frame_deep_copies_so_editing_the_copy_leaves_the_source_unchanged() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);
        doc.set_pixel(0, 0, red).unwrap();

        let copy = Uuid::new_v4();
        doc.duplicate_frame(copy); // copy active, holds the cloned red pixel
        doc.set_pixel(1, 1, green).unwrap(); // edit only the copy

        doc.set_active_frame(first).unwrap();
        assert_eq!(doc.get_pixel(0, 0).unwrap(), red);
        assert_eq!(doc.get_pixel(1, 1).unwrap(), Color::TRANSPARENT);
    }

    #[test]
    fn duplicate_frame_clones_every_pixel_layers_active_frame_cel() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let red = Color::new(255, 0, 0, 255);
        let green = Color::new(0, 255, 0, 255);
        doc.set_pixel(0, 0, red).unwrap(); // layer 0 (active)
        doc.add_layer(Uuid::new_v4(), "Layer 2".to_string()); // layer 1 active
        doc.set_pixel(1, 1, green).unwrap();

        doc.duplicate_frame(Uuid::new_v4());

        // Both layers' cels are copied into the duplicate frame: layer 0's red
        // at (0,0) and layer 1's green at (1,1) both appear in the composite.
        let composite = doc.composite();
        let texel = |x: usize, y: usize| {
            let i = (y * 2 + x) * 4;
            &composite[i..i + 4]
        };
        assert_eq!(texel(0, 0), &[255, 0, 0, 255]);
        assert_eq!(texel(1, 1), &[0, 255, 0, 255]);
        assert_grid_invariant(&mut doc);
    }

    /// Verifies the grid invariant behaviorally: every frame has a cel for every
    /// Pixel Layer. Switches through each frame and exercises the active-frame
    /// accessors, whose grid-invariant `expect` panics if a cel is missing.
    /// Restores the original active frame.
    fn assert_grid_invariant(doc: &mut Document) {
        let frame_ids: Vec<Uuid> = doc.frames().iter().map(|f| f.id).collect();
        let layer_count = doc.layers().len();
        let original = doc.active_frame_id();
        for fid in frame_ids {
            doc.set_active_frame(fid).unwrap();
            for idx in 0..layer_count {
                let _ = doc.layer_pixels_at(idx);
            }
            let _ = doc.composite();
        }
        doc.set_active_frame(original).unwrap();
    }

    #[test]
    fn remove_frame_rejects_the_last_remaining_frame() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let only = doc.active_frame_id();
        assert_eq!(doc.remove_frame(only), Err(FrameError::RemoveLastFrame));
        assert_eq!(doc.frames().len(), 1);
    }

    #[test]
    fn remove_frame_unknown_id_returns_frame_not_found() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        doc.add_frame(Uuid::new_v4());
        let unknown = Uuid::new_v4();
        assert_eq!(
            doc.remove_frame(unknown),
            Err(FrameError::FrameNotFound { id: unknown })
        );
        assert_eq!(doc.frames().len(), 2);
    }

    #[test]
    fn remove_frame_prefers_frame_not_found_over_remove_last_frame() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let unknown = Uuid::new_v4();
        assert_eq!(
            doc.remove_frame(unknown),
            Err(FrameError::FrameNotFound { id: unknown })
        );
    }

    #[test]
    fn remove_frame_relocates_active_to_the_frame_below() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        let second = Uuid::new_v4();
        let third = Uuid::new_v4();
        doc.add_frame(second);
        doc.add_frame(third); // [first, second, third]
        doc.set_active_frame(second).unwrap();

        doc.remove_frame(second).unwrap();
        let ids: Vec<Uuid> = doc.frames().iter().map(|f| f.id).collect();
        assert_eq!(ids, vec![first, third]);
        assert_eq!(doc.active_frame_id(), first);
    }

    #[test]
    fn remove_frame_relocates_active_up_when_removing_the_first_frame() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        let second = Uuid::new_v4();
        doc.add_frame(second); // [first, second]
        doc.set_active_frame(first).unwrap();

        doc.remove_frame(first).unwrap();
        let ids: Vec<Uuid> = doc.frames().iter().map(|f| f.id).collect();
        assert_eq!(ids, vec![second]);
        assert_eq!(doc.active_frame_id(), second);
    }

    #[test]
    fn remove_frame_drops_the_cel_from_every_pixel_layer() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        let red = Color::new(255, 0, 0, 255);
        doc.set_pixel(0, 0, red).unwrap();
        let second = Uuid::new_v4();
        doc.add_frame(second);
        doc.set_pixel(1, 1, Color::new(0, 0, 255, 255)).unwrap();

        doc.remove_frame(second).unwrap();
        assert_eq!(doc.active_frame_id(), first);
        assert_eq!(doc.get_pixel(0, 0).unwrap(), red);
        assert_grid_invariant(&mut doc);
    }

    #[test]
    fn reorder_frame_rearranges_and_preserves_active_by_id() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        let second = Uuid::new_v4();
        let third = Uuid::new_v4();
        doc.add_frame(second);
        doc.add_frame(third); // [first, second, third]
        doc.set_active_frame(second).unwrap();

        doc.reorder_frame(third, 0).unwrap();
        let ids: Vec<Uuid> = doc.frames().iter().map(|f| f.id).collect();
        assert_eq!(ids, vec![third, first, second]);
        assert_eq!(doc.active_frame_id(), second);
        assert_grid_invariant(&mut doc);
    }

    #[test]
    fn reorder_frame_clamps_out_of_range_index() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        let second = Uuid::new_v4();
        doc.add_frame(second); // [first, second]

        doc.reorder_frame(first, 99).unwrap();
        let ids: Vec<Uuid> = doc.frames().iter().map(|f| f.id).collect();
        assert_eq!(ids, vec![second, first]);
    }

    #[test]
    fn reorder_frame_unknown_id_returns_frame_not_found() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let unknown = Uuid::new_v4();
        assert_eq!(
            doc.reorder_frame(unknown, 0),
            Err(FrameError::FrameNotFound { id: unknown })
        );
    }

    #[test]
    fn reorder_frame_preserves_cel_contents_keyed_by_id() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        let red = Color::new(255, 0, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        doc.set_pixel(0, 0, red).unwrap();
        let second = Uuid::new_v4();
        doc.add_frame(second);
        doc.set_pixel(1, 1, blue).unwrap();

        doc.reorder_frame(second, 0).unwrap(); // [second, first]

        doc.set_active_frame(first).unwrap();
        assert_eq!(doc.get_pixel(0, 0).unwrap(), red);
        assert_eq!(doc.get_pixel(1, 1).unwrap(), Color::TRANSPARENT);
        doc.set_active_frame(second).unwrap();
        assert_eq!(doc.get_pixel(1, 1).unwrap(), blue);
    }

    #[test]
    fn add_layer_seeds_a_cel_for_every_existing_frame() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        let second = Uuid::new_v4();
        doc.add_frame(second); // two frames exist before the layer is added
        doc.add_layer(Uuid::new_v4(), "Layer 2".to_string());

        // The new layer is drawable on each frame independently — proving it was
        // seeded a cel for both.
        let red = Color::new(255, 0, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        doc.set_pixel(0, 0, blue).unwrap(); // new layer, `second` frame (active)
        doc.set_active_frame(first).unwrap();
        doc.set_pixel(1, 1, red).unwrap(); // new layer, `first` frame

        assert_eq!(doc.get_pixel(1, 1).unwrap(), red);
        assert_eq!(doc.get_pixel(0, 0).unwrap(), Color::TRANSPARENT);
        doc.set_active_frame(second).unwrap();
        assert_eq!(doc.get_pixel(0, 0).unwrap(), blue);
        assert_eq!(doc.get_pixel(1, 1).unwrap(), Color::TRANSPARENT);

        assert_grid_invariant(&mut doc);
    }

    #[test]
    fn resize_maps_every_cel_of_every_frame_with_the_same_anchor() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        let red = Color::new(255, 0, 0, 255);
        let blue = Color::new(0, 0, 255, 255);
        doc.set_pixel(0, 0, red).unwrap(); // first frame
        let second = Uuid::new_v4();
        doc.add_frame(second);
        doc.set_pixel(0, 0, blue).unwrap(); // second frame

        doc.resize(4, 4, ResizeAnchor::TopLeft).unwrap();
        assert_eq!((doc.width(), doc.height()), (4, 4));

        // A TopLeft anchor keeps (0,0) in place on every frame's cel.
        doc.set_active_frame(first).unwrap();
        assert_eq!(doc.get_pixel(0, 0).unwrap(), red);
        doc.set_active_frame(second).unwrap();
        assert_eq!(doc.get_pixel(0, 0).unwrap(), blue);
        assert_grid_invariant(&mut doc);
    }

    #[test]
    fn rotate_cw_without_a_marquee_turns_every_cel_of_every_frame() {
        let mut doc = Document::new(3, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap(); // first frame
        let second = Uuid::new_v4();
        doc.add_frame(second);
        doc.set_pixel(2, 1, Color::new(0, 0, 255, 255)).unwrap(); // second frame, opposite corner

        doc.set_active_frame(first).unwrap();
        let first_before = doc.composite();
        doc.set_active_frame(second).unwrap();
        let second_before = doc.composite();

        doc.rotate_cw();
        assert_eq!((doc.width(), doc.height()), (2, 3)); // dims swapped
        assert_grid_invariant(&mut doc);

        // A CCW turn restores every frame's original content exactly — only
        // possible if rotate_cw turned every cel of every frame, not just the
        // active one.
        doc.rotate_ccw();
        assert_eq!((doc.width(), doc.height()), (3, 2));
        doc.set_active_frame(first).unwrap();
        assert_eq!(doc.composite(), first_before);
        doc.set_active_frame(second).unwrap();
        assert_eq!(doc.composite(), second_before);
    }

    #[test]
    fn reference_layer_is_frame_independent_across_frames() {
        let mut doc = Document::new(4, 4, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let ref_id = Uuid::new_v4();
        let rgba = vec![9u8; 4 * 4 * 4];
        doc.add_reference_layer(ref_id, "Ref".to_string(), rgba, 4, 4)
            .unwrap();
        let sample_before = doc.try_get_pixel(0, 0);

        // Adding a frame seeds no cel for the Reference; it samples identically.
        doc.add_frame(Uuid::new_v4());
        assert_eq!(doc.try_get_pixel(0, 0), sample_before);

        // Drawing with the Reference active stays a no-op on the new frame.
        assert!(!doc.flood_fill(0, 0, Color::new(1, 2, 3, 255)));
        assert_eq!(
            doc.set_pixel(0, 0, Color::new(1, 2, 3, 255)),
            Err(DrawError::LayerKindMismatch)
        );

        // The Reference never contributes to the composite on any frame.
        assert!(doc.composite().iter().all(|&b| b == 0));
        assert_grid_invariant(&mut doc);
    }

    #[test]
    fn remove_layer_preserves_the_grid_invariant_across_frames() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        doc.add_frame(Uuid::new_v4()); // two frames
        let layer_two = Uuid::new_v4();
        doc.add_layer(layer_two, "Layer 2".to_string());

        doc.remove_layer(layer_two).unwrap();
        assert_grid_invariant(&mut doc);
    }
}
