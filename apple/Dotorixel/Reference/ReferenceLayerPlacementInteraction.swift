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

/// Which surface owns the running gesture. Every callback names its role so a
/// second pointer — a grip pressed during a body drag, a finger still down
/// after a pinch — cannot steer or resolve a gesture it does not own.
enum ReferencePlacementGestureRole: Equatable {
    /// A drag on the box body (`nil`) or on one corner grip.
    case drag(ReferencePlacementHandle?)
    case pinch
}

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

    /// The source key of the Reference the running gesture opened on, or `nil`
    /// when none is. Callers compare it against the current underlay before
    /// trusting the draft: an import replaces the Reference in place, so the
    /// Layer under a live gesture can become a different image.
    var targetKey: String? { gesture?.sourceKey }

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
        let role: ReferencePlacementGestureRole
        let sourceKey: String
        let start: AppleReferencePlacement
        let kind: Kind
        /// The committed footprint's extents divided by its scale — the
        /// projected size one scale unit spans, per axis. Read from the core's
        /// rotation-aware footprint rather than the raw source dimensions, so
        /// a quarter-turned Reference scales about the corner the user sees.
        let unitExtent: (x: Float, y: Float)
        /// The translation this gesture opened at, subtracted from every later
        /// one. A drag resumed after a pinch took the placement over still
        /// reports translation cumulative from its original touch-down;
        /// replaying that whole delta would make the reference jump.
        let baselineTranslation: CGSize
    }

    /// Whether `role` owns the running gesture — the view's cue that it should
    /// open one rather than keep feeding an existing one.
    func isOpen(for role: ReferencePlacementGestureRole) -> Bool {
        gesture?.role == role
    }

    /// Opens a drag gesture against `target`'s committed placement. A `nil`
    /// handle is a body drag (move); a handle is a corner scale drag. Refused
    /// while any gesture is already open: the pointer that got there first
    /// keeps the placement until it resolves.
    ///
    /// `translation` is the drag's translation at this moment, which later
    /// updates are measured against — a drag that never lifted reports it
    /// cumulative from its original touch-down, not from here.
    func begin(
        on target: ReferenceLayerUnderlay,
        handle: ReferencePlacementHandle?,
        at translation: CGSize
    ) {
        guard gesture == nil else { return }
        open(
            on: target,
            role: .drag(handle),
            kind: handle.map(Kind.scale) ?? .move,
            baselineTranslation: translation
        )
    }

    /// Opens a pinch gesture against `target`'s committed placement. `anchor`
    /// is the canvas-space point under the fingers, which the scaled placement
    /// holds still. Unlike `begin`, this takes the placement over from a
    /// running drag — a second finger landing is an explicit change of intent.
    func beginPinch(on target: ReferenceLayerUnderlay, anchor: CGPoint) {
        open(
            on: target,
            role: .pinch,
            kind: .pinch(anchor: (x: Float(anchor.x), y: Float(anchor.y))),
            baselineTranslation: .zero
        )
    }

    /// Advances the live draft for a drag translation, converted from points
    /// to canvas pixels by `pointsPerCanvasPixel` (the viewport's effective
    /// pixel size in the space the overlay is laid out in). Ignored unless
    /// `role` owns the gesture.
    func update(
        translation: CGSize,
        pointsPerCanvasPixel: CGFloat,
        from role: ReferencePlacementGestureRole
    ) {
        guard let gesture, gesture.role == role, pointsPerCanvasPixel > 0 else { return }
        let baseline = gesture.baselineTranslation
        let delta = (
            x: Float((translation.width - baseline.width) / pointsPerCanvasPixel),
            y: Float((translation.height - baseline.height) / pointsPerCanvasPixel)
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
    /// `role` does not own one — a non-owner's release resolves nothing.
    func commit(from role: ReferencePlacementGestureRole) -> AppleReferencePlacementUpdate? {
        guard gesture?.role == role else { return nil }
        defer { cancel() }
        return draft
    }

    /// Abandons the gesture and its draft — the overlay falls back to the
    /// committed placement on the next render.
    func cancel() {
        gesture = nil
        draft = nil
    }

    private func open(
        on target: ReferenceLayerUnderlay,
        role: ReferencePlacementGestureRole,
        kind: Kind,
        baselineTranslation: CGSize
    ) {
        let footprint = target.footprint
        let scale = target.placement.scale
        gesture = Gesture(
            role: role,
            sourceKey: target.sourceKey,
            start: target.placement,
            kind: kind,
            unitExtent: (
                x: (footprint.maxX - footprint.minX) / scale,
                y: (footprint.maxY - footprint.minY) / scale
            ),
            baselineTranslation: baselineTranslation
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
        let scale = max(projected, minimumScale(for: gesture))

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
        let scale = max(gesture.start.scale * magnification, minimumScale(for: gesture))
        let ratio = scale / gesture.start.scale
        return AppleReferencePlacementUpdate(
            x: anchor.x - (anchor.x - gesture.start.x) * ratio,
            y: anchor.y - (anchor.y - gesture.start.y) * ratio,
            scale: scale
        )
    }

    /// The floor a collapsing gesture stops at: the scale where the shorter
    /// projected axis reaches the minimum size, but never above where the
    /// gesture started. A source small enough that its auto-fit already sits
    /// under the floor would otherwise be enlarged by merely touching a grip,
    /// turning a stationary gesture into an edit.
    private func minimumScale(for gesture: Gesture) -> Float {
        let floor = max(
            minimumProjectedSize / gesture.unitExtent.x,
            minimumProjectedSize / gesture.unitExtent.y
        )
        return min(floor, gesture.start.scale)
    }
}
