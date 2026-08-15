import CoreGraphics
import SwiftUI

/// The visible corner grip. Small enough to leave the traced artwork readable;
/// the press target around it is `referencePlacementHandleTargetSize`. Web
/// parity: the overlay draws a larger grip for touch (16px) than for a
/// pointer (12px), which here is a platform split rather than a runtime one.
#if os(macOS)
private let referencePlacementHandleSize: CGFloat = 12
#else
private let referencePlacementHandleSize: CGFloat = 16
#endif

/// HIG touch minimum — the grips overlap on a small box rather than shrink,
/// and `referencePlacementHandle(at:in:)` resolves the overlap by proximity.
private let referencePlacementHandleTargetSize = DesignTokens.btnSize

/// Projects a Reference Footprint into canvas-area points — the space the
/// SwiftUI overlays are laid out in. Same viewport transform the Marquee ants
/// and the Metal underlay use (`round(pan) + canvas × eps` device pixels,
/// divided by the display scale), so the box tracks zoom and pan for free.
func referencePlacementOverlayRect(
    footprint: AppleReferenceFootprint,
    viewport: AppleViewport,
    displayScale: CGFloat
) -> CGRect {
    let eps = viewport.effectivePixelSize()
    return CGRect(
        x: (viewport.panX().rounded() + Double(footprint.minX) * eps) / displayScale,
        y: (viewport.panY().rounded() + Double(footprint.minY) * eps) / displayScale,
        width: Double(footprint.maxX - footprint.minX) * eps / displayScale,
        height: Double(footprint.maxY - footprint.minY) * eps / displayScale
    )
}

/// One handle's press target inside `boxRect`, centered on its corner. Always
/// the full touch-minimum square, even when the box is smaller than the target.
func referencePlacementHandleRect(
    _ handle: ReferencePlacementHandle,
    in boxRect: CGRect
) -> CGRect {
    let corner = referencePlacementCorner(handle, in: boxRect)
    let size = referencePlacementHandleTargetSize
    return CGRect(
        x: corner.x - size / 2,
        y: corner.y - size / 2,
        width: size,
        height: size
    )
}

/// Which handle a press at `point` grabs, or `nil` for the body (a move).
/// On a box narrower than the touch minimum every target overlaps, so the
/// nearest corner wins rather than whichever happens to be drawn on top.
func referencePlacementHandle(
    at point: CGPoint,
    in boxRect: CGRect
) -> ReferencePlacementHandle? {
    ReferencePlacementHandle.allCases
        .filter { referencePlacementHandleRect($0, in: boxRect).contains(point) }
        .min { squaredDistance(from: point, to: referencePlacementCorner($0, in: boxRect))
            < squaredDistance(from: point, to: referencePlacementCorner($1, in: boxRect)) }
}

private func referencePlacementCorner(
    _ handle: ReferencePlacementHandle,
    in boxRect: CGRect
) -> CGPoint {
    switch handle {
    case .topLeft: CGPoint(x: boxRect.minX, y: boxRect.minY)
    case .topRight: CGPoint(x: boxRect.maxX, y: boxRect.minY)
    case .bottomRight: CGPoint(x: boxRect.maxX, y: boxRect.maxY)
    case .bottomLeft: CGPoint(x: boxRect.minX, y: boxRect.maxY)
    }
}

private func squaredDistance(from point: CGPoint, to other: CGPoint) -> CGFloat {
    let dx = point.x - other.x
    let dy = point.y - other.y
    return dx * dx + dy * dy
}

/// The Reference Layer Placement Interaction's canvas surface: a dashed box
/// over the underlay's footprint with four corner grips, shown only while the
/// Reference Layer is active. Dragging the body moves the placement, a corner
/// scales it, and a pinch inside the box scales it about the fingers — each
/// completed gesture committing one undoable Edit through the tab.
///
/// Isolates its observable reads (placement target + viewport) from
/// `ContentView`'s body, the way `MarqueeOverlay` does, so a live drag
/// re-renders only this overlay.
struct ReferenceLayerPlacementOverlay: View {
    let tab: TabState
    let displayScale: CGFloat

    /// Whether a drag has already opened a gesture — a pinch can replace it
    /// mid-flight, so the drag must not reopen one on its next callback.
    @State private var isDragOpen = false
    @State private var isPinchOpen = false

    // Web parity (`.reference-placement-overlay`): a 1px accent dash over a
    // background wash, so the box reads on any traced color. Static rather
    // than marching — the ants belong to the Marquee.
    private let washWidth: CGFloat = 3
    private let borderWidth: CGFloat = 1
    private let dashPattern: [CGFloat] = [4, 4]

    var body: some View {
        if let target = tab.referencePlacementTarget {
            let box = referencePlacementOverlayRect(
                footprint: target.footprint,
                viewport: tab.viewport,
                displayScale: displayScale
            )
            Rectangle()
                .stroke(DesignTokens.bgBase, lineWidth: washWidth)
                .overlay {
                    Rectangle().stroke(
                        DesignTokens.accent,
                        style: StrokeStyle(lineWidth: borderWidth, dash: dashPattern)
                    )
                }
                .frame(width: box.width, height: box.height)
                // Only the box itself moves the placement. Widening this to
                // cover the grips' overhang would also swallow a ring of
                // canvas all around the box, where pan and zoom still belong.
                .contentShape(Rectangle())
                .gesture(pinchGesture(target: target))
                .gesture(bodyDragGesture())
                // Above the body, so a corner press scales instead of moving.
                .overlay { handles }
                .offset(x: box.minX, y: box.minY)
                // The box is unbounded in screen space once panned, and
                // `.overlay` content is never clipped by default — fill the
                // canvas area and clip so it never reaches the Timeline panel
                // or the toolbars (web parity: the canvas container's
                // `overflow: hidden`).
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .clipped()
                .accessibilityHidden(true)
        }
    }

    /// The four corner grips, drawn in the box's own coordinate space and
    /// positioned by canvas geometry rather than leading/trailing alignment —
    /// the box belongs to the document, so it must not mirror under RTL. Each
    /// grip carries its own touch-minimum press target, which overhangs the
    /// box the way the web handles' expanded hit boxes do.
    private var handles: some View {
        GeometryReader { geometry in
            let box = CGRect(origin: .zero, size: geometry.size)
            ForEach(ReferencePlacementHandle.allCases, id: \.self) { handle in
                let target = referencePlacementHandleRect(handle, in: box)
                Rectangle()
                    .fill(DesignTokens.accent)
                    .stroke(DesignTokens.bgBase, lineWidth: borderWidth)
                    .frame(
                        width: referencePlacementHandleSize,
                        height: referencePlacementHandleSize
                    )
                    .frame(width: target.width, height: target.height)
                    .contentShape(Rectangle())
                    .gesture(dragGesture(handle: handle, target: target, in: box))
                    .position(x: target.midX, y: target.midY)
            }
        }
    }

    private func bodyDragGesture() -> some Gesture {
        dragGesture(handle: nil, target: nil, in: .zero)
    }

    /// One drag for both roles: a body move when `handle` is nil, a corner
    /// scale otherwise. `minimumDistance: 0` so the press claims the box
    /// immediately, the way the Timeline's reorder handle claims its row.
    private func dragGesture(
        handle: ReferencePlacementHandle?,
        target: CGRect?,
        in box: CGRect
    ) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if !isDragOpen {
                    isDragOpen = true
                    tab.beginReferencePlacement(handle: pressedHandle(
                        handle,
                        target: target,
                        in: box,
                        startLocation: value.startLocation
                    ))
                }
                tab.updateReferencePlacement(
                    translation: value.translation,
                    pointsPerCanvasPixel: pointsPerCanvasPixel
                )
            }
            .onEnded { _ in
                isDragOpen = false
                // A pinch that replaced this drag commits on its own end; the
                // interaction has nothing left to hand back here.
                guard !isPinchOpen else { return }
                tab.commitReferencePlacement()
            }
    }

    /// Which corner a handle press actually grabbed. On a box narrower than
    /// the touch minimum every grip's target covers every corner, so the press
    /// point picks the nearest one rather than whichever view SwiftUI happened
    /// to stack on top. A body press has no handle to re-resolve.
    private func pressedHandle(
        _ handle: ReferencePlacementHandle?,
        target: CGRect?,
        in box: CGRect,
        startLocation: CGPoint
    ) -> ReferencePlacementHandle? {
        guard let handle, let target else { return handle }
        let press = CGPoint(
            x: target.minX + startLocation.x,
            y: target.minY + startLocation.y
        )
        return referencePlacementHandle(at: press, in: box) ?? handle
    }

    private func pinchGesture(target: ReferenceLayerUnderlay) -> some Gesture {
        MagnifyGesture(minimumScaleDelta: 0)
            .onChanged { value in
                if !isPinchOpen {
                    isPinchOpen = true
                    tab.beginReferencePlacementPinch(
                        anchor: canvasAnchor(value.startAnchor, in: target.footprint)
                    )
                }
                tab.updateReferencePlacement(magnification: value.magnification)
            }
            .onEnded { _ in
                isPinchOpen = false
                isDragOpen = false
                tab.commitReferencePlacement()
            }
    }

    /// The canvas-space point a pinch anchor names, so the image under the
    /// fingers holds still while the box scales around it.
    private func canvasAnchor(
        _ anchor: UnitPoint,
        in footprint: AppleReferenceFootprint
    ) -> CGPoint {
        CGPoint(
            x: Double(footprint.minX)
                + anchor.x * Double(footprint.maxX - footprint.minX),
            y: Double(footprint.minY)
                + anchor.y * Double(footprint.maxY - footprint.minY)
        )
    }

    /// How many canvas-area points one canvas pixel spans — the drag's
    /// points → canvas-pixel conversion.
    private var pointsPerCanvasPixel: CGFloat {
        tab.viewport.effectivePixelSize() / displayScale
    }
}
