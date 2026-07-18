---
title: Apple native — sampling loupe overlay for the eyedropper
status: done
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Add the **sampling loupe** — the magnifier overlay shown while an eyedropper
stroke is active — to the Apple shell, mirroring the web editor's loupe.

While the user drags with the eyedropper, a floating panel near the pointer
shows:

- A **9×9 pixel grid** centered on the target pixel, each cell rendered at
  loupe-cell scale with gridlines; the center cell (the one that will commit) is
  visually highlighted. Cells outside the canvas bounds render as "no pixel"
  (distinct from transparent pixels, which render like the canvas does).
- A **hex chip** below the grid: a small swatch plus the center pixel's hex
  string.

Positioning mirrors the web's rules: the loupe floats offset from the pointer —
a small symmetric offset for mouse/pencil input, a larger vertical offset for
touch (so the finger doesn't cover it) — and is clamped so it stays fully inside
the canvas area, flipping to the opposite side when it would overflow. The web's
loupe geometry constants (grid size 9, cell 24px, offsets 20px mouse / 80px
touch, etc.) are the single source of truth to mirror; keep them in one place on
the Swift side too.

The grid contents come from reading canvas pixels around the target via the
existing `get_pixel` FFI call (the web's sample-grid logic is shell-side; mirror
it in Swift — a 9×9 read per sample is cheap). The loupe appears on the first
sample of an eyedropper stroke, follows the drag, and disappears on release or
cancel.

This is a SwiftUI overlay in the canvas area — not part of the Metal render
pass.

## Acceptance criteria

- Starting an eyedropper drag shows the loupe; it follows the pointer and
  disappears on release/cancel.
- The grid shows the 9×9 neighborhood of the target pixel; the center cell is
  highlighted and matches the color that a release would commit.
- Out-of-bounds cells are visually distinct from transparent pixels.
- The hex chip shows the center pixel's hex value and tracks the drag.
- Touch input positions the loupe with the larger vertical offset; mouse input
  uses the small offset; near canvas edges the loupe flips/clamps to stay fully
  visible.
- Grid sampling and position math are unit-tested (bounds, flipping, center
  index); the loupe view has a snapshot baseline.

## Blocked by

- [234 — eyedropper tool](234-apple-eyedropper.md)

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Sampling/LoupeGeometry.swift` | Web `loupe-config.ts` mirror — single source for grid/cell/offset constants and the derived loupe box size |
| `apple/Dotorixel/Sampling/LoupePosition.swift` | Pure position math: `tr` default quadrant, edge flips, clamp safety net; touch centers horizontally with the 80pt offset |
| `apple/Dotorixel/Sampling/SampleGrid.swift` | 9×9 neighborhood read via the existing `getPixel` FFI; out-of-canvas cells are `nil`, distinct from transparent (`a == 0`) |
| `apple/Dotorixel/Sampling/SamplingLoupeState.swift` | `@Observable` loupe surface: grid + visibility driven by the session, pointer feed pushed by the input layer, derived `position` |
| `apple/Dotorixel/Sampling/LoupeView.swift` | SwiftUI overlay: grid (transparent checker, out-of-canvas hatch, center rings) + hex chip with a muted em-dash state |
| `apple/Dotorixel/Tools/StrokeSession.swift` | `StrokeSessionHost` gains the `samplingLoupe` seam; drawing sessions never touch it |
| `apple/Dotorixel/Tools/EyedropperStrokeSession.swift` | Shows/updates the loupe on every `draw`, dismisses on `end`/`cancel` |
| `apple/Dotorixel/Rendering/InputMTKView.swift` | `drawingBegan` carries a `LoupeInputSource` (finger → touch; pencil/pointer/mouse → mouse) |
| `apple/Dotorixel/Rendering/PixelCanvasView.swift` | Coordinator pushes the pointer + canvas-area size to the loupe before each stroke sample |
| `apple/Dotorixel/ContentView.swift` | Hit-test-free `LoupeView` overlay on the canvas area, offset by the derived position |
| `apple/DotorixelTests/SampleGridTests.swift` | Grid centering, row-major layout, out-of-bounds vs transparent |
| `apple/DotorixelTests/LoupePositionTests.swift` | Mouse default/flips/clamp, touch centering/flip/clamp (7 tests) |
| `apple/DotorixelTests/SamplingLoupeTests.swift` | Lifecycle through the `EditorState` public API + position derivation (7 tests) |
| `apple/DotorixelTests/LoupeViewSnapshotTests.swift` | Two snapshot baselines (all cell states + rings + chip; transparent-center em-dash) on the pinned host |

### Key Decisions

- The session drives the loupe through a `samplingLoupe` handle on
  `StrokeSessionHost` (web parity: the session owns the loupe lifecycle), while
  the pointer's view position + input source are pushed independently by the
  input layer — mirroring the web's split between session grid updates and the
  always-safe `updatePointer`.
- Only a direct finger touch (`UITouch.type == .direct`) uses the touch
  offsets; Apple Pencil and indirect pointers behave like a mouse, since the
  pencil tip does not cover the loupe the way a finger does.
- The commit path is unchanged: `end()` still samples the canvas directly at
  the target pixel — the same pixel the grid centers on — so the loupe is
  purely presentational.
- The transparent-cell checkerboard matches the Metal shader's orientation
  (top-left and bottom-right light) so the transparency signal is consistent
  with the canvas.

### Notes

- The hex chip uses the system monospaced font — the web's `GalmuriMono11` is
  not bundled in the Apple shell. Bundle it in a later parity pass if visual
  fidelity matters.
- The loupe appears only during eyedropper strokes. The web's tool-independent
  400ms long-press touch sampling (and its loupe) is out of scope; coordinate
  with the Apple Pencil palm-rejection work when it lands.
