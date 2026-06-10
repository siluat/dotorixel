---
title: "Deepen the Reference Window Placement Interaction"
status: done
created: 2026-06-10
---

## Problem Statement

Reference Window placement policy is split across three modules, each invoking the placement math at a different moment:

| Pure function | Caller | Moment |
|---|---|---|
| `createPlacement` | `References` (`#displayCentered`, `importDroppedBatch`) | open |
| `refitPlacement` | `References.refitAll` | viewport change |
| `commitMove` | `ReferenceWindowOverlay.commitPosition` | move drag **release** |
| `commitResize` | `ReferenceWindow` (leaf component) | resize drag, **every pointer move** (despite the name) |

Friction this causes:

- The `References` seam for windows is raw per-field setters (`setDisplayPosition`, `setDisplaySize`, `setMinimized`, `close`, `show`) whose only external caller is the Overlay. `show` secretly doubles as bring-to-front, and the Overlay guards z-order raising itself.
- The "windows stay fully inside the viewport" invariant is enforced asymmetrically: moves clamp at release in the Overlay (read state back → recompute → conditional write), resizes clamp live inside the Window. During a move drag the store holds invariant-violating positions, and every pointer move fires `markDirty` — a mid-drag session flush (e.g. tab hidden) persists the violating state, healed only incidentally by the next `refitAll`.
- Placement-policy tests must mount the Overlay and dispatch synthetic pointer events to reach store-level policy — testing past the interface.

## Solution

Deepen `References` in place so it owns the full **Reference Window State** and the **Reference Window Placement Interaction** end-to-end (both terms added to CONTEXT.md). No module split: gallery intake and window lifecycle stay behind the single `References` seam; their separation is an implementation detail.

### Interface reshape (sketch)

```ts
class References {
  // gallery intake — unchanged
  forDoc / importToGallery / importDroppedBatch / delete / removeDoc / snapshot + restore

  // Reference Window lifecycle — intent verbs
  windowStatesForDoc(docId): readonly ReferenceWindowState[]  // render read model
  openCentered(refId, docId, viewport)      // kept
  toggleDisplay(refId, docId, viewport)     // kept
  close(refId, docId)
  bringToFront(refId, docId)                // split from `show`, idempotent
  setMinimized(refId, docId, minimized)
  refitAll(docId, viewport)                 // kept — seam shared with viewport propagation

  // Reference Window Placement Interaction — gesture lifecycle
  beginMove(refId, docId)                   // captures start geometry
  moveTo(refId, docId, dx, dy)              // preview: unclamped, no dirty
  endMove(refId, docId, viewport)           // clamp + markDirty once
  beginResize(refId, docId)
  resizeTo(refId, docId, dW, dH, viewport)  // aspect-locked live clamp, no dirty
  endResize(refId, docId)                   // markDirty once
}
```

### Behind the seam (becomes internal)

- All four placement pure functions — after this change only `references.svelte.ts` imports `reference-window-placement.ts`.
- Cascade Index math, z-order math, gesture start-geometry bookkeeping (today's `dragOrigin`/`resizeOrigin` in the Window).
- `display(placement)` and `show()` go private (`show`'s reveal semantics stay inside `openCentered`/`toggleDisplay`).

### Components thin out

- `ReferenceWindow`: render + pointer capture + delta emission only. Its `commitResize` import disappears; resize emits raw `(dW, dH)` deltas.
- `ReferenceWindowOverlay`: `commitPosition` deleted; events bind directly to store verbs; `onActivate` becomes `bringToFront` (idempotence moves into the store). The pinned contract "renders the stored placement geometry verbatim" is preserved and strengthened.

### Behavior

- **Preserved**: move previews unclamped and snap inside the viewport at release; resizes clamp live with aspect locked. The asymmetry becomes a documented decision inside one module.
- **Intentionally changed**: `markDirty` fires once per completed gesture instead of per pointer move. Closes the invariant-violating persistence hole; a mid-drag flush now saves the pre-gesture state. Update affected tests deliberately.

### Naming

- `DisplayState` → `ReferenceWindowState` (type, methods, e.g. `displayStatesForDoc` → `windowStatesForDoc`), aligning code with the CONTEXT.md term.

### Test migration

- Clamp-on-release / no-write-when-fits / drag-time resize clamp tests move from Overlay component tests (synthetic pointer events) to `References` interface tests.
- `reference-window-placement.test.ts` (18 tests) survives as an internal-seam suite.
- Existing `References` setter tests convert to gesture/intent verbs; dirty-per-gesture is pinned by new tests.
- Overlay render-verbatim and wiring tests survive.

### Out of scope

- `refitAll` trigger ownership (viewport-size propagation — architecture report candidate 3).
- Splitting gallery intake and window lifecycle into separate modules (rejected: single seam, Drop Batch spans both).
- Unifying move/resize preview clamping UX (deliberately preserved; revisit as a product decision if desired).

## Decisions (architecture grilling, 2026-06-10)

| Branch | Decision |
|---|---|
| Module scope | Deepen `References` in place — single seam |
| Gesture ownership | Store owns begin → preview → end; Window emits deltas |
| Preview UX | Preserve current asymmetry |
| Dirty timing | Once per gesture (intentional behavior change) |
| Naming | `ReferenceWindowState` rename included; CONTEXT.md terms added |

## Results

| File | Description |
|------|-------------|
| `src/lib/reference-images/references.svelte.ts` | Added the Reference Window Placement Interaction verbs (`beginMove`/`moveTo`/`endMove`, `beginResize`/`resizeTo`/`endResize`) and idempotent `bringToFront`. `display`/`show` went private (`#createWindow`/`#reveal`); `setDisplayPosition`/`setDisplaySize` removed. Dirty marking fires once per completed gesture, and no-op gestures skip it. |
| `src/lib/reference-images/reference-window-state-types.ts` | Renamed from `display-state-types.ts`; `DisplayState` → `ReferenceWindowState` with a contract doc comment. |
| `src/lib/reference-images/ReferenceWindow.svelte` | Thinned to render + pointer capture + raw delta emission (`onMoveStart/Delta/End`, `onResizeStart/Delta/End`). Dropped the `commitResize` import and the viewport props. |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte` | Deleted `commitPosition`; events bind directly to store verbs; `onActivate` → `bringToFront`. |
| `src/lib/canvas/workspace-snapshot.ts`, `src/lib/canvas/editor-session/workspace.svelte.ts`, `src/lib/session/session-persistence.ts` | Runtime type/method renames only; the persisted `displayStates` storage key and `DisplayStateRecord` stay for format compatibility (documented in `workspace-snapshot.ts`). |
| `src/lib/reference-images/references.svelte.test.ts` | Gesture-lifecycle interface tests (unclamped preview, end-clamp + single dirty, no-op gestures skip dirty, `bringToFront` idempotence). Setups converted to `restoredWindowStates` seeding via `windowState`/`storeWithWindows` helpers. |
| `src/lib/reference-images/ReferenceWindow.svelte.test.ts`, `ReferenceWindowOverlay.svelte.test.ts` | Window tests assert raw delta emission; clamp/snap-back/resize policy assertions moved to final store state through the gesture path (`seedStore` helper). |
| `docs/platform-status.md` | "Move + resize" Notes overwritten with the per-gesture dirty semantics and single-gesture constraint. |

### Key Decisions

- The store owns the begin → preview → end gesture lifecycle; the window component emits raw pointer deltas only — start geometry, clamping, and persistence are all behind the `References` seam.
- Preview UX asymmetry preserved (move follows unclamped and snaps at release; resize live-clamps aspect-locked), now a documented decision inside one module.
- `markDirty` once per completed gesture (intentional change): a mid-gesture session flush now persists the pre-gesture state instead of an unclamped intermediate one.
- Rename limited to the runtime model/interface; persisted schema keys unchanged — no storage migration.

### Notes

- Behavior divergence to evaluate on touch hardware: the store holds a single active gesture, so two windows can no longer be dragged simultaneously with two fingers (previously possible because drag origins were component-local). If two-handed iPad use matters, a follow-up can key gestures by `(refId, docId)`.
- Verified: unit suite 1361 passed, `svelte-check` 0 errors, production build OK, reference-images E2E 6/6 (drag + IndexedDB persistence round-trip).
- This deepening implements architecture-review candidate 1 (2026-06-10); CONTEXT.md terms **Reference Window State** and **Reference Window Placement Interaction** were added in the planning commit (`87fe68f`).
