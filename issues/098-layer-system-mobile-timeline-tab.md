---
title: "Layer system: mobile Timeline tab"
status: done
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Surface the layer interface on mobile via a 4th BottomTabs entry labeled "Timeline". The tab itself is the toggle — there is no separate collapse control on mobile. Switching to another tab implicitly hides the panel.

Scope:

- Add a 4th tab "Timeline" to the mobile BottomTabs alongside the existing tabs.
- When active, the tab shows the mobile TimelinePanel variant from the design (092).
- The mobile variant exposes the same per-row controls (visibility, delete, reorder) wired in C2–C5, plus the add-layer affordance from C2.
- Paraglide message for the tab label in en/ko/ja.

## Acceptance criteria

- BottomTabs on mobile shows a 4th "Timeline" tab.
- Tapping the tab opens the mobile TimelinePanel variant.
- Tapping another tab implicitly hides the panel.
- All layer actions wired in C2–C5 work in the mobile variant.
- Tab label is localized in en/ko/ja.

## Blocked by

- [093 — TimelinePanel shell](093-layer-system-timeline-panel-shell.md)

## Scenarios addressed

- Scenario 11.

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/mobile-tab.ts` | New — single source of truth for the `MobileTab` union (`'draw' \| 'colors' \| 'layers' \| 'settings'`). |
| `src/lib/ui-editor/TabBar.svelte` | Extended to 4 tabs (DRAW / COLORS / LAYERS / SETTINGS); slide-indicator width recalculated to `/4`; imports `MobileTab`. |
| `src/lib/ui-editor/AppBar.svelte` | Imports `MobileTab`; LAYERS shares the full app-bar layout with DRAW (no heading), so canvas-side controls stay accessible. |
| `src/routes/editor/+page.svelte` | Imports `MobileTab`; mobile content-area shows canvas for both `draw` and `layers`; mobile control row renders `TimelinePanel` when `activeTab === 'layers'`, otherwise `ToolStrip + ColorBar` when `draw`. |
| `src/lib/ui-editor/TimelinePanel.svelte` | Mobile media query (`max-width: 1023px`) overrides `--row-height: 28px` / `--panel-height: 146px` per design 092. Reorder reimplemented on PointerEvents (`pointerdown/move/up/cancel` + `setPointerCapture` + `touch-action: none`) so the handle works on touch as well as mouse. `DEFAULT_ROW_HEIGHT_PX = 32` constant documents the headless-test fallback. |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | Replaced the HTML5 DnD test with three pointer scenarios: downward two-row drag → reorder, `pointercancel` → no reorder, near-zero release → no reorder. |
| `messages/{en,ko,ja}.json` | Added `tab_layers` (`LAYERS` / `레이어` / `レイヤー`). |

### Key Decisions

- **Tab label/position**: Followed design 092 (`LAYERS`, 3rd of 4) over the older "Timeline (4th)" wording in this issue — design 092 was the later, reconciled source.
- **Layout when LAYERS is active**: Canvas stays visible (drawing still possible); ToolStrip and ColorBar are hidden per design 092's `wbAke` frame. TimelinePanel sits where ToolStrip/ColorBar would otherwise be.
- **HTML5 DnD → PointerEvents**: HTML5 Drag & Drop does not fire on touch, so the handle previously only worked with a mouse. Replaced with a `pointerdown`-captures-the-handle model where `Math.round(deltaY / rowHeight)` maps to a target visual index. This unifies mouse and touch reorder behind a single code path and removes the need for separate `dragover`/`drop` plumbing on rows.
- **`MobileTab` union extracted**: With 4 tabs, the same union lived in 3 files and was easy to desynchronize (svelte-check caught one such case during this work). Moved to `src/lib/ui-editor/mobile-tab.ts` as the single source.

### Notes

- The fallback row height of `32px` in `TimelinePanel.svelte` is only used when `row.offsetHeight === 0` (headless test environments). In real browsers, the measured value (32 desktop / 28 mobile) is always used. Documented in a code comment.
- Mobile device verification was performed by the user; the unit tests cover behavior via simulated PointerEvents.
