---
title: Apple native — stroke session architecture (prefactoring for the full tool set)
status: done
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Prefactor the Apple shell's drawing pipeline so that every pointer stroke runs
through a per-stroke **session** with an explicit lifecycle, then migrate pencil
and eraser onto it with unchanged behavior. This is the "make the change easy"
step: every remaining Phase 2 tool slice plugs a new session kind into this seam.

Today the canvas coordinator applies the active tool pixel-by-pixel as samples
arrive. That shape can express only continuous tools. The tools coming next need
lifecycles the current pipeline cannot represent:

- **Shape tools** (line/rect/ellipse) — snapshot at stroke start, restore + redraw
  the whole preview on every drag sample, commit on release.
- **One-shot tools** (flood fill) — fire once on the first sample, ignore the drag.
- **Deferred-commit tools** (eyedropper) — sample during the drag, commit an effect
  only at release; cancel must discard it.
- **Move** — snapshot + re-shift relative to the drag origin; cancel restores.

Introduce a per-stroke session contract — conceptually `start / draw(current,
previous) / end / cancel` — resolved from the active tool when a stroke begins.
The web's stroke engine and tool-authoring sugars are the behavioral reference,
but the Swift implementation should be idiomatic (protocol- or closure-based as
fits), not a transliteration.

Also widen the shell-side tool identity: the editor's active tool is currently
the core `ToolType` enum, which exists for per-pixel `apply` and will never gain
fill/eyedropper/move variants (those are canvas ops or shell behaviors, not
per-pixel stamps — same split the web uses). Introduce a Swift-side tool identity
that covers the current tools, carries the user-visible display name, and can
grow per tool slice; it maps down to core `ToolType` only where per-pixel apply
is involved.

Behavioral invariants to preserve (all covered by existing tests):

- Pencil/eraser paint interpolated segments between samples (no gaps on fast drags).
- An undo snapshot is captured at stroke start; one undo reverts the whole stroke.
- Redundant samples on the same pixel don't trigger redraws.
- An interrupted pointer sequence (e.g. `touchesCancelled`) tears the session down;
  after this slice it must route through the session's `cancel`, not `end`.

## Acceptance criteria

- Pencil and eraser draw exactly as before: interpolated, history-integrated,
  re-rendering only when pixels change. Existing editor-state tests and docked
  snapshot tests pass unchanged.
- A stroke session is created per stroke from the active tool and driven through
  start → draw* → end (or cancel); unit tests cover the lifecycle order, including
  cancel-without-commit.
- Tool identity is shell-owned: the active-tool state, toolbar, and status bar
  read the Swift-side tool identity; core `ToolType` appears only at the FFI
  drawing call sites.
- The session seam demonstrably supports a non-continuous lifecycle (e.g. a test
  double session that defers an effect to `end` and discards it on `cancel`) —
  proving the seam is ready for shape/eyedropper/move without shipping them.
- No new UI. Status bar and toolbar behavior unchanged.

## Blocked by

None - can start immediately.

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Tools/EditorTool.swift` | Shell-owned tool identity (pencil/eraser): `displayName`, core `ToolType` mapping for FFI call sites, per-stroke session factory |
| `apple/Dotorixel/Tools/StrokeSession.swift` | `StrokeSession` lifecycle protocol (start / draw(current:previous:) / end / cancel) + narrow `StrokeSessionHost` surface |
| `apple/Dotorixel/Tools/StrokeEngine.swift` | Per-stroke driver: tool→session resolution, eager start, previous-sample threading, same-pixel dedup, teardown; injectable session factory for tests |
| `apple/Dotorixel/Tools/FreehandStrokeSession.swift` | Pencil/eraser session: Bresenham interpolation moved in from the coordinator, undo snapshot at start, draw color captured at begin |
| `apple/Dotorixel/State/EditorState.swift` | `beginStroke`/`continueStroke`/`endStroke`/`cancelStroke` replace `handleDrawStart`/`handleDrawEnd`; conforms to `StrokeSessionHost`; `activeTool` is now `EditorTool` |
| `apple/Dotorixel/Rendering/PixelCanvasView.swift` | Coordinator reduced to a thin adapter — coordinate conversion + forwarding only |
| `apple/Dotorixel/Rendering/InputMTKView.swift` | `drawingCancelled` added to `CanvasInputDelegate`; `touchesCancelled` routes to the cancel path |
| `apple/Dotorixel/Extensions/ToolType+DisplayName.swift` | Deleted — display names moved to `EditorTool` |
| `apple/DotorixelTests/EditorToolTests.swift` | `EditorTool` displayName tests (replaces `ToolTypeTests`) |
| `apple/DotorixelTests/StrokeEngineTests.swift` | Lifecycle-order tests (spy session) incl. cancel-without-commit, plus deferred-commit seam proof (end commits, cancel discards) |
| `apple/DotorixelTests/EditorStateTests.swift` | New stroke-lifecycle suite (paint+snapshot, interpolation, redundant-sample no-rerender, one-undo-per-stroke, cancel, eraser, capture-at-begin); two `handleDrawStart` call sites mechanically swapped to `beginStroke` |

### Key Decisions

- Draw color and tool are captured at stroke begin (web parity, user-approved) —
  mid-stroke palette/tool changes no longer affect the stroke in flight; locked
  by a test. The pre-existing behavior read both live per pixel.
- Session lifecycle lives natively in Swift (protocol-based), not in the Rust
  core: pointer handling is platform-divergent and the web keeps its own TS
  implementation; the algorithms (Bresenham, per-pixel apply) stay in core.
- `StrokeEngine` is a concrete class, no protocol — the varying seam is the
  session, not the engine; its `makeSession` init parameter is the test seam.
- Session `Bool` returns mean "canvas needs a re-render", not strictly "pixels
  changed" — preserves the legacy redraw-on-same-color-restamp behavior.

### Notes

- `ToolType` display names for line/rectangle/ellipse were removed with the
  extension (unreachable from the UI today); they return via `EditorTool` in
  issue 231.
- An out-of-canvas stroke begin no longer bumps `canvasVersion` (the old code
  re-rendered unconditionally on pointer-down) — matches the acceptance
  criterion "re-rendering only when pixels change".
- macOS has no cancel source yet — `drawingCancelled` is wired only from
  iPadOS `touchesCancelled`.
- Verified: full iOS suite (docked snapshots unchanged) + macOS build, both
  green; in the handwritten Swift shell, core `ToolType` references exist only
  inside `Tools/` (the generated FFI bindings and the Rust crates reference it
  by definition).
