import CoreGraphics
import Observation

/// Observable state behind the loupe overlay. The eyedropper stroke session
/// drives the grid and visibility through the `StrokeSessionHost` seam; the
/// input layer pushes the pointer's view position independently (mirroring
/// the web sampling session's `updatePointer`, which is always safe to call).
@Observable
final class SamplingLoupeState {
    private(set) var isActive = false

    /// Row-major `gridSize × gridSize` neighborhood of the target pixel.
    /// Out-of-canvas cells are `nil`; transparent pixels have `a == 0`.
    private(set) var grid: [Color?] = []

    private var pointer: CGPoint?
    private var viewport: CGSize?
    private var inputSource: LoupeInputSource?

    /// Canvas-area top-left of the loupe overlay, flipped/clamped by
    /// `computeLoupePosition`; `nil` when inactive or before any pointer push.
    var position: CGPoint? {
        guard isActive, let pointer, let viewport, let inputSource else { return nil }
        let resolved = computeLoupePosition(LoupePositionInput(
            pointer: pointer,
            viewport: viewport,
            loupe: CGSize(width: LoupeGeometry.width, height: LoupeGeometry.height),
            mouseOffset: LoupeGeometry.mouseOffset,
            touchOffset: LoupeGeometry.touchOffset,
            inputSource: inputSource
        ))
        return CGPoint(x: resolved.x, y: resolved.y)
    }

    /// Shows the loupe with a freshly sampled grid; also updates the grid of
    /// an already-visible loupe as the drag refines the target.
    func show(grid: [Color?]) {
        self.grid = grid
        isActive = true
    }

    func dismiss() {
        isActive = false
        grid = []
    }

    /// Always safe to call — pointer state caches even when the loupe is
    /// inactive, so the input layer can push unconditionally.
    func updatePointer(screen: CGPoint, viewport: CGSize, inputSource: LoupeInputSource) {
        self.pointer = screen
        self.viewport = viewport
        self.inputSource = inputSource
    }
}
