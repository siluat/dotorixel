---
title: "Layer system: persist `timelinePanelCollapsed`"
status: ready-for-agent
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Wire the `timelinePanelCollapsed` field defined in 090 (V3 schema) and present on the runtime Document (087) to the chevron toggle from 099. After the user collapses or expands, the choice survives page refresh.

Scope:

- On chevron toggle → write the new boolean to `Document.timelinePanelCollapsed`.
- On TabState load → use the persisted value to render the panel in the correct state.
- The migration path from 090 already defaults `timelinePanelCollapsed = false` on V2→V3 upgrade.
- Toggling is **not** undoable (UI panel state, not artwork).

## Acceptance criteria

- Collapsing the panel and refreshing the page restores the collapsed state.
- Expanding the panel and refreshing the page restores the expanded state.
- Per-document state — different documents (tabs) keep their own value.
- V2→V3 migrated documents start expanded (`timelinePanelCollapsed = false`).
- Toggling does not push a history snapshot.

## Blocked by

- [099 — Collapsible chevron (no persistence)](099-layer-system-collapsible-toggle.md)

## Scenarios addressed

- Scenario 10.
