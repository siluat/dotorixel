import CoreGraphics

/// The corner of the placement overlay a scale drag grips. Named in canvas
/// space (the box turns with the document, never with the reading direction),
/// so `topLeft` is the same corner in every locale.
enum ReferencePlacementHandle: CaseIterable {
    case topLeft
    case topRight
    case bottomRight
    case bottomLeft

    /// Which way the box grows when this handle is pulled, per axis.
    fileprivate var growthSigns: (x: Float, y: Float) {
        switch self {
        case .topLeft: (-1, -1)
        case .topRight: (1, -1)
        case .bottomRight: (1, 1)
        case .bottomLeft: (-1, 1)
        }
    }
}

/// The smallest projected extent a scale gesture may collapse the underlay to,
/// in canvas pixels — web parity. The core's invariant only forbids scale ≤ 0,
/// which would leave the box too small to grab again.
private let minimumProjectedSize: Float = 8

/// The Reference Layer Placement Interaction's gesture state — begin →
/// live draft → commit, framework-free so the placement math is exercised
/// without a view. The shell feeds it SwiftUI gesture values; the draft it
/// publishes is what the overlay and the Metal underlay render until the
/// gesture completes and `commit` hands one placement to the Edit Baseline.
///
/// Web parity: `createReferenceLayerPlacementInteraction`
/// (`reference-layer-placement-interaction.svelte.ts`), plus the pinch branch
/// the touch shell adds.
final class ReferenceLayerPlacementInteraction {
    /// The in-flight placement, or `nil` when no gesture is running. Rotation
    /// is deliberately absent: move, scale, and pinch all preserve the
    /// Reference Layer's quarter-turn, which the core re-applies on commit.
    private(set) var draft: AppleReferencePlacementUpdate?

    private var gesture: Gesture?

    private enum Kind {
        /// Body drag: the whole placement translates.
        case move
        /// Corner drag: uniform scale anchored on the opposite corner.
        case scale(ReferencePlacementHandle)
        /// Two-finger pinch: uniform scale anchored on the canvas point the
        /// fingers started over.
        case pinch(anchor: (x: Float, y: Float))
    }

    private struct Gesture {
        let start: AppleReferencePlacement
        let kind: Kind
        /// The committed footprint's extents divided by its scale — the
        /// projected size one scale unit spans, per axis. Read from the core's
        /// rotation-aware footprint rather than the raw source dimensions, so
        /// a quarter-turned Reference scales about the corner the user sees.
        let unitExtent: (x: Float, y: Float)
    }

    /// Opens a drag gesture against `target`'s committed placement. A `nil`
    /// handle is a body drag (move); a handle is a corner scale drag.
    func begin(on target: ReferenceLayerUnderlay, handle: ReferencePlacementHandle?) {
        open(on: target, kind: handle.map(Kind.scale) ?? .move)
    }

    /// Opens a pinch gesture against `target`'s committed placement. `anchor`
    /// is the canvas-space point under the fingers, which the scaled placement
    /// holds still.
    func beginPinch(on target: ReferenceLayerUnderlay, anchor: CGPoint) {
        open(on: target, kind: .pinch(anchor: (x: Float(anchor.x), y: Float(anchor.y))))
    }

    /// Advances the live draft for a drag translation, converted from points
    /// to canvas pixels by `pointsPerCanvasPixel` (the viewport's effective
    /// pixel size in the space the overlay is laid out in). Inert for a pinch.
    func update(translation: CGSize, pointsPerCanvasPixel: CGFloat) {
        guard let gesture, pointsPerCanvasPixel > 0 else { return }
        let delta = (
            x: Float(translation.width / pointsPerCanvasPixel),
            y: Float(translation.height / pointsPerCanvasPixel)
        )
        switch gesture.kind {
        case .move:
            draft = moved(gesture, by: delta)
        case .scale(let handle):
            draft = scaled(gesture, handle: handle, by: delta)
        case .pinch:
            break
        }
    }

    /// Advances the live draft for a pinch magnification relative to the
    /// gesture's start. Inert for a drag.
    func update(magnification: CGFloat) {
        guard let gesture, case .pinch(let anchor) = gesture.kind else { return }
        draft = pinched(gesture, anchor: anchor, by: Float(magnification))
    }

    /// Closes the gesture and yields the placement to commit, or `nil` when
    /// none was open.
    func commit() -> AppleReferencePlacementUpdate? {
        defer { cancel() }
        return draft
    }

    /// Abandons the gesture and its draft — the overlay falls back to the
    /// committed placement on the next render.
    func cancel() {
        gesture = nil
        draft = nil
    }

    private func open(on target: ReferenceLayerUnderlay, kind: Kind) {
        let footprint = target.footprint
        let scale = target.placement.scale
        gesture = Gesture(
            start: target.placement,
            kind: kind,
            unitExtent: (
                x: (footprint.maxX - footprint.minX) / scale,
                y: (footprint.maxY - footprint.minY) / scale
            )
        )
        draft = AppleReferencePlacementUpdate(
            x: target.placement.x,
            y: target.placement.y,
            scale: scale
        )
    }

    private func moved(
        _ gesture: Gesture,
        by delta: (x: Float, y: Float)
    ) -> AppleReferencePlacementUpdate {
        AppleReferencePlacementUpdate(
            x: gesture.start.x + delta.x,
            y: gesture.start.y + delta.y,
            scale: gesture.start.scale
        )
    }

    /// Uniform scale about the corner opposite `handle`: the drag is projected
    /// onto that corner's diagonal, so an off-diagonal drag still resolves to
    /// one scale factor and the box keeps its aspect ratio (web parity).
    private func scaled(
        _ gesture: Gesture,
        handle: ReferencePlacementHandle,
        by delta: (x: Float, y: Float)
    ) -> AppleReferencePlacementUpdate {
        let signs = handle.growthSigns
        let basis = (
            x: signs.x * gesture.unitExtent.x,
            y: signs.y * gesture.unitExtent.y
        )
        let dragged = (
            x: basis.x * gesture.start.scale + delta.x,
            y: basis.y * gesture.start.scale + delta.y
        )
        let projected = (dragged.x * basis.x + dragged.y * basis.y)
            / (basis.x * basis.x + basis.y * basis.y)
        let scale = max(projected, minimumScale(for: gesture.unitExtent))

        let anchorRight = gesture.start.x + gesture.unitExtent.x * gesture.start.scale
        let anchorBottom = gesture.start.y + gesture.unitExtent.y * gesture.start.scale
        return AppleReferencePlacementUpdate(
            x: signs.x < 0 ? anchorRight - gesture.unitExtent.x * scale : gesture.start.x,
            y: signs.y < 0 ? anchorBottom - gesture.unitExtent.y * scale : gesture.start.y,
            scale: scale
        )
    }

    /// Uniform scale about a fixed canvas point: both origin offsets shrink or
    /// grow by the same ratio the scale did, so the anchored point keeps the
    /// same place in the source image.
    private func pinched(
        _ gesture: Gesture,
        anchor: (x: Float, y: Float),
        by magnification: Float
    ) -> AppleReferencePlacementUpdate {
        let scale = max(
            gesture.start.scale * magnification,
            minimumScale(for: gesture.unitExtent)
        )
        let ratio = scale / gesture.start.scale
        return AppleReferencePlacementUpdate(
            x: anchor.x - (anchor.x - gesture.start.x) * ratio,
            y: anchor.y - (anchor.y - gesture.start.y) * ratio,
            scale: scale
        )
    }

    /// The scale at which the shorter projected axis reaches the minimum size —
    /// the floor a collapsing gesture stops at.
    private func minimumScale(for unitExtent: (x: Float, y: Float)) -> Float {
        max(
            minimumProjectedSize / unitExtent.x,
            minimumProjectedSize / unitExtent.y
        )
    }
}
