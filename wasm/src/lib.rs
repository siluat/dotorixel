use uuid::Uuid;
use wasm_bindgen::prelude::*;

use dotorixel_core::canvas::{CanvasRect, PixelCanvas, ResizeAnchor};
use dotorixel_core::color::Color;
use dotorixel_core::document::Document;
use dotorixel_core::export::{PngExport, SvgExport};
use dotorixel_core::history::DocumentHistory;
use dotorixel_core::layer::{Layer, LayerKind, LayerKindTag, ReferenceData};
use dotorixel_core::pixel_perfect::{Action, FilterResult, TailState, pixel_perfect_filter};
use dotorixel_core::reference_placement::ReferencePlacement;
use dotorixel_core::selection::{MarqueeRegion, SelectionClipboard};
use dotorixel_core::tool::{ToolType, ellipse_outline, interpolate_pixels, rectangle_outline};
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
// WasmReferencePlacement
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct WasmReferencePlacement {
    inner: ReferencePlacement,
}

#[wasm_bindgen]
impl WasmReferencePlacement {
    #[wasm_bindgen(getter)]
    pub fn x(&self) -> f32 {
        self.inner.x()
    }

    #[wasm_bindgen(getter)]
    pub fn y(&self) -> f32 {
        self.inner.y()
    }

    #[wasm_bindgen(getter)]
    pub fn scale(&self) -> f32 {
        self.inner.scale()
    }

    /// Number of 90° clockwise turns applied to the source image, in `0..=3`.
    #[wasm_bindgen(getter)]
    pub fn rotation(&self) -> u8 {
        self.inner.rotation()
    }

    pub fn fit_to_canvas(
        canvas_width: u32,
        canvas_height: u32,
        natural_width: u32,
        natural_height: u32,
    ) -> WasmReferencePlacement {
        ReferencePlacement::fit_to_canvas(
            canvas_width,
            canvas_height,
            natural_width,
            natural_height,
        )
        .into()
    }
}

impl From<ReferencePlacement> for WasmReferencePlacement {
    fn from(inner: ReferencePlacement) -> Self {
        Self { inner }
    }
}

// ---------------------------------------------------------------------------
// WasmSelectionClipboard
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct WasmSelectionClipboard {
    inner: SelectionClipboard,
}

#[wasm_bindgen]
impl WasmSelectionClipboard {
    #[wasm_bindgen(constructor)]
    pub fn new(pixels: &[u8], width: u32, height: u32) -> Result<WasmSelectionClipboard, JsError> {
        let expected = (width as usize)
            .checked_mul(height as usize)
            .and_then(|pixel_count| pixel_count.checked_mul(4))
            .ok_or_else(|| JsError::new("Selection Clipboard dimensions are too large"))?;
        if pixels.len() != expected {
            return Err(JsError::new(&format!(
                "Selection Clipboard pixels must be {expected} bytes (width × height × 4); got {}",
                pixels.len()
            )));
        }

        Ok(WasmSelectionClipboard {
            inner: SelectionClipboard {
                pixels: pixels.to_vec(),
                width,
                height,
            },
        })
    }

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
// WasmMarqueeRegion
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct WasmMarqueeRegion {
    inner: MarqueeRegion,
}

impl From<MarqueeRegion> for WasmMarqueeRegion {
    fn from(inner: MarqueeRegion) -> Self {
        Self { inner }
    }
}

#[wasm_bindgen]
impl WasmMarqueeRegion {
    pub fn from_drag(x0: i32, y0: i32, x1: i32, y1: i32) -> WasmMarqueeRegion {
        MarqueeRegion::from_drag(x0, y0, x1, y1).into()
    }

    #[wasm_bindgen(getter)]
    pub fn x(&self) -> i32 {
        self.inner.x()
    }

    #[wasm_bindgen(getter)]
    pub fn y(&self) -> i32 {
        self.inner.y()
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.inner.width()
    }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.inner.height()
    }

    pub fn contains(&self, x: i32, y: i32) -> bool {
        self.inner.contains(x, y)
    }

    pub fn translate(&self, dx: i32, dy: i32) -> WasmMarqueeRegion {
        self.inner.translate(dx, dy).into()
    }

    pub fn clip_to(&self, canvas_w: u32, canvas_h: u32) -> Option<WasmMarqueeRegion> {
        self.inner.clip_to(canvas_w, canvas_h).map(Into::into)
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

    pub fn from_pixels(width: u32, height: u32, pixels: &[u8]) -> Result<WasmPixelCanvas, JsError> {
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
// WasmLayerMetadata
// ---------------------------------------------------------------------------

/// One layer's metadata, read in a single crossing via
/// [`WasmDocument::layers_metadata`]. Every layer carries the common fields;
/// Reference Layers additionally expose their immutable source fingerprint,
/// natural (pre-placement) dimensions, and current placement. Bulk pixel
/// buffers are intentionally excluded — callers fetch those on demand through
/// [`WasmDocument::layer_pixels_at`] / [`WasmDocument::layer_source_pixels_at`].
#[wasm_bindgen]
pub struct WasmLayerMetadata {
    id: String,
    name: String,
    visible: bool,
    opacity: f32,
    kind: String,
    source_fingerprint: Option<String>,
    natural_width: Option<u32>,
    natural_height: Option<u32>,
    placement: Option<ReferencePlacement>,
}

#[wasm_bindgen]
impl WasmLayerMetadata {
    #[wasm_bindgen(getter)]
    pub fn id(&self) -> String {
        self.id.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn name(&self) -> String {
        self.name.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn visible(&self) -> bool {
        self.visible
    }

    #[wasm_bindgen(getter)]
    pub fn opacity(&self) -> f32 {
        self.opacity
    }

    /// `"pixel"` or `"reference"`.
    #[wasm_bindgen(getter)]
    pub fn kind(&self) -> String {
        self.kind.clone()
    }

    /// Hex source fingerprint for Reference Layers; `None` for Pixel Layers.
    #[wasm_bindgen(getter)]
    pub fn source_fingerprint(&self) -> Option<String> {
        self.source_fingerprint.clone()
    }

    /// Natural (pre-placement) source width for Reference Layers; `None` for
    /// Pixel Layers.
    #[wasm_bindgen(getter)]
    pub fn natural_width(&self) -> Option<u32> {
        self.natural_width
    }

    /// Natural (pre-placement) source height for Reference Layers; `None` for
    /// Pixel Layers.
    #[wasm_bindgen(getter)]
    pub fn natural_height(&self) -> Option<u32> {
        self.natural_height
    }

    /// Current placement for Reference Layers; `None` for Pixel Layers.
    #[wasm_bindgen(getter)]
    pub fn placement(&self) -> Option<WasmReferencePlacement> {
        self.placement.map(Into::into)
    }
}

impl WasmLayerMetadata {
    fn from_layer(layer: &Layer) -> WasmLayerMetadata {
        let (source_fingerprint, natural_width, natural_height, placement) = match &layer.kind {
            LayerKind::Reference(data) => (
                Some(format!("{:016x}", data.source_fingerprint())),
                Some(data.natural_width()),
                Some(data.natural_height()),
                Some(data.placement()),
            ),
            LayerKind::Pixel(_) => (None, None, None, None),
        };
        WasmLayerMetadata {
            id: layer.id.to_string(),
            name: layer.name.clone(),
            visible: layer.visible,
            opacity: layer.opacity,
            kind: match layer.kind.tag() {
                LayerKindTag::Pixel => "pixel".to_string(),
                LayerKindTag::Reference => "reference".to_string(),
            },
            source_fingerprint,
            natural_width,
            natural_height,
            placement,
        }
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

    pub fn marquee(&self) -> Option<WasmMarqueeRegion> {
        self.inner.marquee().map(Into::into)
    }

    pub fn set_marquee(&mut self, region: Option<WasmMarqueeRegion>) {
        self.inner.set_marquee(region.map(|region| region.inner));
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
            return Err(JsError::new(&format!("Layer with id {id} already exists")));
        }
        self.inner.add_layer(id, name);
        Ok(())
    }

    /// Sets the singleton Reference Layer, keeps it bottom-most, and makes it
    /// active. The core computes its initial auto-fit placement.
    pub fn add_reference_layer(
        &mut self,
        new_id: String,
        name: String,
        source_rgba: &[u8],
        source_width: u32,
        source_height: u32,
    ) -> Result<(), JsError> {
        let id = Uuid::parse_str(&new_id).map_err(|e| JsError::new(&e.to_string()))?;
        if self.inner.layers().iter().any(|l| l.id == id) {
            return Err(JsError::new(&format!("Layer with id {id} already exists")));
        }
        self.inner
            .add_reference_layer(id, name, source_rgba.to_vec(), source_width, source_height)
            .map_err(|e| JsError::new(&e.to_string()))
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

    /// RGBA row-major Pixel-only composite buffer (`width * height * 4`
    /// bytes), suitable for `ImageData`.
    pub fn composite(&self) -> Vec<u8> {
        self.inner.composite()
    }

    /// RGBA row-major composite buffer that excludes Reference Layers,
    /// suitable for export and saved-work thumbnails.
    pub fn composite_for_export(&self) -> Vec<u8> {
        self.inner.composite_for_export()
    }

    /// Reads the pixel color at `(x, y)` on the active layer.
    ///
    /// Returns `Err(JsError)` when `(x, y)` is outside the document's
    /// `width × height` (out-of-bounds reads do not throw silently).
    pub fn get_pixel(&self, x: u32, y: u32) -> Result<WasmColor, JsError> {
        self.inner
            .get_pixel(x, y)
            .map(|c| WasmColor { inner: c })
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Reads the active layer at `(x, y)`, returning `None` when no pixel is
    /// available (out of document bounds, or outside a Reference Layer's
    /// projected source footprint).
    pub fn try_get_pixel(&self, x: u32, y: u32) -> Option<WasmColor> {
        self.inner
            .try_get_pixel(x, y)
            .map(|inner| WasmColor { inner })
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

    pub fn set_timeline_panel_collapsed(&mut self, collapsed: bool) {
        self.inner.set_timeline_panel_collapsed(collapsed);
    }

    /// Sets the active layer by id. Errors when no layer with `id` exists; in
    /// that case the previous active layer is preserved.
    pub fn set_active_layer(&mut self, id: String) -> Result<(), JsError> {
        let layer_id = Uuid::parse_str(&id).map_err(|e| JsError::new(&e.to_string()))?;
        self.inner
            .set_active_layer(layer_id)
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Moves a Pixel Layer with `id` to `new_index`. `new_index` is silently
    /// clamped to `[0, layer_count - 1]` and never below a Reference Layer.
    /// Reference reorder attempts are no-ops. The active layer pointer is
    /// preserved across reordering (tracked by id, not by index).
    pub fn reorder_layer(&mut self, id: String, new_index: usize) -> Result<(), JsError> {
        let layer_id = Uuid::parse_str(&id).map_err(|e| JsError::new(&e.to_string()))?;
        self.inner
            .reorder_layer(layer_id, new_index)
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Sets the visibility flag of the layer with `id`. Errors when no layer
    /// with `id` exists; the previous visibility is preserved on error.
    pub fn set_layer_visibility(&mut self, id: String, visible: bool) -> Result<(), JsError> {
        let layer_id = Uuid::parse_str(&id).map_err(|e| JsError::new(&e.to_string()))?;
        self.inner
            .set_layer_visibility(layer_id, visible)
            .map_err(|e| JsError::new(&e.to_string()))
    }

    /// Updates the placement of the Reference Layer with `id`.
    ///
    /// Errors when `id` is not a valid UUID string, when the placement is
    /// invalid (`x`/`y` non-finite, or `scale` non-finite or ≤ 0), or when
    /// no Reference Layer with `id` exists.
    pub fn set_reference_placement(
        &mut self,
        id: String,
        x: f32,
        y: f32,
        scale: f32,
    ) -> Result<(), JsError> {
        let layer_id = Uuid::parse_str(&id).map_err(|e| JsError::new(&e.to_string()))?;
        let placement =
            ReferencePlacement::new(x, y, scale).map_err(|e| JsError::new(&e.to_string()))?;
        self.inner
            .set_reference_placement(layer_id, placement)
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

    /// Returns every layer's metadata in stack order (`index = 0` is the
    /// bottom-most layer) in a single crossing. Reference-only fields are
    /// populated only for Reference Layers. Bulk pixel buffers are excluded —
    /// fetch them on demand via [`Self::layer_pixels_at`] /
    /// [`Self::layer_source_pixels_at`].
    pub fn layers_metadata(&self) -> Vec<WasmLayerMetadata> {
        self.inner
            .layers()
            .iter()
            .map(WasmLayerMetadata::from_layer)
            .collect()
    }

    /// Returns a copy of the RGBA pixel buffer of the layer at `index`, or
    /// `None` when `index` is out of range.
    pub fn layer_pixels_at(&self, index: usize) -> Option<Vec<u8>> {
        self.inner.layer_pixels_at(index).map(|p| p.to_vec())
    }

    /// Returns a copy of a Reference Layer's source RGBA buffer, or `None`
    /// when `index` is out of range or points at a Pixel Layer.
    pub fn layer_source_pixels_at(&self, index: usize) -> Option<Vec<u8>> {
        self.inner.layer_source_pixels_at(index).map(|p| p.to_vec())
    }

    /// Overwrites the active layer's pixel buffer with `data`. Used by tools
    /// that take a stroke-start snapshot and restore it during preview (shape
    /// tools, move tool). Other layers are unaffected. Fails when `data.len()`
    /// is not exactly `width * height * 4`.
    pub fn restore_active_layer_pixels(&mut self, data: &[u8]) -> Result<(), JsError> {
        self.inner
            .restore_active_layer_pixels(data)
            .map_err(|e| JsError::new(&e.to_string()))
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

    /// 4-connected flood fill on the active layer, constrained to `bounds`.
    /// Negative coordinates short-circuit to `false`.
    pub fn flood_fill_bounded(
        &mut self,
        x: i32,
        y: i32,
        color: &WasmColor,
        bounds: &WasmMarqueeRegion,
    ) -> bool {
        if x < 0 || y < 0 {
            return false;
        }
        self.inner
            .flood_fill_bounded(x as u32, y as u32, color.inner, bounds.inner)
    }

    /// Clears the active layer to fully transparent. Other layers are
    /// unaffected.
    pub fn clear(&mut self) {
        self.inner.clear();
    }

    /// Copies the current Marquee region from the active Pixel Layer as a
    /// row-major RGBA buffer. Returns an empty buffer when no Marquee exists
    /// or when the active layer is a Reference Layer.
    pub fn lift_marquee_pixels(&self) -> Vec<u8> {
        self.inner.lift_marquee_pixels()
    }

    /// Clears pixels inside the current Marquee on the active Pixel Layer.
    /// The Marquee itself is preserved.
    pub fn clear_marquee_pixels(&mut self) {
        self.inner.clear_marquee_pixels();
    }

    /// Mirrors the active Pixel Layer horizontally. With a Marquee active, only
    /// the pixels inside it are mirrored (the Marquee position is preserved);
    /// otherwise the whole layer is mirrored. No-op on a Reference Layer.
    pub fn flip_horizontal(&mut self) {
        self.inner.flip_horizontal();
    }

    /// Mirrors the active Pixel Layer vertically. With a Marquee active, only
    /// the pixels inside it are mirrored (the Marquee position is preserved);
    /// otherwise the whole layer is mirrored. No-op on a Reference Layer.
    pub fn flip_vertical(&mut self) {
        self.inner.flip_vertical();
    }

    /// Rotates the active Pixel Layer's Marquee region 90° clockwise. The region's
    /// `W×H` pixels become an `H×W` block re-centered on the region's center and
    /// clipped to the canvas; the Marquee updates to wrap the new region. No-op
    /// without a Marquee or on a Reference Layer.
    pub fn rotate_cw(&mut self) {
        self.inner.rotate_cw();
    }

    /// Rotates the active Pixel Layer's Marquee region 90° counter-clockwise. The
    /// region's `W×H` pixels become an `H×W` block re-centered on the region's
    /// center and clipped to the canvas; the Marquee updates to wrap the new
    /// region. No-op without a Marquee or on a Reference Layer.
    pub fn rotate_ccw(&mut self) {
        self.inner.rotate_ccw();
    }

    /// Source-over composites `buffer` at `region` on the active Pixel Layer.
    ///
    /// Returns `Err(JsError)` when the buffer length does not match
    /// `region.width × region.height × 4`.
    pub fn composite_buffer_at(
        &mut self,
        buffer: &[u8],
        region: &WasmMarqueeRegion,
    ) -> Result<(), JsError> {
        let expected = (region.inner.width() as usize)
            .checked_mul(region.inner.height() as usize)
            .and_then(|pixels| pixels.checked_mul(4))
            .ok_or_else(|| JsError::new("Region buffer dimensions are too large"))?;
        if buffer.len() != expected {
            return Err(JsError::new(&format!(
                "Region buffer length must be {expected} bytes (width × height × 4); got {}",
                buffer.len()
            )));
        }
        self.inner.composite_buffer_at(buffer, region.inner);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// WasmDocumentBuilder
// ---------------------------------------------------------------------------

/// Builder for constructing a [`WasmDocument`] from a pre-existing layer
/// stack with caller-supplied layer ids, names, pixel buffers, visibility,
/// and opacity.
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
            visible,
            opacity,
            kind: LayerKind::Pixel(pixel_canvas),
        });
        Ok(())
    }

    /// Appends an existing Reference Layer to the in-progress stack. This is
    /// used by persistence hydration, where placement and display state must
    /// be restored exactly rather than recomputed through auto-fit. The final
    /// Document build normalizes Reference data to one bottom-most underlay.
    ///
    /// Errors when `id` is not a valid UUID string, when the placement is
    /// invalid (`x`/`y` non-finite, or `scale` non-finite or ≤ 0), or when
    /// the source buffer is inconsistent with the declared dimensions.
    /// `rotation` is the persisted quarter-turn (number of 90° clockwise turns),
    /// normalized into `0..=3`.
    #[allow(clippy::too_many_arguments)]
    pub fn add_reference_layer(
        &mut self,
        id: String,
        name: String,
        source_rgba: Vec<u8>,
        source_width: u32,
        source_height: u32,
        x: f32,
        y: f32,
        scale: f32,
        rotation: u8,
        visible: bool,
        opacity: f32,
    ) -> Result<(), JsError> {
        let layer_id = Uuid::parse_str(&id).map_err(|e| JsError::new(&e.to_string()))?;
        let placement = ReferencePlacement::new(x, y, scale)
            .map_err(|e| JsError::new(&e.to_string()))?
            .with_rotation(rotation);
        let data = ReferenceData::new(source_rgba, source_width, source_height, placement)
            .map_err(|e| JsError::new(&e.to_string()))?;
        self.layers.push(Layer {
            id: layer_id,
            name,
            visible,
            opacity,
            kind: LayerKind::Reference(data),
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

/// Fills all pixels connected to `(x, y)` with the given color using 4-connectivity,
/// constrained to `bounds`.
#[wasm_bindgen]
pub fn wasm_flood_fill_bounded(
    canvas: &mut WasmPixelCanvas,
    x: i32,
    y: i32,
    color: &WasmColor,
    bounds: &WasmMarqueeRegion,
) -> bool {
    if x < 0 || y < 0 {
        return false;
    }
    let Some(bounds) = CanvasRect::new(
        bounds.inner.x(),
        bounds.inner.y(),
        bounds.inner.width(),
        bounds.inner.height(),
    ) else {
        return false;
    };
    canvas
        .inner
        .flood_fill_rect(x as u32, y as u32, color.inner, bounds)
}

// ---------------------------------------------------------------------------
// WasmHistoryManager
// ---------------------------------------------------------------------------

#[wasm_bindgen]
pub struct WasmHistoryManager {
    inner: DocumentHistory,
}

#[wasm_bindgen]
impl WasmHistoryManager {
    #[wasm_bindgen(constructor)]
    pub fn new(max_snapshots: usize) -> WasmHistoryManager {
        WasmHistoryManager {
            inner: DocumentHistory::new(max_snapshots),
        }
    }

    pub fn default_manager() -> WasmHistoryManager {
        WasmHistoryManager {
            inner: DocumentHistory::default(),
        }
    }

    pub fn can_undo(&self) -> bool {
        self.inner.can_undo()
    }

    pub fn can_redo(&self) -> bool {
        self.inner.can_redo()
    }

    pub fn clear(&mut self) {
        self.inner.clear();
    }

    pub fn default_max_snapshots() -> usize {
        DocumentHistory::DEFAULT_MAX_SNAPSHOTS
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
    let point_vec: Vec<(i32, i32)> = points.chunks_exact(2).map(|c| (c[0], c[1])).collect();

    let tail = match prev_tail.len() {
        0 => TailState::Empty,
        2 => TailState::One(prev_tail[0], prev_tail[1]),
        4 => TailState::Two(prev_tail[0], prev_tail[1], prev_tail[2], prev_tail[3]),
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

    pub fn clamp_pan_to_document_bounds(
        &self,
        min_x: f64,
        min_y: f64,
        max_x: f64,
        max_y: f64,
        viewport_width: f64,
        viewport_height: f64,
    ) -> WasmViewport {
        let vs = ViewportSize {
            width: viewport_width,
            height: viewport_height,
        };
        WasmViewport {
            inner: self
                .inner
                .clamp_pan_to_document_bounds(min_x, min_y, max_x, max_y, vs),
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
    fn wasm_document_marquee_round_trips_region() {
        let id = Uuid::new_v4();
        let mut doc = WasmDocument::new(8, 8, id.to_string(), "Layer 1".to_string()).unwrap();
        let region = WasmMarqueeRegion::from_drag(1, 2, 4, 5);

        assert!(doc.marquee().is_none());

        doc.set_marquee(Some(region));
        let read = doc.marquee().expect("marquee exists");
        assert_eq!(read.x(), 1);
        assert_eq!(read.y(), 2);
        assert_eq!(read.width(), 4);
        assert_eq!(read.height(), 4);

        doc.set_marquee(None);
        assert!(doc.marquee().is_none());
    }

    #[test]
    fn wasm_document_region_pixel_methods_round_trip_marquee_pixels() {
        let id = Uuid::new_v4();
        let mut doc = WasmDocument::new(2, 2, id.to_string(), "Layer 1".to_string()).unwrap();
        let red = WasmColor::new(255, 0, 0, 255);
        let blue = WasmColor::new(0, 0, 255, 255);
        let region = WasmMarqueeRegion::from_drag(0, 0, 1, 0);
        doc.set_pixel(0, 0, &red).unwrap();
        doc.set_pixel(1, 0, &blue).unwrap();
        doc.set_marquee(Some(region));

        let lifted = doc.lift_marquee_pixels();
        doc.clear_marquee_pixels();
        let region = WasmMarqueeRegion::from_drag(0, 0, 1, 0);
        doc.composite_buffer_at(&lifted, &region).unwrap();

        assert_eq!(&doc.composite()[0..8], &[255, 0, 0, 255, 0, 0, 255, 255]);
        let marquee = doc.marquee().expect("marquee is preserved");
        assert_eq!(marquee.x(), 0);
        assert_eq!(marquee.width(), 2);
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
    fn wasm_document_get_pixel_reads_active_layer() {
        let id = Uuid::new_v4();
        let mut doc = WasmDocument::new(2, 2, id.to_string(), "L1".into()).unwrap();
        let red = WasmColor::new(255, 0, 0, 255);
        doc.set_pixel(1, 0, &red).unwrap();

        let read = doc.get_pixel(1, 0).unwrap();
        assert_eq!(read.inner, red.inner);
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

    #[test]
    fn wasm_document_layers_metadata_reports_pixel_and_reference_records() {
        let pixel_id = Uuid::new_v4();
        let reference_id = Uuid::new_v4();
        let mut builder = WasmDocumentBuilder::new(8, 8);
        builder
            .add_layer(
                pixel_id.to_string(),
                "Paint".into(),
                vec![0; 8 * 8 * 4],
                true,
                1.0,
            )
            .unwrap();
        builder
            .add_reference_layer(
                reference_id.to_string(),
                "Reference".into(),
                vec![
                    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
                ],
                4,
                1,
                0.5,
                1.0,
                2.0,
                3,
                true,
                0.5,
            )
            .unwrap();
        let document = builder.build(reference_id.to_string(), 3, false).unwrap();

        let metadata = document.layers_metadata();
        assert_eq!(metadata.len(), 2);

        // Reference Layer is normalized bottom-most (stack index 0).
        let reference = &metadata[0];
        assert_eq!(reference.id(), reference_id.to_string());
        assert_eq!(reference.name(), "Reference");
        assert!(reference.visible());
        assert_eq!(reference.opacity(), 0.5);
        assert_eq!(reference.kind(), "reference");
        assert_eq!(reference.natural_width(), Some(4));
        assert_eq!(reference.natural_height(), Some(1));
        assert_eq!(
            reference
                .source_fingerprint()
                .expect("reference fingerprint")
                .len(),
            16
        );
        let placement = reference.placement().expect("reference placement");
        assert_eq!(placement.x(), 0.5);
        assert_eq!(placement.y(), 1.0);
        assert_eq!(placement.scale(), 2.0);
        assert_eq!(placement.rotation(), 3);

        let pixel = &metadata[1];
        assert_eq!(pixel.id(), pixel_id.to_string());
        assert_eq!(pixel.name(), "Paint");
        assert!(pixel.visible());
        assert_eq!(pixel.opacity(), 1.0);
        assert_eq!(pixel.kind(), "pixel");
        assert_eq!(pixel.source_fingerprint(), None);
        assert_eq!(pixel.natural_width(), None);
        assert_eq!(pixel.natural_height(), None);
        assert!(pixel.placement().is_none());
    }

    #[test]
    fn wasm_reference_placement_fit_to_canvas_centers_projected_source() {
        let fitted = WasmReferencePlacement::fit_to_canvas(20, 20, 4, 2);

        assert_eq!(fitted.x(), 0.0);
        assert_eq!(fitted.y(), 5.0);
        assert_eq!(fitted.scale(), 5.0);
    }

    #[test]
    fn wasm_document_add_reference_layer_exposes_reference_metadata() {
        let first = Uuid::new_v4();
        let reference = Uuid::new_v4();
        let mut doc = WasmDocument::new(4, 4, first.to_string(), "Layer 1".into()).unwrap();
        let source_rgba = vec![10, 20, 30, 255, 40, 50, 60, 255];

        doc.add_reference_layer(
            reference.to_string(),
            "Reference".into(),
            &source_rgba,
            2,
            1,
        )
        .unwrap();

        assert_eq!(doc.layer_count(), 2);
        assert_eq!(doc.active_layer_id(), reference.to_string());
        let metadata = doc.layers_metadata();
        assert_eq!(metadata.len(), 2);
        assert_eq!(metadata[0].kind(), "reference");
        assert_eq!(metadata[1].kind(), "pixel");
        assert_eq!(doc.layer_source_pixels_at(0), Some(source_rgba));
        assert_eq!(doc.layer_source_pixels_at(1), None);
        assert_eq!(metadata[0].source_fingerprint().unwrap().len(), 16);
        assert_eq!(metadata[1].source_fingerprint(), None);
        assert_eq!(metadata[0].natural_width(), Some(2));
        assert_eq!(metadata[0].natural_height(), Some(1));

        let placement = metadata[0].placement().unwrap();
        assert_eq!(placement.x(), 1.0);
        assert_eq!(placement.y(), 1.5);
        assert_eq!(placement.scale(), 1.0);
    }

    #[test]
    fn wasm_document_reference_layer_smoke_tests_sampling_and_export_composite() {
        let first = Uuid::new_v4();
        let reference = Uuid::new_v4();
        let mut doc = WasmDocument::new(2, 2, first.to_string(), "Layer 1".into()).unwrap();
        let red = WasmColor::new(255, 0, 0, 255);
        doc.set_pixel(0, 0, &red).unwrap();

        doc.add_reference_layer(
            reference.to_string(),
            "Reference".into(),
            &[0, 255, 0, 255],
            1,
            1,
        )
        .unwrap();
        doc.set_reference_placement(reference.to_string(), 0.0, 0.0, 1.0)
            .unwrap();

        let sampled = doc
            .try_get_pixel(0, 0)
            .expect("reference footprint covers 0,0");
        assert_eq!(sampled.inner, Color::new(0, 255, 0, 255));
        assert!(doc.try_get_pixel(1, 1).is_none());
        assert_eq!(&doc.composite()[..4], &[255, 0, 0, 255]);
        assert_eq!(&doc.composite_for_export()[..4], &[255, 0, 0, 255]);

        doc.set_active_layer(first.to_string()).unwrap();
        let pixel_sampled = doc.try_get_pixel(0, 0).expect("Pixel Layer contains 0,0");
        assert_eq!(pixel_sampled.inner, Color::new(255, 0, 0, 255));

        doc.set_active_layer(reference.to_string()).unwrap();
        doc.set_reference_placement(reference.to_string(), 1.0, 0.0, 1.0)
            .unwrap();
        let placement = doc.layers_metadata()[0].placement().unwrap();
        assert_eq!(placement.x(), 1.0);
        assert!(doc.try_get_pixel(0, 0).is_none());
        assert_eq!(
            doc.try_get_pixel(1, 0).unwrap().inner,
            Color::new(0, 255, 0, 255)
        );
    }

    // -- WasmDocumentBuilder --

    #[test]
    fn wasm_document_builder_assembles_multi_layer_document() {
        let bottom = Uuid::new_v4();
        let top = Uuid::new_v4();
        let mut builder = WasmDocumentBuilder::new(2, 2);

        // Layer A: solid red, visible, full opacity.
        let red_pixels: Vec<u8> = std::iter::repeat_n([255u8, 0, 0, 255], 4)
            .flatten()
            .collect();
        builder
            .add_layer(bottom.to_string(), "Bottom".into(), red_pixels, true, 1.0)
            .unwrap();

        // Layer B: transparent, hidden, half opacity (just to verify per-layer
        // metadata propagation).
        let transparent_pixels = vec![0u8; 16];
        builder
            .add_layer(
                top.to_string(),
                "Top".into(),
                transparent_pixels,
                false,
                0.5,
            )
            .unwrap();

        let doc = builder.build(top.to_string(), 7, true).unwrap();

        assert_eq!(doc.width(), 2);
        assert_eq!(doc.height(), 2);
        assert_eq!(doc.layer_count(), 2);
        let metadata = doc.layers_metadata();
        assert_eq!(metadata[0].id(), bottom.to_string());
        assert_eq!(metadata[1].id(), top.to_string());
        assert_eq!(metadata[0].name(), "Bottom");
        assert!(!metadata[1].visible());
        assert_eq!(metadata[1].opacity(), 0.5);
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

        let restored = history
            .undo_document(&doc)
            .expect("undo should yield prior doc");
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
