# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD](../issues/086-layer-system-basic-infrastructure.md)). PRD decomposed into 14 sub-issues (087–100); 087 + 088 + 089 + 090 done, 10 remaining (see `todo.md`). ADR `docs/decisions/web-document-layer-apple-preserved.en.md` records the web-only / Apple-preserved split. Newly unblocked: **091** (TabState switch — replace `pixelCanvas: PixelCanvas` with `document: Document` and route `samplingSession`/`toolRunner`/`tabViewport` through the active layer; first call site of `migrateV2ToV3` and the WASM Document facade in main code paths). **092** (TimelinePanel design, HITL) remains independently startable. The two run in parallel; 093 (TimelinePanel shell) needs both.

## Last Completed

[090 — TS V3 persistence schema + V2→V3 migration (not yet wired)](../issues/090-layer-system-ts-v3-schema-migration.md): added `LayerRecord` (id/name/pixels/visible/opacity) and `DocumentSchemaV3` (schemaVersion: 3, dimensions, layers, activeLayerId, nextLayerNumber, timelinePanelCollapsed, saved, timestamps) to `src/lib/session/session-storage-types.ts`, plus pure function `migrateV2ToV3(v2)` that wraps the V2 single pixel buffer as one "Layer 1" with a fresh `crypto.randomUUID()`, sets `nextLayerNumber=2` / `timelinePanelCollapsed=false` / `visible=true` / `opacity=1`, preserves dimensions and top-level metadata (id, name, saved, createdAt, updatedAt), and drops history (V3 has no `history` field; the in-memory `HistoryManager` resets on hydration). 5 new Vitest cases under `describe('migrateV2ToV3')` cover tracer (single-layer wrap, schemaVersion=3, byte-equal pixel preservation), dimensions+counters (32×24, nextLayerNumber=2, timelinePanelCollapsed=false), `activeLayerId` equals `layers[0].id` and matches the UUID v4 regex, default visibility/opacity, and metadata pass-through. `LayerRecord` is unversioned to align with sibling persistence types (`WorkspaceRecord`, `ViewportRecord`, `ReferenceImageRecord`, `DisplayStateRecord`); the V3 suffix is reserved for top-level `DocumentSchemaV*` only. `StoredDocument` and `DocumentRecord` aliases left at `V1 | V2` / `V2` — the migration is not yet invoked from any storage call site, so IndexedDB load/save behavior on `main` is unchanged. 091 will widen the union when it becomes the first consumer. Slice remains dead code in `main`. All 851 unit tests pass (5 new); `bun run check` reports 0 errors / 0 warnings. TDD self-report: GREEN #1 over-implemented the full migration in one step (tests #2–#5 passed without an intervening RED) — behavior correct, but vertical-slicing discipline broke; future cycles to tighten the GREEN step.

## Next Up

- [091 — TabState switch: `pixelCanvas` → `document`](../issues/091-layer-system-tab-state-document-switch.md)
  - Newly unblocked by 090. First main-code consumer of `migrateV2ToV3` and the WASM Document facade.
- [092 — TimelinePanel design (Candidate A detail pass)](../issues/092-layer-system-timeline-panel-design.md)
  - Independent (no blockers); HITL `.pen` design task. Runs in parallel with 091.
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Independent. Now that the docked layout is in, this is the next Apple Phase 1 item.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but blocked on shape tools not yet existing on Apple side; functionally on hold.
