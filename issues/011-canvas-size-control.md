---
title: Extract CanvasSizeControl component to eliminate RightPanel/SettingsContent duplication
status: done
created: 2026-04-06
---

## Problem

RightPanel (desktop docked panel) and SettingsContent (mobile tab panel) independently implement the same canvas-size editing concept — ~120 lines of duplicated logic across script and template:

- **WASM constants**: `CANVAS_PRESETS`, `MIN_DIMENSION`, `MAX_DIMENSION` (loaded from `WasmPixelCanvas`)
- **Local input state**: `inputWidth`, `inputHeight`, `showValidation` (`$state` runes)
- **Sync effect**: resets local inputs when `canvasWidth`/`canvasHeight` props change
- **Validation**: `isValidDimension()` via `WasmPixelCanvas.is_valid_dimension()`
- **Derived state**: `isWidthValid`, `isHeightValid`
- **Commit handlers**: `handleResizeCommit()` (validate, suppress no-op), `handleKeyDown()` (Enter to commit)
- **UI elements**: preset buttons, width/height inputs, ValidationAlert, AnchorSelector

The duplication means a validation rule change or commit-logic bug fix must be applied in two places. The two components also have slightly different validation approaches (SettingsContent lacks a clear button in the size section; a third caller, TopControlsRight, skips validation entirely), creating inconsistency risk.

### Visual differences between callers

| Aspect | RightPanel (desktop) | SettingsContent (mobile) |
|--------|---------------------|-------------------------|
| Preset label | `{size}` | `{size} x {size}` |
| Input labels | None | W / H `<label>` elements |
| Input height | 28px | 44px |
| Border radius | 4px | 8px |
| Clear button | Inside canvas section | Separate Actions section |

These differences are **layout density variants**, not independent dimensions — they always appear as a fixed bundle ("compact desktop" or "spacious touch").

## Proposed Interface

A single `CanvasSizeControl` component with a `variant` prop:

```typescript
interface Props {
  canvasWidth: number;
  canvasHeight: number;
  resizeAnchor: ResizeAnchor;
  onResize: (width: number, height: number) => void;
  onAnchorChange: (anchor: ResizeAnchor) => void;
  variant?: 'compact' | 'touch'; // default: 'compact'
}
```

### Usage

```svelte
<!-- RightPanel (desktop) — default variant, zero config -->
<section class="panel-section">
  <h3 class="section-title">{m.section_canvas()}</h3>
  <CanvasSizeControl
    {canvasWidth} {canvasHeight} {resizeAnchor}
    {onResize} {onAnchorChange}
  />
  <button class="clear-btn" onclick={onClear}>{m.action_clearCanvas()}</button>
</section>

<!-- SettingsContent (mobile) — only adds variant="touch" -->
<section class="section">
  <h3 class="section-title">{m.canvas_size()}</h3>
  <CanvasSizeControl
    {canvasWidth} {canvasHeight} {resizeAnchor}
    {onResize} {onAnchorChange} variant="touch"
  />
</section>
```

### What the component hides internally

| Concern | Hidden |
|---------|--------|
| WASM coupling | `WasmPixelCanvas` presets, min/max dimension, `is_valid_dimension()` |
| Local input state | `inputWidth`, `inputHeight` draft runes and sync effect |
| Validation | `isValidDimension()`, derived validity flags, `showValidation` lifecycle |
| Commit semantics | Validate-then-resize guard, suppress no-op resizes |
| Keyboard handling | Enter-to-commit, blur-to-commit |
| Variant styling | Input size, labels, border radius, preset format — all resolved by `variant` |
| Sub-component wiring | ValidationAlert visibility/message, AnchorSelector pass-through |
| i18n | `canvas_width`, `canvas_height`, `validation_dimensionRange` messages |

### Design decisions

- **Section title stays outside.** RightPanel uses `section_canvas()`, SettingsContent uses `canvas_size()`. The heading is a layout concern, not a size-control concern.
- **Clear button stays outside.** RightPanel places it inside the canvas section; SettingsContent places it in a separate Actions section. This asymmetry confirms it belongs to the caller, not the shared component.
- **`variant` instead of boolean props.** The visual differences are a fixed bundle, not independent axes. A `variant` union prevents impossible combinations and keeps the interface minimal.

## Commits

### 1. Create CanvasSizeControl component with both variants

Add a new Svelte component that contains all canvas-size editing logic and variant-specific rendering. This commit adds the file but does not wire it into any caller — the codebase continues to work exactly as before.

Script section:
- Import `WasmPixelCanvas` and compute `CANVAS_PRESETS`, `MIN_DIMENSION`, `MAX_DIMENSION` at module scope
- Define the Props interface: `canvasWidth`, `canvasHeight`, `resizeAnchor`, `onResize`, `onAnchorChange`, `variant?`
- Declare local `$state` runes for `inputWidth`, `inputHeight`, `showValidation`
- Add a `$effect` that syncs local inputs when `canvasWidth`/`canvasHeight` props change
- Define `isValidDimension()` (delegating to WASM), derived `isWidthValid`/`isHeightValid`
- Define `handleResizeCommit()` (validate, suppress no-op, call onResize) and `handleKeyDown()` (Enter to commit)

Template section:
- Preset buttons row — `variant === 'touch'` renders `{size} × {size}`, compact renders `{size}`
- Size inputs row — touch variant wraps each input with a `<label>` (W / H); compact has bare inputs
- Conditional `ValidationAlert` when `showValidation` is true
- `AnchorSelector` with `selected` and `onSelect` passthrough

Style section:
- Scoped CSS for both variants — touch uses 44px height, 8px radius; compact uses 28px height, 4px radius
- Use a wrapper class (e.g., `.canvas-size-control` with an optional `.touch` modifier) to scope variant differences
- Reuse existing design tokens (`--ds-*`) consistent with the editor design system

### 2. Add Storybook stories for CanvasSizeControl

Add a story file co-located with the component, following the existing project pattern (Svelte CSF v5 with `defineMeta`, no explicit title). Include:
- "Compact" story — default variant, 200px wide container (mimics RightPanel sidebar)
- "Touch" story — `variant="touch"`, 390px wide container (mimics mobile settings tab)
- "CompactActivePreset" story — with `canvasWidth` and `canvasHeight` matching a preset value, to verify the active state renders
- Verify visual parity with the canvas sections in existing RightPanel and SettingsContent stories

### 3. Add component mounting tests for CanvasSizeControl

This is the first Svelte component mounting test in the project. Use Svelte 5's `mount`/`unmount` from `'svelte'` with happy-dom (no new dependencies needed). Establish a reusable test pattern.

Test cases for the compact variant (default):
- Clicking a preset button calls `onResize` with `(size, size)`
- Typing a new width, then blurring the input, calls `onResize` with the new dimensions
- Pressing Enter in the input calls `onResize` with the new dimensions
- Committing unchanged dimensions does not call `onResize` (no-op suppression)
- Typing an invalid dimension (0, negative, > max), then blurring, shows a validation alert and does not call `onResize`
- After showing validation, if `canvasWidth`/`canvasHeight` props change externally, the validation alert disappears and inputs reset
- Clicking an anchor cell calls `onAnchorChange` with the selected anchor

Test cases for variant differences:
- Compact variant does not render W/H labels
- Touch variant renders W/H labels

### 4. Migrate RightPanel to use CanvasSizeControl

Remove duplicated canvas-size logic from RightPanel and replace with the new component.

Script changes:
- Remove `WasmPixelCanvas` import (no longer needed — color section doesn't use it)
- Remove `CANVAS_PRESETS`, `MIN_DIMENSION`, `MAX_DIMENSION` constants
- Remove `inputWidth`, `inputHeight`, `showValidation` state declarations
- Remove the sync `$effect` for canvas dimensions
- Remove `isValidDimension()`, `isWidthValid`, `isHeightValid`
- Remove `handleResizeCommit()`, `handleKeyDown()`
- Remove `ValidationAlert` and `AnchorSelector` imports (now internal to CanvasSizeControl)
- Add `CanvasSizeControl` import

Template changes:
- Replace the canvas section content (preset row, size inputs, validation alert, anchor selector) with a single `<CanvasSizeControl>` invocation using the default (compact) variant
- Keep the section heading (`<h3>`) and clear button outside the component

Style changes:
- Remove CSS rules for `.preset-row`, `.preset-btn`, `.size-row`, `.size-input`, `.size-input--error`, `.size-x` — these now live inside CanvasSizeControl
- Keep `.clear-btn` styles since the clear button remains in RightPanel

Props interface is unchanged — RightPanel still receives the same props from `+page.svelte` and passes them through.

Verify: existing RightPanel Storybook stories render identically.

### 5. Migrate SettingsContent to use CanvasSizeControl

Remove duplicated canvas-size logic from SettingsContent and replace with the new component.

Script changes (same pattern as RightPanel):
- Remove `WasmPixelCanvas` import, constants, state, effect, validation, handlers
- Remove `ValidationAlert` and `AnchorSelector` imports
- Add `CanvasSizeControl` import

Template changes:
- Replace the "Canvas Size" section content with `<CanvasSizeControl ... variant="touch" />`
- Keep the section heading outside
- Keep the "Actions" section (export, clear) and "Display" section (grid toggle) unchanged

Style changes:
- Remove CSS rules for `.preset-grid`, `.preset-btn`, `.size-row`, `.size-field`, `.size-label`, `.size-input`, `.size-input--error`, `.size-x`

Props interface is unchanged — SettingsContent still receives the same props from `+page.svelte`.

Verify: existing SettingsContent Storybook stories render identically.

## Decision Document

### Component boundary

- **Section titles stay outside.** RightPanel uses `section_canvas()`, SettingsContent uses `canvas_size()` — different i18n keys for the same concept. The heading is a layout concern of the parent, not a canvas-size-control concern.
- **Clear button stays outside.** RightPanel places it in the canvas section; SettingsContent places it in a separate Actions section with an icon. This structural asymmetry means the clear button is a canvas *action*, not part of canvas *size control*.
- **AnchorSelector goes inside.** Both callers render it identically (only CSS differs, handled by AnchorSelector's own responsive media queries). It is semantically part of "how to resize the canvas."

### Variant strategy

- **`variant: 'compact' | 'touch'` (default: `'compact'`).** All visual differences (input height, border radius, labels, preset format) are a fixed bundle — never mixed independently. A discriminated union prevents impossible states and keeps the prop count at 1 instead of 5 booleans.
- **CSS approach**: A wrapper element gets a modifier class (e.g., `.touch`) that scopes all variant-specific rules. No parent CSS overrides or `style:` prop forwarding needed.

### WASM dependency

- The component imports `WasmPixelCanvas` directly. This is the same pattern both callers currently use. The WASM module is guaranteed to be loaded before any editor panel renders (bootstrapped in the SvelteKit layout). No injection or adapter needed.

### Pebble UI exclusion

- TopControlsRight (Pebble UI) also duplicates canvas-size logic but uses a different design system (`--pebble-*` tokens), different validation (simple clamp instead of WASM `is_valid_dimension`), and a different layout (FloatingPanel). Including it would require either a third variant or a more complex abstraction. Out of scope for this refactor.

## Testing Decisions

### What makes a good test for this component

Tests verify **external behavior through the Props/callback boundary**, not internal implementation:
- Correct callback arguments when the user interacts (click preset, commit input, change anchor)
- Correct visual state transitions (validation alert appears/disappears)
- Correct prop synchronization (external dimension changes reset inputs)
- Do NOT test internal state (`inputWidth`, `showValidation` directly) — only their observable effects

### Testing infrastructure

- **`@testing-library/svelte` added as devDependency.** Svelte 5's event delegation prevents bare `mount`/`unmount` from properly simulating user input in happy-dom. `@testing-library/svelte`'s `render` and `fireEvent` handle Svelte 5 internals correctly.
- **`resolve.conditions: ['browser']` added to vitest config.** Required so that Svelte's `mount` resolves to the client bundle instead of the server bundle (which throws `lifecycle_function_unavailable`).
- **Test pattern**: `render` the component, query the DOM with `container.querySelector`, use `fireEvent` for user interactions, assert callback spy arguments and DOM state.
- **Prior art**: While no Svelte component tests existed before, this commit establishes the pattern for future component tests.

### What is tested

- CanvasSizeControl: all behaviors listed in Commit 3
- RightPanel and SettingsContent: not unit-tested (no behavior changed in their remaining code; visual parity verified through existing Storybook stories)

## Out of Scope

- **Pebble UI TopControlsRight** — different design system and validation approach; address separately if needed
- **Extracting a headless resize logic hook** — the component approach is sufficient for two callers; a hook would add abstraction without concrete benefit
- **Changing RightPanel or SettingsContent Props interfaces** — both components continue to receive the same props from `+page.svelte`; this refactor only changes internal implementation
- **Adding tests for RightPanel or SettingsContent** — they remain presentation components; visual verification via Storybook is sufficient
- **Updating `+page.svelte`** — the page component passes the same props as before; no changes needed

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/CanvasSizeControl.svelte` | New component with variant prop (compact/touch) |
| `src/lib/ui-editor/CanvasSizeControl.svelte.test.ts` | 9 component mounting tests (first in project) |
| `src/lib/ui-editor/CanvasSizeControl.stories.svelte` | Storybook stories for both variants |
| `src/lib/ui-editor/RightPanel.svelte` | Migrated to use CanvasSizeControl (−117 lines) |
| `src/lib/ui-editor/SettingsContent.svelte` | Migrated to use CanvasSizeControl variant="touch" (−161 lines) |
| `vitest.config.ts` | Added `resolve.conditions: ['browser']` for Svelte 5 client-side resolution |
| `package.json` | Added `@testing-library/svelte` devDependency |

### Key Decisions
- `@testing-library/svelte` added despite initial plan to use bare `mount`/`unmount` — Svelte 5's event delegation prevents programmatic event dispatch from working correctly in happy-dom without it
- Used `oninput` with `e.target` instead of `bind:value` — more explicit and avoids Svelte 5 binding edge cases in test environments

### Notes
- Pebble UI TopControlsRight has similar duplication but was excluded (different design system and validation)
- The `resolve.conditions: ['browser']` change in vitest.config.ts applies to all tests; existing 417 tests verified unaffected
