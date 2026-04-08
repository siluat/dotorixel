---
title: SVG web export — TypeScript download + Export UI integration
status: open
created: 2026-04-09
parent: 031-svg-export.md
---

## What to build

Wire the Rust SVG encoder (034) into the web shell so users can export SVG from the Export UI (033). Add a TypeScript `exportAsSvg()` function that calls `encode_svg()`, creates a Blob with `image/svg+xml` type, and triggers a download. Register SVG as an entry in the `availableFormats` array so it appears in the Export UI format selector automatically.

See parent PRD [031](031-svg-export.md) for download behavior and filename format.

## Acceptance criteria

- `exportAsSvg()` function in the export module creates a Blob from the SVG string and triggers a browser download
- Default filename follows `dotorixel-{width}x{height}.svg` pattern (stem from Export UI input, extension from format)
- SVG entry added to `availableFormats` array with correct id, label, extension, and exportFn
- SVG option appears in the Export UI format selector dropdown
- Selecting SVG and clicking export downloads a valid SVG file
- Analytics `trackExport` called with `format: 'svg'`

## Blocked by

- [034 — SVG encoder — Rust core + WASM binding](034-svg-encoder-core.md)
- [033 — Export UI — format selector and filename input](033-export-ui-web.md)

## Scenarios addressed

From parent PRD [031](031-svg-export.md):

- Scenario 1: User exports → SVG file downloaded (end-to-end through UI)
- Scenario 2: Exported SVG renders crisply (guaranteed by 034's encoding)
