---
title: "Reference Layer: Timeline Panel — per-row kind icon + activation across kinds"
status: done
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Render a distinct icon on each Timeline Panel row that tells Pixel vs Reference apart at a glance, and confirm that active-layer selection, reordering, visibility toggle, and delete all work for Reference Layers the same way they work for Pixel Layers (no kind-specific exceptions).

Scope:

- Per-row kind icon (Pixel vs Reference) per the 106 design.
- Active-layer selection works for both kinds (Reference rows can become active).
- Reorder, visibility toggle, and delete inherit from PRD-086's mechanics; a regression test verifies they work on a mixed-kind stack.
- Renderer still reads through the existing `renderVersion` / `compositeBuffer` pipeline — no new wiring needed beyond rendering the right icon per row.
- TimelinePanel keeps its existing row layout; the kind icon slots in at the position chosen in 106.

## Acceptance criteria

- Pixel rows show the Pixel kind icon; Reference rows show the Reference kind icon — per the 106 design.
- Clicking a Reference Layer row makes it the active layer (row highlight identical to a Pixel row's active treatment).
- Reorder works across mixed-kind stacks; the composite reflects the new depth.
- Visibility toggle on a Reference row excludes it from `composite()`; the row's icon stays visible and dimmed (per design).
- Delete on a Reference row removes the row; an adjacent layer becomes active (per the existing PRD-086 rule).
- A regression test asserts add → reorder → toggle visibility → delete on a mixed-kind stack.

## Blocked by

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)
- [106 — Reference Layer UX detail design](106-reference-layer-ux-design.md)

## User stories addressed

- #11, #12, #15, #20.

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/TimelinePanel.svelte` | Added per-row Pixel/Reference kind icons, required layer kind input, and accessible i18n labels. |
| `src/routes/editor/+page.svelte` | Passed each document layer's kind from the active document into `TimelinePanel`. |
| `messages/en.json` | Added Pixel Layer / Reference Layer labels for Timeline kind icons. |
| `messages/ko.json` | Added Korean Pixel/Reference Layer labels for Timeline kind icons. |
| `messages/ja.json` | Added Japanese Pixel/Reference Layer labels for Timeline kind icons. |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | Covered Pixel vs Reference kind icon rendering, accessible labels, and Reference row activation. |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | Added mixed Pixel/Reference stack regression coverage for add → reorder → visibility toggle → delete. |

### Key Decisions

- Layer kind is required at the Timeline Panel boundary instead of defaulting missing values to Pixel, so kind-specific UI cannot silently misrepresent a Reference Layer.
- The kind icon is semantic, not decorative: screen readers receive localized Pixel Layer / Reference Layer labels while the SVG glyphs remain hidden.
- Existing activation, reorder, visibility, and delete pathways handle Reference Layers without kind-specific exceptions; tests pin that behavior through the public TabState calls.

### Notes

- Reference Layer add/import UI, restore-original-size action, placement overlay, drawing-tool no-op cursor, and sampling updates remain follow-up slices.
