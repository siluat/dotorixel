# Pencil / `.pen` Design Conventions

Rules for exploring and editing the project's design file `docs/pencil-dotorixel.pen`
(web/app UI mockups and feature spec sheets). **Read `docs/agents/pencil-canvas.md`
first** — it is the canonical guide (canvas map, naming, spec↔issue map, reuse
patterns, legacy policy, and the full tool-gotcha list). The essentials:

- **Encrypted file — pencil MCP tools only.** Never `Read`/`Grep` a `.pen` file.
  Use the active editor path from `get_editor_state` (it may be a sibling worktree
  checkout), not a hard-coded path.
- **Canvas is organized into labeled bands.** Valid mockups live in feature bands
  (FOUNDATIONS, EDITOR — CORE, EDITOR — ANIMATION/TIMELINE, LANDING, FEATURE SPECS);
  superseded work + the old `[Ref]` series live in the **LEGACY band (y ≥ 18000)**.
  A `00 — CANVAS GUIDE` frame at the origin mirrors the map. New finalized specs go
  in FEATURE SPECS, named `NNN — <Feature> Design Spec` (NNN = issue number).
- **Reuse canonical pieces.** Tokens are the `$--*` palette (`get_variables`;
  mirror of `--ds-*`) — no new tokens without approval. Copy the canonical mobile
  chrome (`mStatusBar` / `mAppBar` / `Tab Bar`) from an `Editor — Mobile *` frame
  rather than rebuilding it.
- **Legacy classification needs human confirmation;** move (don't delete) legacy
  frames to the LEGACY band.
- **`batch_design` quirks:** function names are `Insert/Update/Copy/Move/Delete`
  (not `I/U/C`); persist IDs across calls by assigning without `const`/`let`.
- **Stale render cache is real.** After heavy edits a session can apply a phantom
  **+50px offset** or return **blank screenshots** while the node data is correct.
  Verify structure with `snapshot_layout` coordinates (not screenshots), build
  complex nodes **fresh in one batch**, and tell the user to **refresh/reopen
  Pencil** to clear it. Avoid nested `fit_content` frames inside small headers
  (they glitch) — prefer flat / bare-icon layouts.
- **Keep the map current:** update `docs/agents/pencil-canvas.md` and the
  `00 — CANVAS GUIDE` frame whenever the layout, naming, or spec↔issue map changes.
