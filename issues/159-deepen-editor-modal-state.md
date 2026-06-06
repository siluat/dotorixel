---
title: "Deepen editor dialog state into a ModalState seam"
status: done
created: 2026-06-06
---

## What to build

Lift the editor route's scattered dialog-visibility flags behind a single `ModalState` module so `+page.svelte` no longer tracks which dialog is open across five separate `$state` variables, and the "at most one dialog open" invariant is enforced by the type system instead of a comment plus a hand-written keyboard guard.

This is the first incision of the larger editor-route god-orchestrator decomposition (architecture review candidate "Tame the editor-route god-orchestrator"); the remaining choreographies — tab-close flow, Reference Layer import — are follow-up.

Scope:

- Keep work web-shell only; no Rust core or Apple changes.
- Preserve existing behavior for all four page-level dialogs (unsaved-close confirmation, saved-work browser, reference gallery, reference-layer replace) across docked and mobile layouts.
- Model the open dialog as a discriminated union so payload (close-target tab index, saved-work documents, in-flight open guard) is inseparable from visibility.
- Leave the export bottom sheet on the active tab (`activeTab.isExportUIOpen`) — it is per-Document, so folding it in would change its lifecycle. Leave import progress and error toasts out — they are non-blocking transient overlays.

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/modal-state.svelte.ts` | New `ModalState` class: discriminated-union `ActiveModal` (`save` / `savedWork` / `references` / `refReplace` / `null`) behind `active` + `isOpen` reads and typed transitions; the saved-work in-flight open guard lives inside the `savedWork` variant. |
| `src/lib/ui-editor/modal-state.svelte.test.ts` | New interface test surface (13 specs): open/close transitions, single-active invariant, saved-work opening guard, per-document removal. |
| `src/routes/editor/+page.svelte` | Replaced five dialog `$state` flags with one `ModalState`; rewired handlers and template; keyboard guard reduced to `if (modal.isOpen) return`. |
| `src/lib/ui-editor/TopBar.svelte` | Renamed prop `isBrowserOpen` → `isSavedWorkOpen` for vocabulary consistency. |

### Key Decisions

- Modeled the active dialog as a discriminated union, not a plain enum plus separate payload state, so illegal states like "save dialog open with no target tab" are unrepresentable — the headline win of the deepening.
- Scoped `ModalState` to the four keyboard-blocking page-level dialogs only. The export sheet stays tab-scoped (per-Document lifecycle); import progress and error toasts stay out (non-blocking, can coexist). This keeps the "at most one open" invariant crisp.
- Held visibility plus payload in `ModalState` but left the tab-close choreography in the route, so this stays decoupled from the larger TabCloseFlow extraction.
- Named the dialog kinds by content and renamed the saved-work `browser` vocabulary (module methods, route handlers, the TopBar prop) to `savedWork` for consistency, leaving the `SavedWorkBrowser` / `ReferenceBrowser` component names unchanged.

### Notes

- This architecture deepening did not originate from a `tasks/todo.md` row, so there is no todo item to remove.
- `docs/platform-status.md` is unchanged because this refactor does not alter cross-platform feature status or user-facing behavior.
- The export bottom sheet remaining outside the keyboard guard (shortcuts still fire while it is open) is preserved as-is; whether to fold it into the guard is deferred as a separate, deliberate decision.
- Verification: `svelte-check` clean, 1345 unit tests pass (13 new), E2E workspace + reference-images suites pass (14).
