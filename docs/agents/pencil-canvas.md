# Pencil design canvas — agent guide

How to explore and edit the project's `.pen` design file without rediscovering its
structure (or its tool quirks) every time. Read this **before** touching the
canvas.

- **File**: `docs/pencil-dotorixel.pen` **in the current repository**. The Pencil
  app must have *this repo's* copy open — confirm the `get_editor_state` active
  path is under the current repo root before editing. If it reports another clone
  or worktree (e.g. `…/dotorixel-codex/docs/pencil-dotorixel.pen`), that is a
  misconfiguration: ask the user to open this repo's `.pen` in Pencil and do
  **not** edit the other copy.
- **Encrypted**: access **only** via the `pencil` MCP tools. Never `Read`/`Grep` a
  `.pen` file.

## Canvas map

The canvas is organized into labeled **bands** (a `§ <BAND>` frame marks each
band's top-left). Top-level frame names are self-documenting — a `get_editor_state`
listing reveals the structure. There's a `00 — CANVAS GUIDE` frame at the origin
that mirrors this map in-canvas.

| Band | y | Contents |
|---|---|---|
| **FOUNDATIONS** | 0 | Design System Reference |
| **EDITOR — CORE APP** | 3100 | Desktop Light/Dark · iPad Landscape · Medium Tablet · Mobile Draw/Colors/Settings |
| **EDITOR — ANIMATION / TIMELINE** | 4624 | Desktop Anim Light/Dark · iPad Anim · Tablet/Mobile Timeline Tab |
| **LANDING PAGE** | 6148 | Desktop · Mobile |
| **FEATURE SPECS** | 8548 | finalized per-feature spec sheets, left→right (see map below) |
| **LEGACY / SUPERSEDED** | 18000+ | superseded explorations + the old `[Ref]` mockup series — kept for history, separated by a large gap |

FEATURE SPECS row (left→right): `092 TimelinePanel` · `187 Frame Ruler (M4)` ·
`106 Reference Layer` · `133 Selection Action Bar` · `054 Floating Reference
Windows` · Floating Window Chrome compare · Color Picker Loupe · Saved Work
Browser · Export UI · Canvas Resize · Tooltip · Pixel-Perfect Toggle (Icon / Q4
ON·OFF / Final Spec) · `194 Per-frame Duration Control (M4)` · `199 Animation
Playback / Transport Strip (M4)`.

## Naming conventions

- `NNN — <Feature> Design Spec` — a **finalized** feature spec sheet. `NNN` is the
  issue number (`issues/NNN-*.md`), so the spec ↔ issue link is the prefix.
- `Editor — <Breakpoint> [variant]` — the **canonical current-app** editor screens.
  These are the source of truth for chrome (top bar, tab bar, etc.).
- `[Ref] DOTORIXEL — …` — **legacy** reference mockups (superseded by the
  `Editor —` series; in the LEGACY band).
- `§ <BAND>` — section-label frames.
- `00 — CANVAS GUIDE` — the in-canvas version of this map (sorts first).

## Reuse, don't reinvent

- **Tokens**: the `$--*` palette (theme axis `mode: dark|light`). Fetch with
  `get_variables`. It mirrors `src/styles/design-tokens.css` (`--ds-*`). Do **not**
  introduce new tokens without approval.
- **Mobile chrome**: `mStatusBar` (9:41 + status icons), `mAppBar` (DOTORIXEL +
  undo/redo/menu), and the bottom `Tab Bar` (DRAW · COLORS · LAYERS · SETTINGS,
  active tab as a copper pill) are a **canonical pattern** — **copy** them from an
  existing `Editor — Mobile *` frame rather than rebuilding, so new mobile mockups
  stay consistent.
- **Layer-type distinction** (Pixel vs Reference Layer), the frame-ruler grid, the
  header metric system, etc. are specified in `187 — Frame Ruler Design Spec`;
  match it rather than re-deriving.

## Legacy policy

- Classify a frame as legacy **only with human confirmation** — names can be
  ambiguous and a mockup may still be a useful reference.
- Move legacy frames to the **LEGACY band (y ≥ 18000)**; **don't delete** them
  (keep for history).
- When adding a new finalized spec, place it in the **FEATURE SPECS** band
  (append to the right), name it `NNN — <Feature> Design Spec`, and update this
  guide + the `00 — CANVAS GUIDE` frame.

## Pencil tool gotchas (learned the hard way)

- **`batch_design` function names** are `Insert / Update / Copy / Move / Delete /
  Generate` — not the short `I/U/C` forms shown in some tool descriptions.
- **Persist node IDs across `batch_design` calls** by assigning without
  `const`/`let` (`foo = Insert(...)`); `const`/`let` don't survive between calls.
- **Stale render/layout cache after heavy editing** is the big one. Symptoms: a
  phantom **+50px offset**, children rendering outside their parent, or **blank
  screenshots** — while the node *data* is actually correct (the batch succeeded).
  Handling:
  - Trust **`snapshot_layout` coordinates** for structure verification over
    screenshots when results look wrong; the relative node order is reliable even
    when an absolute offset is applied.
  - Build complex nodes **fresh in a single `batch_design` call**. Inserting
    children into a frame created in an *earlier* batch can render with the offset
    in a degraded session.
  - The fix that clears it is a **user refresh/reopen** of the Pencil document
    (the layout recomputes from correct data). Tell the user to refresh to verify.
- **Avoid nested `fit_content` frames inside small flex headers**, and avoid
  `Move`-ing children into them — they y-offset/glitch in this environment. Prefer
  **flat structures / bare icons** with a single uniform `gap`.
- **Repositioning** a top-level frame via `Update(id, {x, y})` is safe and
  glitch-free (used for the band layout).
- Top-level layout is absolute (the document root has no flex layout), so `x`/`y`
  on top-level frames apply directly. Keep the root clean: only screen/spec frames
  and `§`/guide frames belong at the root (no bare text — wrap in a frame).

## Keeping this current

Update this doc **and** the `00 — CANVAS GUIDE` frame whenever the band layout,
naming, or spec↔issue map changes. The `/ui-design` flow is the natural place to
do it (after producing or moving a spec frame).
