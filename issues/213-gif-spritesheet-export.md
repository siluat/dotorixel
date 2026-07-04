---
title: GIF / spritesheet export — multi-frame export formats (M4)
status: ready-for-agent
created: 2026-07-04
---

# GIF / Spritesheet Export

## Problem Statement

Milestone 4 gave users a full animation workflow — frame management, per-frame durations, and in-editor Playback — but export is still frozen in the single-image era: PNG and SVG emit only the Active Frame's composite. Animation work is trapped inside the editor. A hobbyist who finishes a bouncing-slime loop has no way to share it as a moving image; a game developer who animates a character walk cycle has no way to bring the frames into an engine. The only workaround is exporting each frame one-by-one (moving the Active Frame between exports) and assembling the result in an external tool, which is tedious and error-prone.

## Solution

Add two multi-frame formats to the existing export flow, selectable from the same format selector (desktop popover and mobile bottom sheet) with the same filename flow:

- **Animated GIF** — every Frame in axis order, each shown for its own duration, looping forever, with pixel-art-faithful colors and binary transparency. What Playback previews is what the GIF plays.
- **Spritesheet (PNG)** — every Frame's composite tiled left-to-right as one contiguous horizontal strip at native document resolution, with full RGBA transparency. Engine import is trivial: tile size is exactly the canvas size.

Both formats export committed art only, composed exactly like Playback: visible Pixel Layers blended with their opacity, Reference Layer excluded.

## User Stories

1. As a pixel artist, I want to export my animation as a GIF, so that I can share it anywhere without external assembly tools.
2. As a pixel artist, I want the GIF to honor each Frame's individual duration, so that exported timing matches the in-editor Playback preview.
3. As a pixel artist, I want the exported GIF to loop forever, so that it plays continuously when shared on social media or in chat apps.
4. As a pixel artist, I want frames exported in Timeline axis order, so that the animation plays in the order I arranged.
5. As a pixel artist, I want transparent pixels to stay transparent in the GIF, so that my sprite composes over any page background.
6. As a pixel artist, I want my exact colors preserved when a frame uses few colors (the normal pixel-art case), so that no quantization artifacts corrupt the art.
7. As a pixel artist using layer opacity, I want a predictable transparency rule for semi-transparent composite results in GIF (opaque at alpha ≥ 128, transparent below), so that the binarized output is consistent and explainable.
8. As a game developer, I want to export all frames as one horizontal spritesheet PNG, so that I can import it into Unity, Godot, or Phaser with uniform frame slicing.
9. As a game developer, I want each spritesheet tile to be exactly the Document's canvas size with no padding or margins, so that slicing is `frame index × canvas width` with nothing to configure.
10. As a game developer, I want the spritesheet to keep full RGBA transparency (no binarization), so that sprites render correctly in-engine.
11. As a user, I want GIF and Spritesheet to appear in the same format selector as PNG and SVG, so that I don't have to learn a new export flow.
12. As a user, I want to set the filename before exporting a GIF or spritesheet, so that downloads are named the way my workflow expects.
13. As a user, I want a distinct default filename for the spritesheet, so that it doesn't collide with a still PNG export of the same Document.
14. As a mobile user, I want the new formats available in the bottom-sheet export UI, so that phone/tablet export has parity with desktop.
15. As a user, I want export to include only visible Pixel Layers blended with their opacity, so that what I see in Playback is exactly what exports.
16. As a user tracing over a Reference Layer, I want the Reference Layer excluded from GIF and spritesheet output, so that my reference image never leaks into shared work.
17. As a user with an uncommitted Floating Selection, I want multi-frame export to emit committed art only, so that export behaves identically to today's PNG/SVG export.
18. As a user with a single-frame Document, I want GIF and spritesheet export to still work, so that there is no special case to discover or work around.
19. As a user, I want exporting to leave my editing session untouched — Active Frame, History, dirty state, Playback state — so that export is always a safe, read-only action.
20. As a user with typical documents (small canvas, tens of frames), I want export to complete near-instantly, so that the app never feels frozen.
21. As a user, I want a failed encode to surface an actionable error, so that I know what went wrong instead of getting a silent no-op.
22. As a keyboard or screen-reader user, I want the new format options reachable through the existing accessible format selector, so that export stays fully accessible.
23. As an i18n user, I want every new export string localized in English, Japanese, and Korean together, so that the export UI never shows mixed-language fallbacks.
24. As a maintainer, I want export analytics to record the chosen format including the new ones, so that real usage informs future export investments.
25. As a user, I want my per-frame durations approximated as faithfully as the GIF format allows, so that exported motion stays as close as possible to what I authored.

## Implementation Decisions

- **Core placement.** GIF and spritesheet encoding live in the Rust core's export module as **Document-level encoders**, alongside the existing single-canvas PNG/SVG encoder pattern. Rationale per the Core Placement criteria: encoding is complex with subtle edge cases (palettes, transparency, frame disposal), the logic is stable, and it is cross-platform — a future Apple-shell export task reuses the same encoder. GIF encoding uses the `gif` crate; the spritesheet reuses the existing `png` dependency.
- **Pure queries.** Both encoders iterate the Frame axis in order, reading each frame's composite through the existing per-frame composite seam (`composite_at`). They never touch the Active Frame, History, dirty state, or Playback.
- **GIF timing.** Frame delay = the Frame's `duration_ms` quantized to centiseconds (GIF's native unit), round-to-nearest with a 1 cs floor. The maximum duration (60 000 ms → 6 000 cs) fits the format's delay field.
- **GIF looping.** Always infinite, via the standard looping extension. Not configurable in v1 — Playback's loop toggle is transient per-tab UI state, not Document data, so it does not drive export.
- **GIF transparency.** Binary (the format supports only 1-bit transparency): composite alpha ≥ 128 → opaque, below → the reserved transparent palette index.
- **GIF palette.** Per-frame palettes with an exactness guarantee: when a frame's unique opaque colors fit the palette (reserving one index for transparency when needed), colors are preserved exactly — the normal pixel-art case. Only frames exceeding the palette limit fall back to quantization. A shared global palette is an allowed optimization, not a requirement.
- **GIF frame encoding.** Every frame is encoded full-canvas (no delta optimization), with disposal set so each frame fully replaces the previous one — transparent regions must never show ghosting from earlier frames.
- **Spritesheet geometry.** One horizontal strip: frames in axis order, each tile exactly canvas width × height, contiguous with no padding, sheet dimensions `(width × frame count) × height`. Encoded as straight-alpha RGBA PNG through the same encoding path as the existing PNG export.
- **WASM surface.** The two Document-level encoders are exposed on the existing document binding, returning byte buffers, with encode failures surfaced as errors per the established binding error pattern.
- **Web export flow generalization.** The format registry currently assumes every format consumes a single-frame exportable snapshot. Generalize it so each format declares its source — a still snapshot (PNG/SVG, unchanged) or the whole Document (GIF, spritesheet). The download plumbing (blob, object URL, anchor click, deferred revoke) and filename processing are reused unchanged. MIME types: `image/gif` and `image/png`.
- **Format availability.** Both formats are always listed regardless of frame count — a single-frame GIF or one-tile sheet is valid output, and unconditional availability avoids conditional UI.
- **Filenames.** The shared default-stem convention is reused; extensions are `.gif` and `.png`. The spritesheet's default stem carries a sheet marker so it doesn't collide with the still-PNG default.
- **Analytics.** The existing export tracking records the new format ids.
- **i18n.** New format labels and strings land in all three locales (en/ja/ko) together.
- **Synchronous export.** At the current canvas-size cap and typical frame counts, encode time is negligible; no worker or progress UI in v1.

## Testing Decisions

- A good test asserts **external behavior at a seam** — decode the emitted bytes and check observable properties (frames, delays, pixels, dimensions) — never encoder internals.
- **Primary seam — core Document-level encoders (the only new seam).** Decode round-trip tests assert: frame count and order; per-frame delay quantization including the 1 cs floor and the maximum duration; exact-palette color fidelity; the alpha-128 transparency threshold; hidden-layer and Reference-Layer exclusion; layer-opacity blending parity with the existing composite behavior; no cross-frame ghosting when transparency is present; spritesheet dimensions and per-tile pixel placement; single-frame Documents. Prior art: the core's existing PNG round-trip/SVG export tests and the `composite`/`composite_at` test suites.
- **WASM seam.** Thin marshalling tests — returned buffers carry the right format signatures, error paths surface as errors — mirroring the existing `composite_at` binding tests.
- **Web shell.** Format registry tests (new entries, extensions, MIME, filename handling) and export-flow tests asserting document-source formats receive the Document and analytics fire, mirroring the existing PNG/SVG flow tests. The UI is registry-driven, so no new component seam is needed.
- E2E is not required for v1; the download mechanics are already covered at the unit seams.

## Out of Scope

- Export scale multiplier (×2/×4/×8) — a follow-up that should apply uniformly to all formats, including the existing PNG.
- Frame-range selection (exporting a subset of frames).
- Spritesheet layout options: vertical strips, grids/column counts, padding/margins, and metadata sidecars (JSON atlas).
- APNG, WebP, or video formats.
- GIF loop-count option or background-matte color option.
- Apple shell UI — export there is still disabled pending its Phase 1 PNG task; this PRD only guarantees the core encoders land reusable for that future.
- Committing a pending Floating Selection as part of export — export stays a pure read of committed art, matching existing PNG/SVG behavior.

## Further Notes

- GIF's 10 ms delay granularity means authored durations are approximated (e.g. 83 ms → 80 ms), and many viewers additionally slow delays under 20 ms — format/viewer constraints, not editor bugs. Faithful quantization is the contract.
- Direction fit: the spritesheet serves the indie-game-dev direction, the GIF serves casual/hobby sharing, and both build on the "solid export/file formats" investment named in the project's future directions.
- The per-frame composite seam (`composite_at`) was landed by the M4 playback track with this exporter explicitly named as a future reader — this PRD is that reader. Onion skinning (the sibling M4 item) reads the same seam; the two features stay uncoupled.
