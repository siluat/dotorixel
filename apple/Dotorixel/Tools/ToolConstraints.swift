/// Shift-constrain math for the shape tools — the Swift equivalents of the
/// web's shell-side functions (`src/lib/canvas/tool-constraints.ts`). Simple,
/// stable integer math, deliberately kept in shell code rather than the
/// shared core (mirroring the web's placement decision).

/// Snaps `current` to the nearest 45-degree multiple direction from `anchor`
/// (8-directional).
func constrainLine(anchor: ScreenCanvasCoords, current: ScreenCanvasCoords) -> ScreenCanvasCoords {
    let dx = current.x - anchor.x
    let dy = current.y - anchor.y
    let absDx = abs(dx)
    let absDy = abs(dy)

    if absDy * 2 <= absDx {
        return ScreenCanvasCoords(x: current.x, y: anchor.y)
    }

    if absDx * 2 <= absDy {
        return ScreenCanvasCoords(x: anchor.x, y: current.y)
    }

    let dist = max(absDx, absDy)
    return ScreenCanvasCoords(
        x: anchor.x + dist * Int32(dx.signum()),
        y: anchor.y + dist * Int32(dy.signum())
    )
}

/// Forces the bounding box defined by `anchor` and `current` into a square.
/// A zero delta counts as a positive direction (web parity: `dx >= 0`).
func constrainSquare(anchor: ScreenCanvasCoords, current: ScreenCanvasCoords) -> ScreenCanvasCoords {
    let dx = current.x - anchor.x
    let dy = current.y - anchor.y
    let side = max(abs(dx), abs(dy))

    return ScreenCanvasCoords(
        x: anchor.x + side * (dx >= 0 ? 1 : -1),
        y: anchor.y + side * (dy >= 0 ? 1 : -1)
    )
}
