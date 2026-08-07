import SwiftUI

/// Maps a canvas-space Marquee region to its display rect in canvas-area
/// points, clipped to the canvas — `nil` when nothing of it is on-canvas
/// (defensive parity with the web `SelectionOverlay` projection). The
/// viewport transform places a cell at `round(pan) + cell × eps` device
/// pixels (the hover highlight's `cellRect` math); dividing by the display
/// scale converts to the points the overlay is laid out in, so pan and zoom
/// reposition the ants for free.
func marqueeDisplayRect(
    region: AppleMarqueeRegion,
    canvasWidth: UInt32,
    canvasHeight: UInt32,
    viewport: AppleViewport,
    displayScale: CGFloat
) -> CGRect? {
    guard let clipped = appleMarqueeClipTo(
        region: region, canvasW: canvasWidth, canvasH: canvasHeight
    ) else { return nil }

    let eps = viewport.effectivePixelSize()
    let deviceX = viewport.panX().rounded() + Double(clipped.x) * eps
    let deviceY = viewport.panY().rounded() + Double(clipped.y) * eps
    return CGRect(
        x: deviceX / displayScale,
        y: deviceY / displayScale,
        width: Double(clipped.width) * eps / displayScale,
        height: Double(clipped.height) * eps / displayScale
    )
}

/// The marching-ants rectangle over the active Marquee, rendered above the
/// Metal canvas (web parity: `SelectionOverlay.svelte` — a background-color
/// wash under an animated accent dash, so the ants read on any pixel color).
/// Isolates its observable reads (Marquee + viewport) from `ContentView`'s
/// body the same way `HoverHighlightOverlay` does.
struct MarqueeOverlay: View {
    let tab: TabState
    let displayScale: CGFloat

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var antsPhase: CGFloat = 0

    // Web parity: 1px accent dash (4 4) marching 8px per 600ms over a 3px
    // background wash.
    private let washWidth: CGFloat = 3
    private let dashWidth: CGFloat = 1
    private let dashPattern: [CGFloat] = [4, 4]
    private let antsCycle: CGFloat = 8
    private let antsPeriod: TimeInterval = 0.6

    var body: some View {
        if let region = tab.marquee,
           let rect = marqueeDisplayRect(
               region: region,
               canvasWidth: tab.document.width(),
               canvasHeight: tab.document.height(),
               viewport: tab.viewport,
               displayScale: displayScale
           ) {
            Rectangle()
                .stroke(DesignTokens.bgBase, lineWidth: washWidth)
                .overlay {
                    Rectangle()
                        .stroke(
                            DesignTokens.accent,
                            style: StrokeStyle(
                                lineWidth: dashWidth,
                                dash: dashPattern,
                                dashPhase: antsPhase
                            )
                        )
                }
                .frame(width: rect.width, height: rect.height)
                .offset(x: rect.minX, y: rect.minY)
                // Identity reset on a live Reduce Motion toggle: recreating
                // the view is the one reliable way to kill a running
                // `repeatForever` animation, and `onAppear` then re-evaluates
                // the guard below — both directions handled with one seam.
                .id(reduceMotion)
                .onAppear {
                    guard !reduceMotion else { return }
                    withAnimation(.linear(duration: antsPeriod).repeatForever(autoreverses: false)) {
                        antsPhase = antsCycle
                    }
                }
                // The display rect is canvas-clipped in document space but
                // unbounded in screen space — pan/zoom can push it past the
                // canvas area, and `.overlay` content is never clipped by
                // default. Fill the proposed canvas-area frame and clip, so
                // the ants stay off the neighboring chrome (web parity: the
                // canvas container's `overflow: hidden`).
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .clipped()
                .allowsHitTesting(false)
        }
    }
}
