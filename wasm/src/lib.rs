use wasm_bindgen::prelude::*;

use dotorixel_core::canvas::PixelCanvas;
use dotorixel_core::color::Color;
use dotorixel_core::export::PngExport;
use dotorixel_core::history::HistoryManager;
use dotorixel_core::tool::{ellipse_outline, flood_fill, interpolate_pixels, rectangle_outline, ToolType};
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
    flood_fill(&mut canvas.inner, x, y, color.inner)
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

    pub fn push_snapshot(&mut self, pixels: &[u8]) {
        self.inner.push_snapshot(pixels);
    }

    pub fn undo(&mut self, current_pixels: &[u8]) -> Option<Vec<u8>> {
        self.inner.undo(current_pixels)
    }

    pub fn redo(&mut self, current_pixels: &[u8]) -> Option<Vec<u8>> {
        self.inner.redo(current_pixels)
    }

    pub fn clear(&mut self) {
        self.inner.clear();
    }

    pub fn default_max_snapshots() -> usize {
        HistoryManager::DEFAULT_MAX_SNAPSHOTS
    }
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

    pub fn zoom_at_point(
        &self,
        screen_x: f64,
        screen_y: f64,
        new_zoom: f64,
    ) -> WasmViewport {
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
