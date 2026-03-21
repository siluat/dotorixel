import SwiftUI

/// Central editor state shared across all views via `@Observable`.
///
/// Wraps UniFFI objects (`ApplePixelCanvas`, `AppleViewport`) and provides
/// SwiftUI-compatible properties. Since `ApplePixelCanvas` is a reference type
/// whose internal mutations are invisible to `@Observable`, the `canvasVersion`
/// counter must be incremented manually to trigger Metal re-renders.
@Observable
final class EditorState {
    var pixelCanvas: ApplePixelCanvas
    var viewport: AppleViewport
    var activeTool: ToolType = .pencil
    /// Default foreground color matches Pebble's #2D2D2D.
    var foregroundColor: Color
    var showGrid: Bool = true

    /// Manually incremented to trigger SwiftUI updates when canvas pixels change.
    var canvasVersion: Int = 0

    init(
        width: UInt32 = 16,
        height: UInt32 = 16
    ) {
        self.pixelCanvas = try! ApplePixelCanvas(width: width, height: height)
        self.viewport = AppleViewport.forCanvas(canvasWidth: width, canvasHeight: height)
        self.foregroundColor = Color(r: 0x2D, g: 0x2D, b: 0x2D, a: 0xFF)
    }
}
