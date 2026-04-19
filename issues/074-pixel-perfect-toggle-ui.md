---
title: Pixel Perfect — topBar/mAppBar toggle and preference persistence
status: done
created: 2026-04-18
parent: 069-pixel-perfect-drawing.md
---

## What to build

Add a `pixelPerfect` field to the editor preference (default `true`, reusing the existing persistence mechanism). Implement the toggle button in topBar/mAppBar based on the 070 design. Tool-runner queries the preference and switches to **conditional** PP wrapping (replacing the hardcoded ON from 072/073). Mid-stroke preference changes are ignored for the current stroke; they take effect from the next stroke. The toggle state persists across sessions.

See the parent PRD's "Settings / Persistence" and "UI" sections, and Scenarios 2, 7, 8, 9, and 11.

## Acceptance criteria

- Editor preference gains a `pixelPerfect: boolean` field (default `true`), reusing the existing persistence pattern
- PP toggle button implemented in topBar/mAppBar (based on 070's `.pen` design)
  - Custom icon; ON/OFF/hover/active/disabled states reflected
  - When the active tool is not Pencil/Eraser, the toggle is visualized as **disabled** (opacity 0.4 + `aria-disabled="true"`, no hover/press response, tooltip replaced with contextual "Pencil/Eraser only" guidance)
  - `aria-label` and tooltip express the current state
- i18n strings added (en, ko, ja) — for toggle label / aria / tooltip
- tool-runner queries the preference on `drawStart` and conditionally applies the PP wrapper (replacing the existing hardcoded ON logic)
  - When PP is OFF, or when the active tool is not pencil/eraser, use the default `ops`
- Stroke-start-time value is fixed for the entire stroke (toggle changes mid-drag take effect from the next stroke)
- E2E cases (Playwright):
  - PP OFF + Pencil L-shape → middle pixel present (compared to 072's ON case)
  - topBar/mAppBar toggle click → state display changes + next stroke switches behavior
  - After app reload, toggle state is preserved
  - PP ON + Line tool drawing a diagonal that would induce an L-corner → middle pixel present (defends PP wrapping scope boundary)
- `cargo test`, Vitest, and Playwright all pass

## Blocked by

- [070 — topBar/mAppBar PP toggle design](070-pixel-perfect-toggle-design.md)
- [072 — Pixel Perfect Pencil integration](072-pixel-perfect-pencil-integration.md)

## Scenarios addressed

- Scenario 2 (Pencil PP OFF Bresenham raw preservation)
- Scenario 7 (toggle click → next stroke reflects change)
- Scenario 8 (mid-stroke toggle change ignored)
- Scenario 9 (persistence across sessions)
- Scenario 11 (no effect on Shape tools — verifies PP wrapping scope boundary)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/shared-state.svelte.ts` | Added `pixelPerfect = $state<boolean>(true)` field (default ON) |
| `src/lib/canvas/editor-state.svelte.ts` | PP getter/setter + `handlePixelPerfectToggle()` method |
| `src/lib/canvas/tool-runner.svelte.ts` | On `drawStart`, queries preference → conditional `createPixelPerfectOps` wrapping (removed hardcoded ON). Tools other than Pencil/Eraser use the default ops regardless of preference |
| `src/lib/canvas/workspace-snapshot.ts` | `SharedStateSnapshot.pixelPerfect?: boolean` (legacy snapshots restored via `?? true`) |
| `src/lib/canvas/workspace.svelte.ts` | `#hydrate` restores `pixelPerfect`; `toSnapshot` includes it |
| `src/lib/session/session-storage-types.ts` | Added `SharedStateRecord.pixelPerfect?: boolean` (schema extension) |
| `src/lib/session/session-persistence.ts` | Map `pixelPerfect` on save |
| `src/routes/editor/+page.svelte` | PP toggle handler (disabled guard + `markDirty`), props passed to TopBar/AppBar, `pixelPerfectDisabled` derived |
| `src/lib/ui-editor/TopBar.svelte` | PP button (custom icon, ON/OFF/disabled states, `aria-pressed`/`aria-disabled`, per-state i18n tooltip) |
| `src/lib/ui-editor/AppBar.svelte` | Same PP button (for compact viewport) |
| `src/lib/ui-editor/PixelPerfectIcon.svelte` | Staircase-shaped PP icon (new) |
| `src/lib/ui-editor/TopBar.stories.svelte`, `AppBar.stories.svelte` | Added PP props |
| `src/lib/ui-editor/AppBar.svelte.test.ts` | Added PP prop defaults |
| `src/lib/canvas/shared-state.svelte.test.ts`, `workspace.svelte.test.ts` | PP default + snapshot round-trip (legacy absence → `true`) unit coverage |
| `messages/en.json`, `messages/ko.json`, `messages/ja.json` | `action_pixelPerfectOn` / `Off` / `Disabled` i18n entries (3 locales) |
| `e2e/editor/pixel-perfect.test.ts` | Added 5 E2E scenarios: PP OFF L-shape preservation · reload persistence · incompatible-tool disabled · AppBar(compact) toggle · Line L-corner scope boundary |

### Key Decisions

- **Disabled state visually/semantically suppresses the button without removing it** — `aria-disabled="true"` + opacity 0.4 + hover suppression + `(Pencil/Eraser only)` contextual tooltip. Not hiding the button prevents layout shift on tool switch and directly explains the grayed state via screen reader / tooltip.
- **Preference snapshot fixed at stroke start** — tool-runner's `drawStart` reads `shared.pixelPerfect` to decide the wrapper. Mid-stroke toggle changes apply from the next stroke (Scenario 8).
- **Legacy snapshot compatibility** — `SharedStateSnapshot.pixelPerfect?: boolean` declared as optional; hydrate applies `?? true` default. Existing users are restored in ON state, consistent with prior behavior (PR #156/#157).
- **Double defense of Shape tool scope boundary** — tool-runner applies the PP wrapper only to `pencil`/`eraser`, and additionally `createPixelPerfectOps` only wraps `applyStroke` while forwarding `applyTool` as-is. Line/Rect/Ellipse go through the `applyTool` path and are by design unaffected by PP (regression-defended in Cycle 6 E2E).
- **Reload persistence test stabilization** — `page.reload()` doesn't wait for `beforeunload`'s async flush, so the test polls IDB with `page.waitForFunction` to confirm `pixelPerfect === false` before reload, plus a 200ms settle pad. Eliminates the race between the 3s debounce and reload.

### Notes

- This issue is the last sub-issue of parent PRD 069 (Pixel-perfect drawing). After 070/071/072/073 finished, 074's completion closes the PRD as done.
- Apple shell still lacks PP — `platform-status.md` keeps the Pixel-perfect filter row at Web ✅, Apple ⬜.
