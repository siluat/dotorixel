use uuid::Uuid;
use wasm_bindgen::prelude::*;

use dotorixel_core::canvas::{PixelCanvas, ResizeAnchor};
use dotorixel_core::color::Color;
use dotorixel_core::document::Document;
use dotorixel_core::layer::Layer;
use dotorixel_core::export::{PngExport, SvgExport};
use dotorixel_core::history::{HistoryManager, Snapshot};
use dotorixel_core::pixel_perfect::{
    Action, FilterResult, TailState, pixel_perfect_filter,
};
use dotorixel_core::tool::{
    ToolType, ellipse_outline, interpolate_pixels, rectangle_outline,
};
use dotorixel_core::viewport::{ScreenCanvasCoords, Viewport, ViewportSize};

// ---------------------------------------------------------------------------
// core_version
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub fn core_version() -> String {
    dotorixel_core::core_version().to_string()
}

// ---------------------------------------------------------------------------
// WasmColor
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct WasmColor {
    inner: Color,
}

#[wasm_bindgen]
impl WasmColor {
    #[wasm_bindgen(constructor)]
    pub fn new(r: u8, g: u8, b: u8, a: u8) -> WasmColor {
        WasmColor {
            inner: Color::new(r, g, b, a),
        }
    }

    pub fn transparent() -> WasmColor {
        WasmColor {
            inner: Color::TRANSPARENT,
        }
    }

    #[wasm_bindgen(getter)]
    pub fn r(&self) -> u8 {
        self.inner.r
    }

    #[wasm_bindgen(getter)]
    pub fn g(&self) -> u8 {
        self.inner.g
    }

    #[wasm_bindgen(getter)]
    pub fn b(&self) -> u8 {
        self.inner.b
    }

    #[wasm_bindgen(getter)]
    pub fn a(&self) -> u8 {
        self.inner.a
    }

    pub fn to_hex(&self) -> String {
        self.inner.to_hex()
    }

    pub fn from_hex(hex: &str) -> Result<WasmColor, JsError> {
        let color = Color::from_hex(hex).map_err(|e| JsError::new(&e.to_string()))?;
        Ok(WasmColor { inner: color })
    }
}

// ---------------------------------------------------------------------------
// WasmPixelCanvas
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct WasmPixelCanvas {
    inner: PixelCanvas,
}

#[wasm_bindgen]
impl WasmPixelCanvas {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> Result<WasmPixelCanvas, JsError> {
        let canvas = PixelCanvas::new(width, height).map_err(|e| JsError::new(&e.to_string()))?;
        Ok(WasmPixelCanvas { inner: canvas })
    }

    pub fn with_color(
        width: u32,
        height: u32,
        color: &WasmColor,
    ) -> Result<WasmPixelCanvas, JsError> {
        let canvas = PixelCanvas::with_color(width, height, color.inner)
            .map_err(|e| JsError::new(&e.to_string()))?;
        Ok(WasmPixelCanvas { inner: canvas })
    }

    pub fn from_pixels(
        width: u32,
        height: u32,
        pixels: &[u8],
    ) -> Result<WasmPixelCanvas, JsError> {
        let canvas = PixelCanvas::from_pixels(width, height, pixels.to_vec())
            .map_err(|e| JsError::new(&e.to_string()))?;
        Ok(WasmPixelCanvas { inner: canvas })
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.inner.width()
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.inner.height()
    }

    /// Returns a copy of the pixel buffer as a `Uint8Array`.
    pub fn pixels(&self) -> Vec<u8> {
        self.inner.pixels().to_vec()
    }

    pub fn get_pixel(&self, x: u32, y: u32) -> Result<WasmColor, JsError> {
        let color = self
            .inner
            .get_pixel(x, y)
            .map_err(|e| JsError::new(&e.to_string()))?;
        Ok(WasmColor { inner: color })
    }

    pub fn set_pixel(&mut self, x: u32, y: u32, color: &WasmColor) -> Result<(), JsError> {
        self.inner
            .set_pixel(x, y, color.inner)
            .map_err(|e| JsError::new(&e.to_string()))
    }

    pub fn is_inside_bounds(&self, x: u32, y: u32) -> bool {
        self.inner.is_inside_bounds(x, y)
    }

    pub fn restore_pixels(&mut self, data: &[u8]) -> Result<(), JsError> {
        self.inner
            .restore_pixels(data)
            .map_err(|e| JsError::new(&e.to_string()))
    }

    pub fn clear(&mut self) {
        self.inner.clear();
    }

    pub fn resize(&self, new_width: u32, new_height: u32) -> Result<WasmPixelCanvas, JsError> {
        let canvas = self
            .inner
            .resize(new_width, new_height)
            .map_err(|e| JsError::new(&e.to_string()))?;
        Ok(WasmPixelCanvas { inner: canvas })
    }

    pub fn resize_with_anchor(
        &self,
        new_width: u32,
        new_height: u32,
        anchor: WasmResizeAnchor,
    ) -> Result<WasmPixelCanvas, JsError> {
        let canvas = self
            .inner
            .resize_with_anchor(new_width, new_height, anchor.to_core())
            .map_err(|e| JsError::new(&e.to_string()))?;
        Ok(WasmPixelCanvas { inner: canvas })
    }

    // --- Constants as static methods ---

    pub fn min_dimension() -> u32 {
        PixelCanvas::MIN_DIMENSION
    }

    pub fn max_dimension() -> u32 {
        PixelCanvas::MAX_DIMENSION
    }

    pub fn presets() -> Vec<u32> {
        PixelCanvas::PRESETS.to_vec()
    }

    pub fn is_valid_dimension(value: u32) -> bool {
        PixelCanvas::is_valid_dimension(value)
    }

    pub fn encode_png(&self) -> Result<Vec<u8>, JsError> {
        self.inner
            .encode_png()
            .map_err(|e| JsError::new(&e.to_string()))
    }

    pub fn encode_svg(&self) -> Result<String, JsError> {
        self.inner
            .encode_svg()
            .map_err(|e| JsError::new(&e.to_string()))
    }
}

// ---------------------------------------------------------------------------
// WasmDocument
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct WasmDocument {
    inner: Document,
}

#[wasm_bindgen]
impl WasmDocument {
    /// Creates a document of `width × height` with one initial transparent
    /// layer keyed by `first_layer_id`. Errors when `first_layer_id` is not a
    /// valid UUID string or when the dimensions fall outside the core's
    /// supported range.
    #[wasm_bindgen(constructor)]
    pub fn new(
        width: u32,
        height: u32,
        first_layer_id: String,
        first_layer_name: String,
    ) -> Result<WasmDocument, JsError> {
        let id = Uuid::parse_str(&first_layer_id).map_err(|e| JsError::new(&e.to_string()))?;
        let document = Document::new(width, height, id, first_layer_name)
            .map_err(|e| JsError::new(&e.to_string()))?;
        Ok(WasmDocument { inner: document })
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.inner.width()
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.inner.height()
    }

    pub fn active_layer_id(&self) -> String {
        self.inner.active_layer_id().to_string()
    }

    pub fn next_layer_number(&self) -> u32 {
        self.inner.next_layer_number()
    }

    pub fn layer_count(&self) -> usize {
        self.inner.layers().len()
    }

    /// Inserts a transparent layer directly above the active layer and makes
    /// it active. Increments `next_layer_number`; the counter is never
    /// decremented by `remove_layer`. Errors when `new_id` is not a valid UUID
    /// string or when a layer with the same id already exists in the document.
    pub fn add_layer(&mut self, new_id: String, name: String) -> Result<(), JsError> {
        let id = Uuid::parse_str(&new_id).map_err(|e| JsError::new(&e.to_string()))?;
        if self.inner.layers().iter().any(|l| l.id == id) {
            return Err(JsError::new(&format!(
                "Layer with id {id} already exists"
            )));
        }
        self.inner.add_layer(id, name);
        Ok(())
    }

    /// Removes the layer with `id`. Errors when the layer does not exist or
    /// when removing it would empty the document (a document must always
    /// contain at least one layer). When the removed layer was active, the
    /// active pointer moves to an adjacent layer.
    pub fn remove_layer(&mut self, id: String) -> Result<(), JsError> {
        let layer_id = Uuid::parse_str(&id).map_err(|e| JsError::new(&e.to_string()))?;
        self.inner
            .remove_layer(layer_id)
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// RGBA row-major composite buffer (`width * height * 4` bytes), suitable
    /// for `ImageData`.
    pub fn composite(&self) -> Vec<u8> {
        self.inner.composite()
    }

    /// Writes `color` to `(x, y)` on the active layer.
    pub fn set_pixel(&mut self, x: u32, y: u32, color: &WasmColor) -> Result<(), JsError> {
        self.inner
            .set_pixel(x, y, color.inner)
            .map_err(|e| JsError::new(&e.to_string()))
    }

    pub fn is_timeline_panel_collapsed(&self) -> bool {
        self.inner.is_timeline_panel_collapsed()
    }

    /// Sets the active layer by id. Errors when no layer with `id` exists; in
    /// that case the previous active layer is preserved.
    pub fn set_active_layer(&mut self, id: String) -> Result<(), JsError> {
        let layer_id = Uuid::parse_str(&id).map_err(|e| JsError::new(&e.to_string()))?;
        self.inner
            .set_active_layer(layer_id)
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Moves the layer with `id` to `new_index`. `new_index` is silently
    /// clamped to `[0, layer_count - 1]`. The active layer pointer is
    /// preserved across reordering (tracked by id, not by index).
    pub fn reorder_layer(&mut self, id: String, new_index: usize) -> Result<(), JsError> {
        let layer_id = Uuid::parse_str(&id).map_err(|e| JsError::new(&e.to_string()))?;
        self.inner
            .reorder_layer(layer_id, new_index)
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Resizes every layer to `new_width × new_height` using the same
    /// `anchor`, preserving each layer's id, name, visibility, and opacity.
    /// The active layer pointer is preserved.
    pub fn resize(
        &mut self,
        new_width: u32,
        new_height: u32,
        anchor: WasmResizeAnchor,
    ) -> Result<(), JsError> {
        self.inner
            .resize(new_width, new_height, anchor.to_core())
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Returns the layer id at `index` as a UUID string, or `None` when
    /// `index` is out of range. `index = 0` is the bottom-most layer.
    pub fn layer_id_at(&self, index: usize) -> Option<String> {
        self.inner.layers().get(index).map(|l| l.id.to_string())
    }

    /// Returns the layer name at `index`, or `None` when `index` is out of
    /// range.
    pub fn layer_name_at(&self, index: usize) -> Option<String> {
        self.inner.layers().get(index).map(|l| l.name.clone())
    }

    /// Returns the visibility flag of the layer at `index`, or `None` when
    /// `index` is out of range.
    pub fn layer_visible_at(&self, index: usize) -> Option<bool> {
        self.inner.layers().get(index).map(|l| l.visible)
    }

    /// Returns the opacity (0.0..=1.0) of the layer at `index`, or `None` when
    /// `index` is out of range.
    pub fn layer_opacity_at(&self, index: usize) -> Option<f32> {
        self.inner.layers().get(index).map(|l| l.opacity)
    }

    /// Returns a copy of the RGBA pixel buffer of the layer at `index`, or
    /// `None` when `index` is out of range. Used by the persistence save path.
    pub fn layer_pixels_at(&self, index: usize) -> Option<Vec<u8>> {
        self.inner.layer_pixels_at(index).map(|p| p.to_vec())
    }

    /// Applies `tool` at `(x, y)` to the active layer. Returns `true` when a
    /// pixel was written; `false` when the coordinates are out of bounds
    /// (including negative values, which match `apply_tool` on
    /// `WasmPixelCanvas`).
    pub fn apply_tool(&mut self, x: i32, y: i32, tool: WasmToolType, color: &WasmColor) -> bool {
        self.inner.apply_tool(tool.to_core(), x, y, color.inner)
    }

    /// 4-connected flood fill on the active layer starting at `(x, y)`.
    /// Returns `true` when at least one pixel was changed. Negative
    /// coordinates short-circuit to `false`.
    pub fn flood_fill(&mut self, x: i32, y: i32, color: &WasmColor) -> bool {
        if x < 0 || y < 0 {
            return false;
        }
        self.inner.flood_fill(x as u32, y as u32, color.inner)
    }

    /// Clears the active layer to fully transparent. Other layers are
    /// unaffected.
    pub fn clear(&mut self) {
        self.inner.clear();
    }
}

// ---------------------------------------------------------------------------
// WasmDocumentBuilder
// ---------------------------------------------------------------------------

/// Builder for constructing a [`WasmDocument`] from a pre-existing layer
/// stack — used by the persistence hydration path.
///
/// `wasm-bindgen` cannot marshal `Vec<MyType>` directly, so callers add
/// layers one at a time via [`Self::add_layer`] and then call [`Self::build`].
#[wasm_bindgen]
pub struct WasmDocumentBuilder {
    width: u32,
    height: u32,
    layers: Vec<Layer>,
}

#[wasm_bindgen]
impl WasmDocumentBuilder {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> WasmDocumentBuilder {
        WasmDocumentBuilder {
            width,
            height,
            layers: Vec::new(),
        }
    }

    /// Appends a layer to the in-progress stack. `pixels` must be a row-major
    /// RGBA buffer of length `width * height * 4`. Errors when `id` is not a
    /// valid UUID string or when the pixel buffer is the wrong length.
    pub fn add_layer(
        &mut self,
        id: String,
        name: String,
        pixels: Vec<u8>,
        visible: bool,
        opacity: f32,
    ) -> Result<(), JsError> {
        let layer_id = Uuid::parse_str(&id).map_err(|e| JsError::new(&e.to_string()))?;
        let pixel_canvas = PixelCanvas::from_pixels(self.width, self.height, pixels)
            .map_err(|e| JsError::new(&e.to_string()))?;
        self.layers.push(Layer {
            id: layer_id,
            name,
            pixels: pixel_canvas,
            visible,
            opacity,
        });
        Ok(())
    }

    /// Consumes the builder and returns the resulting document. Errors when
    /// the accumulated layer stack fails [`Document::from_layers`] validation
    /// (empty stack, duplicate ids, layer/document dimension mismatch, or
    /// `active_layer_id` not present).
    pub fn build(
        self,
        active_layer_id: String,
        next_layer_number: u32,
        timeline_panel_collapsed: bool,
    ) -> Result<WasmDocument, JsError> {
        let active_id =
            Uuid::parse_str(&active_layer_id).map_err(|e| JsError::new(&e.to_string()))?;
        let document = Document::from_layers(
            self.width,
            self.height,
            self.layers,
            active_id,
            next_layer_number,
            timeline_panel_collapsed,
        )
        .map_err(|e| JsError::new(&e.to_string()))?;
        Ok(WasmDocument { inner: document })
    }
}

// ---------------------------------------------------------------------------
// WasmResizeAnchor
// ---------------------------------------------------------------------------

#[wasm_bindgen]
#[derive(Debug, Clone, Copy)]
pub enum WasmResizeAnchor {
    TopLeft = 0,
    TopCenter = 1,
    TopRight = 2,
    MiddleLeft = 3,
    Center = 4,
    MiddleRight = 5,
    BottomLeft = 6,
    BottomCenter = 7,
    BottomRight = 8,
}

impl WasmResizeAnchor {
    fn to_core(self) -> ResizeAnchor {
        match self {
            WasmResizeAnchor::TopLeft => ResizeAnchor::TopLeft,
            WasmResizeAnchor::TopCenter => ResizeAnchor::TopCenter,
            WasmResizeAnchor::TopRight => ResizeAnchor::TopRight,
            WasmResizeAnchor::MiddleLeft => ResizeAnchor::MiddleLeft,
            WasmResizeAnchor::Center => ResizeAnchor::Center,
            WasmResizeAnchor::MiddleRight => ResizeAnchor::MiddleRight,
            WasmResizeAnchor::BottomLeft => ResizeAnchor::BottomLeft,
            WasmResizeAnchor::BottomCenter => ResizeAnchor::BottomCenter,
            WasmResizeAnchor::BottomRight => ResizeAnchor::BottomRight,
        }
    }
}

// ---------------------------------------------------------------------------
// WasmToolType
// ---------------------------------------------------------------------------

#[wasm_bindgen]
#[derive(Debug, Clone, Copy)]
pub enum WasmToolType {
    Pencil = 0,
    Eraser = 1,
    Line = 2,
    Rectangle = 3,
    Ellipse = 4,
}

impl WasmToolType {
    fn to_core(self) -> ToolType {
        match self {
            WasmToolType::Pencil => ToolType::Pencil,
            WasmToolType::Eraser => ToolType::Eraser,
            WasmToolType::Line => ToolType::Line,
            WasmToolType::Rectangle => ToolType::Rectangle,
            WasmToolType::Ellipse => ToolType::Ellipse,
        }
    }
}

// ---------------------------------------------------------------------------
// Tool free functions
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub fn apply_tool(
    canvas: &mut WasmPixelCanvas,
    x: i32,
    y: i32,
    tool: WasmToolType,
    color: &WasmColor,
) -> bool {
    tool.to_core().apply(&mut canvas.inner, x, y, color.inner)
}

/// Returns interpolated pixel coordinates as a flat `Vec<i32>`: `[x0, y0, x1, y1, ...]`.
#[wasm_bindgen]
pub fn wasm_interpolate_pixels(x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<i32> {
    let points = interpolate_pixels(x0, y0, x1, y1);
    let mut flat = Vec::with_capacity(points.len() * 2);
    for (x, y) in points {
        flat.push(x);
        flat.push(y);
    }
    flat
}

/// Returns rectangle outline pixel coordinates as a flat `Vec<i32>`: `[x0, y0, x1, y1, ...]`.
#[wasm_bindgen]
pub fn wasm_rectangle_outline(x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<i32> {
    let points = rectangle_outline(x0, y0, x1, y1);
    let mut flat = Vec::with_capacity(points.len() * 2);
    for (x, y) in points {
        flat.push(x);
        flat.push(y);
    }
    flat
}

/// Returns ellipse outline pixel coordinates as a flat `Vec<i32>`: `[x0, y0, x1, y1, ...]`.
#[wasm_bindgen]
pub fn wasm_ellipse_outline(x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<i32> {
    let points = ellipse_outline(x0, y0, x1, y1);
    let mut flat = Vec::with_capacity(points.len() * 2);
    for (x, y) in points {
        flat.push(x);
        flat.push(y);
    }
    flat
}

/// Fills all pixels connected to `(x, y)` with the given color using 4-connectivity.
#[wasm_bindgen]
pub fn wasm_flood_fill(canvas: &mut WasmPixelCanvas, x: i32, y: i32, color: &WasmColor) -> bool {
    if x < 0 || y < 0 {
        return false;
    }
    canvas.inner.flood_fill(x as u32, y as u32, color.inner)
}

// ---------------------------------------------------------------------------
// WasmSnapshot
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct WasmSnapshot {
    inner: Snapshot,
}

#[wasm_bindgen]
impl WasmSnapshot {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.inner.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.inner.height
    }

    pub fn pixels(&self) -> Vec<u8> {
        self.inner.pixels.clone()
    }
}

// ---------------------------------------------------------------------------
// WasmHistoryManager
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct WasmHistoryManager {
    inner: HistoryManager,
}

#[wasm_bindgen]
impl WasmHistoryManager {
    #[wasm_bindgen(constructor)]
    pub fn new(max_snapshots: usize) -> WasmHistoryManager {
        WasmHistoryManager {
            inner: HistoryManager::new(max_snapshots),
        }
    }

    pub fn default_manager() -> WasmHistoryManager {
        WasmHistoryManager {
            inner: HistoryManager::default(),
        }
    }

    pub fn can_undo(&self) -> bool {
        self.inner.can_undo()
    }

    pub fn can_redo(&self) -> bool {
        self.inner.can_redo()
    }

    pub fn push_snapshot(&mut self, width: u32, height: u32, pixels: &[u8]) {
        self.inner.push_snapshot(width, height, pixels);
    }

    pub fn undo(
        &mut self,
        current_width: u32,
        current_height: u32,
        current_pixels: &[u8],
    ) -> Option<WasmSnapshot> {
        self.inner
            .undo(current_width, current_height, current_pixels)
            .map(|s| WasmSnapshot { inner: s })
    }

    pub fn redo(
        &mut self,
        current_width: u32,
        current_height: u32,
        current_pixels: &[u8],
    ) -> Option<WasmSnapshot> {
        self.inner
            .redo(current_width, current_height, current_pixels)
            .map(|s| WasmSnapshot { inner: s })
    }

    pub fn clear(&mut self) {
        self.inner.clear();
    }

    pub fn default_max_snapshots() -> usize {
        HistoryManager::DEFAULT_MAX_SNAPSHOTS
    }

    /// Captures `document` as the new top of the undo stack and clears the
    /// redo stack. Older snapshots are evicted once the configured maximum is
    /// exceeded.
    pub fn push_document(&mut self, document: &WasmDocument) {
        self.inner.push_document(&document.inner);
    }

    /// Pushes `current` onto the redo stack and returns the previous document
    /// snapshot, or `None` when the undo stack is empty.
    pub fn undo_document(&mut self, current: &WasmDocument) -> Option<WasmDocument> {
        self.inner
            .undo_document(&current.inner)
            .map(|inner| WasmDocument { inner })
    }

    /// Pushes `current` onto the undo stack and returns the next document
    /// snapshot, or `None` when the redo stack is empty.
    pub fn redo_document(&mut self, current: &WasmDocument) -> Option<WasmDocument> {
        self.inner
            .redo_document(&current.inner)
            .map(|inner| WasmDocument { inner })
    }
}

// ---------------------------------------------------------------------------
// Pixel Perfect filter
// ---------------------------------------------------------------------------

/// Discriminant encoded as the first `i32` of each triple in
/// `WasmFilterResult::actions_flat`. Matches the TS import name.
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WasmActionKind {
    Paint = 0,
    Revert = 1,
}

/// Opaque result of one `wasm_pixel_perfect_filter` call.
///
/// Exposes actions and the updated tail via flat `Int32Array` accessors — the
/// TS caller parses them. Wrapping avoids `wasm-bindgen` enum-with-data
/// limitations.
#[wasm_bindgen]
pub struct WasmFilterResult {
    inner: FilterResult,
}

#[wasm_bindgen]
impl WasmFilterResult {
    /// Actions as flat `i32` triples: `[kind0, x0, y0, kind1, x1, y1, ...]`.
    /// `kind` discriminants are defined by [`WasmActionKind`].
    pub fn actions_flat(&self) -> Vec<i32> {
        let mut flat = Vec::with_capacity(self.inner.actions.len() * 3);
        for action in &self.inner.actions {
            let (kind, x, y) = match *action {
                Action::Paint(x, y) => (WasmActionKind::Paint, x, y),
                Action::Revert(x, y) => (WasmActionKind::Revert, x, y),
            };
            flat.push(kind as i32);
            flat.push(x);
            flat.push(y);
        }
        flat
    }

    /// Tail as flat `i32`: `[]` empty, `[x, y]` one, `[ax, ay, bx, by]` two.
    pub fn new_tail_flat(&self) -> Vec<i32> {
        match self.inner.new_tail {
            TailState::Empty => vec![],
            TailState::One(x, y) => vec![x, y],
            TailState::Two(ax, ay, bx, by) => vec![ax, ay, bx, by],
        }
    }
}

/// Apply the L-corner filter to a batch of points.
///
/// `points` is flat `[x0, y0, x1, y1, ...]`; `prev_tail` is `[]`, `[x, y]`,
/// or `[ax, ay, bx, by]` encoding the 0/1/2-point carry state.
#[wasm_bindgen]
pub fn wasm_pixel_perfect_filter(
    points: &[i32],
    prev_tail: &[i32],
) -> Result<WasmFilterResult, JsError> {
    if points.len() % 2 != 0 {
        return Err(JsError::new("points length must be even"));
    }
    let point_vec: Vec<(i32, i32)> =
        points.chunks_exact(2).map(|c| (c[0], c[1])).collect();

    let tail = match prev_tail.len() {
        0 => TailState::Empty,
        2 => TailState::One(prev_tail[0], prev_tail[1]),
        4 => TailState::Two(
            prev_tail[0],
            prev_tail[1],
            prev_tail[2],
            prev_tail[3],
        ),
        _ => return Err(JsError::new("prev_tail must have 0, 2, or 4 elements")),
    };

    Ok(WasmFilterResult {
        inner: pixel_perfect_filter(&point_vec, tail),
    })
}

// ---------------------------------------------------------------------------
// WasmScreenCanvasCoords
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct WasmScreenCanvasCoords {
    inner: ScreenCanvasCoords,
}

#[wasm_bindgen]
impl WasmScreenCanvasCoords {
    #[wasm_bindgen(getter)]
    pub fn x(&self) -> i32 {
        self.inner.x
    }

    #[wasm_bindgen(getter)]
    pub fn y(&self) -> i32 {
        self.inner.y
    }
}

// ---------------------------------------------------------------------------
// WasmViewportSize
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct WasmViewportSize {
    inner: ViewportSize,
}

#[wasm_bindgen]
impl WasmViewportSize {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> f64 {
        self.inner.width
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> f64 {
        self.inner.height
    }
}

// ---------------------------------------------------------------------------
// WasmViewport
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct WasmViewport {
    inner: Viewport,
}

#[wasm_bindgen]
impl WasmViewport {
    #[wasm_bindgen(constructor)]
    pub fn new(pixel_size: u32, zoom: f64, pan_x: f64, pan_y: f64) -> WasmViewport {
        WasmViewport {
            inner: Viewport {
                pixel_size,
                zoom,
                pan_x,
                pan_y,
            },
        }
    }

    pub fn for_canvas(canvas_width: u32, canvas_height: u32) -> WasmViewport {
        WasmViewport {
            inner: Viewport::for_canvas(canvas_width, canvas_height),
        }
    }

    #[wasm_bindgen(getter)]
    pub fn pixel_size(&self) -> u32 {
        self.inner.pixel_size
    }

    #[wasm_bindgen(getter)]
    pub fn zoom(&self) -> f64 {
        self.inner.zoom
    }

    #[wasm_bindgen(getter)]
    pub fn pan_x(&self) -> f64 {
        self.inner.pan_x
    }

    #[wasm_bindgen(getter)]
    pub fn pan_y(&self) -> f64 {
        self.inner.pan_y
    }

    pub fn effective_pixel_size(&self) -> f64 {
        self.inner.effective_pixel_size()
    }

    pub fn screen_to_canvas(&self, screen_x: f64, screen_y: f64) -> WasmScreenCanvasCoords {
        WasmScreenCanvasCoords {
            inner: self.inner.screen_to_canvas(screen_x, screen_y),
        }
    }

    pub fn display_size(&self, canvas_width: u32, canvas_height: u32) -> WasmViewportSize {
        WasmViewportSize {
            inner: self.inner.display_size(canvas_width, canvas_height),
        }
    }

    pub fn zoom_at_point(&self, screen_x: f64, screen_y: f64, new_zoom: f64) -> WasmViewport {
        WasmViewport {
            inner: self.inner.zoom_at_point(screen_x, screen_y, new_zoom),
        }
    }

    pub fn pan(&self, delta_x: f64, delta_y: f64) -> WasmViewport {
        WasmViewport {
            inner: self.inner.pan(delta_x, delta_y),
        }
    }

    pub fn clamp_pan(
        &self,
        canvas_width: u32,
        canvas_height: u32,
        viewport_width: f64,
        viewport_height: f64,
    ) -> WasmViewport {
        let vs = ViewportSize {
            width: viewport_width,
            height: viewport_height,
        };
        WasmViewport {
            inner: self.inner.clamp_pan(canvas_width, canvas_height, vs),
        }
    }

    pub fn fit_to_viewport(
        &self,
        canvas_width: u32,
        canvas_height: u32,
        viewport_width: f64,
        viewport_height: f64,
        max_zoom: f64,
    ) -> WasmViewport {
        let vs = ViewportSize {
            width: viewport_width,
            height: viewport_height,
        };
        WasmViewport {
            inner: self
                .inner
                .fit_to_viewport(canvas_width, canvas_height, vs, max_zoom),
        }
    }

    // --- Static zoom utilities ---

    pub fn default_pixel_size(canvas_width: u32, canvas_height: u32) -> u32 {
        Viewport::default_pixel_size(canvas_width, canvas_height)
    }

    pub fn clamp_zoom(zoom: f64) -> f64 {
        Viewport::clamp_zoom(zoom)
    }

    pub fn compute_pinch_zoom(current_zoom: f64, delta_y: f64) -> f64 {
        Viewport::compute_pinch_zoom(current_zoom, delta_y)
    }

    pub fn next_zoom_level(current_zoom: f64) -> f64 {
        Viewport::next_zoom_level(current_zoom)
    }

    pub fn prev_zoom_level(current_zoom: f64) -> f64 {
        Viewport::prev_zoom_level(current_zoom)
    }

    // --- Constants as static methods ---

    pub fn zoom_levels() -> Vec<f64> {
        Viewport::ZOOM_LEVELS.to_vec()
    }

    pub fn min_zoom() -> f64 {
        Viewport::MIN_ZOOM
    }

    pub fn max_zoom() -> f64 {
        Viewport::MAX_ZOOM
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    // -- WasmDocument --

    #[test]
    fn wasm_document_new_round_trips_dimensions_and_active_id() {
        let id = Uuid::new_v4();
        let doc = WasmDocument::new(8, 16, id.to_string(), "Layer 1".to_string()).unwrap();

        assert_eq!(doc.width(), 8);
        assert_eq!(doc.height(), 16);
        assert_eq!(doc.active_layer_id(), id.to_string());
        assert_eq!(doc.next_layer_number(), 2);
        assert_eq!(doc.layer_count(), 1);
    }

    #[test]
    fn wasm_document_set_pixel_on_active_layer_shows_in_composite() {
        let id = Uuid::new_v4();
        let mut doc = WasmDocument::new(2, 2, id.to_string(), "L1".into()).unwrap();
        let red = WasmColor::new(255, 0, 0, 255);

        doc.set_pixel(1, 0, &red).unwrap();

        // Pixel (1, 0) starts at byte offset (0 * 2 + 1) * 4 = 4.
        let buf = doc.composite();
        assert_eq!(&buf[4..8], &[255, 0, 0, 255]);
    }

    #[test]
    fn wasm_document_composite_of_new_doc_is_all_zero_rgba() {
        let id = Uuid::new_v4();
        let doc = WasmDocument::new(3, 5, id.to_string(), "L1".into()).unwrap();

        let buf = doc.composite();
        assert_eq!(buf.len(), 3 * 5 * 4);
        assert!(buf.iter().all(|&b| b == 0));
    }

    #[test]
    fn wasm_document_remove_layer_decrements_count_and_relocates_active() {
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let mut doc = WasmDocument::new(4, 4, first.to_string(), "A".into()).unwrap();
        doc.add_layer(second.to_string(), "B".into()).unwrap(); // active=B

        doc.remove_layer(second.to_string()).unwrap();

        assert_eq!(doc.layer_count(), 1);
        assert_eq!(doc.active_layer_id(), first.to_string());
    }

    #[test]
    fn wasm_document_add_layer_advances_count_counter_and_active_id() {
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let mut doc = WasmDocument::new(4, 4, first.to_string(), "Layer 1".into()).unwrap();

        doc.add_layer(second.to_string(), "Layer 2".into()).unwrap();

        assert_eq!(doc.layer_count(), 2);
        assert_eq!(doc.next_layer_number(), 3);
        assert_eq!(doc.active_layer_id(), second.to_string());
    }

    // -- WasmDocumentBuilder --

    #[test]
    fn wasm_document_builder_assembles_multi_layer_document() {
        let bottom = Uuid::new_v4();
        let top = Uuid::new_v4();
        let mut builder = WasmDocumentBuilder::new(2, 2);

        // Layer A: solid red, visible, full opacity.
        let red_pixels: Vec<u8> = std::iter::repeat_n([255u8, 0, 0, 255], 4).flatten().collect();
        builder
            .add_layer(bottom.to_string(), "Bottom".into(), red_pixels, true, 1.0)
            .unwrap();

        // Layer B: transparent, hidden, half opacity (just to verify per-layer
        // metadata propagation).
        let transparent_pixels = vec![0u8; 16];
        builder
            .add_layer(top.to_string(), "Top".into(), transparent_pixels, false, 0.5)
            .unwrap();

        let doc = builder.build(top.to_string(), 7, true).unwrap();

        assert_eq!(doc.width(), 2);
        assert_eq!(doc.height(), 2);
        assert_eq!(doc.layer_count(), 2);
        assert_eq!(doc.layer_id_at(0), Some(bottom.to_string()));
        assert_eq!(doc.layer_id_at(1), Some(top.to_string()));
        assert_eq!(doc.layer_name_at(0), Some("Bottom".into()));
        assert_eq!(doc.layer_visible_at(1), Some(false));
        assert_eq!(doc.layer_opacity_at(1), Some(0.5));
        assert_eq!(doc.active_layer_id(), top.to_string());
        assert_eq!(doc.next_layer_number(), 7);
        assert!(doc.is_timeline_panel_collapsed());
    }

    // -- WasmDocument tool surface --

    #[test]
    fn wasm_document_apply_tool_writes_only_to_active_layer() {
        let bottom = Uuid::new_v4();
        let top = Uuid::new_v4();
        let mut doc = WasmDocument::new(2, 2, bottom.to_string(), "A".into()).unwrap();
        doc.add_layer(top.to_string(), "B".into()).unwrap(); // active = top

        let red = WasmColor::new(255, 0, 0, 255);
        let drew = doc.apply_tool(0, 0, WasmToolType::Pencil, &red);

        assert!(drew);
        assert_eq!(doc.layer_pixels_at(0).unwrap()[..4], [0, 0, 0, 0]);
        assert_eq!(doc.layer_pixels_at(1).unwrap()[..4], [255, 0, 0, 255]);
    }

    #[test]
    fn wasm_document_flood_fill_writes_only_to_active_layer() {
        let bottom = Uuid::new_v4();
        let top = Uuid::new_v4();
        let mut doc = WasmDocument::new(2, 2, bottom.to_string(), "A".into()).unwrap();
        doc.add_layer(top.to_string(), "B".into()).unwrap();

        let blue = WasmColor::new(0, 0, 255, 255);
        let painted = doc.flood_fill(0, 0, &blue);

        assert!(painted);
        let top_pixels = doc.layer_pixels_at(1).unwrap();
        for chunk in top_pixels.chunks_exact(4) {
            assert_eq!(chunk, [0, 0, 255, 255]);
        }
        // Bottom is still all-transparent.
        assert!(doc.layer_pixels_at(0).unwrap().iter().all(|&b| b == 0));
    }

    #[test]
    fn wasm_document_clear_resets_only_active_layer_to_transparent() {
        let bottom = Uuid::new_v4();
        let top = Uuid::new_v4();
        let mut doc = WasmDocument::new(2, 2, bottom.to_string(), "A".into()).unwrap();
        // Paint bottom red via direct set_pixel through set_active_layer trick.
        let red = WasmColor::new(255, 0, 0, 255);
        for y in 0..2 {
            for x in 0..2 {
                doc.set_pixel(x, y, &red).unwrap();
            }
        }
        doc.add_layer(top.to_string(), "B".into()).unwrap(); // active=top
        let green = WasmColor::new(0, 255, 0, 255);
        for y in 0..2 {
            for x in 0..2 {
                doc.set_pixel(x, y, &green).unwrap();
            }
        }

        doc.clear();

        // Active (top) is now transparent.
        assert!(doc.layer_pixels_at(1).unwrap().iter().all(|&b| b == 0));
        // Bottom is still red.
        for chunk in doc.layer_pixels_at(0).unwrap().chunks_exact(4) {
            assert_eq!(chunk, [255, 0, 0, 255]);
        }
    }

    // -- WasmHistoryManager Document path --

    #[test]
    fn wasm_history_manager_push_then_undo_document_round_trip() {
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let mut doc = WasmDocument::new(2, 2, first.to_string(), "A".into()).unwrap();
        let mut history = WasmHistoryManager::default_manager();

        history.push_document(&doc);
        doc.add_layer(second.to_string(), "B".into()).unwrap(); // mutate

        let restored = history.undo_document(&doc).expect("undo should yield prior doc");
        assert_eq!(restored.layer_count(), 1);
        assert_eq!(restored.active_layer_id(), first.to_string());
        assert_eq!(restored.next_layer_number(), 2);
    }

    #[test]
    fn wasm_history_manager_redo_document_reapplies_post_undo_state() {
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let mut doc = WasmDocument::new(2, 2, first.to_string(), "A".into()).unwrap();
        let mut history = WasmHistoryManager::default_manager();

        history.push_document(&doc);
        doc.add_layer(second.to_string(), "B".into()).unwrap();

        let restored = history.undo_document(&doc).unwrap();
        let redone = history.redo_document(&restored).unwrap();

        assert_eq!(redone.layer_count(), 2);
        assert_eq!(redone.active_layer_id(), second.to_string());
    }

    // Note: JsError-returning paths (e.g., invalid UUID, oversize dimensions)
    // panic under `cargo test` because `JsError::new` is only callable on
    // wasm targets. They're verified end-to-end in TS via wasm-pack output;
    // a wasm-bindgen-test rig can be added if a regression class warrants it.
}
