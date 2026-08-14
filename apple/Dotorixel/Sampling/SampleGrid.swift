import Foundation

/// Read-only color surface shared by Eyedropper commit and Loupe preview.
/// It names what sampling sees without exposing drawing or Layer structure.
protocol SamplingSurface {
    func samplePixel(at coords: ScreenCanvasCoords) -> Color?
}

/// Pixel-only sampling used by hosts that do not provide an editor underlay.
struct CompositeSamplingSurface: SamplingSurface {
    let surface: any DrawingSurface

    func samplePixel(at coords: ScreenCanvasCoords) -> Color? {
        compositeSample(surface: surface, x: coords.x, y: coords.y)
    }
}

/// What the Apple editor shows inside the Document bounds: Pixel artwork
/// wins where it has content; otherwise a visible active Reference supplies
/// the underlay color through the core's sampling-aware accessor.
struct DocumentSamplingSurface: SamplingSurface {
    private let document: AppleDocument
    private let pixelComposite: Data
    private let samplesActiveReference: Bool

    init(document: AppleDocument) {
        self.document = document
        self.pixelComposite = document.composite()
        let activeLayerId = document.activeLayerId()
        self.samplesActiveReference = document.layers().contains {
            $0.id == activeLayerId && $0.kind == .reference && $0.visible
        }
    }

    func samplePixel(at coords: ScreenCanvasCoords) -> Color? {
        guard containsPixel(at: coords) else { return nil }
        let pixelColor = colorAt(
            pixelComposite,
            width: Int32(document.width()),
            x: coords.x,
            y: coords.y
        )
        if pixelColor.a > 0 || !samplesActiveReference {
            return pixelColor
        }
        return document.tryGetPixel(
            x: UInt32(coords.x),
            y: UInt32(coords.y)
        ) ?? pixelColor
    }

    private func containsPixel(at coords: ScreenCanvasCoords) -> Bool {
        coords.x >= 0
            && coords.y >= 0
            && coords.x < Int32(document.width())
            && coords.y < Int32(document.height())
    }
}

func sampleGrid(
    surface: any SamplingSurface,
    center: ScreenCanvasCoords,
    size: Int
) -> [Color?] {
    sampleGrid(center: center, size: size) { coords in
        surface.samplePixel(at: coords)
    }
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
    let width = Int32(surface.width())
    // One composite fetch for the whole grid — not one per cell.
    let composite = surface.composite()
    return sampleGrid(center: center, size: size) { coords in
        guard surface.containsPixel(x: coords.x, y: coords.y) else { return nil }
        return colorAt(composite, width: width, x: coords.x, y: coords.y)
    }
}

/// Owns the row-major neighborhood traversal shared by every sampling source.
private func sampleGrid(
    center: ScreenCanvasCoords,
    size: Int,
    samplePixel: (ScreenCanvasCoords) -> Color?
) -> [Color?] {
    let half = Int32(size / 2)
    var result: [Color?] = []
    result.reserveCapacity(size * size)
    for dy in -half...half {
        for dx in -half...half {
            result.append(samplePixel(ScreenCanvasCoords(
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
