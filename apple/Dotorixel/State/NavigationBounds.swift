/// Document-space rectangle, in canvas-pixel coordinates, that a tab's
/// viewport pan is clamped to (web parity: `navigation-bounds.ts`). Expressed
/// as min/max corners in the `Double` precision the core clamp consumes.
struct NavigationBounds: Equatable {
    let minX: Double
    let minY: Double
    let maxX: Double
    let maxY: Double
}

/// The document-space region a tab's viewport pan is clamped to: the union of
/// the canvas rectangle and, when supplied, an active Reference Layer's visible
/// underlay footprint. The footprint enters as an input so its source can
/// change (reference-geometry consolidation) without touching this computation.
///
/// Returns the canvas rectangle alone when no footprint is given or when the
/// footprint lies entirely within the canvas.
func navigationBounds(
    canvasWidth: UInt32,
    canvasHeight: UInt32,
    referenceFootprint: AppleReferenceFootprint?
) -> NavigationBounds {
    let canvas = NavigationBounds(
        minX: 0,
        minY: 0,
        maxX: Double(canvasWidth),
        maxY: Double(canvasHeight)
    )
    guard let footprint = referenceFootprint else { return canvas }
    return NavigationBounds(
        minX: min(canvas.minX, Double(footprint.minX)),
        minY: min(canvas.minY, Double(footprint.minY)),
        maxX: max(canvas.maxX, Double(footprint.maxX)),
        maxY: max(canvas.maxY, Double(footprint.maxY))
    )
}
