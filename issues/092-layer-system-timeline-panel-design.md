---
title: "Layer system: TimelinePanel design — Candidate A detail pass"
status: done
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Detail Candidate A (unified Layer × Frame timeline panel docked below the canvas) into a full pixel-level design in the project's `.pen` file. This slice is **HITL** — run the `/ui-design` flow.

Scope:

- Reference the existing comparison area in `docs/pencil-dotorixel.pen` (container ID `sTEPj`, position `x=-430, y=28063`) for context.
- Produce desktop expanded state (h=180) and collapsed state (h=32) — left-side layer sidebar (each row: visibility toggle + name + delete + reorder handle) and right-side frame area (one column or hidden in M3).
- Produce mobile variant (entered via the 4th BottomTabs tab "Timeline").
- All design tokens come from the existing token system; do not introduce new tokens unless required and approved during the design flow.
- M3 frame axis: render a single column placeholder or hide it altogether — pick one in the design and document the choice.
- Output: a finalized design block in `docs/pencil-dotorixel.pen` that downstream UI slices (C1–C5, D, E1–E2) can implement against.

## Acceptance criteria

- Desktop expanded state finalized (layer sidebar + frame area + chevron).
- Desktop collapsed state finalized (h=32 strip with chevron).
- Mobile variant finalized (entered via Timeline tab).
- Layer row controls finalized: visibility toggle, name area, delete affordance, reorder affordance.
- M3 frame-axis treatment chosen and documented in the `.pen`.
- Design uses existing tokens only (or new tokens are agreed during the flow).

## Blocked by

None — can start immediately, parallel to the A series.

## Scenarios addressed

- Visual specification for Scenarios 3, 4, 5, 7, 10, 11.

## Design Plan (from grill)

Decisions agreed during the grill phase before the `.pen` detail pass.

- **Frame axis (M3)**: single column placeholder, rendered in a dim/static tone. Keeps the panel structure stable across M3 → M4 (frame ruler grows in place).
- **Panel header**: full-width internal header at h=32. Left side: "Layers" label + add (＋); right side: chevron. Reserves the right-side space for the M4 frame ruler.
- **Layer row layout (left → right)**: `[👁 visibility] [name (fill)] [✕ delete] [≡ reorder]` — Aseprite/Photoshop convention; familiar to pixel-art users.
- **Active layer emphasis**: combined treatment — row fill with hover-tone surface + 2px accent bar on the row's left edge. Two channels for color-blind safety.
- **Reorder affordance**: drag handle only (`≡`). Keyboard accessibility via focus + ↑/↓ (binding details belong to issue 096).
- **Collapsed state (h=32)**: `"Layers · <active layer name>"` on the left + chevron on the right. Read-only; no toggles.
- **Mobile entry**: full-screen takeover via the 4th BottomTabs tab "Timeline". Consistent with Colors / Settings tabs; the tab itself is the toggle.
- **Sidebar width**: 256px default (8-grid alignment, comfortable for `[👁] [name fill] [✕] [≡]`).
- **Row height**: 32px (with h=32 header + h=148 body, ~4.5 rows visible at expanded h=180).
- **Add-layer entry point**: panel header's left side, adjacent to the "Layers" label.
- **Tokens**: use existing tokens only. New tokens require explicit agreement during the design pass.
- **Output matrix**: Light + Dark × {Desktop expanded, Desktop collapsed, Mobile expanded}.

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | New "092 — TimelinePanel Design Spec" frame (`iDAOA`) with 8 sections: §1 Anatomy (layer-row callouts), §2 Active state matrix (default/hover/active/active+hover), §3 Desktop Light (expanded h=180 + collapsed h=32), §4 Desktop Dark, §5 Mobile Light (canonical chrome + h=146 panel split), §6 Mobile Dark, §7 Frame axis evolution (M3 dim placeholder → M4 frame ruler), §8 Design notes (token references, dimensions, M4 evolution path). |
| `issues/092-layer-system-timeline-panel-design.md` | Task closeout — frontmatter status flipped to `done`, Results appended. |

### Key Decisions

- **Mobile layout: split, not takeover.** Phone-2 keeps the canvas visible with the h=146 timelinePanel docked below, matching the existing `wbAke` "Editor — Mobile Timeline Tab" reference. The previously discussed full-screen takeover was rejected to preserve canvas continuity when switching to LAYERS.
- **Mobile entry tab: LAYERS (3rd of 4)** in the existing BottomTabs Pill, identical to the canonical Mobile reference. The earlier brief mentioned a 4th "Timeline" tab; this was reconciled to the actual 4-tab pattern (DRAW / COLORS / LAYERS / SETTINGS).
- **Mobile chrome reuses canonical pattern unchanged.** mStatusBar (h=54) + mAppBar (h=44) + Tab Bar Pill (h=62 in padding [8,16,20,16]) cloned from the existing `A9dne` / `wbAke` references — the timelinePanel is the *only* new UI in the mobile design.
- **Layer row layout**: `[👁 visibility] [name (fill)] [✕ delete] [≡ reorder]`, Aseprite/Photoshop convention.
- **Active row emphasis**: combined treatment — surface fill tone + 2px accent bar on the row's left edge (two channels for color-blind safety).
- **Panel header (h=32)**: "Layers" label + add (＋) on the left, chevron on the right. Reserves the right-side region for the M4 frame ruler.
- **Sidebar width**: 256px desktop (8-grid aligned, fits `[👁] [name] [✕] [≡]` comfortably). Row height 32px desktop, 28px mobile (compact).
- **M3 frame axis**: single column placeholder rendered in a dim/static tone (not hidden) — keeps panel structure stable across M3 → M4, where the frame ruler grows in place.
- **Tokens**: existing tokens only. No new tokens introduced.

### Notes

- **Mid-pass rebuild of mobile chrome.** First-pass mobile mockups inadvertently redesigned the navigation (topbar h=56 + bottomtabs h=88) instead of reusing the canonical mobile chrome. After user audit feedback, §5/§6 were rebuilt: 22 orphaned phone-canvas clones polluting the canonical reference frames (`sBYpq`, `7Dq5d`, `qMTQv`, `NFRUX`, `ogXPa`, `dY8B3`, `M4HoJ`, `lYrKx`, `KY103`, `uC3Fe`, `W28et`) were deleted, and the chrome was re-cloned with the correct `C(source, parent, options)` argument order. Final visual matches the canonical references exactly.
- Downstream sub-issues 093–100 (TimelinePanel shell + buttons + reorder + visibility + mobile tab + collapsible) implement against §1–§7 of this spec.
