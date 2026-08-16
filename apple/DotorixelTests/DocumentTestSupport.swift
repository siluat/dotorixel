import Foundation
@testable import Dotorixel

/// A fresh layer id in the core's canonical form — the core normalizes ids
/// to lowercase, so string comparisons against ids it returns hold.
func makeLayerId() -> String {
    UUID().uuidString.lowercased()
}

/// A fresh frame id in the core's canonical form — the frame-axis mirror of
/// `makeLayerId`.
func makeFrameId() -> String {
    UUID().uuidString.lowercased()
}

/// A single-layer document fixture mirroring the editor's own construction
/// (web-parity "Layer 1" naming) — for tests that need a drawing surface
/// without a full `Workspace`.
func makeSingleLayerDocument(width: UInt32, height: UInt32) -> AppleDocument {
    try! AppleDocument(
        width: width,
        height: height,
        firstLayerId: UUID().uuidString,
        firstLayerName: "Layer 1"
    )
}

/// Counts the non-transparent pixels in the tab's composite — the shared
/// "how much did the stroke paint" probe for session tests.
func paintedPixelCount(_ tab: TabState) -> Int {
    let pixels = tab.document.composite()
    return stride(from: 3, to: pixels.count, by: 4).count { pixels[$0] != 0 }
}
