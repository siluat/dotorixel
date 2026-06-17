---
title: "Frame ruler design — M4 Layer × Frame grid (.pen)"
type: design
status: done
created: 2026-06-16
parent: 186-frame-management.md
---

## Design Scope

Finalize the **M4 frame ruler** design in `docs/pencil-dotorixel.pen`, growing the
092 TimelinePanel spec's M3 single-column placeholder (§7) into the full Layer ×
Frame grid. This is the leading (HITL) slice of PRD 186 — downstream shell and
operation slices implement against it.

Produce a finalized design spec frame (sibling to `092 — TimelinePanel Design
Spec`) covering:

- **Anatomy** — frame ruler row (frame ordinals, 32px columns) and a grid cell
  with its cel-occupancy indicator.
- **Active-state treatment** — active frame column + active cel emphasis.
- **Header frame actions** — the header-right action group.
- **Desktop expanded** state (full grid: layers × frames, dots, active column,
  active row, active cel, header actions, reserved transport strip).
- **Desktop collapsed** state.
- **Mobile** state (Timeline tab, horizontal frame scroll).
- **Reserved transport strip** — the future playBar location (placeholder only).
- Light + Dark via token theming.

## References

- Parent PRD: [186 — Frame management](186-frame-management.md)
- [092 — TimelinePanel Design (layer panel spec)](092-layer-system-timeline-panel-design.md) — tokens, sidebar/header structure, §7 frame-axis-evolution rough M4 sketch this slice finalizes.
- `.pen` references: `1itxU` ([Ref] DOTORIXEL — Layers + Animation, the grid+transport exploration this adopts), `00B7W` ([Ref] Animation Workspace, filmstrip exploration — **not** adopted).
- Implementation seam: `src/lib/ui-editor/TimelinePanel.svelte` (pure view; frame-area placeholder grows here).

## Design Plan

Decisions agreed during the grill (do not re-litigate):

- **Direction**: Layer × Frame grid (layers = rows spanning all frames; frames =
  columns; cell = cel). Confirmed over the filmstrip alternative.
- **Cell cel representation**: occupancy **dot indicator** — empty cel = blank
  cell, content-bearing cel = a small dot. (Thumbnails deferred.)
- **Pixel Layer vs Reference Layer distinction (structural)**: the two Layer kinds
  read differently in both the sidebar and the grid.
  - *Sidebar*: each row carries a kind icon — Pixel Layers use a grid glyph
    (`grid-2x2`), the Reference Layer a photo glyph (`image`, in the accent tone).
    The Reference Layer is **pinned at the bottom of the stack below a divider
    line** and **omits the reorder handle** (`≡`) since it can't be reordered
    (singleton, fixed below the Pixel Layers).
  - *Frame grid*: Pixel Layers show **discrete per-frame cells with occupancy
    dots**; the Reference Layer — being **frame-independent (no cels)** — shows a
    single **continuous spanning bar** across all frame columns (a muted band, not
    discrete cells), captioned "underlay — same under every frame." The
    discrete-cells-vs-continuous-bar contrast is what makes the frame-independence
    legible at a glance. The divider above the Reference row spans both the sidebar
    and the grid so the two kinds are clearly partitioned.
- **Frame actions**: a **header-right action group** — `＋` add (empty frame),
  `⧉` duplicate, `🗑` delete — acting on the **active frame**, then the collapse
  chevron. The group is **prefixed with a `Frames` label**, mirroring the left
  `Layers` label. This symmetric labeling resolves the two-`＋` ambiguity (left
  `＋` reads as *add layer*, right `＋` as *add frame*) and signals that the whole
  right group — including duplicate/delete — is **frame-scoped**, the layer axis
  on the left and the frame axis on the right. Header **left is unchanged from
  M3** — it keeps the existing add-layer (`＋`) and add-reference-layer (`▣`
  image) buttons plus the `Layers` label (matching the current `TimelinePanel`
  `onAddLayer` / `onAddReferenceLayer`). Reorder frames by dragging their ruler
  cell. On mobile the collapse chevron is dropped (the Timeline tab itself is the
  toggle).
- **Header metrics (uniform, design-led — implementation to sync later)**: the
  header is one flat flex row of **bare icons** (no button wrappers) so spacing is
  perfectly even with no padding asymmetry. A single uniform gap separates **every**
  element — add-layer, add-reference-layer, the `Layers` label, and the
  frame-action group — left and right share the same rhythm. Desktop: 14px icons,
  8px gap. Mobile: 20px icons, 12px gap (proportionally matched to desktop, the
  collapse chevron dropped since the Timeline tab is the toggle). All action icons
  are `text-secondary`; only the `Layers` label is `text-primary`. (Implementation
  uses 24×24 icon buttons today; the visual hit-target/hover is an implementation
  concern to reconcile in the design-sync pass.)
- **Selection model**: clicking a ruler ordinal activates the **frame only**
  (keeps the active layer); clicking a grid cell activates **both** that layer
  (row) and frame (column).
- **Active highlight (2-channel, color-blind safe, consistent with 092 §2)**:
  active frame column = `accent-subtle` fill across the ruler cell + the column's
  cells, plus a **2px accent bar on the ruler cell's top edge** (the layer row's
  left-edge bar, rotated to top). The active cel (active row ∩ active column)
  gets combined emphasis.
- **Layout**: column width **32px** (square cells, matches 32px row height);
  panel height **180** expanded (header 32 + body 148) / **32** collapsed;
  layer sidebar **256px frozen**, only the frame-area scrolls horizontally.
- **Collapsed state**: `Layers · <active layer name> · Frame n/N` (read-only).
- **Mobile**: same grid (incl. the Reference-layer row + spanning bar) on a
  narrower sidebar; frame-area scrolls horizontally; touch targets ≥44px. The
  **mobile chrome is the canonical pattern reused verbatim** — `mStatusBar`,
  `mAppBar`, and the bottom `Tab Bar` (DRAW · COLORS · **LAYERS** · SETTINGS, the
  LAYERS tab active as a copper pill) are copied from the existing mobile mockups
  rather than re-invented, so the screen stays consistent with the rest of the
  app. (Entered via the existing LAYERS tab; whether M4 renames it to "Timeline"
  is an implementation decision, deferred — the mockup matches today's chrome.)
- **Reserved transport strip**: a dedicated strip **above the ruler** is left as a
  dim placeholder for the future playBar (play/pause, FPS, loop). **Not built in
  this slice** — it only reserves the location so the panel can grow without
  restructuring. PRD 186 scope stays frame-management only.

## Constraints

- **Tokens only** (`--ds-*` / the `.pen`'s `$--*` variables). No new tokens
  unless agreed during the design pass.
- Panel structure (header + body) and sidebar layout from 092 stay constant — only
  the right-side frame area gains content, so M3 → M4 grows in place.
- Scope is frame **management** (add/delete/duplicate/reorder + selection). No
  playback, onion skinning, or per-frame speed UI beyond the reserved strip.
- Mirror the 092 spec sheet's section structure for downstream implementability.

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` → `187 — Frame Ruler Design Spec (M4)` | New finalized spec sheet (7 sections: Anatomy · Desktop expanded Light/Dark · Collapsed · Mobile · Reserved transport · Design notes). Desktop + mobile panels with the Layer × Frame grid, Pixel/Reference layer distinction, and canonical mobile chrome. |
| `docs/pencil-dotorixel.pen` (canvas) | Whole canvas reorganized into labeled feature bands; superseded explorations + old `[Ref]` series moved to a LEGACY band; `00 — CANVAS GUIDE` index frame added. |
| `docs/agents/pencil-canvas.md`, `.claude/rules/pencil-design.md` | Agent guide + auto-surfaced rule capturing the canvas map, naming, reuse patterns, legacy policy, and Pencil tool gotchas (cross-tool via the `AGENTS.md` pointer). |

### Key Decisions
- **Layer × Frame grid** over the filmstrip alternative; a cel = (Pixel Layer × Frame) intersection.
- **Cell representation**: occupancy **dot** indicator (cel thumbnails deferred).
- **Pixel vs Reference Layer distinction (structural)**: photo kind-icon, pinned at the bottom below a divider, no reorder handle; in the grid a **continuous spanning bar** (frame-independent) vs pixel rows' per-frame dots.
- **Two-`＋` disambiguation**: symmetric `Layers` / `Frames` group labels.
- **Header spacing**: flat **bare-icon** layout with a single uniform gap (design-led).
- **Mobile chrome**: canonical `mStatusBar` / `mAppBar` / `Tab Bar` reused verbatim (copied), not reinvented.

### Notes
- The `.pen` itself lives in the Pencil-app worktree (`…/dotorixel-codex/docs/pencil-dotorixel.pen`) — **commit it from there** (not tracked-as-changed in this worktree).
- Header metric (bare icons / single uniform gap) intentionally **diverges from the current implementation** (24×24 icon buttons); flagged for a future design↔implementation sync.
- During the work, a session-level Pencil **render-cache glitch** (+50px offset / blank screenshots while node data is correct) was hit repeatedly; resolved by building fresh in a single batch + user refresh. Documented in `docs/agents/pencil-canvas.md` so future agents skip the trial-and-error.
- **PRD 186 stays open** — the implementation slices (core cel-grid → persistence V6 → ruler shell → add/duplicate/delete/reorder) are pending `/to-issues`.
