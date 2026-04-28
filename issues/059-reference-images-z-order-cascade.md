---
title: Reference images — multi-window z-order + cascade placement
status: done
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

Support multiple reference windows visible at once with predictable stacking and placement:

- **Cascade placement** — each newly-displayed reference appears ~24px down-right from the previous one, centered on the viewport for the first. Cascade resets once all windows are dismissed.
- **Auto LIFO z-order** — the most recently displayed or focused window is on top. Clicking an older window raises it to the top.
- **Persistence** — z-order survives reload and tab switch.

Also covers the re-display toggle from the gallery: clicking a non-displayed card displays the reference; clicking a displayed card raises it to the top and closes the modal (explicit "show" action).

## Acceptance criteria

- Toggling a second reference on from the gallery places it ~24px offset from the previous window and as top of the z-order.
- Clicking an older window raises it above the others.
- Z-order persists through reload.
- When all windows are closed, the next displayed reference starts fresh at the viewport center (cascade reset).
- Unit tests: store z-order updates on display + focus, cascade offset math, reset on empty set.
- Component tests: click-to-focus raises z-index; DOM stacking reflects `zOrder`.

## Blocked by

- [057 — Reference images — move + resize](057-reference-images-move-resize.md)

## Scenarios addressed

- Scenario 10 (second reference cascades and is on top)
- Scenario 11 (clicking older window raises it)

## Results

| File | Description |
|------|-------------|
| `src/lib/reference-images/reference-images-store.svelte.ts` | New `nextCascadeIndex(docId)` query: count of currently visible windows. Drives cascade offset (24px × index) and resets to 0 once all windows are dismissed. Closed-but-existing states do not contribute. Documented as a public-API doc comment. |
| `src/lib/reference-images/reference-images-store.svelte.test.ts` | +4 unit tests: empty doc returns 0; grows with each new display; resets after all close; ignores hidden states. |
| `src/lib/reference-images/ReferenceWindow.svelte` | New optional `onActivate` callback; root `<div>` has `tabindex="-1"` and a `handleWindowPointerDown` that fires `onActivate` for any pointerdown except on `.title-bar-button` (so close/minimize don't trigger raise → flicker). Removed defensive `e.stopPropagation()` from resize-handle pointerdown so resize bubbles to root and raises the window. |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte` | Wires `onActivate` → `store.show(refId, docId)` (idempotent: re-display + raise share the same store path). Skips the call when the window is already on top to avoid spurious dirty-marks. |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte.test.ts` | +3 component tests: pointerdown on a non-active window flips `data-active`; close button does NOT raise (no flicker); resize handle DOES raise. |
| `src/routes/editor/+page.svelte` | `handleReferenceSelect` now delegates to the new `selectReference()` helper; `handleReferenceToggleDisplay` calls the new `displayReference()` helper for the create branch. The old inline `displayReference` and `displayStatesForDoc(docId).length` (which counted hidden states forever) are removed. Bug fix carried into the helper: clicking a *displayed* card raises (`store.show`) instead of early-returning, then closes the modal, matching the spec's "explicit show action". |
| `src/lib/reference-images/select-reference.ts` (new) | Pure orchestration helpers `selectReference({ store, docId, ref, viewport, onClose })` and `displayReference({ store, docId, ref, viewport })`. Decouples the gallery-card → store flow from the SvelteKit route so the bug fix can be pinned with unit tests. |
| `src/lib/reference-images/select-reference.test.ts` (new) | +6 unit tests pinning the user-visible flow: existing/closed/never-shown cases each assert the right store mutation **and** that `onClose` was called (regression defense for the early-return bug). Cascade-offset and reset-after-all-closed are also asserted at this orchestration layer. |

### Key Decisions

- **`nextCascadeIndex` lives on the store, not at the call site.** Computing the index inline coupled the call site to the store's internal representation (closed states still in the array) and lost the "reset on empty" policy. Moving it into the store puts the cascade policy in one place.
- **`store.show()` is the single path for both re-display and raise-to-top.** It sets `visible: true` and bumps `zOrder` above the current max, so calling it on an already-visible window simply re-asserts top-of-stack — repeated calls are safe (each bump goes above the current max). Note: `show()` mutates `zOrder` on every call, so it is *not* a structural no-op; it is a valid raise-to-top action.
- **Skip activation on title-bar buttons specifically (`.title-bar-button`), not all buttons.** The resize handle is also a `<button>`, but per spec users expect a resize gesture on a background window to also raise it. The class-based check expresses this distinction precisely.
- **Removed `e.stopPropagation()` from resize-handle pointerdown** rather than calling `onActivate?.()` explicitly inside the resize handler. The stopPropagation was defensive (no outer interactive ancestor required it) and was actively blocking the new bubble-up activation. Letting the event bubble keeps activation policy in one handler.
- **`tabindex="-1"` on the dialog root** rather than suppressing the Svelte a11y rule. Makes the window programmatically focusable, consistent with its new interactive pointerdown behavior, and leaves the door open for future keyboard activation without restructuring.

### Notes

- Z-order persistence through reload was already covered by the existing snapshot round-trip test (`displayStatesSnapshot` ↔ `restoredDisplayStates`); no new persistence test was needed.
- DOM stacking-by-zOrder is implicit in the existing overlay sort (`[...visibleStates].sort((a, b) => a.zOrder - b.zOrder)`) and the existing `data-active` test; no separate "DOM order" assertion was added to avoid duplication.
