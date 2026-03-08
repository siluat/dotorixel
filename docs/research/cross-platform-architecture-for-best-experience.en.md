# Cross-Platform Architecture for Best Pixel Art Editor Experience

> Technical strategy research for delivering the best pixel art editor experience on every platform.

## Core Principle: Shared Core + Platform-Native Shell

Apps that achieve "best on every platform" almost universally follow this pattern.

```text
┌───────────────────────────────────────────────────────────┐
│                  Platform Shell (Native)                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │   Apple   │ │  Android  │ │  Desktop  │ │    Web    │  │
│  │  SwiftUI  │ │  Compose  │ │ OS-native │ │  Svelte   │  │
│  │  +Metal   │ │  +Vulkan  │ │  +Vulkan  │ │  +WebGPU  │  │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘  │
│        │             │             │             │        │
│  ┌─────┴─────────────┴─────────────┴─────────────┴─────┐  │
│  │                 Shared Core (Rust)                  │  │
│  │  Pixel Buffer / Tool Algorithms / Undo-Redo / I/O   │  │
│  │  Color / Layer Compositing / Selection / Coords     │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

## Real-World Examples of This Pattern

| App | Shared Core | Platform Shell |
|---|---|---|
| **Figma** | C++ rendering engine | Web (WASM) + Desktop (Electron) + Mobile (native) |
| **1Password** | Rust core | SwiftUI / Kotlin / Electron |
| **Signal** | Rust (libsignal) | Swift / Kotlin / Electron |
| **Zed Editor** | Rust (GPUI) | Metal (macOS), Vulkan (Linux) |

## Applying to a Pixel Art Editor

### Layer 1: Shared Core — Rust

All platform-agnostic business logic is written in Rust.

```text
core/
├── pixel_buffer.rs    # RGBA buffer, layer compositing, blend modes
├── tools/             # Pencil, eraser, flood fill, line, shape, selection
├── history.rs         # Undo/Redo (command pattern or snapshot)
├── color.rs           # HSV/RGB conversion, palette management
├── viewport.rs        # Coordinate transforms, zoom/pan
├── format/            # .aseprite, .png, .ase, custom format
└── tilemap.rs         # Tileset/tilemap system
```

**Why Rust (in this scenario):**

- C++-level performance with memory safety
- Compiles to web target via wasm-pack
- Links directly to iOS/Android as .a/.so libraries
- Runs natively on desktop

### Layer 2: Rendering — Two Strategies

#### Strategy A: wgpu (Rust Cross-Platform GPU)

```text
wgpu backends:
├── Metal     → iOS, macOS
├── Vulkan    → Android, Windows, Linux
├── DX12      → Windows
└── WebGPU    → Browser
```

- Write the rendering pipeline once in Rust, get GPU acceleration on every platform
- Mature enough to serve as Firefox's WebGPU implementation
- **Downside:** Must also handle UI rendering directly

#### Strategy B: Platform-Native Rendering

| Platform | Renderer | Advantage |
|---|---|---|
| iOS/macOS | MetalKit | Apple Pencil low-latency, ProMotion 120Hz |
| Android | Vulkan / OpenGL ES | Stylus optimization |
| Desktop | Vulkan / DX12 | Large canvas performance |
| Web | WebGPU / WebGL2 | Zero install |

- Best possible performance by using each platform's GPU API directly
- **Downside:** Writing the renderer 4 times (most expensive part)

**Pragmatic choice:** Start with Strategy A (wgpu), replace with native only where platform-specific optimization is needed. For example, Apple Pencil input handling requires Metal + UIKit directly to achieve low latency.

### Layer 3: UI Shell — Platform Native

The layer that determines "best experience."

| Platform | UI Technology | Platform-Specific UX |
|---|---|---|
| iOS/iPadOS | SwiftUI + UIKit | Apple Pencil, multitasking, Stage Manager |
| macOS | SwiftUI + AppKit | Menu bar, keyboard-centric workflow, multi-window |
| Android | Jetpack Compose | Stylus, Material You |
| Windows/Linux | egui (Rust) or Qt | Keyboard shortcuts, large monitors |
| Web | Svelte/React | Zero install, sharing, collaboration |

### Core Bindings per Platform

```text
Rust Core
  ├─→ iOS/macOS:   Swift ↔ Rust (UniFFI or C FFI)
  ├─→ Android:     Kotlin ↔ Rust (JNI via UniFFI)
  ├─→ Desktop:     Direct Rust execution
  └─→ Web:         WASM (wasm-bindgen)
```

[UniFFI](https://mozilla.github.io/uniffi-rs/) (developed by Mozilla) is key. It auto-generates Swift/Kotlin bindings from Rust code, significantly reducing interface maintenance costs.

## Cost Reality

| Component | Effort |
|---|---|
| Rust Core | 1× (write once, shared across all platforms) |
| Rendering (wgpu) | 1× + per-platform tuning |
| iOS UI | 1× |
| macOS UI | 0.5× (partially shared with iOS) |
| Android UI | 1× |
| Desktop UI | 1× |
| Web UI | 1× |
| Bindings/glue code | 0.5× per platform |

Roughly **5–6× development cost** vs. a single cross-platform framework. However:

- Core accounts for 60–70% of total code → actual duplication is only 30–40% (UI)
- Each platform UI only requires one platform-specialist developer
- Incremental expansion is possible — add one platform at a time

## Realistic Execution Order

```text
Phase 1: Rust Core + Web (WASM + Svelte)
         → Fastest validation, broadest reach

Phase 2: + iOS/iPadOS (SwiftUI + Metal)
         → Tablet market, Apple Pencil experience

Phase 3: + macOS / Windows / Linux Desktop
         → Professional user market

Phase 4: + Android
         → Remaining mobile coverage
```

## Reference: Pixquare Case

Pixquare (iOS/iPadOS pixel art editor) is a native app rendering with Apple MetalKit. It narrowed its platform scope to Apple's ecosystem and maximized performance. Built by a solo developer (Son Nguyen), inspired by Aseprite. App Store rating: 4.86/5.

## Related Discussion Summary

The following topics were analyzed prior to writing this document:

1. **Rust/WASM necessity analysis** — TypeScript alone is sufficient for the current project scope (8–32px canvas). Even extending to tilemap/level design, the performance bottleneck is rendering (GPU), not CPU
2. **Tauri mobile status** — Proven desktop cases exist (Cap, Aptabase, etc.). Mobile app store releases are virtually nonexistent
3. **Capacitor vs Flutter** — Capacitor wraps "web into mobile," Flutter exports "mobile to web." Capacitor for web-first, Flutter for mobile-quality-first
4. **Best quality strategy** — Cross-platform frameworks cannot achieve "best everywhere." Shared Core + Platform-Native Shell is the only viable path
