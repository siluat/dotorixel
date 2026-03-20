use std::sync::{Arc, Mutex};

use dotorixel_core::canvas::PixelCanvas;
use dotorixel_core::export::PngExport;
use dotorixel_core::history::HistoryManager;
use dotorixel_core::tool::interpolate_pixels;
use dotorixel_core::viewport::{ScreenCanvasCoords, Viewport, ViewportSize};

// Re-export core types used directly in the UniFFI interface.
// UniFFI discovers these via their cfg_attr derives in dotorixel-core.
use dotorixel_core::color::Color;
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

// --- History constants ---

#[uniffi::export]
fn history_default_max_snapshots() -> u64 {
    HistoryManager::DEFAULT_MAX_SNAPSHOTS as u64
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
/// See `docs/research/uniffi-mutex-decision.ko.md` for the design rationale.
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
}

// ---------------------------------------------------------------------------
// AppleHistoryManager
// ---------------------------------------------------------------------------

/// History manager wrapper with interior mutability for thread-safe FFI access.
#[derive(uniffi::Object)]
pub struct AppleHistoryManager {
    inner: Mutex<HistoryManager>,
}

#[uniffi::export]
impl AppleHistoryManager {
    /// `max_snapshots` is `u64` because UniFFI does not support `usize`.
    #[uniffi::constructor]
    fn new(max_snapshots: u64) -> Arc<Self> {
        Arc::new(Self {
            inner: Mutex::new(HistoryManager::new(max_snapshots as usize)),
        })
    }

    #[uniffi::constructor]
    fn default_manager() -> Arc<Self> {
        Arc::new(Self {
            inner: Mutex::new(HistoryManager::default()),
        })
    }

    fn can_undo(&self) -> bool {
        self.inner.lock().unwrap().can_undo()
    }

    fn can_redo(&self) -> bool {
        self.inner.lock().unwrap().can_redo()
    }

    fn push_snapshot(&self, pixels: Vec<u8>) {
        self.inner.lock().unwrap().push_snapshot(&pixels);
    }

    fn undo(&self, current_pixels: Vec<u8>) -> Option<Vec<u8>> {
        self.inner.lock().unwrap().undo(&current_pixels)
    }

    fn redo(&self, current_pixels: Vec<u8>) -> Option<Vec<u8>> {
        self.inner.lock().unwrap().redo(&current_pixels)
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

    fn zoom_at_point(
        &self,
        screen_x: f64,
        screen_y: f64,
        new_zoom: f64,
    ) -> Arc<AppleViewport> {
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
            inner: self
                .inner
                .fit_to_viewport(canvas_width, canvas_height, viewport_size),
        })
    }
}
