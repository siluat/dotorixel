---
title: Consolidate modal/overlay behavior into deep modules
status: done
created: 2026-04-09
---

## Problem

Modal and overlay behavior is duplicated across 5 components with no shared abstraction:

- **Scroll lock** (`body.style.overflow` save/restore): implemented independently in `SaveDialog` and `SavedWorkBrowser`
- **Focus trapping** (Tab/Shift+Tab cycling within focusable elements): near-identical `trapFocus()` in `SaveDialog` and `SavedWorkCardGrid`
- **ESC handling**: three divergent approaches — `svelte:window onkeydown` (SaveDialog, SavedWorkBrowser), `stopPropagation` (SavedWorkCardGrid), vaul-svelte built-in (bottom sheets)
- **Close animation delay**: identical `drawerOpen` dual-state + 500ms `setTimeout` pattern in `ExportBottomSheet` and `SavedWorkBrowserSheet`

This duplication creates several risks:

- An accessibility bug (e.g., scroll lock not restoring on edge-case unmount) must be fixed in multiple places
- No test coverage for any of these behaviors (UI test coverage is 7%)
- Nested modals (SavedWorkBrowser > delete confirmation) use ad-hoc coordination (`handleEscape()` ref binding) with no explicit contract
- `ExportBottomSheet` is missing timeout cleanup on rapid open/close — a latent bug that `SavedWorkBrowserSheet` handles correctly

## Proposed Interface

Two factory functions, separated because dialog and bottom sheet share almost no implementation:

### `createModal(options): ModalBehavior`

For center dialogs and fullscreen modals. Provides scroll lock, focus trapping, ESC handling, and backdrop close in a single call.

```typescript
interface ModalOptions {
  onClose: () => void;
  scrollLock?: boolean;   // default: true
  focusTrap?: boolean;    // default: true
  escapeGuard?: () => boolean;  // nested modal intercept
}

interface ModalBehavior {
  containerEl: HTMLElement | undefined;
  handleKeyDown: (event: KeyboardEvent) => void;
  handleBackdropClick: () => void;
}
```

Usage (SaveDialog):

```svelte
const modal = createModal({ onClose: onCancel });
```

```svelte
<svelte:window onkeydown={modal.handleKeyDown} />
<div class="backdrop" onmousedown={modal.handleBackdropClick}>
  <div bind:this={modal.containerEl} role="dialog" aria-modal="true">
```

Usage (SavedWorkBrowser with nested escape guard):

```svelte
const modal = createModal({
  onClose,
  escapeGuard: () => cardGrid?.handleEscape() ?? false
});
```

### `createDrawerState(options): DrawerState`

For vaul-svelte bottom sheets. Manages the `drawerOpen` vs parent `open` desynchronization and close animation delay.

```typescript
interface DrawerStateOptions {
  open: () => boolean;
  onClose: () => void;
  onReset?: () => void;
  animationMs?: number;  // default: 500
}

interface DrawerState {
  readonly drawerOpen: boolean;
  handleOpenChange: (isOpen: boolean) => void;
}
```

Usage (ExportBottomSheet):

```svelte
const drawer = createDrawerState({
  open: () => open,
  onClose: () => onOpenChange(false),
  onReset: () => { selectedFormatId = availableFormats[0].id; filenameStem = ''; }
});
```

```svelte
<Drawer.Root open={drawer.drawerOpen} onOpenChange={drawer.handleOpenChange}>
```

### `trapFocus(event, container)` utility

Exported separately for components that need focus trapping without the full modal behavior (e.g., nested delete confirmation dialog in `SavedWorkCardGrid`).

```typescript
function trapFocus(event: KeyboardEvent, container: HTMLElement): void;
```

## Commits

### Phase 1: Bottom sheet drawer state

**Commit 1: Add `createDrawerState` utility with tests**

Create `$lib/ui/drawer-state.svelte.ts` with the `createDrawerState` factory function. The function manages:

- Reactive `drawerOpen` state that syncs immediately on open
- Delayed close with configurable `animationMs` (default 500ms)
- Timeout cleanup on rapid open/close cycles and on teardown (`$effect` cleanup)
- `onReset` callback invoked after the close delay completes
- `onClose` callback invoked after the close delay completes

Create `$lib/ui/drawer-state.svelte.test.ts` with tests covering:

- `drawerOpen` becomes true immediately when `open()` returns true
- `drawerOpen` remains true during close delay, becomes false after delay
- `onClose` fires after the delay, not immediately
- `onReset` fires after the delay alongside `onClose`
- Rapid open→close→open clears the pending close timeout
- Opening while a close is pending cancels the close

**Commit 2: Migrate `ExportBottomSheet` to `createDrawerState`**

Replace the manual `drawerOpen` state, `$effect`, `CLOSE_ANIMATION_MS` constant, and `handleOpenChange` function with a single `createDrawerState` call. Pass the form reset logic (`selectedFormatId` and `filenameStem` reset) as the `onReset` callback. Remove the duplicated reset from the `$effect` block. This also fixes the missing timeout cleanup bug.

**Commit 3: Migrate `SavedWorkBrowserSheet` to `createDrawerState`**

Replace the manual `drawerOpen` state, `$effect`, `CLOSE_ANIMATION_MS` constant, `pendingClose` tracking, and `handleOpenChange` function with a single `createDrawerState` call. No `onReset` needed — this component has no form state to reset.

### Phase 2: Modal behavior

**Commit 4: Add `trapFocus` utility with tests**

Create `$lib/ui/trap-focus.ts` with the `trapFocus(event, container)` function extracted from the duplicated implementations. This is a pure function that:

- Queries focusable elements within the container (`input, button:not([disabled]), [tabindex]:not([tabindex="-1"])`)
- Prevents default Tab behavior
- Cycles focus forward on Tab, backward on Shift+Tab
- Wraps around at both ends
- No-ops when no focusable elements exist

Create `$lib/ui/trap-focus.test.ts` with tests covering:

- Tab cycles forward through focusable elements
- Shift+Tab cycles backward
- Wraps from last to first (and vice versa)
- No-ops on empty container

**Commit 5: Add `createModal` utility with tests**

Create `$lib/ui/modal.svelte.ts` with the `createModal` factory function. The function provides:

- `containerEl`: a `$state` binding for the modal container element
- `handleKeyDown`: handles ESC (calls `escapeGuard` first if provided, then `onClose`) and Tab (delegates to `trapFocus` using `containerEl`)
- `handleBackdropClick`: calls `onClose`
- Scroll lock: an `$effect` that saves `body.style.overflow` and sets it to `'hidden'` while the component is mounted, restoring on cleanup. Controllable via `scrollLock` option.
- Focus trap controllable via `focusTrap` option — when disabled, Tab key events pass through.

Create `$lib/ui/modal.svelte.test.ts` with tests covering:

- ESC calls `onClose`
- ESC calls `escapeGuard` first; if it returns true, `onClose` is not called
- Tab delegates to `trapFocus` when `containerEl` is set and `focusTrap` is true
- Tab passes through when `focusTrap` is false
- Backdrop click calls `onClose`
- Scroll lock sets `body.style.overflow` to `'hidden'` and restores on cleanup
- Scroll lock disabled when `scrollLock` is false

**Commit 6: Migrate `SaveDialog` to `createModal`**

Replace the `onMount` scroll lock block, `trapFocus` function, `handleKeyDown` function, and `focusAndSelect` action with `createModal({ onClose: onCancel })`. Keep the Enter-to-save logic as a simple conditional inside `modal.handleKeyDown` wrapper, or as a separate inline handler that delegates ESC/Tab to `modal.handleKeyDown`. Remove the `dialogEl` state — replaced by `modal.containerEl`.

**Commit 7: Migrate `SavedWorkBrowser` to `createModal`**

Replace the `onMount` scroll lock block, `handleKeyDown` function, and `modalEl` state with `createModal({ onClose, escapeGuard: () => cardGrid?.handleEscape() ?? false })`. The `escapeGuard` directly replaces the current `if (cardGrid?.handleEscape()) return` pattern. Remove `modalEl` — replaced by `modal.containerEl`.

**Commit 8: Migrate `SavedWorkCardGrid` to use shared `trapFocus`**

Replace the local `trapFocus` function with an import from `$lib/ui/trap-focus`. The `handleDeleteDialogKeyDown` function remains in the component (it handles ESC with `stopPropagation` + dismiss, and delegates Tab to the shared `trapFocus`). This is a minimal change — only the function definition moves.

## Decision Document

- **Two separate modules, not one**: `createModal` and `createDrawerState` are separate because dialog behavior (scroll lock, focus trap, ESC, backdrop) and drawer behavior (animation delay, state sync) share almost no implementation. Forcing them into a single API would create a leaky abstraction requiring callers to know which options to disable.
- **Module location**: `$lib/ui/` — modal behavior is a general UI concern, not editor-specific. This supports reuse in other pages (e.g., landing page) and separates `.svelte.ts` utilities from `.svelte` components in `$lib/ui-editor/`.
- **Scroll lock strategy**: Save/restore pattern (each instance saves `body.style.overflow` on mount, restores on cleanup). No reference counting. This works because the app never has independently-stacked modals — nesting is always parent-child with LIFO mount/unmount order.
- **Focus trap approach**: `containerEl` binding with `handleKeyDown` on `svelte:window`, not a Svelte action. This matches the existing code pattern, keeps ESC and Tab handling unified in one handler, and avoids the action approach's limitation of requiring DOM focus on the node to receive events.
- **Nested ESC via `escapeGuard`**: The parent modal's `createModal` receives an `escapeGuard` callback that asks the child ("do you have something to handle?"). This mirrors the current `cardGrid?.handleEscape()` pattern. The alternative (independent `createModal` instances with `svelte:window` listener stacking) was rejected due to execution order fragility.
- **`trapFocus` exported separately**: A standalone utility function, not part of `createModal`'s public API. This serves `SavedWorkCardGrid`'s delete confirmation dialog, which needs focus trapping but is not a full modal (no scroll lock, no backdrop, ESC handled by parent's `escapeGuard`).
- **`onReset` timing**: Always fires after the close delay, never immediately. This prevents form content from visually resetting during the slide-down animation. Both code paths (parent-initiated close and user-swipe close) behave identically.
- **CSS duplication**: Out of scope. The two bottom sheets share nearly identical overlay/content/animation CSS, but this is a maintenance concern, not a bug risk. Address in a separate task if desired.

## Testing Decisions

- **Utility unit tests only** — no component integration tests for migrated consumers. The refactoring moves behavior into testable utilities; verifying that components call the utility correctly is testing implementation, not behavior. Wiring mistakes (e.g., forgetting to bind `containerEl`) are immediately visible in manual testing (ESC doesn't work, focus doesn't trap).
- **Good tests for these modules**: assert on observable outcomes (was `onClose` called? did `body.style.overflow` change? did focus move to the next element?) rather than internal state. Tests should survive internal refactors of the utility.
- **Test environment**: Vitest with `happy-dom`, matching the project's existing test setup. `createDrawerState` tests use `vi.useFakeTimers()` to control setTimeout. `createModal` and `trapFocus` tests create real DOM elements for focus/keyboard assertions.
- **Prior art**: `editor-state.svelte.test.ts` and `tool-runner.svelte.test.ts` for testing Svelte 5 rune-based utilities. `AppBar.svelte.test.ts` for `@testing-library/svelte` patterns.

## Out of Scope

- **CSS deduplication** for bottom sheet overlay/content/animation styles — address separately if desired
- **Component-level integration tests** for migrated consumers
- **Refactoring `SavedWorkCardGrid`'s delete confirmation into a separate component** — it remains an internal concern of `SavedWorkCardGrid`
- **Adding new modal types or patterns** — this refactoring consolidates existing behavior, it does not add new capabilities
- **Keyboard handling in `+page.svelte`** — the page-level modal-open keyboard suppression (`if (saveDialogTabIndex !== null) return`) is a separate concern from the modal behavior modules

## Results

| File | Description |
|------|-------------|
| `src/lib/ui/BottomSheet.svelte` | Custom bottom sheet component replacing vaul-svelte |
| `src/lib/ui/modal.svelte.ts` | createModal utility for dialog scroll lock, focus trap, ESC, backdrop |
| `src/lib/ui/modal.svelte.test.ts` | 9 tests for createModal |
| `src/lib/ui/trap-focus.ts` | Shared focus trapping utility |
| `src/lib/ui/trap-focus.test.ts` | 7 tests for trapFocus |
| `src/lib/ui-editor/ExportBottomSheet.svelte` | Migrated to BottomSheet |
| `src/lib/ui-editor/SavedWorkBrowserSheet.svelte` | Migrated to BottomSheet |
| `src/lib/ui-editor/SaveDialog.svelte` | Migrated to createModal |
| `src/lib/ui-editor/SavedWorkBrowser.svelte` | Migrated to createModal |
| `src/lib/ui-editor/SavedWorkCardGrid.svelte` | Migrated to shared trapFocus |

### Key Decisions

- Replaced vaul-svelte entirely with a custom BottomSheet component. vaul-svelte 0.3.2 (Svelte 4) required a 500ms close delay workaround due to bits-ui DOM timing issues. The 1.0.0-next.7 prerelease had missing dependency declarations and test compatibility issues. Direct implementation with CSS transitions + pointer events resolved all animation and rapid open/close issues.
- createDrawerState was created then removed. The delay-based state sync it provided was a workaround for vaul-svelte's limitations, not a genuine architectural need.

### Notes

- The BottomSheet component uses vaul's tuned animation values: `cubic-bezier(0.32, 0.72, 0, 1)` easing, 500ms duration, 0.4 velocity threshold for swipe-to-close.
- Upward drag dampening was omitted for simplicity — the sheet only allows downward drag. Can be added later if needed.

