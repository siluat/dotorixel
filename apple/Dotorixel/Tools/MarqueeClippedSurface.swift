import Foundation

/// A `DrawingSurface` whose writes are clipped to a Marquee region — the
/// Apple analog of the web's Marquee-clipped ops decorator.
///
/// Writes landing outside the region are dropped before they reach the base
/// surface; reads and whole-layer operations (composite, snapshot/restore)
/// pass straight through, so a shape session still restores its full
/// pre-stroke snapshot and the pixel-perfect filter still reads pre-stroke
/// colors anywhere.
///
/// The region is a value captured at construction: a Marquee mutated
/// mid-stroke never changes the clip a stroke in flight is drawing through.
final class MarqueeClippedSurface: DrawingSurface {
    private let base: any DrawingSurface
    private let region: AppleMarqueeRegion

    init(base: any DrawingSurface, region: AppleMarqueeRegion) {
        self.base = base
        self.region = region
    }

    func width() -> UInt32 { base.width() }

    func height() -> UInt32 { base.height() }

    func composite() -> Data { base.composite() }

    func getPixel(x: UInt32, y: UInt32) throws -> Color {
        try base.getPixel(x: x, y: y)
    }

    func setPixel(x: UInt32, y: UInt32, color: Color) throws {
        // Coordinates past the `Int32` space clamp to `Int32.max`, which no
        // canvas-clipped Marquee contains — they read as outside, not trap.
        guard isInsideMarquee(x: Int32(clamping: x), y: Int32(clamping: y)) else { return }
        try base.setPixel(x: x, y: y, color: color)
    }

    func applyTool(x: Int32, y: Int32, tool: ToolType, foregroundColor: Color) -> Bool {
        guard isInsideMarquee(x: x, y: y) else { return false }
        return base.applyTool(x: x, y: y, tool: tool, foregroundColor: foregroundColor)
    }

    /// The clipped fill: the Marquee's edges bound the flood, and a seed
    /// outside the region fills nothing (both decided by the bounded fill in
    /// the core). A valid Marquee is always valid bounds, so a throw is an
    /// invariant break: surfaced in debug, degraded to "filled nothing" in
    /// release.
    func floodFill(x: Int32, y: Int32, fillColor: Color) -> Bool {
        do {
            return try base.floodFillBounded(x: x, y: y, fillColor: fillColor, bounds: region)
        } catch {
            assertionFailure("Failed to flood fill within the Marquee: \(error)")
            return false
        }
    }

    /// A caller's own bounds narrow the clip, never escape it: the effective
    /// region is the overlap of `bounds` and the Marquee (web parity), and a
    /// pair that doesn't overlap fills nothing.
    func floodFillBounded(
        x: Int32, y: Int32, fillColor: Color, bounds: AppleMarqueeRegion
    ) throws -> Bool {
        guard let effectiveBounds = overlap(region, bounds) else { return false }
        return try base.floodFillBounded(
            x: x, y: y, fillColor: fillColor, bounds: effectiveBounds
        )
    }

    func activeLayerPixels() throws -> Data {
        try base.activeLayerPixels()
    }

    func restoreActiveLayerPixels(data: Data) throws {
        try base.restoreActiveLayerPixels(data: data)
    }

    func marquee() -> AppleMarqueeRegion? { base.marquee() }

    func setMarquee(region: AppleMarqueeRegion?) throws {
        try base.setMarquee(region: region)
    }

    /// Marquee membership — distinct from `DrawingSurface.containsPixel`,
    /// which answers the canvas-bounds question.
    private func isInsideMarquee(x: Int32, y: Int32) -> Bool {
        appleMarqueeContains(region: region, x: x, y: y)
    }
}

/// The rectangle two regions share, or `nil` when they don't overlap. Widened
/// to `Int64` so far corners past the `Int32` space compare without trapping;
/// the result is always inside both inputs, so it fits their field types.
private func overlap(
    _ a: AppleMarqueeRegion, _ b: AppleMarqueeRegion
) -> AppleMarqueeRegion? {
    let x = max(Int64(a.x), Int64(b.x))
    let y = max(Int64(a.y), Int64(b.y))
    let right = min(Int64(a.x) + Int64(a.width), Int64(b.x) + Int64(b.width))
    let bottom = min(Int64(a.y) + Int64(a.height), Int64(b.y) + Int64(b.height))
    guard right > x, bottom > y else { return nil }

    return AppleMarqueeRegion(
        x: Int32(x), y: Int32(y),
        width: UInt32(right - x), height: UInt32(bottom - y)
    )
}

/// A `StrokeSessionHost` that hands sessions a Marquee-clipped drawing
/// surface and forwards everything else to the host it wraps. Built per
/// stroke by `StrokeEngine`, which retains it for the stroke's lifetime —
/// sessions hold their host `unowned`.
final class MarqueeClippedStrokeHost: StrokeSessionHost {
    // `unowned` matches the session convention: the wrapper lives inside the
    // engine, which the host owns and which tears the stroke down first.
    private unowned let base: StrokeSessionHost

    let drawingSurface: any DrawingSurface

    init(base: StrokeSessionHost, region: AppleMarqueeRegion) {
        self.base = base
        self.drawingSurface = MarqueeClippedSurface(base: base.drawingSurface, region: region)
    }

    var foregroundColor: Color { base.foregroundColor }
    var backgroundColor: Color { base.backgroundColor }
    var isPixelPerfectEnabled: Bool { base.isPixelPerfectEnabled }
    var isConstrainHeld: Bool { base.isConstrainHeld }
    var samplingLoupe: SamplingLoupeState { base.samplingLoupe }

    func beginEdit() { base.beginEdit() }

    func commitColorPick(_ color: Color, to target: ColorPickTarget) {
        base.commitColorPick(color, to: target)
    }

    func recordRecentColor(_ color: Color) { base.recordRecentColor(color) }
}
