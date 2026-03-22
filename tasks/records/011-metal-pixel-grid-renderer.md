# 011 — Metal pixel grid renderer — minimal Metal pipeline rendering the pixel buffer

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Rendering/Shaders.metal` | Vertex + fragment shader — fullscreen quad, checkerboard transparency, pixel sampling (nearest-neighbor), grid overlay |
| `apple/Dotorixel/Rendering/PixelGridRenderer.swift` | `MTKViewDelegate` — Metal pipeline setup, RGBA texture upload, uniform management, on-demand draw |
| `apple/Dotorixel/Rendering/PixelCanvasView.swift` | SwiftUI wrapper — `NSViewRepresentable` (macOS) / `UIViewRepresentable` (iOS) with shared Coordinator |
| `apple/Dotorixel/ContentView.swift` | Replaced placeholder with 8×8 test canvas (RGB + semi-transparent yellow + white diagonal) |

### Key Decisions

- Single fullscreen quad + fragment shader over multi-pass rendering — checkerboard, pixel data, grid all computed per-fragment in one draw call
- On-demand rendering (`isPaused=true`, `enableSetNeedsDisplay=true`) — pixel art editor doesn't need 60fps, saves battery
- Viewport size read from `drawableSize` at draw time — avoids first-frame zero-size issue when SwiftUI hasn't laid out the MTKView yet

### Notes

- Canvas is positioned at top-left (panOffset 0,0) — centering will come with zoom/pan input task
- Xcode 26 beta requires separate Metal Toolchain download (`xcodebuild -downloadComponent MetalToolchain`)
