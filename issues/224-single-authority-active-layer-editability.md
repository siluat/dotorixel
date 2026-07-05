---
title: "One authority for active-layer editability"
status: ready-for-agent
created: 2026-07-05
---

## Problem Statement

The rule "a Reference Layer takes no paint and no Marquee" is re-decided in
four modules (25 layer-kind checks across 10 non-test files; the rule sites):

- `stroke-engine.ts:63–93` — private `isActiveLayerReference` +
  `noOpStroke()`, gated on `isPixelMutationTool(activeTool)` at `begin()`.
- `tools/selection-tool.ts:11–17, 147, 174, 188` — its own private
  `isReferenceLayerActive` helper, checked in three callbacks.
- `tab-state.svelte.ts` — kind guards in `draw` (:612), `nudgeMarquee`
  (:776), `pasteSelectionClipboard` (:791), `selectionCutSnapshot` (:806).
- `+page.svelte:80–83` → `PixelCanvasView` — a derived kind check feeding the
  view's cursor/marquee-display/pointer-routing props.

Grilling findings that sharpen the picture:

1. **`selection.isPixelMutationTool` is `true`** (tool-registry.ts:99), so the
   stroke engine's `begin()` gate already blocks the Selection tool — the
   tool's three internal checks are unreachable at stroke start. Their only
   reachable scenario is the active layer changing **mid-stroke**.
2. **Mid-stroke surface switches are possible today.** TabState's 16
   `isDrawing` guards all sit on the selection/history/transform command
   family (:692–790); the layer/frame family (`setActiveLayer`,
   `setActiveFrame`, `removeLayer`, `removeFrame`, …) has none. A second
   input (e.g. a second touch on a Timeline row) can switch or remove the
   stroke's target while a pencil stroke is writing — the Selection tool's
   internal checks were a selection-only partial patch over this general
   hazard. The invariant is already in CONTEXT.md: "Drawing tools write only
   the active Layer's active-frame Cel."
3. Not all 25 checks are the rule. Out of scope as **different rules or
   legitimate union handling**: sampling-source selection
   (tab-state :402/:413 — Reference Sampling species), Navigation-Bounds
   footprint (:1042), the journal's stacking invariant (:327/:435, reference
   stays bottom), serialization/hydration type guards, and TimelinePanel's
   per-kind rendering.

## Solution

Authority = one projection predicate; enforcement = TabState entries; tools
and engine trust their preconditions ("fail at the boundary, trust the core").

### 1. Predicate on the layer projection

`DocumentLayerProjection` gains `isActiveLayerEditable` (today:
`activeLayerKind !== 'reference'`) — the only place the formula lives. Name
reuses existing vocabulary (Layer); no new glossary noun.

### 2. TabState becomes the sole enforcement point

- `drawStart`: when `isPixelMutationTool(shared.activeTool)` and the active
  layer is not editable, do not dispatch (no tool-runner call). The
  eyedropper is unaffected (not a mutation tool — Reference Sampling keeps
  working).
- The existing kind guards in `draw` / `nudgeMarquee` /
  `pasteSelectionClipboard` / `selectionCutSnapshot` consult the predicate.
- **Targeted `isDrawing` guards** on the four methods that move or destroy
  the stroke's target: `setActiveLayer`, `setActiveFrame`, `removeLayer`,
  `removeFrame` — same idiom as the existing command-family guards. This
  closes the mid-stroke hazard for every tool (pencil included) and makes
  the deletions below provably safe. Full uniformization of the mutating
  surface stays with the future prepare-to-mutate-gate work (architecture
  review candidate #2); these four guards fold into that gate when it lands.

### 3. Deletions

- `stroke-engine.ts`: the `begin()` reference gate, `noOpStroke()`, and the
  private `isActiveLayerReference` helper.
- `tools/selection-tool.ts`: the private `isReferenceLayerActive` helper and
  all three internal gate checks.

### 4. What deliberately stays

- The view/page `isReferenceLayerActive` prop keeps its name and kind-based
  meaning: routing pointers to the Reference Layer Placement Interaction,
  the eyedropper cursor variant, and marquee display are **kind** decisions,
  not editability decisions. Renaming them "editable" would couple two rules
  that only coincide today (a future locked Pixel Layer must not start
  routing pointers to placement drag).
- Sampling-source selection, Navigation-Bounds footprint, journal stacking
  invariant, serialization/UI kind branches — different rules, untouched.

### Intended behaviour changes (both are pins in the test plan)

- (a) A blocked stroke attempt on a Reference Layer no longer sets
  `isDrawing`, stops Playback, or creates a no-op session. Observable only
  on the rare reference-without-underlay path (with an underlay present the
  view already routes the pointer to placement interaction); a gesture that
  does nothing no longer changes editor state.
- (b) During an active stroke, `setActiveLayer` / `setActiveFrame` /
  `removeLayer` / `removeFrame` are ignored — the multi-input mid-stroke
  target switch (which today lets a pencil stroke continue onto the switched
  layer) is sealed.

### Domain model

In the implementing PR, amend CONTEXT.md's **Pixel Layer** entry with an
ownership clause: the editability rule is owned by the Document Layer
Projection (`isActiveLayerEditable`) and enforced only at TabState entries.
No new glossary term.

### Relations

Independent of issues 221–223 (no file overlap: this touches tab-state,
stroke-engine, selection-tool, document-layer-projection; 221 touches
editor-controller/+page/session.ts, 222 floating-selection-lifecycle/core/
wasm, 223 session-storage/persistence). Composes with 221: the Input
Pipeline gates session-level input admission; TabState gates document-state
editability.

## Test plan

- Delete the reference-gate tests in the stroke-engine and selection-tool
  suites (the rule is no longer their job; it was verified 3–4× across
  seams).
- Keep TabState's existing reference-guard tests — the enforcement seam is
  the test surface; assertions are unchanged by switching to the predicate.
- New: projection predicate unit test; mutation-tool `drawStart` on a
  Reference Layer → no dispatch, `isDrawing` stays false, Playback keeps
  running (pin (a)); eyedropper `drawStart` on a Reference Layer proceeds
  (Reference Sampling preserved); the four mid-stroke guards defer/ignore
  while `isDrawing` (pins (b)).

## Acceptance criteria

- The formula `activeLayerKind !== 'reference'` (as an editability decision)
  exists once, on `DocumentLayerProjection.isActiveLayerEditable`;
  stroke-engine and selection-tool contain no layer-kind checks.
- With a Reference Layer active: mutation-tool strokes never reach the tool
  runner; marquee nudge/paste/cut stay no-ops; eyedropper sampling and
  Reference Layer Placement Interaction behave exactly as today.
- Mid-stroke `setActiveLayer` / `setActiveFrame` / `removeLayer` /
  `removeFrame` are ignored while `isDrawing`.
- The view's `isReferenceLayerActive` prop and all out-of-scope kind checks
  (sampling species, footprint, stacking, serialization, TimelinePanel) are
  unchanged.
- CONTEXT.md Pixel Layer entry carries the ownership clause.
- Unit suites and e2e editor specs pass.

## Blocked by

None — independent of issues 221, 222, and 223.

## Notes

- 2026-07-05: Produced by the `/improve-codebase-architecture` review
  (candidate #3 of 11) followed by a grilling pass. Decision tree resolved
  with the user: projection-predicate authority with TabState-only
  enforcement over a shared-helper-only or defense-in-depth shape;
  `isActiveLayerEditable` naming reusing existing vocabulary over a new
  "Editable Surface" term; view props keep kind semantics (placement routing
  is a different rule); four targeted `isDrawing` guards included here as
  the precondition that makes deleting the tools' internal gates sound, with
  full guard uniformization deferred to the prepare-to-mutate-gate candidate.
