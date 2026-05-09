# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD](../issues/086-layer-system-basic-infrastructure.md)). PRD decomposed into 15 sub-issues (087–101); 087 + 088 + 089 + 090 + 091 + 092 + 093 + 101 done, 7 remaining (see `todo.md`). ADR `docs/decisions/web-document-layer-apple-preserved.en.md` records the web-only / Apple-preserved split. With **091** (TabState switch) landed, the web shell now treats `Document` as the single source of truth. With **092** (TimelinePanel design) landed, the visual spec is finalized in `docs/pencil-dotorixel.pen`. With **093** (TimelinePanel shell) landed, the desktop seat is now mounted below the canvas — `<TimelinePanel>` renders one row per layer with active highlight; header label only, no actions wired. **094** (＋ add-layer button) is the next slice; it claims the header's left side and will be the first slice that mutates the WASM document in place — at that point the page-level `layers` derived must add `tabState.renderVersion` as a dependency to re-run on internal mutations.

## Last Completed

[093 — TimelinePanel shell (desktop, single-layer row)](../issues/093-layer-system-timeline-panel-shell.md): mounted `src/lib/ui-editor/TimelinePanel.svelte` in the docked layout below the canvas (grid template extended with a `timeline 180px` row spanning the canvas column; toolbar/right-panel span both rows). Component is a pure view (`layers: ReadonlyArray<{id, name}>` + `activeLayerId: string` props) — Document seam stays at the page level so unit tests don't load WASM. Sidebar 256px renders one row per layer with `[2px accent bar] [name]`; active row gets `--ds-bg-active` fill + `--ds-accent` bar + name fontWeight 500 + `aria-current="true"`. Frame area renders the M3 placeholder column (one 32×32 cell per layer) + italic "frame ruler grows here in M4" hint, reserving the M4 frame-ruler region. Header shows the "Layers" label only; ＋ and chevron are owned by 094 and 099. Tokens-only CSS (`--ds-bg-surface`, `--ds-border-subtle`, `--ds-bg-active`, `--ds-accent`, `--ds-text-*`, `--ds-space-*`, `--ds-border-width{,-thick}`); recurring component dimensions (`--row-height: 32px`, `--panel-height: 180px`, `--sidebar-width: 256px`) are component-scoped custom properties. Three Vitest tests cover single-row name, N rows, and active marker. Mobile (<1024px) layout untouched (098 owns the mobile entry).

## Next Up

- [094 — Add-layer button](../issues/094-layer-system-add-layer-button.md)
  - Now unblocked (093 shell landed). First slice that mutates the WASM document in place; will require `tabState.renderVersion` as a dependency on the page-level `layers` derived to re-trigger.
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Independent. Now that the docked layout is in, this is the next Apple Phase 1 item.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but blocked on shape tools not yet existing on Apple side; functionally on hold.
