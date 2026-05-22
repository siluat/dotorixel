---
title: "Reference Layer: placement overlay — Shift-snap to integer scale"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Add a Shift-modifier behavior to corner-handle drags: while Shift is held, the effective placement scale snaps to integer multiples (`1.0, 2.0, 3.0, ...`). This is a placement precision aid only; it does not imply that the Reference source is rasterized into `Document.composite()`.

Scope:

- During a corner-handle drag, when Shift is held, the live preview's effective scale snaps to the nearest integer multiple.
- Releasing Shift mid-drag returns to continuous scale.
- Re-pressing Shift mid-drag re-snaps to the nearest integer multiple.
- The release commit uses the scale shown by the preview at that moment.
- Shift has no effect on body-drag translation.

## Acceptance Criteria

- Shift + corner drag snaps scale to integer multiples in the preview.
- Releasing Shift mid-drag immediately returns to continuous scale.
- Re-pressing Shift mid-drag immediately re-snaps.
- The release commit uses the in-flight previewed scale.
- Shift + body drag has no special behavior.

## Blocked By

- [121 — placement overlay drag interaction](121-reference-layer-placement-overlay-drag.md)

## User Stories Addressed

- #21.
