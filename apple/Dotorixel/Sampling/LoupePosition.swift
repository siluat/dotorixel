import CoreGraphics

/// Picks between the mouse and touch loupe positioning offsets. Apple Pencil
/// and indirect pointers (trackpad/mouse on iPadOS) count as `.mouse` — only
/// a direct finger touch needs the larger offset that keeps the loupe out
/// from under the finger.
enum LoupeInputSource {
    case mouse
    case touch
}

/// Which quadrant of the pointer the loupe occupies.
enum LoupeQuadrant {
    case tl, tr, bl, br
}

struct LoupePositionInput {
    /// Pointer position in canvas-area coordinates (SwiftUI points).
    let pointer: CGPoint
    /// Visible canvas-area dimensions in points.
    let viewport: CGSize
    /// Rendered loupe dimensions in points.
    let loupe: CGSize
    /// Pointer-to-loupe gap for mouse input (applied symmetrically on x and y).
    let mouseOffset: CGFloat
    /// Pointer-to-loupe vertical gap for touch input (touch is centered horizontally).
    let touchOffset: CGFloat
    let inputSource: LoupeInputSource
}

struct LoupePosition: Equatable {
    /// Top-left of the loupe in canvas-area coordinates.
    let x: CGFloat
    let y: CGFloat
    /// The quadrant the loupe ended up in relative to the pointer.
    let quadrant: LoupeQuadrant
}

/// Computes the loupe's position so it stays inside the canvas area.
/// Default quadrant is `tr` (top-right of the pointer); the loupe flips to
/// the opposite vertical and/or horizontal half when the default would clip.
///
/// Touch input centers the loupe horizontally on the pointer. Touch never
/// flips horizontally; if the centered position would clip a viewport side,
/// the loupe is clamped inward.
///
/// Mirrors the web's `computeLoupePosition` (`loupe-position.ts`).
func computeLoupePosition(_ input: LoupePositionInput) -> LoupePosition {
    if input.inputSource == .touch { return touchPosition(input) }
    return mousePosition(input)
}

private func mousePosition(_ input: LoupePositionInput) -> LoupePosition {
    let defaultX = input.pointer.x + input.mouseOffset
    let flipsHorizontal = defaultX + input.loupe.width > input.viewport.width
    let x = flipsHorizontal
        ? input.pointer.x - input.loupe.width - input.mouseOffset
        : defaultX

    let defaultY = input.pointer.y - input.loupe.height - input.mouseOffset
    let flipsVertical = defaultY < 0
    let y = flipsVertical ? input.pointer.y + input.mouseOffset : defaultY

    let quadrant: LoupeQuadrant = flipsVertical
        ? (flipsHorizontal ? .bl : .br)
        : (flipsHorizontal ? .tl : .tr)

    // Degenerate-viewport safety net: in viewports too narrow or too short
    // for even the flipped position to fit, clamp inward so at least one edge
    // stays on-screen.
    return LoupePosition(
        x: clamped(x, max: input.viewport.width - input.loupe.width),
        y: clamped(y, max: input.viewport.height - input.loupe.height),
        quadrant: quadrant
    )
}

private func touchPosition(_ input: LoupePositionInput) -> LoupePosition {
    // Touch always centers horizontally per the design spec; if centering
    // would push the loupe off either side, we clamp inward (no horizontal
    // flip) so the visual relationship "loupe sits above/below the finger"
    // is preserved.
    let centeredX = input.pointer.x - input.loupe.width / 2
    let x = clamped(centeredX, max: input.viewport.width - input.loupe.width)

    let defaultY = input.pointer.y - input.loupe.height - input.touchOffset
    let flipsVertical = defaultY < 0
    let y = flipsVertical ? input.pointer.y + input.touchOffset : defaultY

    // A narrow band of pointer.y values can flip the loupe yet still clip the
    // bottom edge on short viewports. Clamp y inward as a safety net,
    // mirroring the mouse branch.
    return LoupePosition(
        x: x,
        y: clamped(y, max: input.viewport.height - input.loupe.height),
        quadrant: flipsVertical ? .br : .tr
    )
}

private func clamped(_ value: CGFloat, max upperBound: CGFloat) -> CGFloat {
    max(0, min(value, upperBound))
}
