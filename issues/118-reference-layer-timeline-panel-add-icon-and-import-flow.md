---
title: "Reference Layer: Timeline Panel — Reference Layer add icon + import flow (loading / failure / quota states)"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

A dedicated Reference Layer add icon next to the existing `+` (Pixel add) in the Timeline Panel header. Single click opens the file picker; the chosen file is decoded via the existing `src/lib/reference-images/decode-reference-blob.ts` and added through `add_reference_layer`. The default name is the file's display name (fallback `"Reference"` localized). Loading, failure, and storage-quota states are handled explicitly.

Scope:

- Add the Reference Layer add icon to the TimelinePanel header per the 106 design.
- On click → file picker → decode via `decode-reference-blob.ts` → call WASM `add_reference_layer` with source RGBA + dimensions + name.
- Default name: the file's display name; fallback to a localized `"Reference"` if name is empty/unavailable. No `nextReferenceLayerNumber` counter.
- **Loading state**: as soon as the file is chosen, a Reference Layer row appears in the panel in a skeleton / spinner state; the import icon enters a disabled + spinner state to block duplicate triggers. Drawing on a Pixel Layer continues to work during the decode.
- **Decode failure (unsupported format, corrupt file)**: skeleton row is removed; import icon returns to normal; a brief Paraglide toast (`reference_layer_import_failed` or equivalent) is shown. The exact wording and supported-format list mirror Reference Window's existing failure path — confirm and reuse the same shape during implementation.
- **Storage quota exceeded** (IndexedDB write fails): the new layer is rolled back (in-memory add reverted before it appears outside the skeleton) and a localized toast (`storage_quota_exceeded` or equivalent) is shown. Deeper quota handling (pre-check, usage indicator, in-app cleanup) is owned by the existing backlog item (`tasks/todo.md` Review backlog) and out of scope here.
- Drag-and-drop continues to create Reference Window per PRD-053 (unchanged).
- Clipboard paste is not supported in v1 (symmetric with Reference Window's deferred paste).

## Acceptance criteria

- Reference Layer add icon sits next to the `+` per the 106 design.
- Single click → file picker → decode → `add_reference_layer` succeeds for supported formats.
- The new Reference Layer becomes the active layer; the row appears with the file's display name (or localized `"Reference"`).
- Loading: skeleton row appears immediately and the import icon is disabled with a spinner until decode resolves.
- Decode failure: skeleton row removed, import icon recovers, error toast shown (no error cascade, no leftover row).
- Storage quota exceeded: layer rolled back, error toast shown; no orphan row, no half-state.
- Drag-and-drop onto the canvas still creates a Reference Window (PRD-053 unchanged).
- Pixel `+` button behavior is unchanged (still single click → add Pixel Layer).

## Blocked by

- [115 — V4 persistence end-to-end](115-reference-layer-v4-persistence-end-to-end.md)
- [117 — Timeline Panel kind icons](117-reference-layer-timeline-panel-kind-icons.md)
- [106 — Reference Layer UX detail design](106-reference-layer-ux-design.md)

## User stories addressed

- #1, #5, #6, #19, #21, #28, #29, #30.
