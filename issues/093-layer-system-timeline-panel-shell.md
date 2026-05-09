---
title: "Layer system: TimelinePanel shell — desktop, single-layer row"
status: done
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Mount the TimelinePanel in the desktop layout below the canvas. The panel renders the Document's layer stack as rows but exposes **no actions yet** — no add, delete, reorder, or visibility toggle. Only the active layer's name is shown for each row (a single row in practice, since the Document still starts with one layer).

This slice establishes the structural seat that the subsequent C2–C5 slices fill in.

Scope:

- New file `src/lib/ui-editor/TimelinePanel.svelte` (or equivalent location aligned with the existing layout).
- Mount the panel in the desktop layout below the canvas, matching the placement and dimensions defined by the design (092).
- Read `tabState.document.layers` and render one row per layer with the layer name.
- Highlight the active layer.
- Mobile layout is **not** affected by this slice.

## Acceptance criteria

- TimelinePanel renders below the canvas on desktop.
- Each layer in `document.layers` becomes a row showing the layer name.
- The active layer row has a visual highlight.
- No actions (add/delete/reorder/visibility) are wired yet.
- Mobile layout is unchanged.

## Blocked by

- [091 — TabState switch: `pixelCanvas` → `document`](091-layer-system-tab-state-document-switch.md)
- [092 — TimelinePanel design](092-layer-system-timeline-panel-design.md)

## Scenarios addressed

- Structural seat for Scenarios 3, 4, 5, 7.

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/TimelinePanel.svelte` | New component. Pure view: `layers: ReadonlyArray<{id, name}>` + `activeLayerId: string` props. Renders panel chrome (h=180, header h=32 with "Layers" label only, divider, body) per 092 §3. Sidebar (256px) with one row per layer showing `[2px accent bar] [name]`; active row gets `--ds-bg-active` fill, `--ds-accent` bar, name fontWeight 500, and `aria-current="true"`. Frame area renders M3 placeholder column (one 32×32 cell per layer) + italic "M3 placeholder — frame ruler grows here in M4" hint reserving the M4 frame-ruler region. Tokens-only; component-scoped custom properties (`--row-height`, `--panel-height`, `--sidebar-width`) capture the recurring dimensions. |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | Vitest + @testing-library/svelte. Three tests asserting public-interface behavior: single-layer row + name visible, N rows for N layers, active layer marked via `aria-current="true"` while others omit the attribute. |
| `src/routes/editor/+page.svelte` | Mounted `<TimelinePanel>` below the canvas in the docked layout. Grid template extended with a `timeline 180px` row spanning the canvas column; toolbar/right-panel now span both canvas and timeline rows. `layers` and `activeLayerId` are `$derived` from `editor.workspace.activeTab.document` via the existing `layer_count() / layer_id_at(i) / layer_name_at(i)` accessors. Mobile (<1024px) layout untouched. |

### Key Decisions

- **Component is a pure view, not Document-aware.** Props are `LayerSummary[]` + `activeLayerId` rather than a `Document` reference. Keeps the WASM Document seam at the page level, lets unit tests stay framework-only (no WASM load), and matches how RightPanel/AppBar accept derived primitives.
- **Header label only this slice.** Per 092 §3 the header has `[＋] Layers` on the left and a chevron on the right; `＋` is owned by 094 and chevron by 099. 093 ships only the "Layers" label so the structural seat is in place without claiming buttons that subsequent slices will own.
- **Frame-area placeholder included.** The M3 single-column placeholder (one 32×32 cell per layer) + "frame ruler grows here in M4" hint is part of the structural seat — it locks the panel's right-side region so M4's frame ruler grows in place without restructuring. Cells are decorative (no semantics).
- **Active row uses `aria-current="true"`.** Standard ARIA pattern for "the currently active item in a set"; readable by assistive tech without inventing a custom attribute. The data attribute `data-layer-row` / `data-layer-id` exists for stable test selectors.
- **Grid placement: timeline row spans only the canvas column.** Toolbar (left) and right-panel (right) span both canvas and timeline rows so the panel fits naturally between them, consistent with Aseprite/Photoshop convention and the 092 §3 mock framing.
- **Tokens-first CSS, component-scoped custom properties for repeated dimensions.** Borders use `--ds-border-width` / `--ds-border-width-thick`; paddings use `--ds-space-2 / --ds-space-3 / --ds-space-5`; recurring component dimensions (32px row, 180px panel, 256px sidebar) are component-scoped CSS custom properties for self-documentation. Width/height literals are not promoted to global tokens (no cross-component reuse confirmed yet, matches the existing AppBar / RightPanel pattern).

### Notes

- **No actions wired** per scope. 094 (＋ button) / 095 (✕ delete) / 096 (≡ reorder) / 097 (👁 visibility) / 099 (chevron + collapse) / 100 (collapse persistence) all add their respective controls onto this seat.
- **`layers` derived will need a reactive trigger when 094 lands.** The `$derived.by` reads `document.layer_count()` etc. Today this only re-runs when `tabState.document` is reassigned (e.g. on undo via `documentReplaced`). When 094 wires add-layer that mutates the WASM document in place, the derived must depend on `tabState.renderVersion` to re-run. Not addressed here because no in-place mutations are exercised yet — addressing it now would be premature.
- **Mobile layout intentionally unchanged.** 098 introduces the mobile Timeline tab and the split layout per 092 §5. The current docked-only mount means narrow viewports continue to show the existing Draw / Colors / Settings tabs.
- Verified: full Vitest suite (60 files / 872 tests) green; `bun run check` 0 errors / 0 warnings; visual confirmation in browser at `localhost:5173/en/editor`.
