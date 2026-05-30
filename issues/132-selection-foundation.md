---
title: "Selection foundation — MarqueeRegion + tool registration + DefineMarquee + marching ants"
status: done
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

The tracer-bullet slice that wires Selection end-to-end with the smallest demoable feature: switch to the Selection tool (M), drag a rectangle, see marching-ants, press Escape to clear.

End-to-end coverage of every layer (Rust core, WASM facade, tool registry, stroke session, overlay, keyboard). All other Selection sub-issues build on this foundation.

Scope:

- **Rust core** (`crates/core/src/selection.rs`, new): `MarqueeRegion` value type with `from_drag(x0, y0, x1, y1)`, `contains(x, y)`, `translate(dx, dy)`, `clip_to(canvas_w, canvas_h) -> Option<Self>`, `(x, y, width, height)` accessors. Trait derives `Eq`, `Hash`. Inline unit tests covering normalization, clip-to-canvas, contains, translate, edge cases (1×1, off-canvas, degenerate inputs).
- **Rust core** (`crates/core/src/document.rs`): `marquee() -> Option<MarqueeRegion>` and `set_marquee(Option<MarqueeRegion>)`. The Marquee field becomes Document state. No region pixel mutators in this slice — those land in 136.
- **WASM facade** (`wasm/`): expose `MarqueeRegion` struct and Document marquee getter/setter. `wasm-sync.test.ts` updated to enforce structural compatibility.
- **Tool registry** (`src/lib/canvas/tool-registry.ts`): new `selection` entry — shortcut `M`, cursor `crosshair`, `isDrawingTool: true`, `isPixelMutationTool: true`.
- **Tool UI** (`src/lib/ui-editor/tool-ui.ts`): Lucide `SquareDashed` icon, `m.tool_selection()` label.
- **i18n** (`messages/{en,ko,ja}.json`): `tool_selection` = `"Selection"` / `"선택"` / `"選択"`.
- **Selection stroke session** (`src/lib/canvas/tools/selection-tool.ts`, new): `customTool` sugar. Stroke session implements `DefineMarquee` mode only — drag-from-outside writes a draft preview, release commits `set-marquee` via the Document Change Journal. No LiftAndDrag, no click-without-drag in this slice.
- **Document Change Journal** (`src/lib/canvas/editor-session/document-change-journal.svelte.ts`): new `set-marquee: { region: MarqueeRegion | null }` intent (undoable). Interaction-internal preview updates write directly to a transient Document field, not through the journal.
- **`SelectionOverlay.svelte`** (`src/lib/ui-editor/`, new): renders the Marquee as a marching-ants dashed rectangle. Uses CSS animation on `stroke-dashoffset` 0→8 in 600ms `linear infinite`. 1px dashed `var(--ds-accent)` + 1px outer wash. Respects `prefers-reduced-motion`. Marquee outline clips at canvas boundary. Mounted alongside `ReferenceLayerPlacementOverlay` in `PixelCanvasView.svelte`. No floating-buffer tracking in this slice.
- **Keyboard input** (`src/lib/canvas/keyboard-input.svelte.ts`): Escape clears the Marquee when active (Idle state only — Floating cancel arrives in 144).
- **Tests**: Rust unit tests for `MarqueeRegion`. TS tests for the Selection stroke session's DefineMarquee path, the journal's `set-marquee` intent, the `SelectionOverlay` rendering.

## Acceptance criteria

- Pressing `M` activates the Selection tool; toolbar reflects state.
- Dragging on the canvas with Selection active produces a live marching-ants preview and commits a Marquee on release.
- Marching-ants animation runs at the documented 600ms `linear infinite` cadence and stops at offset 0 under `prefers-reduced-motion`.
- Marquee outline clips at the canvas boundary; partially off-canvas regions render only the in-bounds portion.
- Pressing Escape with an active Marquee clears it.
- `MarqueeRegion::from_drag` normalizes drag direction and degenerate inputs (1×1).
- `Document.marquee()` round-trips through `set_marquee(...)`.
- `wasm-sync.test.ts` continues to pass.
- Selection tool icon and label render in all three locales.

## Blocked by

None — can start immediately.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/selection.rs` | Added `MarqueeRegion` with drag normalization, contains, translate, clipping, and edge-case unit coverage. |
| `crates/core/src/document.rs` | Added Document-scoped optional Marquee state with round-trip tests. |
| `wasm/src/lib.rs` | Exposed Marquee bindings and Document getter/setter through the WASM facade. |
| `src/lib/canvas/canvas-model.ts` | Added the shell-facing Marquee interface and Document contract. |
| `src/lib/canvas/wasm-backend.ts` | Added Marquee construction/copy helpers for shell code that must avoid consuming WASM handles. |
| `src/lib/canvas/tools/selection-tool.ts` | Added DefineMarquee stroke behavior with live preview and undoable commit effect. |
| `src/lib/canvas/SelectionOverlay.svelte` | Added marching-ants Marquee rendering with canvas-bound clipping and reduced-motion fallback. |
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | Added undoable `set-marquee` document intent. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Routed Marquee previews, commits, clears, and reactive projection through active tab state. |
| `src/lib/canvas/keyboard-input.svelte.ts` | Added Escape-to-clear behavior while idle. |
| `src/lib/canvas/tool-registry.ts` | Registered the Selection tool with shortcut `M` and crosshair cursor. |
| `src/lib/ui-editor/tool-ui.ts` | Added the Selection toolbar icon and localized label. |
| `messages/en.json`, `messages/ko.json`, `messages/ja.json` | Added Selection label translations. |
| `src/routes/editor/+page.svelte`, `src/lib/canvas/PixelCanvasView.svelte` | Mounted the Marquee overlay in the editor canvas for desktop and mobile layouts. |
| `src/lib/canvas/*selection*test.ts`, `src/lib/canvas/editor-session/*test.ts`, `src/lib/canvas/keyboard-input.svelte.test.ts`, `src/lib/canvas/tool-registry.test.ts` | Added regression coverage for DefineMarquee, overlay projection, journal commits, Escape clear, toolbar shortcut, and reactive rendering. |

### Key Decisions

- The first Selection slice implements DefineMarquee only: move/copy/paste, clipping-mask behavior, persistence, and action bar work remain in their dedicated follow-up issues.
- Click-only strokes do not create a 1×1 Marquee. Full click-without-drag deselect behavior remains in issue 135.
- The overlay uses the same rounded effective pixel size as the canvas renderer so fractional zoom does not drift from the pixel grid.

### Notes

- Marquee state is Document-scoped and undoable in memory, but is not persisted yet; issue 134 owns the v5 storage migration.
- Reference Layer and region-pixel mutation semantics are intentionally deferred to issues 136 and 138.
