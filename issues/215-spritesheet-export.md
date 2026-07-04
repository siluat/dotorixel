---
title: "Spritesheet (PNG) export — horizontal strip, end-to-end"
status: done
created: 2026-07-05
parent: 213-gif-spritesheet-export.md
---

## Parent

[213 — GIF / spritesheet export — multi-frame export formats (M4)](213-gif-spritesheet-export.md)

## What to build

The first real document-source export format, riding the generalized registry from the prefactor slice: export every Frame's composite as one contiguous horizontal-strip PNG. The simpler of the two encoders, so it doubles as the tracer bullet that proves the whole Document-source export path.

- **Core**: a Document-level spritesheet encoder in the core export module. It iterates the Frame axis in order, reads each frame through the existing per-frame composite seam (`composite_at`), tiles the composites left-to-right — each tile exactly canvas width × height, contiguous, no padding — and encodes a straight-alpha RGBA PNG through the existing PNG dependency. Sheet dimensions: `(width × frame count) × height`. A pure query: never touches the Active Frame, History, dirty state, or Playback. Compositing matches Playback exactly: visible Pixel Layers blended with their opacity, hidden layers and the Reference Layer excluded.
- **WASM**: the encoder exposed on the existing document binding, returning a byte buffer, with encode failures surfaced as errors per the established binding error pattern.
- **Web**: a Spritesheet entry in the format registry as a document-source format — `.png` extension, `image/png` MIME, and a default filename stem carrying a sheet marker so it doesn't collide with the still-PNG default. The entry appears in the desktop popover and mobile bottom sheet automatically (registry-driven), available regardless of frame count. Export analytics records the new format id. New user-facing strings land in en/ja/ko together.

## Acceptance criteria

- Core decode round-trip tests assert: sheet dimensions `(width × frame count) × height`; per-tile pixels match each frame's composite in axis order; hidden-layer and Reference-Layer exclusion; layer-opacity parity with existing composite behavior; a single-frame Document produces a one-tile sheet identical to that frame's composite.
- Exporting is observably side-effect-free: Active Frame, History, and dirty state are unchanged after encoding.
- WASM tests: the returned buffer carries the PNG signature; the error path surfaces as an error.
- Web tests mirror the existing PNG/SVG flow tests: registry entry (id, extension, MIME, document-source shape), sheet-marker default stem, and the export flow handing the Document to the format and firing analytics.
- Demoable: selecting Spritesheet in the popover or bottom sheet downloads a strip PNG whose tiles match the Timeline order.
- All three locales (en/ja/ko) updated together for any new strings.

## Blocked by

- [214 — Prefactor: export formats declare their source](214-export-format-source-prefactor.md)

## Results

| File | Description |
|------|-------------|
| `crates/core/src/export.rs` | `SpritesheetExport` trait + `impl for Document`: frames tiled left-to-right through `composite_at`, encoded via a shared `encode_rgba_png` helper (`PixelCanvas::encode_png` now delegates to it). Decode round-trip tests: tile order, hidden/Reference exclusion, opacity parity, purity, single-frame |
| `wasm/src/lib.rs` | `WasmDocument::encode_spritesheet_png() -> Result<Vec<u8>, JsError>` + PNG-signature marshalling test |
| `src/lib/canvas/export.ts` | `spritesheet` document-source registry entry, `exportAsSpritesheet` (runtime narrowing, `image/png` blob), optional `defaultStem` seam (`dotorixel-WxH-sheet` via `spritesheetDefaultStem`), lazy `label: () => string`, shared `downloadBlob` plumbing |
| `src/lib/canvas/export.test.ts` | Registry shape, sheet-marker stem, `defaultStem` fallback in `exportAs`, download-behavior tests (URL/anchor stubs) |
| `src/lib/ui-editor/ExportPopover.svelte`, `ExportBottomSheet.svelte` | `label()` rendering + format-aware filename placeholder mirroring the actual empty-stem fallback |
| `src/lib/ui-editor/ExportPopover.svelte.test.ts` | Registry-driven option list + placeholder tests |
| `messages/{en,ja,ko}.json` | `format_spritesheet` label in all three locales |
| `e2e/editor/export.test.ts` | Spritesheet case: select → placeholder switches to `-sheet` → empty input downloads `dotorixel-16x16-sheet.png` |

### Key Decisions

- **Lazy format labels** (`label: () => string`): localized labels resolve at render time instead of module init, so locale is always known; matches the existing `tool.label()` pattern. PNG/SVG stay untranslated acronyms; only Spritesheet carries a message key.
- **`defaultStem` as a registry-entry function** (not a suffix field): the format owns its fallback formula, and both UI placeholders derive from the same function, so placeholder and actual filename cannot drift.
- **Raw-buffer PNG helper** (`encode_rgba_png`): `PixelCanvas` cannot host the sheet buffer (its dimension cap rejects `width × frame count`), so the encoder works on a raw RGBA buffer; the still-PNG path shares the same helper.

### Notes

- **happy-dom cannot drive Svelte 5 select bindings**: its `:checked` matcher only supports `INPUT` elements (source-verified), while Svelte 5 reads `select.querySelector(':checked')` on change — the binding silently falls back to the first option. Selection-driven UI behaviors are therefore covered in `e2e/editor/export.test.ts` (one case added despite the PRD's "e2e not required"). Affects any future component test that changes a `<select>`.
- **WASM error path untested by design**: the binding takes no input and a valid Document cannot make the core encoder fail; the `JsError` mapping follows the established pattern (recorded in the wasm test comment).
- **Sheet-size guard added post-review (PR #304)**: `encode_spritesheet_png` computes `sheet_width`/byte size with checked math and returns `ExportError::SheetTooLarge` on overflow — unreachable on wasm32 (such a document exceeds addressable memory first) but conceivable on a future 64-bit native shell. The Err branch cannot be constructed through the public API in test memory; only the error's Display message is pinned.
- Encode-failure UI surfacing matches existing PNG/SVG parity (propagates as `JsError`, no toast) — a shared follow-up if ever needed, not spritesheet-specific.
