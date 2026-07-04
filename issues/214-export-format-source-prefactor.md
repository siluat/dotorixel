---
title: "Prefactor: export formats declare their source (still snapshot vs Document)"
status: done
created: 2026-07-05
parent: 213-gif-spritesheet-export.md
---

## Parent

[213 — GIF / spritesheet export — multi-frame export formats (M4)](213-gif-spritesheet-export.md)

## What to build

Prefactoring slice — "make the change easy, then make the easy change." The web export format registry currently assumes every format consumes a single-frame exportable snapshot (a still canvas exposing the PNG/SVG encoders). Generalize the registry contract so each format declares which source it consumes:

- **Still source** — the active-frame composite snapshot. PNG and SVG migrate to this shape with unchanged behavior.
- **Document source** — the whole Document binding, for multi-frame formats. No real document-source format ships in this slice; the follow-up slices (spritesheet, GIF) each add one.

The export confirm flow (shared by the desktop popover and mobile bottom sheet paths) resolves the declared source per format and hands it to the format's export function. Download plumbing (blob, object URL, anchor click, deferred revoke), filename processing, and analytics stay unchanged.

Observable behavior must not change: PNG and SVG export produce the same bytes, filenames, downloads, and analytics events as before.

## Acceptance criteria

- The format registry type distinguishes still-source formats from document-source formats, with the illegal combination unrepresentable (a discriminated shape, not a boolean flag plus convention).
- PNG and SVG entries are migrated to the still-source shape with zero behavior change.
- The export confirm flow resolves the source per format: still formats receive the exportable snapshot; document-source formats receive the Document — exercised in tests via a fake document-source format, since no real one exists yet.
- Existing export unit tests (registry, filename processing, export flow) pass, updated only where the contract shape changed.
- No UI or i18n changes; popover and bottom sheet behave identically.

## Blocked by

None — can start immediately.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/export.ts` | `ExportFormat` redefined as a `StillExportFormat \| DocumentExportFormat` discriminated union on `source`; added minimal `ExportableDocument` (mirrors `ExportableCanvas`) and lazy `ExportSources` thunks; confirm flow extracted into `exportAs()` which cleans the stem, resolves only the declared source, assembles the filename, dispatches, and returns the resolved dimensions |
| `src/routes/editor/+page.svelte` | `handleExportConfirm` shrunk to `exportAs(...)` + `trackExport` with the returned dimensions + close export UI; no longer imports the filename helpers |
| `src/lib/canvas/export.test.ts` | Six `exportAs` behavior specs (still/document dispatch, lazy source resolution, default-stem fallback, known-extension stripping, dimension reporting) via fake-format factories; registry tests now pin `source: 'still'` on PNG/SVG |

### Key Decisions

- **Minimal `ExportableDocument` (`{width, height}`), not the full `Document` interface** — keeps the registry from exposing mutating Document APIs to formats (least privilege); follow-up formats narrow to their encoder methods at runtime, reusing the established `isPngEncodable` pattern.
- **Confirm flow extracted to `export.ts` as `exportAs`** — the page component was untestable; the flow now lives beside the registry (high cohesion) and is exercised with a fake document-source format as required.
- **Lazy `ExportSources` thunks** — only the declared source is materialized (a still snapshot costs a full composite); pinned by a regression test as an API contract.
- **`exportAs` returns the resolved source dimensions** — analytics stays at the page level unchanged, without re-deriving dimensions from a second source of truth.

### Notes

- Zero behavior change verified beyond unit seams: the pre-existing `e2e/editor/export.test.ts` (6 tests, real download events for PNG/SVG filenames) passes against the refactored flow. Full suite 90 files / 1,622 tests green; `svelte-check` clean.
- `exportAs` derives known extensions from the whole registry, so registering the 215/216 formats automatically includes their extensions in stem cleaning — no extra wiring needed in the follow-ups.
- "Still source / Document source" vocabulary lives in this issue and the PRD for now; consider a CONTEXT.md entry via `/domain-modeling` once 215/216 stabilize the terms.
