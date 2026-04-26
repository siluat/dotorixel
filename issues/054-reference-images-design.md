---
title: Reference images — UI design spec
status: done
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

Produce the Pencil (`.pen`) design spec for every surface the floating reference window feature introduces. This is a **HITL** slice: deliverable is design mockups + token usage + behavior notes, not code.

Surfaces to design (see parent PRD §Solution, §UI Entry Point, §Responsive):

- TopBar: new References icon button placed next to My Works (FolderOpen), using the existing `.icon-btn` pattern.
- References browser modal (desktop / wide + x-wide): gallery grid of cards, empty state with drag-drop target, per-card Hide/Delete controls.
- References BottomSheet (compact / medium): mirrors `SavedWorkBrowserSheet` layout.
- Gallery card: thumbnail, filename, dimensions, display toggle, delete button; active (displayed) state visually distinct.
- Floating reference window chrome: title bar (drag handle, minimize, close), body (image area), bottom-right resize handle, minimized state (title bar only).
- Confirmation dialog for delete (mirrors My Works' pattern).

Design tokens stay within the `--ds-*` namespace. Cross-reference `docs/design-system.md` and the existing Pebble-replacement docked layout patterns.

## Acceptance criteria

- `.pen` frames covering: TopBar (with new button), modal (desktop), BottomSheet (compact), empty state, populated gallery, card states (idle / displayed / hover / delete-confirming), floating window (normal / minimized / dragging / resizing), delete confirmation dialog.
- Every color, spacing, radius, shadow, and type size references an existing `--ds-*` token. New tokens only when reuse across components is confirmed.
- Touch targets ≥ 44×44 on compact/medium; floating window chrome usable with pointer and touch.
- Notes capture: z-order cue (active window), pointer-absorb (no pass-through indication), cascade offset (~24px), minimum window size (~80×80), minimize affordance (window-shade).
- Review with user; approved design unlocks downstream AFK slices.

## Blocked by

None — can start immediately.

## Scenarios addressed

Design deliverable only — no runtime scenarios. Provides the visual contract for all downstream slices.

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | Spec container `p92Kt` (Light, x=-430 y=24056, 1800w) holding §1–§9. In-place edits to top-level editor frames `atTXy` (Light) and `NyOgp` (Dark): added Images button to TopBar (between Grid and Export) and placed two floating reference windows on canvas (active z-front + inactive behind). |
| `docs/images/generated-1777165939893.png` | Shared fox-warrior reference image used as thumbnail across §1–§3 and §8 floating windows. |

Sections in the spec container:

- §1 Floating Window — Light component states (Active / Inactive / Minimized) — node `xtr51`
- §2 Floating Window — Dark component states via theme cascade — node `eGAYA`
- §3 Gallery Card — Idle / Displayed (Eye accent) / Hover (delete visible) — node `ZNgCf`
- §4 TopBar — Grid · **Images (NEW)** · Export action cluster + annotation — node `lsf9P`
- §5 References Modal (Desktop) — Empty + Populated 3-card grid — node `qyBmE`
- §6 References Bottom Sheet (Compact) — Empty + Populated 2×2 grid — node `xxLc3`
- §7 Delete Confirmation alertdialog (Cancel + destructive Delete) — node `jCTP8`
- §8 Integrated View hint — points to `atTXy` / `NyOgp` (modified in-place)
- §9 Design Notes — Tokens / Behavior / Deferred (3-column) — node `qI5Bi`

### Key Decisions

- **Q1 Chrome density: B (Quiet)** — minimal title bar, no app-style chrome; pixel art canvas remains the visual focus.
- **Q2 Active vs inactive differentiation: C (shadow + tone)** — active uses heavier shadow (0 2 16 #00000012) and full opacity; inactive uses softer shadow (0 1 6 #0000000F), surface-tone titlebar, and 0.85 image opacity.
- **Q3 Minimize behavior: A (width-preserved window-shade)** — collapses to titlebar only, preserves horizontal footprint; restore icon swaps from Minus to Maximize-2.
- **Q4 Resize handle: A (two-line corner)** — discrete 12×12 stroke path at bottom-right, low visual weight.
- **Q5 TopBar entry icon: A (Images)** — lucide `images` icon, distinct from `folder-open` (My Works).
- **Q6 Card affordance: A (Model 1 + Eye toggle)** — card stays in browser; Eye icon (`eye-off` → `eye` accent) toggles canvas display without removing reference.
- **Q7 Dark renderings scope: A (new components dark only)** — only floating window gets dedicated dark rendering (§2). Cards/modal/sheet/dialog rely on `--ds-*` token cascade verified in §8 dark integrated view.
- **Q8 Long-press color sampling visuals: A (defer)** — sampling reuses existing `SamplingSession` loupe; visual spec deferred until interaction behavior solidifies in slices 060–061.

### Notes

- All colors/spacing/radius/shadows reference `--ds-*` tokens. No new tokens introduced — `#EF4444` reused inline for destructive button (matches existing dialog pattern in `SavedWorkCardGrid`).
- `theme: { mode: "dark" }` applied at stage frame level (§2 stage `eGAYA`, `NyOgp` editor) — token resolution validated end-to-end.
- Pencil layout bug (+50px child offset on new frames) encountered mid-task; resolved by user updating the Pencil app. All §1–§9 frames built after the fix render correctly.
- `Move(node, parent, index)` operation syntax confirmed (third arg is plain number, not `{index: N}`).
- Parent PRD 053 remains `open` — sub-issues 055–062 (gallery foundation through drag-drop import) still pending.
