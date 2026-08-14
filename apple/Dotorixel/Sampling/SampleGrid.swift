import Foundation

/// Read-only color surface shared by Eyedropper commit and Loupe preview.
/// It names what sampling sees without exposing drawing or Layer structure.
protocol SamplingSurface {
    func samplePixel(at coords: ScreenCanvasCoords) -> Color?
    func sampleGrid(center: ScreenCanvasCoords, size: Int) -> [Color?]
}

extension SamplingSurface {
    func sampleGrid(center: ScreenCanvasCoords, size: Int) -> [Color?] {
        mapSampleGrid(center: center, size: size) { coords in
            samplePixel(at: coords)
        }
    }
}

/// Pixel-only sampling used by hosts that do not provide an editor underlay.
struct CompositeSamplingSurface: SamplingSurface {
    let surface: any DrawingSurface

    func samplePixel(at coords: ScreenCanvasCoords) -> Color? {
        compositeSample(surface: surface, x: coords.x, y: coords.y)
    }

    func sampleGrid(center: ScreenCanvasCoords, size: Int) -> [Color?] {
        sampleDrawingGrid(surface: surface, center: center, size: size)
    }
}

/// What the Apple editor shows inside the Document bounds: Pixel artwork
/// wins where it has content; otherwise the visible Reference supplies the
/// underlay color regardless of which Layer is active.
struct DocumentSamplingSurface: SamplingSurface {
    private let document: AppleDocument
    private let width: Int32
    private let height: Int32

    init(document: AppleDocument) {
        self.document = document
        self.width = Int32(document.width())
        self.height = Int32(document.height())
    }

    func samplePixel(at coords: ScreenCanvasCoords) -> Color? {
        guard containsPixel(at: coords) else { return nil }
        return document.sampleVisiblePixels(points: [coords])[0]
    }

    func sampleGrid(center: ScreenCanvasCoords, size: Int) -> [Color?] {
        let points = mapSampleGrid(center: center, size: size) { $0 }
        let visibleColors = document.sampleVisiblePixels(points: points)
        precondition(
            visibleColors.count == points.count,
            "Visible artwork sampling must preserve the requested point count"
        )
        return zip(points, visibleColors).map { point, visibleColor in
            containsPixel(at: point) ? visibleColor : nil
        }
    }

    private func containsPixel(at coords: ScreenCanvasCoords) -> Bool {
        coords.x >= 0
            && coords.y >= 0
            && coords.x < width
            && coords.y < height
    }
}

func sampleGrid(
    surface: any SamplingSurface,
    center: ScreenCanvasCoords,
    size: Int
) -> [Color?] {
    surface.sampleGrid(center: center, size: size)
}

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
    sampleDrawingGrid(surface: surface, center: center, size: size)
}

private func sampleDrawingGrid(
    surface: any DrawingSurface,
    center: ScreenCanvasCoords,
    size: Int
) -> [Color?] {
    let width = Int32(surface.width())
    // One composite fetch for the whole grid — not one per cell.
    let composite = surface.composite()
    return mapSampleGrid(center: center, size: size) { coords in
        guard surface.containsPixel(x: coords.x, y: coords.y) else { return nil }
        return colorAt(composite, width: width, x: coords.x, y: coords.y)
    }
}

/// Owns the row-major neighborhood traversal shared by every sampling source.
private func mapSampleGrid<Value>(
    center: ScreenCanvasCoords,
    size: Int,
    transform: (ScreenCanvasCoords) -> Value
) -> [Value] {
    let half = Int32(size / 2)
    var result: [Value] = []
    result.reserveCapacity(size * size)
    for dy in -half...half {
        for dx in -half...half {
            result.append(transform(ScreenCanvasCoords(
                x: center.x + dx,
                y: center.y + dy
            )))
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
