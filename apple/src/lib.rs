use std::sync::{Arc, Mutex};

use dotorixel_core::canvas::PixelCanvas;
use dotorixel_core::export::PngExport;
use dotorixel_core::history::DocumentHistory;
use dotorixel_core::pixel_perfect::{FilterResult, TailState, pixel_perfect_filter};
use dotorixel_core::selection::MarqueeRegion;
use dotorixel_core::tool::{ellipse_outline, interpolate_pixels, rectangle_outline};
use dotorixel_core::viewport::{ScreenCanvasCoords, Viewport, ViewportSize};
use dotorixel_core::{Document, Layer, ReferenceFootprint, ReferencePlacement, ResizeAnchor};
use uuid::Uuid;

// Re-export core types used directly in the UniFFI interface.
// UniFFI discovers these via their cfg_attr derives in dotorixel-core.
use dotorixel_core::color::Color;
use dotorixel_core::layer::{LayerKind, LayerKindTag, ReferenceData};
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

impl From<dotorixel_core::document::FrameError> for AppleError {
    fn from(e: dotorixel_core::document::FrameError) -> Self {
        Self::Document {
            message: e.to_string(),
        }
    }
}

impl From<dotorixel_core::document::DocumentBuildError> for AppleError {
    fn from(e: dotorixel_core::document::DocumentBuildError) -> Self {
        Self::Document {
            message: e.to_string(),
        }
    }
}

impl From<dotorixel_core::document::CompositePatchError> for AppleError {
    fn from(e: dotorixel_core::document::CompositePatchError) -> Self {
        Self::Document {
            message: e.to_string(),
        }
    }
}

impl From<dotorixel_core::layer::ReferenceDataError> for AppleError {
    fn from(e: dotorixel_core::layer::ReferenceDataError) -> Self {
        Self::Document {
            message: e.to_string(),
        }
    }
}

impl From<dotorixel_core::export::PngDecodeError> for AppleError {
    fn from(e: dotorixel_core::export::PngDecodeError) -> Self {
        Self::Export {
            message: e.to_string(),
        }
    }
}

impl From<dotorixel_core::reference_placement::ReferencePlacementError> for AppleError {
    fn from(e: dotorixel_core::reference_placement::ReferencePlacementError) -> Self {
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

// --- Frame constants ---

/// The bounds `AppleDocument::set_frame_duration` clamps to, exposed so the
/// per-frame duration UI and the binding agree on one range.
#[uniffi::export]
fn frame_min_duration_ms() -> u32 {
    AppleDocument::MIN_FRAME_DURATION_MS
}

#[uniffi::export]
fn frame_max_duration_ms() -> u32 {
    AppleDocument::MAX_FRAME_DURATION_MS
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
// AppleMarqueeRegion
// ---------------------------------------------------------------------------

/// The Marquee rectangle as a value crossing the FFI boundary — the shell
/// reads `x`/`y`/`width`/`height` directly and treats construction as the
/// helpers' job ([`apple_marquee_from_drag`]). A record is constructible
/// field-wise in Swift, so document methods validate the core invariant
/// (`width`/`height ≥ 1`, extents within `i32`) at the boundary.
#[derive(uniffi::Record, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AppleMarqueeRegion {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl From<MarqueeRegion> for AppleMarqueeRegion {
    fn from(region: MarqueeRegion) -> Self {
        Self {
            x: region.x(),
            y: region.y(),
            width: region.width(),
            height: region.height(),
        }
    }
}

impl AppleMarqueeRegion {
    /// Converts the record back into the core's invariant-holding type.
    /// Errors when the record was built with a zero width/height, a
    /// width/height above `i32::MAX`, or a far corner outside the `i32`
    /// coordinate space — states the core type makes unrepresentable (its
    /// drag-corner arithmetic spans at most the `i32` range).
    fn to_core(self) -> Result<MarqueeRegion, AppleError> {
        if self.width == 0 || self.height == 0 {
            return Err(AppleError::Document {
                message: format!(
                    "Marquee region width and height must be at least 1, got {} × {}",
                    self.width, self.height
                ),
            });
        }
        if self.width > i32::MAX as u32 || self.height > i32::MAX as u32 {
            return Err(AppleError::Document {
                message: format!(
                    "Marquee region width and height must be at most {}, got {} × {}",
                    i32::MAX,
                    self.width,
                    self.height
                ),
            });
        }
        let right = i64::from(self.x) + i64::from(self.width) - 1;
        let bottom = i64::from(self.y) + i64::from(self.height) - 1;
        if right > i64::from(i32::MAX) || bottom > i64::from(i32::MAX) {
            return Err(AppleError::Document {
                message: format!(
                    "Marquee region extends past the i32 coordinate space: far corner ({right}, {bottom})"
                ),
            });
        }
        Ok(MarqueeRegion::from_drag(
            self.x,
            self.y,
            right as i32,
            bottom as i32,
        ))
    }
}

/// Normalizes two drag corners (any order, inclusive) into a Marquee region —
/// the drag-corner normalization the Marquee select tool consumes. Errors
/// when the corner span exceeds `i32::MAX` pixels on either axis (the core's
/// drag arithmetic is `i32`-wide); canvas-sized drags never come close.
#[uniffi::export]
fn apple_marquee_from_drag(
    x0: i32,
    y0: i32,
    x1: i32,
    y1: i32,
) -> Result<AppleMarqueeRegion, AppleError> {
    let span_x = (i64::from(x0) - i64::from(x1)).abs() + 1;
    let span_y = (i64::from(y0) - i64::from(y1)).abs() + 1;
    if span_x > i64::from(i32::MAX) || span_y > i64::from(i32::MAX) {
        return Err(AppleError::Document {
            message: format!(
                "Marquee drag span must be at most {} pixels per axis, got {span_x} × {span_y}",
                i32::MAX
            ),
        });
    }
    Ok(MarqueeRegion::from_drag(x0, y0, x1, y1).into())
}

/// Whether `(x, y)` lies inside `region`. An invalid record (zero
/// width/height, or extents the core type cannot represent) contains
/// nothing.
#[uniffi::export]
fn apple_marquee_contains(region: AppleMarqueeRegion, x: i32, y: i32) -> bool {
    region.to_core().is_ok_and(|region| region.contains(x, y))
}

/// Clips `region` to a `canvas_w × canvas_h` canvas, returning only the
/// in-bounds overlap — `nil` when the region does not overlap the canvas or
/// the record is invalid (zero width/height, or extents the core type
/// cannot represent).
#[uniffi::export]
fn apple_marquee_clip_to(
    region: AppleMarqueeRegion,
    canvas_w: u32,
    canvas_h: u32,
) -> Option<AppleMarqueeRegion> {
    region
        .to_core()
        .ok()?
        .clip_to(canvas_w, canvas_h)
        .map(Into::into)
}

// ---------------------------------------------------------------------------
// AppleDocument
// ---------------------------------------------------------------------------

/// A complete Reference Layer Placement value crossing the FFI boundary for
/// reads and stateless geometry calculations. Swift may construct records
/// field-wise, so [`AppleReferencePlacement::to_core`] validates every core
/// invariant before using the value.
#[derive(uniffi::Record, Clone, Copy, PartialEq)]
pub struct AppleReferencePlacement {
    pub x: f32,
    pub y: f32,
    pub scale: f32,
    pub rotation: u8,
}

impl From<ReferencePlacement> for AppleReferencePlacement {
    fn from(placement: ReferencePlacement) -> Self {
        Self {
            x: placement.x(),
            y: placement.y(),
            scale: placement.scale(),
            rotation: placement.rotation(),
        }
    }
}

impl AppleReferencePlacement {
    fn to_core(self) -> Result<ReferencePlacement, AppleError> {
        if self.rotation > 3 {
            return Err(AppleError::Document {
                message: format!(
                    "Reference placement rotation must be between 0 and 3 quarter-turns, got {}",
                    self.rotation
                ),
            });
        }
        Ok(ReferencePlacement::new(self.x, self.y, self.scale)?.with_rotation(self.rotation))
    }
}

/// The position-and-scale fields placement interaction may update. Rotation
/// is deliberately absent because the core preserves the Reference Layer's
/// existing quarter-turn during move and scale operations.
#[derive(uniffi::Record, Clone, Copy, PartialEq)]
pub struct AppleReferencePlacementUpdate {
    pub x: f32,
    pub y: f32,
    pub scale: f32,
}

impl AppleReferencePlacementUpdate {
    fn to_core(self) -> Result<ReferencePlacement, AppleError> {
        Ok(ReferencePlacement::new(self.x, self.y, self.scale)?)
    }
}

/// A Reference Layer's projected axis-aligned bounds in canvas coordinates.
#[derive(uniffi::Record, Clone, Copy, PartialEq)]
pub struct AppleReferenceFootprint {
    pub min_x: f32,
    pub min_y: f32,
    pub max_x: f32,
    pub max_y: f32,
}

impl From<ReferenceFootprint> for AppleReferenceFootprint {
    fn from(footprint: ReferenceFootprint) -> Self {
        Self {
            min_x: footprint.min_x(),
            min_y: footprint.min_y(),
            max_x: footprint.max_x(),
            max_y: footprint.max_y(),
        }
    }
}

/// Computes a Reference Layer footprint from a placement and natural source
/// dimensions, including quarter-turn rotation. Errors when the placement is
/// invalid or either natural dimension is zero.
#[uniffi::export]
fn apple_reference_footprint(
    placement: AppleReferencePlacement,
    natural_width: u32,
    natural_height: u32,
) -> Result<AppleReferenceFootprint, AppleError> {
    if natural_width == 0 || natural_height == 0 {
        return Err(AppleError::Document {
            message: format!(
                "Reference source dimensions must both be at least 1, got {natural_width}x{natural_height}"
            ),
        });
    }

    Ok(placement
        .to_core()?
        .footprint(natural_width, natural_height)
        .into())
}

/// Computes a centered, aspect-preserving placement for a Reference Layer.
/// Zero dimensions are rejected at the FFI boundary instead of reaching the
/// core helper's internal non-zero precondition.
#[uniffi::export]
fn apple_reference_placement_fit_to_canvas(
    canvas_width: u32,
    canvas_height: u32,
    natural_width: u32,
    natural_height: u32,
) -> Result<AppleReferencePlacement, AppleError> {
    if canvas_width == 0 || canvas_height == 0 || natural_width == 0 || natural_height == 0 {
        return Err(AppleError::Document {
            message: format!(
                "Reference fit dimensions must all be at least 1, got canvas {canvas_width}x{canvas_height} and source {natural_width}x{natural_height}"
            ),
        });
    }

    Ok(ReferencePlacement::fit_to_canvas(
        canvas_width,
        canvas_height,
        natural_width,
        natural_height,
    )
    .into())
}

/// A decoded reference PNG: the RGBA source buffer with the dimensions the
/// stream itself declared.
#[derive(uniffi::Record)]
pub struct AppleDecodedPng {
    pub width: u32,
    pub height: u32,
    /// Row-major RGBA buffer, `width * height * 4` bytes.
    pub rgba: Vec<u8>,
}

/// Encodes a Reference Layer's RGBA source buffer as an RGBA 8-bit PNG —
/// the compressed form session persistence stores. Errors when `rgba` is
/// not a `width * height * 4` row-major buffer.
#[uniffi::export]
fn apple_encode_reference_png(
    width: u32,
    height: u32,
    rgba: Vec<u8>,
) -> Result<Vec<u8>, AppleError> {
    Ok(dotorixel_core::export::encode_rgba_png(
        width, height, &rgba,
    )?)
}

/// The largest decoded reference source the persistence codec will
/// materialize — the same 64 MiB decoded-RGBA cap the import boundary
/// enforces (`ReferenceImageImporter.maximumDecodedPixelCount`), so a
/// stored blob can never admit more than an import could.
const MAX_REFERENCE_SOURCE_BYTES: usize = 64 * 1024 * 1024;

/// Decodes a stored reference PNG back into its RGBA source buffer — the
/// lossless inverse of [`apple_encode_reference_png`]. Errors on malformed
/// bytes, any other PNG layout, or a header whose decoded size exceeds
/// [`MAX_REFERENCE_SOURCE_BYTES`], so a corrupt stored blob fails here, at
/// the persistence boundary — before its declared dimensions can drive an
/// allocation.
#[uniffi::export]
fn apple_decode_reference_png(bytes: Vec<u8>) -> Result<AppleDecodedPng, AppleError> {
    let decoded = dotorixel_core::export::decode_rgba_png(&bytes, MAX_REFERENCE_SOURCE_BYTES)?;
    Ok(AppleDecodedPng {
        width: decoded.width,
        height: decoded.height,
        rgba: decoded.pixels,
    })
}

/// Natural source dimensions for the Reference Layer at a stack index.
#[derive(uniffi::Record, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AppleReferenceDimensions {
    pub width: u32,
    pub height: u32,
}

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

/// One Pixel Layer's full persistence snapshot — everything session
/// persistence stores per layer, read in stack order via
/// [`AppleDocument::pixel_layer_snapshots`] (or the Pixel-only
/// [`AppleDocument::layer_snapshots`]) and fed back verbatim to the
/// hydration constructor. `pixels` is the layer's RGBA row-major buffer
/// (`width * height * 4` bytes); the id crosses the boundary as a lowercase
/// UUID string, per the [`AppleLayerMetadata`] convention.
#[derive(uniffi::Record)]
pub struct AppleLayerSnapshot {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub opacity: f32,
    pub pixels: Vec<u8>,
}

/// The singleton Reference Layer's full persistence snapshot — everything
/// session persistence stores for the Reference: identity and display
/// fields, the immutable RGBA source with its natural dimensions, and the
/// placement. Read via [`AppleDocument::reference_layer_snapshot`] and fed
/// back to [`AppleDocument::from_layers`] on hydration.
#[derive(uniffi::Record)]
pub struct AppleReferenceLayerSnapshot {
    pub id: String,
    pub name: String,
    pub visible: bool,
    pub opacity: f32,
    /// Row-major RGBA source buffer (`natural_width * natural_height * 4`
    /// bytes).
    pub source_rgba: Vec<u8>,
    pub natural_width: u32,
    pub natural_height: u32,
    pub placement: AppleReferencePlacement,
}

/// Rebuilds a Reference Layer from its persistence snapshot, validating
/// every field the way [`AppleDocument::from_layers`] validates Pixel
/// Layers: persisted data is an external input, so malformed values fail
/// here, at the boundary.
fn reference_layer_from_snapshot(
    snapshot: AppleReferenceLayerSnapshot,
) -> Result<Layer, AppleError> {
    let id = parse_layer_id(&snapshot.id)?;
    if !snapshot.opacity.is_finite() || !(0.0..=1.0).contains(&snapshot.opacity) {
        return Err(AppleError::Document {
            message: format!(
                "Layer {id} opacity must be a finite value between 0.0 and 1.0, got {}",
                snapshot.opacity
            ),
        });
    }
    let placement = snapshot.placement.to_core()?;
    let data = ReferenceData::new(
        snapshot.source_rgba,
        snapshot.natural_width,
        snapshot.natural_height,
        placement,
    )?;
    Ok(Layer {
        id,
        name: snapshot.name,
        visible: snapshot.visible,
        opacity: snapshot.opacity,
        kind: LayerKind::Reference(data),
    })
}

fn pixel_layer_snapshot(
    document: &Document,
    stack_index: usize,
    layer: &Layer,
) -> Option<AppleLayerSnapshot> {
    let pixels = document.layer_pixels_at(stack_index)?;
    Some(AppleLayerSnapshot {
        id: layer.id.to_string(),
        name: layer.name.clone(),
        visible: layer.visible,
        opacity: layer.opacity,
        pixels: pixels.to_vec(),
    })
}

fn parse_layer_id(id: &str) -> Result<Uuid, AppleError> {
    Uuid::parse_str(id).map_err(|e| AppleError::Document {
        message: format!("Invalid layer id {id:?}: {e}"),
    })
}

fn parse_frame_id(id: &str) -> Result<Uuid, AppleError> {
    Uuid::parse_str(id).map_err(|e| AppleError::Document {
        message: format!("Invalid frame id {id:?}: {e}"),
    })
}

/// Whether the cel at `[stack_index × frame_id]` holds any pixel with a
/// non-zero alpha — the timeline grid's occupancy predicate, shared by the
/// per-column and per-cel reads. A stack index that holds no cel at this frame
/// (a Reference Layer, which is frame-independent) is not occupied.
fn cel_is_occupied(document: &Document, stack_index: usize, frame_id: Uuid) -> bool {
    document
        .cel_pixels_at(stack_index, frame_id)
        .is_some_and(|pixels| pixels.chunks_exact(4).any(|rgba| rgba[3] != 0))
}

/// One frame's shell-facing metadata, read in axis order via
/// [`AppleDocument::frames`] — the frame-axis mirror of
/// [`AppleLayerMetadata`]. A frame carries no name; the shell displays its
/// 1-based ordinal. The id crosses the boundary as a lowercase UUID string
/// (UniFFI has no UUID type).
#[derive(uniffi::Record)]
pub struct AppleFrameMetadata {
    pub id: String,
    /// The frame's display time in milliseconds during playback.
    pub duration_ms: u32,
}

/// Document wrapper with interior mutability for thread-safe FFI access.
/// See `docs/decisions/uniffi-mutex-interior-mutability.ko.md` for the design rationale.
#[derive(uniffi::Object)]
pub struct AppleDocument {
    inner: Mutex<Document>,
}

impl AppleDocument {
    /// Smallest display duration a frame may hold (1 ms). The core trusts any
    /// value; this shell binding owns the range and clamps to it, so a frame
    /// is never zero-length. Read from Swift via `frame_min_duration_ms`.
    const MIN_FRAME_DURATION_MS: u32 = 1;
    /// Largest display duration a frame may hold (60_000 ms = 60 s).
    const MAX_FRAME_DURATION_MS: u32 = 60_000;
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

    /// Rebuilds a document from persisted parts — the hydration counterpart
    /// of the persistence snapshot reads: `layers` is the persisted Pixel
    /// stack in stack order, restored verbatim (ids, names, visibility,
    /// opacity, pixels), and `reference` is the optional Reference Layer
    /// snapshot, restored exactly (placement included) and normalized by the
    /// core to the single bottom-most underlay. Errors when a layer id or
    /// `active_layer_id` is not a valid UUID string, when a layer's opacity
    /// is not a finite value in `[0.0, 1.0]`, when a pixel buffer's length is
    /// not `width * height * 4`, when the reference's placement or source
    /// buffer fails validation, or when the stack fails the core's build
    /// validation (empty stack, duplicate ids, active layer not present).
    #[uniffi::constructor(default(reference = None))]
    fn from_layers(
        width: u32,
        height: u32,
        layers: Vec<AppleLayerSnapshot>,
        active_layer_id: String,
        next_layer_number: u32,
        timeline_panel_collapsed: bool,
        reference: Option<AppleReferenceLayerSnapshot>,
    ) -> Result<Arc<Self>, AppleError> {
        let mut stack: Vec<Layer> = Vec::with_capacity(layers.len() + 1);
        if let Some(reference) = reference {
            stack.push(reference_layer_from_snapshot(reference)?);
        }
        for snapshot in layers {
            let id = parse_layer_id(&snapshot.id)?;
            // Persisted data is an external input: a NaN opacity would
            // slip past the compositor's clamp and render the layer
            // transparent, so malformed values fail here, at the boundary.
            if !snapshot.opacity.is_finite() || !(0.0..=1.0).contains(&snapshot.opacity) {
                return Err(AppleError::Document {
                    message: format!(
                        "Layer {id} opacity must be a finite value between 0.0 and 1.0, got {}",
                        snapshot.opacity
                    ),
                });
            }
            let canvas = PixelCanvas::from_pixels(width, height, snapshot.pixels)?;
            stack.push(Layer::from_pixel_canvas(
                id,
                snapshot.name,
                snapshot.visible,
                snapshot.opacity,
                canvas,
            ));
        }
        let active_id = parse_layer_id(&active_layer_id)?;
        let document = Document::from_layers(
            width,
            height,
            stack,
            active_id,
            next_layer_number,
            timeline_panel_collapsed,
        )?;
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

    /// Sampling-aware active-layer read. Pixel Layers return their color
    /// inside document bounds; Reference Layers sample their projected source
    /// and return `nil` outside its footprint.
    fn try_get_pixel(&self, x: u32, y: u32) -> Option<Color> {
        self.inner.lock().unwrap().try_get_pixel(x, y)
    }

    /// Samples the visible artwork stack at every document-space point under
    /// one lock: the Pixel composite source-over the visible Reference
    /// underlay. The result preserves input order and length; out-of-bounds
    /// points are transparent.
    fn sample_visible_pixels(&self, points: Vec<ScreenCanvasCoords>) -> Vec<Color> {
        let document = self.inner.lock().unwrap();
        let width = document.width();
        let height = document.height();
        let pixel_composite = document.composite();
        let reference = document.layers().iter().find_map(|layer| {
            if !layer.visible {
                return None;
            }
            match &layer.kind {
                LayerKind::Reference(data) => Some(data),
                LayerKind::Pixel(_) => None,
            }
        });

        points
            .into_iter()
            .map(|point| {
                let Ok(x) = u32::try_from(point.x) else {
                    return Color::TRANSPARENT;
                };
                let Ok(y) = u32::try_from(point.y) else {
                    return Color::TRANSPARENT;
                };
                if x >= width || y >= height {
                    return Color::TRANSPARENT;
                }
                let offset = (y as usize * width as usize + x as usize) * 4;
                let pixel_color = Color::new(
                    pixel_composite[offset],
                    pixel_composite[offset + 1],
                    pixel_composite[offset + 2],
                    pixel_composite[offset + 3],
                );
                let reference_color = reference
                    .and_then(|data| data.sample_at(x, y))
                    .unwrap_or(Color::TRANSPARENT);
                pixel_color.source_over(reference_color)
            })
            .collect()
    }

    /// RGBA row-major composite buffer (`width * height * 4` bytes) of every
    /// visible Pixel Layer's active-frame cel. Reference Layers are excluded;
    /// this is the Pixel-only buffer the Metal render path uploads.
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

    /// Every layer's persistence snapshot in stack order — the per-layer
    /// fields session persistence stores (id, name, visibility, opacity, and
    /// the full pixel buffer, active or not). Errors when the stack contains
    /// a Reference Layer: this read covers Pixel Layers only — a
    /// reference-carrying stack reads through [`Self::pixel_layer_snapshots`]
    /// plus [`Self::reference_layer_snapshot`] instead.
    fn layer_snapshots(&self) -> Result<Vec<AppleLayerSnapshot>, AppleError> {
        let document = self.inner.lock().unwrap();
        document
            .layers()
            .iter()
            .enumerate()
            .map(|(index, layer)| {
                pixel_layer_snapshot(&document, index, layer).ok_or_else(|| {
                    AppleError::Document {
                        message: format!(
                            "Layer {} is a Reference Layer; persistence snapshots cover Pixel Layers only",
                            layer.id
                        ),
                    }
                })
            })
            .collect()
    }

    /// Pixel-only persistence projection in stack order — the Pixel half of
    /// the snapshot reads; [`Self::reference_layer_snapshot`] is the
    /// Reference half.
    fn pixel_layer_snapshots(&self) -> Vec<AppleLayerSnapshot> {
        let document = self.inner.lock().unwrap();
        document
            .layers()
            .iter()
            .enumerate()
            .filter_map(|(index, layer)| pixel_layer_snapshot(&document, index, layer))
            .collect()
    }

    /// The singleton Reference Layer's persistence snapshot — source buffer,
    /// natural dimensions, placement, and display fields; `nil` when the
    /// stack holds no Reference. The read half of reference-aware
    /// persistence; [`Self::from_layers`] is the hydration half.
    fn reference_layer_snapshot(&self) -> Option<AppleReferenceLayerSnapshot> {
        let document = self.inner.lock().unwrap();
        document
            .layers()
            .iter()
            .find_map(|layer| match &layer.kind {
                LayerKind::Reference(data) => Some(AppleReferenceLayerSnapshot {
                    id: layer.id.to_string(),
                    name: layer.name.clone(),
                    visible: layer.visible,
                    opacity: layer.opacity,
                    source_rgba: data.source_rgba().to_vec(),
                    natural_width: data.natural_width(),
                    natural_height: data.natural_height(),
                    placement: data.placement().into(),
                }),
                LayerKind::Pixel(_) => None,
            })
    }

    /// A copy of the immutable RGBA source buffer for the Reference Layer at
    /// `stack_index`; `nil` for a Pixel Layer or an out-of-range index.
    fn layer_source_pixels_at(&self, stack_index: u64) -> Option<Vec<u8>> {
        let index = usize::try_from(stack_index).ok()?;
        self.inner
            .lock()
            .unwrap()
            .layer_source_pixels_at(index)
            .map(<[u8]>::to_vec)
    }

    /// Natural source dimensions for the Reference Layer at `stack_index`;
    /// `nil` for a Pixel Layer or an out-of-range index.
    fn layer_source_dimensions_at(&self, stack_index: u64) -> Option<AppleReferenceDimensions> {
        let index = usize::try_from(stack_index).ok()?;
        self.inner
            .lock()
            .unwrap()
            .layer_source_dimensions_at(index)
            .map(|(width, height)| AppleReferenceDimensions { width, height })
    }

    /// Current placement for the Reference Layer at `stack_index`; `nil` for
    /// a Pixel Layer or an out-of-range index.
    fn layer_placement_at(&self, stack_index: u64) -> Option<AppleReferencePlacement> {
        let index = usize::try_from(stack_index).ok()?;
        self.inner
            .lock()
            .unwrap()
            .layer_placement_at(index)
            .map(Into::into)
    }

    /// Projected footprint for the Reference Layer at `stack_index`; `nil`
    /// for a Pixel Layer or an out-of-range index.
    fn reference_layer_footprint_at(&self, stack_index: u64) -> Option<AppleReferenceFootprint> {
        let index = usize::try_from(stack_index).ok()?;
        let document = self.inner.lock().unwrap();
        let placement = document.layer_placement_at(index)?;
        let (natural_width, natural_height) = document.layer_source_dimensions_at(index)?;
        Some(placement.footprint(natural_width, natural_height).into())
    }

    /// Whether the bottom-docked Timeline panel is collapsed to its header
    /// strip — presentation state that persists with the document.
    fn is_timeline_panel_collapsed(&self) -> bool {
        self.inner.lock().unwrap().is_timeline_panel_collapsed()
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

    /// Sets the singleton Reference Layer, fixed at the bottom of the stack,
    /// and makes it active. A later import replaces the existing Reference
    /// Layer. Errors when the id belongs to an existing Pixel Layer or the
    /// source dimensions and RGBA buffer are inconsistent.
    fn add_reference_layer(
        &self,
        new_id: String,
        name: String,
        source_rgba: Vec<u8>,
        source_width: u32,
        source_height: u32,
    ) -> Result<(), AppleError> {
        let id = parse_layer_id(&new_id)?;
        if source_width == 0 || source_height == 0 {
            return Err(AppleError::Document {
                message: format!(
                    "Reference source dimensions must both be at least 1, got {source_width}x{source_height}"
                ),
            });
        }
        let mut document = self.inner.lock().unwrap();
        if document
            .layers()
            .iter()
            .any(|layer| layer.id == id && layer.kind.tag() == LayerKindTag::Pixel)
        {
            return Err(AppleError::Document {
                message: format!("Pixel Layer with id {id} already exists"),
            });
        }
        document.add_reference_layer(id, name, source_rgba, source_width, source_height)?;
        Ok(())
    }

    /// Updates a Reference Layer's position and scale after validating the
    /// record. The core preserves the layer's current quarter-turn rotation so
    /// placement interaction cannot reset a rotation restored from an older
    /// document.
    fn set_reference_placement(
        &self,
        id: String,
        placement: AppleReferencePlacementUpdate,
    ) -> Result<(), AppleError> {
        let layer_id = parse_layer_id(&id)?;
        let placement = placement.to_core()?;
        self.inner
            .lock()
            .unwrap()
            .set_reference_placement(layer_id, placement)?;
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

    /// The current Marquee, or `nil` when no selection exists.
    fn marquee(&self) -> Option<AppleMarqueeRegion> {
        self.inner.lock().unwrap().marquee().map(Into::into)
    }

    /// Sets or clears the current Marquee. Errors when `region` is invalid —
    /// zero or above-`i32::MAX` width/height, or a far corner outside the
    /// `i32` coordinate space; the previous Marquee is preserved in that
    /// case.
    fn set_marquee(&self, region: Option<AppleMarqueeRegion>) -> Result<(), AppleError> {
        let marquee = region.map(AppleMarqueeRegion::to_core).transpose()?;
        self.inner.lock().unwrap().set_marquee(marquee);
        Ok(())
    }

    /// 4-connected flood fill on the active layer starting at `(x, y)`,
    /// constrained to `bounds` — the fill the Marquee clipping mode routes
    /// through. Returns `true` when at least one pixel was changed; negative
    /// coordinates short-circuit to `false`, mirroring `flood_fill`. Errors
    /// when `bounds` is an invalid record — zero or above-`i32::MAX`
    /// width/height, or a far corner outside the `i32` coordinate space.
    fn flood_fill_bounded(
        &self,
        x: i32,
        y: i32,
        fill_color: Color,
        bounds: AppleMarqueeRegion,
    ) -> Result<bool, AppleError> {
        let bounds = bounds.to_core()?;
        if x < 0 || y < 0 {
            return Ok(false);
        }
        Ok(self
            .inner
            .lock()
            .unwrap()
            .flood_fill_bounded(x as u32, y as u32, fill_color, bounds))
    }

    /// Copies pixels inside the current Marquee from the active Pixel Layer
    /// into a row-major RGBA buffer (`width * height * 4` bytes; pixels
    /// outside the canvas come back transparent). Returns an empty buffer
    /// when no Marquee exists or the active layer is a Reference Layer.
    fn lift_marquee_pixels(&self) -> Vec<u8> {
        self.inner.lock().unwrap().lift_marquee_pixels()
    }

    /// Clears pixels inside the current Marquee on the active Pixel Layer to
    /// transparent; the Marquee itself is preserved. No-op when no Marquee
    /// exists or the active layer is a Reference Layer.
    fn clear_marquee_pixels(&self) {
        self.inner.lock().unwrap().clear_marquee_pixels();
    }

    /// Source-over composites a row-major RGBA `buffer` at `region` on the
    /// active Pixel Layer; pixels landing outside the canvas are skipped.
    /// No-op when the active layer is a Reference Layer. Errors when `region`
    /// is invalid, when its byte length overflows the address space, or when
    /// `buffer.len()` is not exactly `region.width * region.height * 4` —
    /// the core treats that as a programming error (panic), so it is
    /// validated here at the boundary.
    fn composite_buffer_at(
        &self,
        buffer: Vec<u8>,
        region: AppleMarqueeRegion,
    ) -> Result<(), AppleError> {
        let region = region.to_core()?;
        let expected = u64::from(region.width())
            .checked_mul(u64::from(region.height()))
            .and_then(|pixels| pixels.checked_mul(4))
            .and_then(|bytes| usize::try_from(bytes).ok())
            .ok_or_else(|| AppleError::Document {
                message: format!(
                    "Region dimensions are too large for an RGBA buffer: {} × {}",
                    region.width(),
                    region.height()
                ),
            })?;
        if buffer.len() != expected {
            return Err(AppleError::Document {
                message: format!(
                    "Region buffer must be region.width * region.height * 4 = {expected} bytes, got {}",
                    buffer.len()
                ),
            });
        }
        self.inner
            .lock()
            .unwrap()
            .composite_buffer_at(&buffer, region);
        Ok(())
    }

    /// The full composite with one Pixel Layer's active-frame cel replaced by
    /// a copy carrying `patch` at `(dest_x, dest_y)` — the non-mutating read
    /// the Metal render path uses to preview a Floating Selection. The
    /// document itself is untouched. Errors when no layer has `layer_id`,
    /// when it is a Reference Layer, or when `patch.len()` is not exactly
    /// `patch_width * patch_height * 4`.
    fn composite_with_layer_patch(
        &self,
        layer_id: String,
        patch: Vec<u8>,
        patch_width: u32,
        patch_height: u32,
        dest_x: i32,
        dest_y: i32,
    ) -> Result<Vec<u8>, AppleError> {
        let id = parse_layer_id(&layer_id)?;
        Ok(self.inner.lock().unwrap().composite_with_layer_patch(
            id,
            &patch,
            patch_width,
            patch_height,
            dest_x,
            dest_y,
        )?)
    }

    /// Mirrors the whole canvas horizontally — every Pixel Layer's every cel
    /// (all frames), regardless of the active layer; dimensions are
    /// unchanged, Reference Layers stay fixed, and an active Marquee is
    /// mirrored across the same axis and clipped to the canvas.
    fn flip_canvas_horizontal(&self) {
        self.inner.lock().unwrap().flip_canvas_horizontal();
    }

    /// Mirrors the whole canvas vertically. Mirror of
    /// `flip_canvas_horizontal`.
    fn flip_canvas_vertical(&self) {
        self.inner.lock().unwrap().flip_canvas_vertical();
    }

    /// Rotates the whole canvas 90° clockwise — every Pixel Layer's every
    /// cel (all frames) turns, the canvas width/height swap, Reference
    /// Layers stay fixed, and an active Marquee is carried through the same
    /// quarter-turn and clipped to the new canvas.
    fn rotate_canvas_cw(&self) {
        self.inner.lock().unwrap().rotate_canvas_cw();
    }

    /// Rotates the whole canvas 90° counter-clockwise. Mirror of
    /// `rotate_canvas_cw`.
    fn rotate_canvas_ccw(&self) {
        self.inner.lock().unwrap().rotate_canvas_ccw();
    }

    /// Mirrors the current Marquee region on the active Pixel Layer's
    /// active-frame cel horizontally; the Marquee position is unchanged.
    /// Other layers, other frames, and pixels outside the Marquee are
    /// untouched. No-op without a Marquee or on a Reference Layer.
    fn flip_marquee_horizontal(&self) {
        self.inner.lock().unwrap().flip_marquee_horizontal();
    }

    /// Mirrors the current Marquee region vertically. Mirror of
    /// `flip_marquee_horizontal`.
    fn flip_marquee_vertical(&self) {
        self.inner.lock().unwrap().flip_marquee_vertical();
    }

    /// Rotates the current Marquee region on the active Pixel Layer's
    /// active-frame cel 90° clockwise: the region's `W×H` pixels become an
    /// `H×W` block re-centered on the region's center and clipped to the
    /// canvas, and the Marquee updates to wrap it. No-op without a Marquee
    /// or on a Reference Layer.
    fn rotate_marquee_cw(&self) {
        self.inner.lock().unwrap().rotate_marquee_cw();
    }

    /// Rotates the current Marquee region 90° counter-clockwise. Mirror of
    /// `rotate_marquee_cw`.
    fn rotate_marquee_ccw(&self) {
        self.inner.lock().unwrap().rotate_marquee_ccw();
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

    // -- Frame axis --

    /// Every frame's metadata in axis order — the first element is the first
    /// frame, displayed as ordinal 1. The frame-axis mirror of `layers`.
    fn frames(&self) -> Vec<AppleFrameMetadata> {
        self.inner
            .lock()
            .unwrap()
            .frames()
            .iter()
            .map(|frame| AppleFrameMetadata {
                id: frame.id.to_string(),
                duration_ms: frame.duration_ms,
            })
            .collect()
    }

    fn active_frame_id(&self) -> String {
        self.inner.lock().unwrap().active_frame_id().to_string()
    }

    /// The number of frames on the axis — the ruler's extent, read without
    /// marshalling every frame's metadata. `u64` because UniFFI has no
    /// `usize`.
    fn frame_count(&self) -> u64 {
        self.inner.lock().unwrap().frames().len() as u64
    }

    /// RGBA row-major composite buffer (`width * height * 4` bytes) of the
    /// frame identified by `frame_id`, without moving the active-frame
    /// pointer — the read-only, frame-addressed sibling of `composite` that
    /// playback, onion skin, and the export encoders read frame by frame.
    ///
    /// The core trusts a validated id, so this boundary confirms the frame
    /// exists before delegating. Errors only when `frame_id` is not a valid
    /// UUID string or no frame with that id is on the axis.
    fn composite_at(&self, frame_id: String) -> Result<Vec<u8>, AppleError> {
        let id = parse_frame_id(&frame_id)?;
        let document = self.inner.lock().unwrap();
        if !document.frames().iter().any(|f| f.id == id) {
            return Err(AppleError::Document {
                message: format!("Frame with id {id} not found"),
            });
        }
        Ok(document.composite_at(id))
    }

    /// The ids of the Pixel Layers whose cel at `frame_id` is content-bearing
    /// (any pixel with a non-zero alpha), in stack order — the timeline grid's
    /// occupied/empty indicator, read as one list per frame column rather than
    /// one cel buffer per `[layer × frame]` cell.
    ///
    /// Occupancy is a property of the cel's pixels alone: a hidden Layer's cel
    /// still reports occupied, and a Reference Layer never does (it is
    /// frame-independent and holds no cels).
    ///
    /// Errors only when `frame_id` is not a valid UUID string or no frame with
    /// that id is on the axis.
    fn occupied_layer_ids(&self, frame_id: String) -> Result<Vec<String>, AppleError> {
        let id = parse_frame_id(&frame_id)?;
        let document = self.inner.lock().unwrap();
        if !document.frames().iter().any(|f| f.id == id) {
            return Err(AppleError::Document {
                message: format!("Frame with id {id} not found"),
            });
        }
        Ok(document
            .layers()
            .iter()
            .enumerate()
            .filter(|(stack_index, _)| cel_is_occupied(&document, *stack_index, id))
            .map(|(_, layer)| layer.id.to_string())
            .collect())
    }

    /// Whether the single cel where `layer_id` crosses `frame_id` is
    /// content-bearing — the same predicate `occupied_layer_ids` applies, read
    /// one cel at a time.
    ///
    /// This is the shell's re-probe for a Cel it knows is the only one that
    /// can have changed: while a stroke is live, its target cel. Reading the
    /// whole column there would rescan every other Pixel Layer's buffer per
    /// stroke sample.
    ///
    /// A layer that holds no cel at this frame — a Reference Layer, which is
    /// frame-independent — reports `false` rather than erroring. Errors only
    /// when either id is not a valid UUID string, no frame with `frame_id` is
    /// on the axis, or no layer with `layer_id` is in the stack.
    fn is_cel_occupied(&self, frame_id: String, layer_id: String) -> Result<bool, AppleError> {
        let frame = parse_frame_id(&frame_id)?;
        let layer = parse_layer_id(&layer_id)?;
        let document = self.inner.lock().unwrap();
        if !document.frames().iter().any(|f| f.id == frame) {
            return Err(AppleError::Document {
                message: format!("Frame with id {frame} not found"),
            });
        }
        let Some(stack_index) = document.layers().iter().position(|l| l.id == layer) else {
            return Err(AppleError::Document {
                message: format!("Layer with id {layer} not found"),
            });
        };
        Ok(cel_is_occupied(&document, stack_index, frame))
    }

    /// Inserts a transparent frame directly after the active frame, seeds a
    /// cel for it on every Pixel Layer, and makes it active. Errors when
    /// `new_id` is not a valid UUID string or a frame with the same id is
    /// already on the axis.
    fn add_frame(&self, new_id: String) -> Result<(), AppleError> {
        let id = parse_frame_id(&new_id)?;
        let mut document = self.inner.lock().unwrap();
        if document.frames().iter().any(|f| f.id == id) {
            return Err(AppleError::Document {
                message: format!("Frame with id {id} already exists"),
            });
        }
        document.add_frame(id);
        Ok(())
    }

    /// Inserts a deep copy of the active frame directly after it — cloning
    /// every Pixel Layer's active-frame cel and inheriting the source frame's
    /// duration — and makes the copy active. Errors when `new_id` is not a
    /// valid UUID string or is already on the axis.
    fn duplicate_frame(&self, new_id: String) -> Result<(), AppleError> {
        let id = parse_frame_id(&new_id)?;
        let mut document = self.inner.lock().unwrap();
        if document.frames().iter().any(|f| f.id == id) {
            return Err(AppleError::Document {
                message: format!("Frame with id {id} already exists"),
            });
        }
        document.duplicate_frame(id);
        Ok(())
    }

    /// Removes the frame with `id` and drops its cel from every Pixel Layer.
    /// Errors when the frame is not on the axis or when removing it would
    /// empty the axis (a document must always contain at least one frame).
    /// When the removed frame was active, the active pointer moves to the
    /// frame below it, falling back to the frame above when it was the first.
    fn remove_frame(&self, id: String) -> Result<(), AppleError> {
        let frame_id = parse_frame_id(&id)?;
        Ok(self.inner.lock().unwrap().remove_frame(frame_id)?)
    }

    /// Moves the frame with `id` to `new_index` (0-based axis position),
    /// silently clamped to the axis bounds. The active frame pointer is
    /// preserved (tracked by id), and each Pixel Layer's cels stay keyed by
    /// frame id, so cel contents follow their frame. Errors for an unknown id.
    /// `new_index` is `u64` because UniFFI does not support `usize`.
    fn reorder_frame(&self, id: String, new_index: u64) -> Result<(), AppleError> {
        let frame_id = parse_frame_id(&id)?;
        Ok(self
            .inner
            .lock()
            .unwrap()
            .reorder_frame(frame_id, new_index as usize)?)
    }

    /// Sets the active frame by id. Errors when no frame with `id` is on the
    /// axis; the previous active frame is preserved on error.
    fn set_active_frame(&self, id: String) -> Result<(), AppleError> {
        let frame_id = parse_frame_id(&id)?;
        Ok(self.inner.lock().unwrap().set_active_frame(frame_id)?)
    }

    /// Sets the display duration of the frame with `id`, clamped at this
    /// boundary to `[frame_min_duration_ms, frame_max_duration_ms]` before
    /// reaching the core — the core trusts whatever it is given, so the range
    /// is the binding's to own. Clamping never errors; the call errors only
    /// when `id` is not a valid UUID string or no frame with that id is on the
    /// axis.
    ///
    /// Unlike the web binding, `duration_ms` arrives as a `u32` rather than a
    /// float: Swift's type system already stops a negative or fractional value
    /// at the call site, so the clamp has no wrap-around to defend against.
    fn set_frame_duration(&self, id: String, duration_ms: u32) -> Result<(), AppleError> {
        let frame_id = parse_frame_id(&id)?;
        let clamped = duration_ms.clamp(Self::MIN_FRAME_DURATION_MS, Self::MAX_FRAME_DURATION_MS);
        Ok(self
            .inner
            .lock()
            .unwrap()
            .set_frame_duration(frame_id, clamped)?)
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

    /// Clamps pan so an arbitrary document-space content rectangle stays
    /// reachable — the Navigation Bounds sink (canvas ∪ Reference footprint,
    /// unioned shell-side like the web).
    fn clamp_pan_to_document_bounds(
        &self,
        min_x: f64,
        min_y: f64,
        max_x: f64,
        max_y: f64,
        viewport_size: ViewportSize,
    ) -> Arc<AppleViewport> {
        Arc::new(AppleViewport {
            inner: self.inner.clamp_pan_to_document_bounds(
                min_x,
                min_y,
                max_x,
                max_y,
                viewport_size,
            ),
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
