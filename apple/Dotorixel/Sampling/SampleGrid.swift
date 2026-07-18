/// Returns a row-major flat array of length `size × size` for an N×N pixel
/// grid centered on `center`. Cells whose coordinates fall outside the canvas
/// are `nil`, distinguishing "no pixel here" from transparent pixels (which
/// return a `Color` with `a == 0`). Mirrors the web's `sample-grid.ts`.
///
/// `size` is expected to be an odd positive integer; the center cell is at
/// index `(size² - 1) / 2` in the returned array.
func sampleGrid(canvas: ApplePixelCanvas, center: ScreenCanvasCoords, size: Int) -> [Color?] {
    let half = Int32(size / 2)
    var result: [Color?] = []
    result.reserveCapacity(size * size)
    for dy in -half...half {
        for dx in -half...half {
            let x = center.x + dx
            let y = center.y + dy
            guard let ux = UInt32(exactly: x), let uy = UInt32(exactly: y),
                  let pixel = try? canvas.getPixel(x: ux, y: uy)
            else {
                result.append(nil)
                continue
            }
            result.append(pixel)
        }
    }
    return result
}
