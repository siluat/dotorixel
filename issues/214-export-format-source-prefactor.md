---
title: "Prefactor: export formats declare their source (still snapshot vs Document)"
status: ready-for-agent
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
