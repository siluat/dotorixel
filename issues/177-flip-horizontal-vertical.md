---
title: "Flip horizontal & vertical — region and active layer"
status: done
created: 2026-06-14
parent: 176-flip-and-rotate-transforms.md
---

# Flip horizontal & vertical

## Parent

[176 — Flip & rotate transforms](176-flip-and-rotate-transforms.md)

## What to build

The first tracer bullet for the transform feature: a complete end-to-end **flip
horizontal** and **flip vertical** path that also stands up the shared transform
pipeline (Rust primitive → Document mutator → WASM → Change Journal intent → TS
dispatch → UI → i18n) that later rotation slices extend.

Behaviour:

- The flip operation resolves its target **at apply time** from Document state:
  - **Marquee active** → mirror the pixels inside the Marquee on the active Pixel
    Layer; pixels outside the region and the Marquee position itself are
    unchanged.
  - **No Marquee** → mirror the **entire active Pixel Layer** in place (canvas
    dimensions unchanged).
- When the active layer is a **Reference Layer**, flip is a silent no-op (matches
  the existing drawing/clear no-op contract) and captures no undo snapshot.
- A live **Floating Selection** is committed first (as `resize` does via
  `#commitIdleFloatingSelection()`), then the flip applies to committed pixels.
- Each flip is a single undoable step in the Document Change Journal; redo
  re-applies it.

Entry points (both dispatch the same operations; target resolved by Marquee
state):

- **SelectionActionBar**: Flip H / Flip V actions (Lucide `FlipHorizontal` /
  `FlipVertical`), following the existing `SelectionAction` array pattern.
- **RightPanel → Canvas section**: a new **Transform group** (sibling to the
  resize control and Clear button) with Flip H / Flip V.

Reuse the existing region seams where natural (`lift_region` / `composite_region`)
and add whole-canvas in-place flips on `PixelCanvas`. New journal intents:
`flip-horizontal`, `flip-vertical` (no payload; target resolved in Rust). i18n
keys added to `en` / `ko` / `ja` (e.g. `action_transformFlipHorizontal`,
`action_transformFlipVertical`, and a `section_transform` group label).

## Acceptance criteria

- Flip H and Flip V are available from the SelectionActionBar (when a Marquee is
  active) and from the RightPanel Transform group (when none is).
- With a Marquee on a Pixel Layer, flip mirrors pixels within the region only;
  pixels outside are untouched and the Marquee position is unchanged.
- With no Marquee, flip mirrors the entire active Pixel Layer; canvas dimensions
  are unchanged.
- With a Reference Layer active, flip is a silent no-op and captures no undo
  snapshot.
- A live Floating Selection is committed before the flip applies.
- Each flip is a single undo step; undo restores the prior pixels exactly and
  redo re-applies.
- Button labels are localized in en / ko / ja.
- Rust unit tests cover buffer/region/whole-canvas flip including 1×1 region,
  region flush against each edge, partially off-canvas region, and double-flip
  identity.
- Journal tests cover: one snapshot captured per flip, undo restores, and the
  Reference-active guard suppresses the snapshot.
- Component tests cover: both entry points render the actions and invoke their
  handlers with localized labels.

## Blocked by

None - can start immediately.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/canvas.rs` | Pure `flip_buffer_horizontal/vertical` primitives + in-place `PixelCanvas::flip_horizontal/vertical` |
| `crates/core/src/document.rs` | `Document::flip_horizontal/vertical` — resolves Marquee region vs whole active layer at apply time; Reference no-op; shared `flip_active_pixel_layer` helper reusing `lift_region`/`clear_region`/`composite_region` |
| `wasm/src/lib.rs` | `WasmDocument::flip_horizontal/vertical` delegation (payload-less) |
| `src/lib/canvas/canvas-model.ts` | `Document` interface `flip_horizontal/vertical` (wasm-sync contract) |
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | `flip-horizontal`/`flip-vertical` intents — one snapshot per flip, undo/redo, `pixel`-only guard |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `flipHorizontal/flipVertical` — commits an idle Floating Selection first, then the flip |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | `handleFlipHorizontal/Vertical` facade |
| `src/lib/canvas/SelectionActionBar.svelte` | Flip H/V actions (Lucide icons) when a Marquee is active |
| `src/lib/ui-editor/RightPanel.svelte` | Transform group (desktop, no Marquee) |
| `src/lib/ui-editor/SettingsContent.svelte` | Transform section (compact, no Marquee) — parity extension |
| `src/lib/canvas/PixelCanvasView.svelte`, `src/routes/editor/+page.svelte` | Thread handlers to all three entry points (desktop + compact) |
| `messages/{en,ko,ja}.json` | `section_transform`, `action_transformFlipHorizontal/Vertical` |
| Rust + Vitest tests | canvas/document flip (buffer, region, whole-canvas, 1×1, edge-flush, partial off-canvas, double-flip identity, Reference no-op); journal snapshot/undo/redo/guard; tab-state floating-commit; SelectionActionBar / RightPanel / SettingsContent component tests |

### Key Decisions

- **Target resolved in Rust at apply time** via payload-less intents. Region flip reuses the existing `lift_region` → flip buffer → `clear_region` → `composite_region` seams (clear-then-composite gives overwrite semantics so transparent mirrored-in pixels correctly replace); whole-layer flip uses the in-place `PixelCanvas` methods.
- **Infallible, no `Result`** — flip has no failure mode (no dimension/length validation), so the core and WASM signatures return `()`, per "trust the core."
- **Compact parity (user-approved, beyond the issue's two named entry points)**: added a Transform section to `SettingsContent` so whole-layer flip is reachable without a Marquee on the compact layout, not only via the desktop `RightPanel`. Cross-layout feature parity is a stated project priority.
- **Single shared i18n key set** (`action_transform*`) used by all three entry points instead of per-context keys (DRY).

### Notes

- **Unblocks 178** (Rotate region 90° CW/CCW), which depended on this slice's transform pipeline. Parent PRD 176 stays open (178, 179 remain).
- The `SelectionActionBar` right-edge-clamp test had its viewport widened (240→360px) to keep the clamp observable after the bar gained two actions; intent preserved, documented inline.
- `aria-hidden` applied to all `SettingsContent` action-button icons (Export/Clear included) for consistency with `RightPanel`/`SelectionActionBar`.
- Apple shell flip is not implemented (Core ready; native UI pending).
