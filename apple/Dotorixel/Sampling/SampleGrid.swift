import Foundation

/// Samples the color the user sees at `(x, y)` — the composite of every
/// visible layer, not any single layer's buffer. This is the web's sampling
/// rule, carried by the seam so multi-layer sampling needs no rework.
/// Returns `nil` outside the canvas bounds.
func compositeSample(surface: some DrawingSurface, x: Int32, y: Int32) -> Color? {
    guard surface.containsPixel(x: x, y: y) else { return nil }
    return colorAt(surface.composite(), width: Int32(surface.width()), x: x, y: y)
}

/// Returns a row-major flat array of length `size × size` for an N×N pixel
/// grid centered on `center`, sampled from the composite (what the user
/// sees). Cells whose coordinates fall outside the canvas are `nil`,
/// distinguishing "no pixel here" from transparent pixels (which return a
/// `Color` with `a == 0`). Mirrors the web's `sample-grid.ts`.
///
/// `size` is expected to be an odd positive integer; the center cell is at
/// index `(size² - 1) / 2` in the returned array.
func sampleGrid(surface: some DrawingSurface, center: ScreenCanvasCoords, size: Int) -> [Color?] {
    let width = Int32(surface.width())
    // One composite fetch for the whole grid — not one per cell.
    let composite = surface.composite()
    let half = Int32(size / 2)
    var result: [Color?] = []
    result.reserveCapacity(size * size)
    for dy in -half...half {
        for dx in -half...half {
            let x = center.x + dx
            let y = center.y + dy
            guard surface.containsPixel(x: x, y: y) else {
                result.append(nil)
                continue
            }
            result.append(colorAt(composite, width: width, x: x, y: y))
        }
    }
    return result
}

/// Reads the RGBA color at in-bounds `(x, y)` from a row-major composite buffer.
private func colorAt(_ composite: Data, width: Int32, x: Int32, y: Int32) -> Color {
    let offset = Int(y * width + x) * 4
    return Color(
        r: composite[offset],
        g: composite[offset + 1],
        b: composite[offset + 2],
        a: composite[offset + 3]
    )
}
