import Foundation

/// Per-stroke view of a drawing surface that drops pixel-tool writes outside
/// the Marquee captured when the stroke began and bounds flood fill to it.
/// Reads and whole-layer writes pass through unchanged so shape previews can
/// restore their pre-stroke snapshot before redrawing clipped output.
final class MarqueeClippedDrawingSurface: DrawingSurface {
    private let base: any DrawingSurface
    private let marqueeSnapshot: AppleMarqueeRegion

    init(base: any DrawingSurface, marquee: AppleMarqueeRegion) {
        self.base = base
        self.marqueeSnapshot = marquee
    }

    func width() -> UInt32 { base.width() }
    func height() -> UInt32 { base.height() }
    func composite() -> Data { base.composite() }
    func getPixel(x: UInt32, y: UInt32) throws -> Color {
        try base.getPixel(x: x, y: y)
    }

    func setPixel(x: UInt32, y: UInt32, color: Color) throws {
        guard let signedX = Int32(exactly: x), let signedY = Int32(exactly: y),
              appleMarqueeContains(region: marqueeSnapshot, x: signedX, y: signedY)
        else { return }
        try base.setPixel(x: x, y: y, color: color)
    }

    func applyTool(x: Int32, y: Int32, tool: ToolType, foregroundColor: Color) -> Bool {
        guard appleMarqueeContains(region: marqueeSnapshot, x: x, y: y) else { return false }
        return base.applyTool(x: x, y: y, tool: tool, foregroundColor: foregroundColor)
    }

    func floodFill(x: Int32, y: Int32, fillColor: Color) -> Bool {
        do {
            return try base.floodFillBounded(
                x: x, y: y, fillColor: fillColor, bounds: marqueeSnapshot
            )
        } catch {
            assertionFailure("Failed to flood fill within the stroke Marquee: \(error)")
            return false
        }
    }

    func floodFillBounded(
        x: Int32, y: Int32, fillColor: Color, bounds: AppleMarqueeRegion
    ) throws -> Bool {
        let left = max(Int64(marqueeSnapshot.x), Int64(bounds.x))
        let top = max(Int64(marqueeSnapshot.y), Int64(bounds.y))
        let right = min(
            Int64(marqueeSnapshot.x) + Int64(marqueeSnapshot.width),
            Int64(bounds.x) + Int64(bounds.width)
        )
        let bottom = min(
            Int64(marqueeSnapshot.y) + Int64(marqueeSnapshot.height),
            Int64(bounds.y) + Int64(bounds.height)
        )
        guard left < right, top < bottom,
              let clippedX = Int32(exactly: left), let clippedY = Int32(exactly: top),
              let clippedWidth = UInt32(exactly: right - left),
              let clippedHeight = UInt32(exactly: bottom - top)
        else { return false }
        return try base.floodFillBounded(
            x: x,
            y: y,
            fillColor: fillColor,
            bounds: AppleMarqueeRegion(
                x: clippedX, y: clippedY, width: clippedWidth, height: clippedHeight
            )
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
}

/// Delegates editor services while replacing only the drawing surface with
/// the Marquee snapshot captured at stroke begin.
final class MarqueeClippingStrokeHost: StrokeSessionHost {
    private unowned let base: StrokeSessionHost
    let drawingSurface: any DrawingSurface

    init(base: StrokeSessionHost, marquee: AppleMarqueeRegion) {
        self.base = base
        drawingSurface = MarqueeClippedDrawingSurface(
            base: base.drawingSurface,
            marquee: marquee
        )
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

    func recordRecentColor(_ color: Color) {
        base.recordRecentColor(color)
    }
}
