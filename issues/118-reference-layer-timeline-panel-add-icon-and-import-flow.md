---
title: "Reference Layer: Timeline Panel — set/replace Reference image import flow"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

A dedicated Reference Layer icon next to the existing `+` (Pixel add) in the Timeline Panel header. The action sets the document's singleton Reference Layer. If the document already has a Reference Layer, the action must ask for confirmation before proceeding because the new image will replace the existing reference.

The import must not create a second Reference Layer and must not append a reorderable layer above/below the existing stack.

Scope:

- Add the Reference Layer icon to the TimelinePanel header per the 106 design.
- On click with no existing Reference Layer: open file picker.
- On click with an existing Reference Layer: show a localized confirmation explaining that choosing a new image will replace the current Reference Layer image. Cancel leaves the document unchanged; confirm opens the file picker.
- Decode the selected file via `src/lib/reference-images/decode-reference-blob.ts`.
- Call the Document/WASM API that sets or replaces the singleton Reference Layer using source RGBA + dimensions + display name.
- Default name: imported file display name; fallback localized `"Reference"` if name is empty/unavailable.
- Replacement resets placement to auto-fit, aspect-preserving, centered.
- The Reference row is fixed at the bottom of the Timeline Panel and becomes active after successful import/replacement.
- Loading state: while decode/persist is in progress, show the Reference row in a skeleton/spinner state and disable the import icon with a spinner.
- Decode failure: remove skeleton state, restore the import icon, and show a brief localized toast. If replacing, keep the old Reference Layer intact.
- Storage quota failure: roll back to the prior document state and show a localized quota toast. If replacing, keep the old Reference Layer intact.
- Drag-and-drop continues to create Reference Window per PRD-053.
- Clipboard paste is not supported in v1.

## Acceptance Criteria

- Reference Layer icon sits next to the Pixel `+` per the 106 design.
- No existing Reference: click -> file picker -> decode -> singleton Reference Layer appears as the fixed bottom row and becomes active.
- Existing Reference: click first shows a confirmation before any replacement proceeds.
- Confirmation cancel does not open the file picker and does not mutate the document.
- Confirmation accept lets the user pick a new image; successful decode replaces the old Reference image rather than adding a second Reference Layer.
- Replacement resets placement to auto-fit for the new source.
- The document never contains more than one Reference Layer after repeated imports.
- The Reference row has no reorder affordance.
- Loading state appears immediately and the import icon is disabled with a spinner until completion/failure.
- Decode failure and quota failure leave no orphan row and preserve the old Reference if one existed.
- Pixel `+` behavior is unchanged: single click adds a Pixel Layer.
- Drag-and-drop onto the canvas still creates a Reference Window.

## Blocked By

- [110 — Rust core: `add_reference_layer` + composite paths](110-reference-layer-document-add-and-composite-paths.md) must be reworked for singleton/replace semantics.
- [115 — V4 persistence end-to-end](115-reference-layer-v4-persistence-end-to-end.md)
- [117 — Timeline Panel kind icons](117-reference-layer-timeline-panel-kind-icons.md) must be adjusted so Reference has no reorder affordance.
- [106 — Reference Layer UX detail design](106-reference-layer-ux-design.md) must be read with the 2026-05-22 amendment.

## User Stories Addressed

- #1, #4, #5, #6, #7, #14, #18, #22, #23, #24.
