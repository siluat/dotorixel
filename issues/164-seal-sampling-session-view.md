---
title: "Seal the Sampling Session view and name its species"
status: ready-for-agent
created: 2026-06-09
---

## What to build

Make the code mirror the domain's genus/species model for Sampling Sessions, and seal the
surface the two species share by hand today behind a named type.

CONTEXT.md defines a **Sampling Session** genus with two species — **Canvas Sampling Session**
(against Document layer data) and **Reference Sampling Session** (against an imported reference
image) — but the code does not name them this way. `canvas/sampling/session.svelte.ts` exports
`SamplingSession` / `createSamplingSession`, which is simultaneously (a) the Canvas species and
(b) the shared lifecycle engine the Reference session composes via
`inner = createSamplingSession(...)`. The Reference session
(`reference-images/reference-sampling-session.svelte.ts`) re-declares the read surface
(`isActive` / `grid` / `position` / `updatePointer`) and keeps it aligned to the Canvas session's
shape **by comment only** ("match the underlying `SamplingSession` shape") — an unsealed seam
that can drift silently.

This is a behaviour-preserving structural refactor: rename to reveal genus/species, and replace
the hand-aligned comment with a shared type that both species `extends`.

### After this change

- A named genus surface, `SamplingSessionView`, lives in `canvas/sampling/types.ts`:

  ```ts
  export interface SamplingSessionView {
    readonly grid: readonly (Color | null)[];
    readonly position: { readonly x: number; readonly y: number } | null;
    updatePointer(params: SamplingSessionUpdatePointerParams): void;
  }
  ```

  `SamplingSessionUpdatePointerParams` moves here from `session.svelte.ts` (it is genus-level —
  both species use it).

- The Canvas species is renamed and extends the view:
  - `interface SamplingSession` → `CanvasSamplingSession extends SamplingSessionView`
  - `createSamplingSession` → `createCanvasSamplingSession`
  - `SamplingSessionStartParams` → `CanvasSamplingSessionStartParams` (Canvas-specific; internal only)
  - keeps `isActive` + `start` / `update` / `commit` / `cancel`

- The Reference species extends the view: `ReferenceSamplingSession extends SamplingSessionView`,
  keeps `isActive` + its own `start` / `move` / `end` / `cancel`. The "match the shape" comment is
  deleted (the `extends` enforces it). The `inner` composition target becomes
  `createCanvasSamplingSession(...)`, making the "reuses the Canvas Sampling Session as its engine"
  relationship explicit.

- Two view-only consumers narrow to `SamplingSessionView` (giving the type real consumers, not just
  documentation):
  - `editor-controller.svelte.ts` `get samplingSession(): SamplingSessionView`
  - `PixelCanvasView.svelte` prop `samplingSession?: SamplingSessionView`
  - `tab-state` (owner/driver) and the tool system (`tool-runner` / `tool-authoring` /
    `stroke-engine`) keep the full `CanvasSamplingSession`.

### Design decisions (resolved in grilling)

- **No neutral engine.** Canvas stays the shared lifecycle engine that Reference composes
  (`inner`); we do not extract a third "engine" module. Implementation is already shared by
  composition — the real smell is the hand-aligned interface, which a named type seals. A neutral
  engine would be infrastructure for a hypothetical 3rd species (none exists).
- **Scope is naming + seal, not behaviour.** No polymorphic lifecycle consumer exists — the two
  Loupe render sites live in different component trees (`PixelCanvasView` vs editor `+page.svelte`)
  and are deliberately *not* unified. So the genus seals only the **view** surface, not the
  lifecycle.
- **`isActive` excluded from the view, kept on both concrete interfaces.** No production consumer
  reads `isActive` externally, so it is not part of the shared view; but it is test-observed surface
  (session test 5×, reference test 11×), so it stays on `CanvasSamplingSession` /
  `ReferenceSamplingSession`.
- **No lifecycle verb alignment.** Reference keeps `move` / `end` (not renamed to `update` /
  `commit`). The verbs are a coherent press-drag-release gesture vocabulary threaded end-to-end from
  the `referenceSample*` drivers; aligning would mismatch the drivers or balloon the rename, and the
  verb difference correctly signals the different gestures.
- **`SamplingSessionView.position` stays nullable**; the existing `{#if session.position}` render
  guards continue to bridge it to `Loupe.svelte`'s non-null `position` prop.
- **`canvas/sampling/session.svelte.ts` keeps its filename** — the `canvas/sampling/` path already
  localizes it; `canvas-session.svelte.ts` would stutter.

## Scope

- Web-shell only. No Rust core or Apple changes — Sampling Sessions are web-only.
- Behaviour-preserving: no runtime change. All existing unit/e2e assertions stay identical except
  renamed identifiers.
- Blast radius ≈ 16 files (production 9 + test 7), all mechanical identifier renames + one type
  relocation:
  - Define / move: `canvas/sampling/session.svelte.ts`, `canvas/sampling/types.ts`
  - Type consumers: `tool-runner.svelte.ts`, `tool-authoring.ts`, `stroke-engine.ts`,
    `editor-session/tab-state.svelte.ts`, `editor-session/editor-controller.svelte.ts`,
    `PixelCanvasView.svelte`
  - Composition + import: `reference-images/reference-sampling-session.svelte.ts`
  - Doc comments mentioning `SamplingSession`: `reference-images/sampling-port.ts`,
    `reference-sampling-session.svelte.ts`
  - Tests: `session.svelte.test.ts`, `tool-runner.svelte.test.ts`, `stroke-engine.test.ts`, and the
    four tool stubs `one-shot-tool.test.ts` / `shape-tool.test.ts` / `custom-tool.test.ts` /
    `continuous-tool.test.ts` (`{} as CanvasSamplingSession`)
- Not classic TDD (no new behaviour). Mechanical refactor under the existing green suite as the
  safety net.

## Acceptance criteria

- `SamplingSessionView` defined in `canvas/sampling/types.ts`; both `CanvasSamplingSession` and
  `ReferenceSamplingSession` `extends` it. `SamplingSessionUpdatePointerParams` relocated there.
- `isActive` is absent from `SamplingSessionView` and present on both concrete interfaces.
- All renames applied (`SamplingSession` → `CanvasSamplingSession`, `createSamplingSession` →
  `createCanvasSamplingSession`, `SamplingSessionStartParams` → `CanvasSamplingSessionStartParams`);
  the "match the underlying shape" comment is gone.
- `editor-controller` getter and `PixelCanvasView` prop are typed `SamplingSessionView`; `tab-state`
  and the tool system keep `CanvasSamplingSession`.
- Reference session retains `start` / `move` / `end` / `cancel` (no verb alignment).
- Behaviour-preserving: no test assertion changes beyond identifiers; no visual/runtime change.
- `svelte-check` clean; unit + e2e suites pass; production build OK.

## Blocked by

None — sourced from the architecture review (`/improve-codebase-architecture`, candidate #1) and
crystallized via a `/grill-me` design session. Standalone refactor. The grilling reframed the
candidate from "unify two duplicated sessions" to "name the genus/species and seal their shared
view", after confirming the implementations are already shared by composition and the consumers are
already split.
