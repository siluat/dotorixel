/// Screen→canvas conversion result. May contain negative values when
/// clicking outside canvas bounds. Distinct from `CanvasCoords(u32)`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "uniffi", derive(uniffi::Record))]
pub struct ScreenCanvasCoords {
    pub x: i32,
    pub y: i32,
}

impl ScreenCanvasCoords {
    pub const fn new(x: i32, y: i32) -> Self {
        Self { x, y }
    }
}

/// Display area size in screen pixels.
#[derive(Debug, Clone, Copy, PartialEq)]
#[cfg_attr(feature = "uniffi", derive(uniffi::Record))]
pub struct ViewportSize {
    pub width: f64,
    pub height: f64,
}

/// Viewport coordinate transform state. Excludes rendering concerns
/// (grid visibility, grid color) — those belong in the view layer.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Viewport {
    /// Physical pixel dimension — Bevy UVec2, image u32 convention.
    pub pixel_size: u32,
    /// Continuous zoom factor (pinch zoom uses `exp()`).
    pub zoom: f64,
    /// Horizontal pan offset in screen pixels. Rounded at consumption site.
    pub pan_x: f64,
    /// Vertical pan offset in screen pixels. Rounded at consumption site.
    pub pan_y: f64,
}

impl Viewport {
    pub const TARGET_DISPLAY_SIZE: u32 = 512;
    pub const ZOOM_LEVELS: &[f64] = &[0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0];
    pub const MIN_ZOOM: f64 = 0.25;
    pub const MAX_ZOOM: f64 = 16.0;
    pub const MIN_VISIBLE_MARGIN: f64 = 16.0;
    const PINCH_ZOOM_SENSITIVITY: f64 = 0.01;
    const ZOOM_LEVEL_EPSILON: f64 = 1e-9;

    // ── Construction ────────────────────────────────────────────

    /// Creates a viewport with default settings for the given canvas dimensions.
    pub fn for_canvas(canvas_width: u32, canvas_height: u32) -> Self {
        Self {
            pixel_size: Self::default_pixel_size(canvas_width, canvas_height),
            zoom: 1.0,
            pan_x: 0.0,
            pan_y: 0.0,
        }
    }

    // ── Associated functions (zoom utilities, no &self) ─────────

    /// Computes the default pixel size so the canvas fills ~512px on screen.
    ///
    /// # Panics
    ///
    /// Panics if both `canvas_width` and `canvas_height` are zero.
    pub fn default_pixel_size(canvas_width: u32, canvas_height: u32) -> u32 {
        Self::TARGET_DISPLAY_SIZE / canvas_width.max(canvas_height)
    }

    /// Clamps a zoom value to `[MIN_ZOOM, MAX_ZOOM]`.
    pub fn clamp_zoom(zoom: f64) -> f64 {
        zoom.clamp(Self::MIN_ZOOM, Self::MAX_ZOOM)
    }

    /// Computes new zoom from a pinch gesture's deltaY.
    /// Negates deltaY: WheelEvent deltaY > 0 means "scroll down" / "zoom out",
    /// but scale > 1 is zoom-in, so the sign is inverted.
    pub fn compute_pinch_zoom(current_zoom: f64, delta_y: f64) -> f64 {
        let scale = (-delta_y * Self::PINCH_ZOOM_SENSITIVITY).exp();
        Self::clamp_zoom(current_zoom * scale)
    }

    /// Returns the next discrete zoom level above `current_zoom`.
    /// Returns `MAX_ZOOM` if already at or above the maximum.
    pub fn next_zoom_level(current_zoom: f64) -> f64 {
        for &level in Self::ZOOM_LEVELS {
            if level > current_zoom + Self::ZOOM_LEVEL_EPSILON {
                return level;
            }
        }
        *Self::ZOOM_LEVELS.last().unwrap()
    }

    /// Returns the previous discrete zoom level below `current_zoom`.
    /// Returns `MIN_ZOOM` if already at or below the minimum.
    pub fn prev_zoom_level(current_zoom: f64) -> f64 {
        for &level in Self::ZOOM_LEVELS.iter().rev() {
            if level < current_zoom - Self::ZOOM_LEVEL_EPSILON {
                return level;
            }
        }
        Self::ZOOM_LEVELS[0]
    }

    // ── Instance methods ────────────────────────────────────────

    /// Effective pixel size on screen, rounded to integer to prevent
    /// subpixel misalignment during continuous zoom.
    pub fn effective_pixel_size(&self) -> f64 {
        (self.pixel_size as f64 * self.zoom).round()
    }

    /// Converts screen coordinates to canvas pixel coordinates.
    /// Uses `floor()` → `as i32` so clicks outside the canvas produce
    /// negative values (captured by `ScreenCanvasCoords`).
    pub fn screen_to_canvas(&self, screen_x: f64, screen_y: f64) -> ScreenCanvasCoords {
        let scaled_pixel = self.effective_pixel_size();
        ScreenCanvasCoords {
            x: ((screen_x - self.pan_x.round()) / scaled_pixel).floor() as i32,
            y: ((screen_y - self.pan_y.round()) / scaled_pixel).floor() as i32,
        }
    }

    /// Computes the canvas display size in screen pixels.
    pub fn display_size(&self, canvas_width: u32, canvas_height: u32) -> ViewportSize {
        let scaled_pixel = self.effective_pixel_size();
        ViewportSize {
            width: canvas_width as f64 * scaled_pixel,
            height: canvas_height as f64 * scaled_pixel,
        }
    }

    /// Returns a new viewport zoomed to `new_zoom` while keeping the
    /// canvas point under `(screen_x, screen_y)` fixed.
    ///
    /// Uses continuous f64 canvas coordinates (no floor) for sub-pixel
    /// precision — unlike `screen_to_canvas` which discretizes.
    pub fn zoom_at_point(&self, screen_x: f64, screen_y: f64, new_zoom: f64) -> Self {
        let old_scaled_pixel = self.effective_pixel_size();
        let new_scaled_pixel = (self.pixel_size as f64 * new_zoom).round();

        // Canvas coordinate under cursor (continuous, not discretized)
        let canvas_x = (screen_x - self.pan_x.round()) / old_scaled_pixel;
        let canvas_y = (screen_y - self.pan_y.round()) / old_scaled_pixel;

        Self {
            pixel_size: self.pixel_size,
            zoom: new_zoom,
            pan_x: screen_x - canvas_x * new_scaled_pixel,
            pan_y: screen_y - canvas_y * new_scaled_pixel,
        }
    }

    /// Returns a new viewport with pan offset shifted by the given delta.
    pub fn pan(&self, delta_x: f64, delta_y: f64) -> Self {
        Self {
            pan_x: self.pan_x + delta_x,
            pan_y: self.pan_y + delta_y,
            ..*self
        }
    }

    /// Clamps pan so the canvas stays visible.
    ///
    /// When the canvas fits inside the viewport, it is fully contained
    /// (no negative pan). When it overflows, at least `margin` pixels
    /// remain visible on each edge.
    pub fn clamp_pan(
        &self,
        canvas_width: u32,
        canvas_height: u32,
        viewport_size: ViewportSize,
    ) -> Self {
        let scaled_pixel = self.effective_pixel_size();
        let margin = scaled_pixel.max(Self::MIN_VISIBLE_MARGIN);
        let canvas_display_width = canvas_width as f64 * scaled_pixel;
        let canvas_display_height = canvas_height as f64 * scaled_pixel;

        let (min_pan_x, max_pan_x) = if canvas_display_width <= viewport_size.width {
            (0.0, viewport_size.width - canvas_display_width)
        } else {
            (margin - canvas_display_width, viewport_size.width - margin)
        };

        let (min_pan_y, max_pan_y) = if canvas_display_height <= viewport_size.height {
            (0.0, viewport_size.height - canvas_display_height)
        } else {
            (margin - canvas_display_height, viewport_size.height - margin)
        };

        Self {
            pan_x: self.pan_x.clamp(min_pan_x, max_pan_x),
            pan_y: self.pan_y.clamp(min_pan_y, max_pan_y),
            ..*self
        }
    }

    /// Returns a viewport that fits and centers the canvas within
    /// the given viewport size. The `max_zoom` parameter caps the zoom
    /// level — pass `1.0` to prevent enlarging beyond the default pixel
    /// size, or `f64::INFINITY` for unconstrained fitting.
    pub fn fit_to_viewport(
        &self,
        canvas_width: u32,
        canvas_height: u32,
        viewport_size: ViewportSize,
        max_zoom: f64,
    ) -> Self {
        let fit_zoom = (viewport_size.width / (canvas_width as f64 * self.pixel_size as f64))
            .min(viewport_size.height / (canvas_height as f64 * self.pixel_size as f64))
            .min(max_zoom);
        let scaled_pixel = (self.pixel_size as f64 * fit_zoom).round();
        let pan_x = (viewport_size.width - canvas_width as f64 * scaled_pixel) / 2.0;
        let pan_y = (viewport_size.height - canvas_height as f64 * scaled_pixel) / 2.0;

        Self {
            pixel_size: self.pixel_size,
            zoom: fit_zoom,
            pan_x,
            pan_y,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Test helper — creates a Viewport with sensible defaults and overrides.
    fn make_viewport(pixel_size: u32, zoom: f64, pan_x: f64, pan_y: f64) -> Viewport {
        Viewport {
            pixel_size,
            zoom,
            pan_x,
            pan_y,
        }
    }

    /// Shorthand for the most common test viewport (pixel_size=32, zoom=1, no pan).
    fn default_test_viewport() -> Viewport {
        make_viewport(32, 1.0, 0.0, 0.0)
    }

    // ── default_pixel_size ──────────────────────────────────────

    #[test]
    fn default_pixel_size_for_square_canvases() {
        assert_eq!(Viewport::default_pixel_size(8, 8), 64);
        assert_eq!(Viewport::default_pixel_size(16, 16), 32);
        assert_eq!(Viewport::default_pixel_size(32, 32), 16);
    }

    #[test]
    fn default_pixel_size_uses_larger_dimension() {
        assert_eq!(Viewport::default_pixel_size(16, 32), 16);
        assert_eq!(Viewport::default_pixel_size(32, 16), 16);
    }

    // ── display_size ────────────────────────────────────────────

    #[test]
    fn display_size_from_canvas_dimensions_and_pixel_size() {
        let vp = default_test_viewport();
        let size = vp.display_size(16, 16);
        assert_eq!(size, ViewportSize { width: 512.0, height: 512.0 });
    }

    #[test]
    fn display_size_with_different_pixel_size() {
        let vp = make_viewport(10, 1.0, 0.0, 0.0);
        let size = vp.display_size(8, 8);
        assert_eq!(size, ViewportSize { width: 80.0, height: 80.0 });
    }

    #[test]
    fn display_size_accounts_for_zoom() {
        let vp = make_viewport(32, 2.0, 0.0, 0.0);
        let size = vp.display_size(16, 16);
        assert_eq!(size, ViewportSize { width: 1024.0, height: 1024.0 });
    }

    // ── effective_pixel_size ────────────────────────────────────

    #[test]
    fn effective_pixel_size_basic() {
        assert_eq!(make_viewport(32, 2.0, 0.0, 0.0).effective_pixel_size(), 64.0);
    }

    #[test]
    fn effective_pixel_size_fractional_zoom() {
        assert_eq!(make_viewport(32, 0.5, 0.0, 0.0).effective_pixel_size(), 16.0);
    }

    #[test]
    fn effective_pixel_size_rounds_for_continuous_zoom() {
        // 32 * 1.284 = 41.088 → 41
        assert_eq!(make_viewport(32, 1.284, 0.0, 0.0).effective_pixel_size(), 41.0);
        // 32 * 1.3 = 41.6 → 42
        assert_eq!(make_viewport(32, 1.3, 0.0, 0.0).effective_pixel_size(), 42.0);
    }

    // ── screen_to_canvas ────────────────────────────────────────

    #[test]
    fn screen_to_canvas_origin() {
        let vp = default_test_viewport();
        assert_eq!(vp.screen_to_canvas(0.0, 0.0), ScreenCanvasCoords::new(0, 0));
    }

    #[test]
    fn screen_to_canvas_within_pixel() {
        let vp = default_test_viewport();
        assert_eq!(vp.screen_to_canvas(1.0, 1.0), ScreenCanvasCoords::new(0, 0));
        assert_eq!(vp.screen_to_canvas(31.0, 31.0), ScreenCanvasCoords::new(0, 0));
    }

    #[test]
    fn screen_to_canvas_pixel_boundary() {
        let vp = default_test_viewport();
        assert_eq!(vp.screen_to_canvas(32.0, 0.0), ScreenCanvasCoords::new(1, 0));
        assert_eq!(vp.screen_to_canvas(0.0, 32.0), ScreenCanvasCoords::new(0, 1));
    }

    #[test]
    fn screen_to_canvas_different_pixel_size() {
        let vp = make_viewport(10, 1.0, 0.0, 0.0);
        assert_eq!(vp.screen_to_canvas(25.0, 15.0), ScreenCanvasCoords::new(2, 1));
    }

    #[test]
    fn screen_to_canvas_floors_fractional_coordinates() {
        let vp = default_test_viewport();
        assert_eq!(vp.screen_to_canvas(33.7, 65.9), ScreenCanvasCoords::new(1, 2));
    }

    #[test]
    fn screen_to_canvas_accounts_for_zoom() {
        let vp = make_viewport(32, 2.0, 0.0, 0.0);
        // effective_pixel_size = 64
        assert_eq!(vp.screen_to_canvas(64.0, 0.0), ScreenCanvasCoords::new(1, 0));
        assert_eq!(vp.screen_to_canvas(63.0, 0.0), ScreenCanvasCoords::new(0, 0));
    }

    #[test]
    fn screen_to_canvas_accounts_for_pan() {
        let vp = make_viewport(32, 1.0, 100.0, 50.0);
        assert_eq!(vp.screen_to_canvas(100.0, 50.0), ScreenCanvasCoords::new(0, 0));
        assert_eq!(vp.screen_to_canvas(132.0, 50.0), ScreenCanvasCoords::new(1, 0));
    }

    #[test]
    fn screen_to_canvas_zoom_and_pan_combined() {
        let vp = make_viewport(32, 2.0, 50.0, 50.0);
        // eps = 64, (50 - 50) / 64 = 0
        assert_eq!(vp.screen_to_canvas(50.0, 50.0), ScreenCanvasCoords::new(0, 0));
        // (114 - 50) / 64 = 1
        assert_eq!(vp.screen_to_canvas(114.0, 50.0), ScreenCanvasCoords::new(1, 0));
    }

    // ── for_canvas ──────────────────────────────────────────────

    #[test]
    fn for_canvas_sets_correct_pixel_size() {
        let vp = Viewport::for_canvas(16, 16);
        assert_eq!(vp.pixel_size, 32);
    }

    #[test]
    fn for_canvas_initializes_zoom_and_pan_defaults() {
        let vp = Viewport::for_canvas(16, 16);
        assert_eq!(vp.zoom, 1.0);
        assert_eq!(vp.pan_x, 0.0);
        assert_eq!(vp.pan_y, 0.0);
    }

    #[test]
    fn for_canvas_produces_target_display_size() {
        for size in [8, 16, 32] {
            let vp = Viewport::for_canvas(size, size);
            let display = vp.display_size(size, size);
            assert_eq!(display.width, 512.0);
            assert_eq!(display.height, 512.0);
        }
    }

    #[test]
    fn for_canvas_uses_larger_dimension_for_rectangular() {
        let vp = Viewport::for_canvas(32, 64);
        assert_eq!(vp.pixel_size, 8);
    }

    // ── zoom_at_point ───────────────────────────────────────────

    #[test]
    fn zoom_at_point_preserves_canvas_coordinate_under_cursor() {
        let vp = default_test_viewport();
        let screen_x = 160.0;
        let screen_y = 96.0;

        let before = vp.screen_to_canvas(screen_x, screen_y);
        let zoomed = vp.zoom_at_point(screen_x, screen_y, 2.0);
        let after = zoomed.screen_to_canvas(screen_x, screen_y);

        assert_eq!(after, before);
    }

    #[test]
    fn zoom_at_point_updates_zoom_level() {
        let vp = make_viewport(32, 1.0, 0.0, 0.0);
        let result = vp.zoom_at_point(100.0, 100.0, 4.0);
        assert_eq!(result.zoom, 4.0);
    }

    #[test]
    fn zoom_at_point_preserves_pixel_size() {
        let vp = default_test_viewport();
        let result = vp.zoom_at_point(0.0, 0.0, 2.0);
        assert_eq!(result.pixel_size, 32);
    }

    // ── pan ─────────────────────────────────────────────────────

    #[test]
    fn pan_applies_delta() {
        let vp = make_viewport(32, 1.0, 10.0, 20.0);
        let result = vp.pan(5.0, -10.0);
        assert_eq!(result.pan_x, 15.0);
        assert_eq!(result.pan_y, 10.0);
    }

    #[test]
    fn pan_preserves_other_properties() {
        let vp = make_viewport(32, 2.0, 0.0, 0.0);
        let result = vp.pan(100.0, 200.0);
        assert_eq!(result.zoom, 2.0);
        assert_eq!(result.pixel_size, 32);
    }

    // ── clamp_pan ───────────────────────────────────────────────

    // Canvas fits inside viewport (containment mode)
    // pixel_size=32, zoom=1 → eps=32, canvasDisplay=512×512
    // viewport 800×600: both axes fit (512 < 800, 512 < 600)
    // X bounds: 0 ≤ panX ≤ 800-512 = 288
    // Y bounds: 0 ≤ panY ≤ 600-512 = 88

    const VP_SIZE: ViewportSize = ViewportSize { width: 800.0, height: 600.0 };

    #[test]
    fn clamp_pan_unchanged_when_within_bounds() {
        let vp = make_viewport(32, 1.0, 100.0, 50.0);
        let result = vp.clamp_pan(16, 16, VP_SIZE);
        assert_eq!(result.pan_x, 100.0);
        assert_eq!(result.pan_y, 50.0);
    }

    #[test]
    fn clamp_pan_clamps_negative_pan_x_when_canvas_fits() {
        let vp = make_viewport(32, 1.0, -50.0, 0.0);
        let result = vp.clamp_pan(16, 16, VP_SIZE);
        assert_eq!(result.pan_x, 0.0);
        assert_eq!(result.pan_y, 0.0);
    }

    #[test]
    fn clamp_pan_clamps_pan_x_to_keep_right_edge_inside() {
        let vp = make_viewport(32, 1.0, 400.0, 0.0);
        let result = vp.clamp_pan(16, 16, VP_SIZE);
        assert_eq!(result.pan_x, 288.0);
        assert_eq!(result.pan_y, 0.0);
    }

    #[test]
    fn clamp_pan_clamps_negative_pan_y_when_canvas_fits() {
        let vp = make_viewport(32, 1.0, 0.0, -10.0);
        let result = vp.clamp_pan(16, 16, VP_SIZE);
        assert_eq!(result.pan_x, 0.0);
        assert_eq!(result.pan_y, 0.0);
    }

    #[test]
    fn clamp_pan_clamps_pan_y_to_keep_bottom_edge_inside() {
        let vp = make_viewport(32, 1.0, 0.0, 200.0);
        let result = vp.clamp_pan(16, 16, VP_SIZE);
        assert_eq!(result.pan_x, 0.0);
        assert_eq!(result.pan_y, 88.0);
    }

    #[test]
    fn clamp_pan_clamps_both_axes() {
        let vp = make_viewport(32, 1.0, -999.0, 999.0);
        let result = vp.clamp_pan(16, 16, VP_SIZE);
        assert_eq!(result.pan_x, 0.0);
        assert_eq!(result.pan_y, 88.0);
    }

    // Canvas overflows viewport (margin mode)
    // 8×8, pixel_size=64, zoom=16 → eps=1024, canvasDisplay=8192×8192
    // margin = max(1024, 16) = 1024
    // X: minPanX = 1024-8192 = -7168, maxPanX = 800-1024 = -224
    // Y: minPanY = 1024-8192 = -7168, maxPanY = 600-1024 = -424

    #[test]
    fn clamp_pan_margin_mode_when_canvas_overflows() {
        let vp = make_viewport(64, 16.0, 0.0, 0.0);
        let result = vp.clamp_pan(8, 8, VP_SIZE);
        assert_eq!(result.pan_x, -224.0);
        assert_eq!(result.pan_y, -424.0);
    }

    #[test]
    fn clamp_pan_margin_mode_clamps_to_min_bound() {
        let vp = make_viewport(64, 16.0, -9999.0, -9999.0);
        let result = vp.clamp_pan(8, 8, VP_SIZE);
        assert_eq!(result.pan_x, -7168.0);
        assert_eq!(result.pan_y, -7168.0);
    }

    // Mixed axes: one fits, the other overflows
    #[test]
    fn clamp_pan_containment_on_fitting_axis_margin_on_overflowing() {
        // 64×8 canvas, pixel_size=16, zoom=1 → eps=16
        // X: 64×16 = 1024 > 800 → margin mode, margin=max(16,16)=16
        //    minPanX = 16-1024 = -1008, maxPanX = 800-16 = 784
        // Y: 8×16 = 128 ≤ 600 → containment
        //    minPanY = 0, maxPanY = 600-128 = 472
        let vp = make_viewport(16, 1.0, -2000.0, -50.0);
        let result = vp.clamp_pan(64, 8, VP_SIZE);
        assert_eq!(result.pan_x, -1008.0);
        assert_eq!(result.pan_y, 0.0);
    }

    // Canvas exactly equals viewport
    #[test]
    fn clamp_pan_locks_to_zero_when_canvas_equals_viewport() {
        // pixel_size=50, zoom=1 → eps=50, canvasDisplay = 16×50 = 800 === viewport width
        // 800 <= 800 → containment: minPanX=0, maxPanX=800-800=0
        let vp = make_viewport(50, 1.0, 100.0, 0.0);
        let result = vp.clamp_pan(16, 16, VP_SIZE);
        assert_eq!(result.pan_x, 0.0);
    }

    // Low zoom: canvas fits, fully contained
    #[test]
    fn clamp_pan_keeps_small_canvas_inside_at_low_zoom() {
        // pixel_size=32, zoom=0.25 → eps=8, canvasDisplay=128×128
        // Fits → containment: 0 ≤ panX ≤ 672, 0 ≤ panY ≤ 472
        let vp = make_viewport(32, 0.25, -200.0, 0.0);
        let result = vp.clamp_pan(16, 16, VP_SIZE);
        assert_eq!(result.pan_x, 0.0);
        assert_eq!(result.pan_y, 0.0);
    }

    #[test]
    fn clamp_pan_preserves_non_pan_properties() {
        let vp = make_viewport(32, 2.0, -9999.0, -9999.0);
        let result = vp.clamp_pan(16, 16, VP_SIZE);
        assert_eq!(result.pixel_size, 32);
        assert_eq!(result.zoom, 2.0);
    }

    // ── fit_to_viewport ─────────────────────────────────────────

    #[test]
    fn fit_to_viewport_centers_canvas() {
        let vp = default_test_viewport();
        let result =
            vp.fit_to_viewport(16, 16, ViewportSize { width: 800.0, height: 600.0 }, f64::INFINITY);

        let eps = result.effective_pixel_size();
        let display_width = 16.0 * eps;
        let display_height = 16.0 * eps;

        let expected_pan_x = (800.0 - display_width) / 2.0;
        let expected_pan_y = (600.0 - display_height) / 2.0;

        assert!((result.pan_x - expected_pan_x).abs() < 1e-6);
        assert!((result.pan_y - expected_pan_y).abs() < 1e-6);
    }

    #[test]
    fn fit_to_viewport_fits_canvas_within_bounds() {
        let vp = default_test_viewport();
        let viewport_size = ViewportSize { width: 400.0, height: 300.0 };
        let result = vp.fit_to_viewport(16, 16, viewport_size, f64::INFINITY);

        let eps = 32.0 * result.zoom;
        assert!(16.0 * eps <= viewport_size.width);
        assert!(16.0 * eps <= viewport_size.height);
    }

    #[test]
    fn fit_to_viewport_does_not_enlarge_when_max_zoom_capped() {
        let vp = default_test_viewport(); // pixel_size=32, 16×16 → display 512×512
        let viewport_size = ViewportSize { width: 800.0, height: 600.0 };
        let result = vp.fit_to_viewport(16, 16, viewport_size, 1.0);

        assert!(result.zoom <= 1.0);
        // Canvas should be centered at default size (512×512)
        let eps = result.effective_pixel_size();
        assert_eq!(eps, 32.0);
    }

    #[test]
    fn fit_to_viewport_shrinks_regardless_of_max_zoom() {
        let vp = default_test_viewport(); // pixel_size=32, 16×16 → display 512×512
        let viewport_size = ViewportSize { width: 400.0, height: 300.0 };
        let result = vp.fit_to_viewport(16, 16, viewport_size, 1.0);

        // Should still shrink to fit the smaller viewport
        assert!(result.zoom < 1.0);
        let eps = 32.0 * result.zoom;
        assert!(16.0 * eps <= viewport_size.width);
        assert!(16.0 * eps <= viewport_size.height);
    }

    // ── next_zoom_level ─────────────────────────────────────────

    #[test]
    fn next_zoom_level_returns_next_in_sequence() {
        assert_eq!(Viewport::next_zoom_level(1.0), 2.0);
        assert_eq!(Viewport::next_zoom_level(2.0), 4.0);
    }

    #[test]
    fn next_zoom_level_clamps_at_maximum() {
        assert_eq!(Viewport::next_zoom_level(16.0), 16.0);
        assert_eq!(Viewport::next_zoom_level(20.0), 16.0);
    }

    #[test]
    fn next_zoom_level_snaps_from_intermediate_value() {
        assert_eq!(Viewport::next_zoom_level(1.5), 2.0);
        assert_eq!(Viewport::next_zoom_level(3.0), 4.0);
    }

    // ── prev_zoom_level ─────────────────────────────────────────

    #[test]
    fn prev_zoom_level_returns_previous_in_sequence() {
        assert_eq!(Viewport::prev_zoom_level(2.0), 1.0);
        assert_eq!(Viewport::prev_zoom_level(4.0), 2.0);
    }

    #[test]
    fn prev_zoom_level_clamps_at_minimum() {
        assert_eq!(Viewport::prev_zoom_level(0.25), 0.25);
        assert_eq!(Viewport::prev_zoom_level(0.1), 0.25);
    }

    #[test]
    fn prev_zoom_level_snaps_from_intermediate_value() {
        assert_eq!(Viewport::prev_zoom_level(1.5), 1.0);
        assert_eq!(Viewport::prev_zoom_level(3.0), 2.0);
    }

    // ── clamp_zoom ──────────────────────────────────────────────

    #[test]
    fn clamp_zoom_returns_value_when_within_range() {
        assert_eq!(Viewport::clamp_zoom(1.0), 1.0);
        assert_eq!(Viewport::clamp_zoom(4.0), 4.0);
    }

    #[test]
    fn clamp_zoom_clamps_to_min() {
        assert_eq!(Viewport::clamp_zoom(0.01), Viewport::MIN_ZOOM);
        assert_eq!(Viewport::clamp_zoom(-1.0), Viewport::MIN_ZOOM);
    }

    #[test]
    fn clamp_zoom_clamps_to_max() {
        assert_eq!(Viewport::clamp_zoom(100.0), Viewport::MAX_ZOOM);
        assert_eq!(Viewport::clamp_zoom(32.0), Viewport::MAX_ZOOM);
    }

    // ── compute_pinch_zoom ──────────────────────────────────────

    #[test]
    fn compute_pinch_zoom_zooms_in_for_negative_delta_y() {
        assert!(Viewport::compute_pinch_zoom(1.0, -100.0) > 1.0);
    }

    #[test]
    fn compute_pinch_zoom_zooms_out_for_positive_delta_y() {
        assert!(Viewport::compute_pinch_zoom(1.0, 100.0) < 1.0);
    }

    #[test]
    fn compute_pinch_zoom_no_change_for_zero_delta() {
        assert_eq!(Viewport::compute_pinch_zoom(4.0, 0.0), 4.0);
    }

    #[test]
    fn compute_pinch_zoom_clamps_to_min() {
        assert_eq!(Viewport::compute_pinch_zoom(Viewport::MIN_ZOOM, 10000.0), Viewport::MIN_ZOOM);
    }

    #[test]
    fn compute_pinch_zoom_clamps_to_max() {
        assert_eq!(Viewport::compute_pinch_zoom(Viewport::MAX_ZOOM, -10000.0), Viewport::MAX_ZOOM);
    }
}
