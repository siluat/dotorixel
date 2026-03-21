import SwiftUI

struct ContentView: View {
    private let canvas: ApplePixelCanvas
    private let viewport: AppleViewport

    init() {
        // 8×8 test canvas with sample pixels
        let canvas = try! ApplePixelCanvas(width: 8, height: 8)

        // Red, green, blue in the top-left corner
        try! canvas.setPixel(x: 0, y: 0, color: Color(r: 255, g: 0, b: 0, a: 255))
        try! canvas.setPixel(x: 1, y: 0, color: Color(r: 0, g: 255, b: 0, a: 255))
        try! canvas.setPixel(x: 2, y: 0, color: Color(r: 0, g: 0, b: 255, a: 255))

        // Semi-transparent yellow
        try! canvas.setPixel(x: 3, y: 0, color: Color(r: 255, g: 255, b: 0, a: 128))

        // White diagonal from (0,0) to (7,7)
        for i: UInt32 in 0..<8 {
            try! canvas.setPixel(x: i, y: i, color: Color(r: 255, g: 255, b: 255, a: 255))
        }

        self.canvas = canvas
        self.viewport = AppleViewport.forCanvas(canvasWidth: 8, canvasHeight: 8)
    }

    var body: some View {
        VStack(spacing: 0) {
            PixelCanvasView(
                pixelCanvas: canvas,
                viewport: viewport,
                showGrid: true
            )

            HStack {
                Text("DOTORIXEL")
                    .font(.caption)
                Text("Core v\(coreVersion())")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.vertical, 4)
        }
    }
}
