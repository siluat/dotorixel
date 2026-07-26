use std::sync::{Arc, Mutex};

use dotorixel_core::canvas::PixelCanvas;
use dotorixel_core::export::PngExport;
use dotorixel_core::history::DocumentHistory;
use dotorixel_core::pixel_perfect::{FilterResult, TailState, pixel_perfect_filter};
use dotorixel_core::tool::{ellipse_outline, interpolate_pixels, rectangle_outline};
use dotorixel_core::viewport::{ScreenCanvasCoords, Viewport, ViewportSize};
use dotorixel_core::{Document, ResizeAnchor};
use uuid::Uuid;

// Re-export core types used directly in the UniFFI interface.
// UniFFI discovers these via their cfg_attr derives in dotorixel-core.
use dotorixel_core::color::Color;
use dotorixel_core::layer::LayerKindTag;
use dotorixel_core::tool::ToolType;

uniffi::setup_scaffolding!();
dotorixel_core::uniffi_reexport_scaffolding!();

// ---------------------------------------------------------------------------
// AppleError
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error, uniffi::Error)]
#[uniffi(flat_error)]
pub enum AppleError {
    #[error("{message}")]
    Canvas { message: String },
    #[error("{message}")]
    Color { message: String },
    #[error("{message}")]
    Export { message: String },
    #[error("{message}")]
    Document { message: String },
}

impl From<dotorixel_core::PixelCanvasError> for AppleError {
    fn from(e: dotorixel_core::PixelCanvasError) -> Self {
        Self::Canvas {
            message: e.to_string(),
        }
    }
}

impl From<dotorixel_core::ColorParseError> for AppleError {
    fn from(e: dotorixel_core::ColorParseError) -> Self {
        Self::Color {
            message: e.to_string(),
        }
    }
}

impl From<dotorixel_core::export::ExportError> for AppleError {
    fn from(e: dotorixel_core::export::ExportError) -> Self {
        Self::Export {
            message: e.to_string(),
        }
    }
}

impl From<dotorixel_core::DrawError> for AppleError {
    fn from(e: dotorixel_core::DrawError) -> Self {
        Self::Document {
            message: e.to_string(),
        }
    }
}

impl From<dotorixel_core::LayerError> for AppleError {
    fn from(e: dotorixel_core::LayerError) -> Self {
        Self::Document {
            message: e.to_string(),
        }
    }
}

// ---------------------------------------------------------------------------
// Free functions
// ---------------------------------------------------------------------------

#[uniffi::export]
fn core_version() -> String {
    dotorixel_core::core_version().to_string()
}

/// Returns interpolated pixel coordinates along a line between two points.
/// Wraps the core `interpolate_pixels` which returns `Vec<(i32, i32)>` —
/// converted to `Vec<ScreenCanvasCoords>` because UniFFI does not support tuples.
#[uniffi::export]
fn apple_interpolate_pixels(x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<ScreenCanvasCoords> {
    interpolate_pixels(x0, y0, x1, y1)
        .into_iter()
        .map(|(x, y)| ScreenCanvasCoords::new(x, y))
        .collect()
}

/// Returns the pixel outline of a rectangle spanning two opposite corners.
/// Wraps the core `rectangle_outline` which returns `Vec<(i32, i32)>` —
/// converted to `Vec<ScreenCanvasCoords>` because UniFFI does not support tuples.
#[uniffi::export]
fn apple_rectangle_outline(x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<ScreenCanvasCoords> {
    rectangle_outline(x0, y0, x1, y1)
        .into_iter()
        .map(|(x, y)| ScreenCanvasCoords::new(x, y))
        .collect()
}

/// Returns the pixel outline of an ellipse inscribed in the bounding box
/// spanning two opposite corners. Wraps the core `ellipse_outline` which
/// returns `Vec<(i32, i32)>` — converted to `Vec<ScreenCanvasCoords>` because
/// UniFFI does not support tuples.
#[uniffi::export]
fn apple_ellipse_outline(x0: i32, y0: i32, x1: i32, y1: i32) -> Vec<ScreenCanvasCoords> {
    ellipse_outline(x0, y0, x1, y1)
        .into_iter()
        .map(|(x, y)| ScreenCanvasCoords::new(x, y))
        .collect()
}

/// Apply the pixel-perfect L-corner filter. Wraps core `pixel_perfect_filter`
/// with `ScreenCanvasCoords` inputs because UniFFI does not support tuples.
#[uniffi::export]
fn apple_pixel_perfect_filter(
    points: Vec<ScreenCanvasCoords>,
    prev_tail: TailState,
) -> FilterResult {
    let tuples: Vec<(i32, i32)> = points.into_iter().map(|p| (p.x, p.y)).collect();
    pixel_perfect_filter(&tuples, prev_tail)
}

// --- Canvas constants ---

#[uniffi::export]
fn canvas_min_dimension() -> u32 {
    PixelCanvas::MIN_DIMENSION
}

#[uniffi::export]
fn canvas_max_dimension() -> u32 {
    PixelCanvas::MAX_DIMENSION
}

#[uniffi::export]
fn canvas_presets() -> Vec<u32> {
    PixelCanvas::PRESETS.to_vec()
}

#[uniffi::export]
fn canvas_is_valid_dimension(value: u32) -> bool {
    PixelCanvas::is_valid_dimension(value)
}

// --- Viewport static utilities ---

#[uniffi::export]
fn viewport_default_pixel_size(canvas_width: u32, canvas_height: u32) -> u32 {
    Viewport::default_pixel_size(canvas_width, canvas_height)
}

#[uniffi::export]
fn viewport_clamp_zoom(zoom: f64) -> f64 {
    Viewport::clamp_zoom(zoom)
}

#[uniffi::export]
fn viewport_compute_pinch_zoom(current_zoom: f64, delta_y: f64) -> f64 {
    Viewport::compute_pinch_zoom(current_zoom, delta_y)
}

#[uniffi::export]
fn viewport_next_zoom_level(current_zoom: f64) -> f64 {
    Viewport::next_zoom_level(current_zoom)
}

#[uniffi::export]
fn viewport_prev_zoom_level(current_zoom: f64) -> f64 {
    Viewport::prev_zoom_level(current_zoom)
}

#[uniffi::export]
fn viewport_zoom_levels() -> Vec<f64> {
    Viewport::ZOOM_LEVELS.to_vec()
}

#[uniffi::export]
fn viewport_min_zoom() -> f64 {
    Viewport::MIN_ZOOM
}

#[uniffi::export]
fn viewport_max_zoom() -> f64 {
    Viewport::MAX_ZOOM
}

// ---------------------------------------------------------------------------
// ApplePixelCanvas
// ---------------------------------------------------------------------------

/// Pixel canvas wrapper with interior mutability for thread-safe FFI access.
/// See `docs/decisions/uniffi-mutex-interior-mutability.ko.md` for the design rationale.
#[derive(uniffi::Object)]
pub struct ApplePixelCanvas {
    inner: Mutex<PixelCanvas>,
}

#[uniffi::export]
impl ApplePixelCanvas {
    #[uniffi::constructor]
    fn new(width: u32, height: u32) -> Result<Arc<Self>, AppleError> {
        let canvas = PixelCanvas::new(width, height)?;
        Ok(Arc::new(Self {
            inner: Mutex::new(canvas),
        }))
    }

    #[uniffi::constructor]
    fn with_color(width: u32, height: u32, color: Color) -> Result<Arc<Self>, AppleError> {
        let canvas = PixelCanvas::with_color(width, height, color)?;
        Ok(Arc::new(Self {
            inner: Mutex::new(canvas),
        }))
    }

    fn width(&self) -> u32 {
        self.inner.lock().unwrap().width()
    }

    fn height(&self) -> u32 {
        self.inner.lock().unwrap().height()
    }

    fn pixels(&self) -> Vec<u8> {
        self.inner.lock().unwrap().pixels().to_vec()
    }

    fn get_pixel(&self, x: u32, y: u32) -> Result<Color, AppleError> {
        Ok(self.inner.lock().unwrap().get_pixel(x, y)?)
    }

    fn set_pixel(&self, x: u32, y: u32, color: Color) -> Result<(), AppleError> {
        Ok(self.inner.lock().unwrap().set_pixel(x, y, color)?)
    }

    fn is_inside_bounds(&self, x: u32, y: u32) -> bool {
        self.inner.lock().unwrap().is_inside_bounds(x, y)
    }

    fn restore_pixels(&self, data: Vec<u8>) -> Result<(), AppleError> {
        Ok(self.inner.lock().unwrap().restore_pixels(&data)?)
    }

    fn clear(&self) {
        self.inner.lock().unwrap().clear();
    }

    fn resize(&self, new_width: u32, new_height: u32) -> Result<Arc<ApplePixelCanvas>, AppleError> {
        let canvas = self.inner.lock().unwrap().resize(new_width, new_height)?;
        Ok(Arc::new(ApplePixelCanvas {
            inner: Mutex::new(canvas),
        }))
    }

    fn encode_png(&self) -> Result<Vec<u8>, AppleError> {
        Ok(self.inner.lock().unwrap().encode_png()?)
    }

    fn apply_tool(&self, x: i32, y: i32, tool: ToolType, foreground_color: Color) -> bool {
        tool.apply(&mut self.inner.lock().unwrap(), x, y, foreground_color)
    }

    /// 4-connected flood fill starting at `(x, y)`. Returns `true` when at
    /// least one pixel was changed. Negative coordinates short-circuit to
    /// `false`, mirroring the wasm binding's contract.
    fn flood_fill(&self, x: i32, y: i32, fill_color: Color) -> bool {
        if x < 0 || y < 0 {
            return false;
        }
        self.inner
            .lock()
            .unwrap()
            .flood_fill(x as u32, y as u32, fill_color)
    }
}

// ---------------------------------------------------------------------------
// AppleDocument
// ---------------------------------------------------------------------------

/// One layer's shell-facing metadata, read in stack order via
/// [`AppleDocument::layers`] — the id crosses the boundary as a lowercase
/// UUID string (UniFFI has no UUID type).
#[derive(uniffi::Record)]
pub struct AppleLayerMetadata {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub kind: LayerKindTag,
}

fn parse_layer_id(id: &str) -> Result<Uuid, AppleError> {
    Uuid::parse_str(id).map_err(|e| AppleError::Document {
        message: format!("Invalid layer id {id:?}: {e}"),
    })
}

/// Document wrapper with interior mutability for thread-safe FFI access.
/// See `docs/decisions/uniffi-mutex-interior-mutability.ko.md` for the design rationale.
#[derive(uniffi::Object)]
pub struct AppleDocument {
    inner: Mutex<Document>,
}

#[uniffi::export]
impl AppleDocument {
    /// Creates a document of `width × height` with one initial transparent
    /// layer keyed by `first_layer_id`. Errors when `first_layer_id` is not a
    /// valid UUID string or when the dimensions fall outside the core's
    /// supported range.
    #[uniffi::constructor]
    fn new(
        width: u32,
        height: u32,
        first_layer_id: String,
        first_layer_name: String,
    ) -> Result<Arc<Self>, AppleError> {
        let id = parse_layer_id(&first_layer_id)?;
        let document = Document::new(width, height, id, first_layer_name)?;
        Ok(Arc::new(Self {
            inner: Mutex::new(document),
        }))
    }

    fn width(&self) -> u32 {
        self.inner.lock().unwrap().width()
    }

    fn height(&self) -> u32 {
        self.inner.lock().unwrap().height()
    }

    /// The layer stack in stack order — the first element is the bottom of
    /// the visible stack, the last element is the top.
    fn layers(&self) -> Vec<AppleLayerMetadata> {
        self.inner
            .lock()
            .unwrap()
            .layers()
            .iter()
            .map(|layer| AppleLayerMetadata {
                id: layer.id.to_string(),
                name: layer.name.clone(),
                visible: layer.visible,
                kind: layer.kind.tag(),
            })
            .collect()
    }

    fn active_layer_id(&self) -> String {
        self.inner.lock().unwrap().active_layer_id().to_string()
    }

    /// The monotonic counter the shell reads to name the next layer; advanced
    /// by `add_layer`, never decremented by `remove_layer`.
    fn next_layer_number(&self) -> u32 {
        self.inner.lock().unwrap().next_layer_number()
    }

    /// Applies `tool` to the active layer's active-frame cel. Returns `false`
    /// for out-of-bounds coordinates (including negatives); the document is
    /// not modified in that case.
    fn apply_tool(&self, x: i32, y: i32, tool: ToolType, foreground_color: Color) -> bool {
        self.inner
            .lock()
            .unwrap()
            .apply_tool(tool, x, y, foreground_color)
    }

    /// Reads the pixel color at `(x, y)` on the active layer. Errors when
    /// `(x, y)` is outside the document's `width × height` or when the active
    /// layer holds no pixels at that position.
    fn get_pixel(&self, x: u32, y: u32) -> Result<Color, AppleError> {
        Ok(self.inner.lock().unwrap().get_pixel(x, y)?)
    }

    /// RGBA row-major composite buffer (`width * height * 4` bytes) of every
    /// visible layer's active-frame cel — the on-screen buffer the Metal
    /// render path uploads.
    fn composite(&self) -> Vec<u8> {
        self.inner.lock().unwrap().composite()
    }

    /// Writes `color` to `(x, y)` on the active layer. Errors when `(x, y)`
    /// is outside the document's `width × height`.
    fn set_pixel(&self, x: u32, y: u32, color: Color) -> Result<(), AppleError> {
        Ok(self.inner.lock().unwrap().set_pixel(x, y, color)?)
    }

    /// 4-connected flood fill on the active layer starting at `(x, y)`.
    /// Returns `true` when at least one pixel was changed. Negative
    /// coordinates short-circuit to `false`, mirroring `ApplePixelCanvas`.
    fn flood_fill(&self, x: i32, y: i32, fill_color: Color) -> bool {
        if x < 0 || y < 0 {
            return false;
        }
        self.inner
            .lock()
            .unwrap()
            .flood_fill(x as u32, y as u32, fill_color)
    }

    /// Clears the active layer's active-frame cel to transparent.
    fn clear(&self) {
        self.inner.lock().unwrap().clear();
    }

    /// The active layer's pixel buffer (RGBA row-major, `width * height * 4`
    /// bytes) — the stroke-start snapshot shape and move sessions restore
    /// during preview. Errors when the active layer holds no pixel buffer
    /// (a Reference Layer).
    fn active_layer_pixels(&self) -> Result<Vec<u8>, AppleError> {
        let document = self.inner.lock().unwrap();
        document
            .active_layer_pixels()
            .map(<[u8]>::to_vec)
            .ok_or_else(|| AppleError::Document {
                message: format!(
                    "Active layer {} has no pixel buffer",
                    document.active_layer_id()
                ),
            })
    }

    /// Overwrites the active layer's pixel buffer with `data` — the write
    /// counterpart of `active_layer_pixels`, with the core's Reference-Layer
    /// asymmetry: restoring onto a Reference Layer is a silent no-op where
    /// the read errors. Other layers are unaffected. Errors when `data.len()`
    /// is not exactly `width * height * 4`.
    fn restore_active_layer_pixels(&self, data: Vec<u8>) -> Result<(), AppleError> {
        Ok(self
            .inner
            .lock()
            .unwrap()
            .restore_active_layer_pixels(&data)?)
    }

    /// Inserts a transparent layer directly above the active layer and makes
    /// it active. Increments `next_layer_number`; the counter is never
    /// decremented by `remove_layer`. Errors when `new_id` is not a valid
    /// UUID string or when a layer with the same id already exists.
    fn add_layer(&self, new_id: String, name: String) -> Result<(), AppleError> {
        let id = parse_layer_id(&new_id)?;
        let mut document = self.inner.lock().unwrap();
        if document.layers().iter().any(|l| l.id == id) {
            return Err(AppleError::Document {
                message: format!("Layer with id {id} already exists"),
            });
        }
        document.add_layer(id, name);
        Ok(())
    }

    /// Removes the layer with `id`. Errors when the layer does not exist or
    /// when removing it would empty the document (a document must always
    /// contain at least one layer). When the removed layer was active, the
    /// active pointer moves to the layer immediately below, falling back to
    /// the layer above when the removed layer was at the bottom.
    fn remove_layer(&self, id: String) -> Result<(), AppleError> {
        let layer_id = parse_layer_id(&id)?;
        Ok(self.inner.lock().unwrap().remove_layer(layer_id)?)
    }

    /// Sets the active layer by id. Errors when no layer with `id` exists;
    /// in that case the previous active layer is preserved.
    fn set_active_layer(&self, id: String) -> Result<(), AppleError> {
        let layer_id = parse_layer_id(&id)?;
        Ok(self.inner.lock().unwrap().set_active_layer(layer_id)?)
    }

    /// Sets the visibility flag of the layer with `id`. Errors when no layer
    /// with `id` exists; the active layer pointer is never affected.
    fn set_layer_visibility(&self, id: String, visible: bool) -> Result<(), AppleError> {
        let layer_id = parse_layer_id(&id)?;
        Ok(self
            .inner
            .lock()
            .unwrap()
            .set_layer_visibility(layer_id, visible)?)
    }

    /// Moves the layer with `id` to `new_index`, silently clamped to the
    /// stack bounds. The active layer pointer is preserved across reordering
    /// (tracked by id, not by index). Errors for an unknown id.
    /// `new_index` is `u64` because UniFFI does not support `usize`.
    fn reorder_layer(&self, id: String, new_index: u64) -> Result<(), AppleError> {
        let layer_id = parse_layer_id(&id)?;
        Ok(self
            .inner
            .lock()
            .unwrap()
            .reorder_layer(layer_id, new_index as usize)?)
    }

    /// Resizes every layer to `new_width × new_height` using the same
    /// `anchor`, preserving each layer's id, name, and visibility. The
    /// active layer pointer is preserved. Errors when the new dimensions
    /// fall outside the core's supported range.
    fn resize(
        &self,
        new_width: u32,
        new_height: u32,
        anchor: ResizeAnchor,
    ) -> Result<(), AppleError> {
        Ok(self
            .inner
            .lock()
            .unwrap()
            .resize(new_width, new_height, anchor)?)
    }

    /// RGBA row-major composite buffer that excludes Reference Layers,
    /// suitable for export and saved-work thumbnails.
    fn composite_for_export(&self) -> Vec<u8> {
        self.inner.lock().unwrap().composite_for_export()
    }

    /// The export composite encoded as an RGBA 8-bit PNG.
    fn encode_export_png(&self) -> Result<Vec<u8>, AppleError> {
        let document = self.inner.lock().unwrap();
        let canvas = PixelCanvas::from_pixels(
            document.width(),
            document.height(),
            document.composite_for_export(),
        )?;
        Ok(canvas.encode_png()?)
    }
}

// ---------------------------------------------------------------------------
// AppleDocumentHistory
// ---------------------------------------------------------------------------

/// Document History wrapper with interior mutability for thread-safe FFI
/// access — the layer-aware undo/redo species (whole-`Document` snapshots).
#[derive(uniffi::Object)]
pub struct AppleDocumentHistory {
    inner: Mutex<DocumentHistory>,
}

#[uniffi::export]
impl AppleDocumentHistory {
    /// `max_snapshots` is `u64` because UniFFI does not support `usize`.
    #[uniffi::constructor]
    fn new(max_snapshots: u64) -> Arc<Self> {
        Arc::new(Self {
            inner: Mutex::new(DocumentHistory::new(max_snapshots as usize)),
        })
    }

    #[uniffi::constructor]
    fn default_history() -> Arc<Self> {
        Arc::new(Self {
            inner: Mutex::new(DocumentHistory::default()),
        })
    }

    fn can_undo(&self) -> bool {
        self.inner.lock().unwrap().can_undo()
    }

    fn can_redo(&self) -> bool {
        self.inner.lock().unwrap().can_redo()
    }

    /// Holds `document`'s current state as the pending Edit Baseline.
    /// Nothing is pushed and the redo stack stays untouched until `end_edit`
    /// resolves it.
    fn begin_edit(&self, document: Arc<AppleDocument>) {
        let baseline = document.inner.lock().unwrap().clone();
        self.inner.lock().unwrap().begin_edit(&baseline);
    }

    /// Resolves the pending Edit Baseline against `current`'s state: pushes
    /// it as the new undo top (clearing the redo stack) only when the edit
    /// actually changed the document; a no-op edit discards the baseline and
    /// leaves both stacks untouched. No-op when no baseline is pending.
    ///
    /// Returns whether an undo entry was committed.
    fn end_edit(&self, current: Arc<AppleDocument>) -> bool {
        let snapshot = current.inner.lock().unwrap().clone();
        self.inner.lock().unwrap().end_edit(&snapshot)
    }

    /// Pops the most recent snapshot from the undo stack and pushes
    /// `current`'s state onto the redo stack, returning the restored
    /// document as a new object — the caller replaces its reference.
    fn undo(&self, current: Arc<AppleDocument>) -> Option<Arc<AppleDocument>> {
        let snapshot = current.inner.lock().unwrap().clone();
        self.inner
            .lock()
            .unwrap()
            .undo_document(&snapshot)
            .map(|document| {
                Arc::new(AppleDocument {
                    inner: Mutex::new(document),
                })
            })
    }

    /// Pops the most recent snapshot from the redo stack and pushes
    /// `current`'s state onto the undo stack, returning the restored
    /// document as a new object — the caller replaces its reference.
    fn redo(&self, current: Arc<AppleDocument>) -> Option<Arc<AppleDocument>> {
        let snapshot = current.inner.lock().unwrap().clone();
        self.inner
            .lock()
            .unwrap()
            .redo_document(&snapshot)
            .map(|document| {
                Arc::new(AppleDocument {
                    inner: Mutex::new(document),
                })
            })
    }

    fn clear(&self) {
        self.inner.lock().unwrap().clear();
    }
}

// ---------------------------------------------------------------------------
// AppleViewport
// ---------------------------------------------------------------------------

/// Viewport wrapper. No Mutex needed — all methods return new instances
/// (the core `Viewport` is `Copy` and has no `&mut self` methods).
#[derive(uniffi::Object)]
pub struct AppleViewport {
    inner: Viewport,
}

#[uniffi::export]
impl AppleViewport {
    #[uniffi::constructor]
    fn new(pixel_size: u32, zoom: f64, pan_x: f64, pan_y: f64) -> Arc<Self> {
        Arc::new(Self {
            inner: Viewport {
                pixel_size,
                zoom,
                pan_x,
                pan_y,
            },
        })
    }

    #[uniffi::constructor]
    fn for_canvas(canvas_width: u32, canvas_height: u32) -> Arc<Self> {
        Arc::new(Self {
            inner: Viewport::for_canvas(canvas_width, canvas_height),
        })
    }

    fn pixel_size(&self) -> u32 {
        self.inner.pixel_size
    }

    fn zoom(&self) -> f64 {
        self.inner.zoom
    }

    fn pan_x(&self) -> f64 {
        self.inner.pan_x
    }

    fn pan_y(&self) -> f64 {
        self.inner.pan_y
    }

    fn effective_pixel_size(&self) -> f64 {
        self.inner.effective_pixel_size()
    }

    fn screen_to_canvas(&self, screen_x: f64, screen_y: f64) -> ScreenCanvasCoords {
        self.inner.screen_to_canvas(screen_x, screen_y)
    }

    fn display_size(&self, canvas_width: u32, canvas_height: u32) -> ViewportSize {
        self.inner.display_size(canvas_width, canvas_height)
    }

    fn zoom_at_point(&self, screen_x: f64, screen_y: f64, new_zoom: f64) -> Arc<AppleViewport> {
        Arc::new(AppleViewport {
            inner: self.inner.zoom_at_point(screen_x, screen_y, new_zoom),
        })
    }

    fn pan(&self, delta_x: f64, delta_y: f64) -> Arc<AppleViewport> {
        Arc::new(AppleViewport {
            inner: self.inner.pan(delta_x, delta_y),
        })
    }

    fn clamp_pan(
        &self,
        canvas_width: u32,
        canvas_height: u32,
        viewport_size: ViewportSize,
    ) -> Arc<AppleViewport> {
        Arc::new(AppleViewport {
            inner: self
                .inner
                .clamp_pan(canvas_width, canvas_height, viewport_size),
        })
    }

    fn fit_to_viewport(
        &self,
        canvas_width: u32,
        canvas_height: u32,
        viewport_size: ViewportSize,
    ) -> Arc<AppleViewport> {
        Arc::new(AppleViewport {
            inner: self.inner.fit_to_viewport(
                canvas_width,
                canvas_height,
                viewport_size,
                f64::INFINITY,
            ),
        })
    }
}
