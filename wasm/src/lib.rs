use wasm_bindgen::prelude::*;

use dotorixel_core::canvas::{PixelCanvas, ResizeAnchor};
use dotorixel_core::color::Color;
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
