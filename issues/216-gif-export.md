---
title: "Animated GIF export — pixel-art-faithful encoder, end-to-end"
status: done
created: 2026-07-05
parent: 213-gif-spritesheet-export.md
---

## Parent

[213 — GIF / spritesheet export — multi-frame export formats (M4)](213-gif-spritesheet-export.md)

## What to build

Animated GIF export end-to-end, riding the same generalized registry path as the spritesheet slice. The bulk of this slice is the core encoder; its complexity is cohesive and stays in one place.

- **Core**: a Document-level GIF encoder in the core export module, adding the `gif` crate as the core's second image dependency. It iterates the Frame axis in order through the existing per-frame composite seam (`composite_at`) and encodes per the parent PRD's decisions:
  - **Timing** — each frame's delay is its `duration_ms` quantized to centiseconds, round-to-nearest with a 1 cs floor; the maximum duration (60 000 ms → 6 000 cs) fits the delay field.
  - **Looping** — always infinite via the standard looping extension; not configurable.
  - **Transparency** — binary: composite alpha ≥ 128 → opaque, below → the reserved transparent palette index.
  - **Palette** — per-frame palettes with an exactness guarantee: when a frame's unique opaque colors fit the palette (one index reserved for transparency when needed), colors are preserved exactly; only overflow frames fall back to quantization.
  - **Frame encoding** — full-canvas frames (no delta optimization), disposal set so each frame fully replaces the previous one; transparent regions never show ghosting from earlier frames.
  - A pure query: never touches the Active Frame, History, dirty state, or Playback. Compositing matches Playback: visible Pixel Layers blended with opacity, hidden layers and the Reference Layer excluded.
- **WASM**: the encoder exposed on the existing document binding, returning a byte buffer, with encode failures surfaced as errors per the established binding error pattern.
- **Web**: a GIF entry in the format registry as a document-source format — `.gif` extension, `image/gif` MIME, shared default filename stem. Appears in the desktop popover and mobile bottom sheet automatically, available regardless of frame count. Export analytics records the new format id. New user-facing strings land in en/ja/ko together.

## Acceptance criteria

- Core decode round-trip tests (the `gif` crate decodes as well as encodes) assert: frame count and axis order; per-frame delays including round-to-nearest quantization, the 1 cs floor, and the maximum duration; the infinite-loop extension is present; exact color fidelity for frames within the palette limit; the alpha-128 transparency threshold; hidden-layer and Reference-Layer exclusion and layer-opacity parity; no cross-frame ghosting when transparency is present; a single-frame Document produces a valid one-frame GIF; a frame exceeding the palette limit still encodes via the quantization fallback rather than erroring.
- Exporting is observably side-effect-free: Active Frame, History, and dirty state are unchanged after encoding.
- WASM tests: the returned buffer carries the GIF89a signature; the error path surfaces as an error.
- Web tests mirror the existing flow tests: registry entry (id, extension, MIME, document-source shape) and the export flow handing the Document to the format and firing analytics.
- Demoable: an exported GIF plays in a browser with the same frame order and timing as the in-editor Playback preview.
- All three locales (en/ja/ko) updated together for any new strings.

## Blocked by

- [214 — Prefactor: export formats declare their source](214-export-format-source-prefactor.md) (independent of 215 — the two format slices can proceed in parallel)

## Results

| File | Description |
|------|-------------|
| `crates/core/Cargo.toml` | `gif` 0.14 — the core's second image dependency (encoder + decoder, so round-trip tests need nothing extra) |
| `crates/core/src/export.rs` | `GifExport` trait + `impl for Document`: frames in axis order through `composite_at`, alpha-128 binarization (named threshold const) feeding `gif::Frame::from_rgba` (exact palette when unique colors fit, NeuQuant fallback on overflow), `centisecond_delay` quantization, infinite loop, full-canvas frames disposing to background. Ten decode round-trip tests pin the contract |
| `wasm/src/lib.rs` | `WasmDocument::encode_gif() -> Result<Vec<u8>, JsError>` + GIF89a-signature marshalling test |
| `src/lib/canvas/export.ts` | `gif` document-source registry entry (`() => 'GIF'`, `.gif`, `image/gif`, shared default stem — no `defaultStem`) + `exportAsGif` (runtime narrowing, shared `downloadBlob`) |
| `src/lib/canvas/export.test.ts` | Registry shape, shared-stem contract, blob/download behavior; `stubDownloadPlumbing` hoisted to file scope for reuse |
| `src/lib/ui-editor/ExportPopover.svelte.test.ts` | Registry option-list expectation now includes `gif` |
| `e2e/editor/export.test.ts` | GIF case: select → placeholder stays unmarked → empty input downloads `dotorixel-16x16.gif` |

### Key Decisions

- **GIF label stays an untranslated acronym** (`() => 'GIF'`, no message key) — consistent with 215's "PNG/SVG stay untranslated acronyms" decision; no new i18n strings, so the en/ja/ko criterion is satisfied vacuously.
- **Binarize before `from_rgba`** (α ≥ 128 → 255, below → zeroed): aligns the PRD's alpha-128 contract with the crate's alpha==0 transparency rule and keeps the transparent palette entry deterministic. After binarization the crate's built-in exact-palette path (≤ 256 unique RGBA = 255 opaque colors + transparency) matches the PRD's exactness guarantee; NeuQuant runs only on overflow.
- **Ghosting pinned at the on-wire contract**: tests assert full-canvas geometry + `DisposalMethod::Background` per frame — the properties viewers consume — instead of simulating viewer compositing.
- **Delay quantization is half-up** with the 1 cs floor, saturating at the `u16` delay field (the shell-enforced 60 000 ms cap sits well below it).

### Notes

- **WASM error path untested by design** — the binding takes no input and a valid Document cannot make the core encoder fail; same rationale as 215, recorded in the test comment.
- One e2e case added despite the PRD's "e2e not required", covering the same happy-dom select-binding gap 215 documented (selection flows can't be driven in component tests).
- GIF's 10 ms delay granularity and viewer minimum-delay quirks are format/viewer constraints (see PRD Further Notes) — faithful quantization is the contract, not exact millisecond playback.
