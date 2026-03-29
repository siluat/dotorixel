# Touch & Mobile Analysis

> Investigation date: 2026-03-29
> Scope: Web shell only (native shell deferred)
> Primary UI: Pebble editor
> Codebase snapshot: commit 83769df

This document captures the results of a systematic analysis of touch and mobile device support in the DOTORIXEL web editor. It is a **read-only snapshot** — implementation details discovered during task work go into each task's record file. If findings here prove incorrect, append an Addendum rather than rewriting.

## Issues Identified

### HIGH — Issue 1: Multi-touch pinch zoom not working

**Root cause:** `wheel-input.ts` classifies pinch-zoom via `ctrlKey` (line 9: `if (ctrlKey) return 'pinchZoom'`). This works for trackpad pinch gestures, which browsers synthesize as `Ctrl+wheel` events. However, actual touch-screen pinch fires as separate Pointer Events (two `pointerdown` events with different `pointerId`s), not wheel events. There is no code path to handle multi-pointer gestures.

**Affected files:**
- `src/lib/canvas/PixelCanvasView.svelte` — pointer handlers (lines 131–153)
- `src/lib/canvas/wheel-input.ts` — wheel classification (line 9)

**Current behavior:** `touch-action: none` (line 222 in PixelCanvasView) prevents browser default pinch-zoom, but no custom pinch gesture is implemented. The user cannot zoom on touch devices.

**Fix strategy:** Track active pointers in `PixelCanvasView.svelte`. When two pointers are active, calculate inter-pointer distance delta for zoom and midpoint delta for pan. Use existing `WasmViewport.compute_pinch_zoom()` and `viewport.pan()` for the actual transforms.

---

### HIGH — Issue 2: No panning without physical keyboard

**Root cause:** Panning is triggered only by middle mouse button (`event.button === 1`, line 134) or Space+left-click (lines 145–147 in `PixelCanvasView.svelte`). Neither method is available on touch devices without a physical keyboard or mouse.

**Affected files:**
- `src/lib/canvas/PixelCanvasView.svelte` — `handlePointerDown` (lines 131–153)
- `src/lib/canvas/editor-state.svelte.ts` — Space key tracking (lines 353–359)

**Current behavior:** On a touch-only device, the user has no way to pan the canvas. If the canvas is zoomed in, there is no way to navigate to off-screen areas.

**Fix strategy:** Two-finger drag should pan (part of the multi-touch gesture system from Issue 1). Single-finger panning could also be supported via a dedicated "pan mode" toggle button in the toolbar.

---

### HIGH — Issue 3: Layout broken on small screens

**Root cause:** Zero CSS `@media` queries in the entire codebase. The Pebble editor uses absolute positioning with fixed gaps (`--pebble-edge-gap: 16px`). The Pixel editor uses a 3-column CSS grid (`grid-template-columns: auto auto auto`). Neither adapts to viewport size.

**Affected files:**
- `src/routes/pebble/+page.svelte` — absolute positioning layout (lines 133–159)
- `src/routes/pixel/+page.svelte` — 3-column grid layout
- `src/lib/ui-pebble/pebble-tokens.css` — `--pebble-edge-gap: 16px`

**Current behavior:** On a 320–430px wide screen (iPhone), floating panels overlap each other and cover the canvas. The bottom tools panel, color palette, and top controls all compete for the same small viewport.

**Fix strategy:** Add responsive breakpoints. Reorganize panel layout for small screens — likely stack panels vertically with a tab/toggle mechanism, or collapse panels to icons. Pebble editor is the focus; Pixel editor layout can remain desktop-only.

---

### HIGH (mobile) / MEDIUM (tablet) — Issue 4: Touch targets below 44px minimum

**Root cause:** UI components were designed for mouse precision, not finger touch.

**Affected components and sizes:**
- `PebbleButton` — 40x40px (line 37–38 in `PebbleButton.svelte`) — 4px below minimum
- `BevelButton` icon variant — 36x36px
- `PebbleSwatch` small — 22x22px (line 36–39 in `PebbleSwatch.svelte`) — 22px below minimum
- `PebbleSwatch` large — 32x32px (line 41–45) — 12px below minimum
- FgBg swap button — 18–20px

**Current behavior:** Finger taps on small targets frequently hit adjacent elements. Color swatch selection is particularly difficult.

**Fix strategy:** Increase component sizes to meet 44px minimum. For swatches where visual size should stay small, use transparent padding to expand the hit area while keeping the visible swatch compact.

---

### MEDIUM-HIGH — Issue 5: No touch UI for Shift and Alt modifier keys

**Root cause:** Shape constraint (Shift) and temporary eyedropper (Alt) are implemented purely as keyboard modifier detection in `editor-state.svelte.ts`.

**Affected code:**
- Shift handling: lines 361–368 (keydown), lines 412–417 (keyup)
- Alt handling: lines 343–350 (keydown), lines 419–426 (keyup)

**Current behavior:** On touch devices without a physical keyboard, users cannot constrain shapes to squares/circles (Shift) or temporarily switch to eyedropper (Alt). These features are completely inaccessible.

**Fix strategy:** Add toggle buttons in the toolbar for these modifiers. A "constrain" toggle and an eyedropper-mode toggle that mirror the keyboard modifier behavior. This is a Milestone 2 task since it requires UI design decisions.

---

### MEDIUM-HIGH — Issue 6: Safe area not handled

**Root cause:** The viewport meta tag in `app.html` (line 5) uses `width=device-width, initial-scale=1` but does not include `viewport-fit=cover`. No CSS uses `env(safe-area-inset-*)` values.

**Affected files:**
- `src/app.html` — viewport meta tag (line 5)
- `src/routes/pebble/+page.svelte` — bottom panel positioning uses fixed `--pebble-edge-gap: 16px`

**Current behavior:** On iPhones with notch/Dynamic Island, content may be clipped. The bottom tools panel (positioned at `bottom: 16px`) may overlap with the home indicator.

**Fix strategy:** Add `viewport-fit=cover` to the meta tag. Use `env(safe-area-inset-*)` in panel positioning, particularly for bottom panels: `bottom: max(var(--pebble-edge-gap), env(safe-area-inset-bottom))`.

---

### MEDIUM-HIGH — Issue 7: Virtual keyboard pushes layout

**Root cause:** Number input fields (canvas width/height) and hex color input lack `inputmode` attributes. No `inputmode` attributes exist anywhere in the codebase. When the virtual keyboard appears, the viewport resizes and can push fixed/absolute positioned elements.

**Affected interactions:**
- Canvas size inputs in `TopControlsRight.svelte` (Pebble) / `CanvasSettings.svelte` (Pixel)
- Hex color input in `HsvPicker.svelte`

**Current behavior:** Tapping an input field opens the full alphabetic keyboard instead of a numeric keypad. The viewport resize may cause layout shifts with absolutely positioned panels.

**Fix strategy:** Add `inputmode="numeric"` to dimension inputs and `inputmode="text"` (with `pattern`) to hex inputs. Consider using `visualViewport` API to detect keyboard presence and adjust layout.

---

### LOW — Issue 8: iOS Safari export behavior

**Root cause:** PNG export in `export.ts` (lines 11–24) uses `document.createElement('a')` + programmatic `click()` with a Blob URL. On iOS Safari, this pattern may open the image in a new tab instead of triggering a download.

**Affected file:** `src/lib/canvas/export.ts` — `exportAsPng` function

**Fix strategy:** Detect iOS Safari and use `navigator.share()` API as an alternative when available, or fall back to opening the blob URL with instructions to long-press and save.

---

### LOW — Issue 9: Number inputs lack inputmode

Merged with Issue 7 above. The `inputmode` attribute fix is trivial and addresses both the keyboard type and the virtual keyboard UX.

---

## Task Decomposition

10 issues grouped into 7 implementation tasks:

| Task | Issues | Milestone | Grouping rationale |
|------|--------|-----------|-------------------|
| T1: Touch pinch-zoom and two-finger pan | 1, 2 | M1 | Same code path (PixelCanvasView pointer handlers), same gesture system |
| T2: Responsive layout for small screens | 3, part of 4 (panel overlap) | M1 | Both are "layout doesn't work on small screens" — media queries + panel reorganization |
| T3: Touch target sizing — 44px minimum | 4 | M1 | CSS-focused, independent of other changes |
| T4: Touch modifier alternatives | 5 | M2 | Requires UI design decisions, builds on touch infrastructure from T1 |
| T5: Safe area + virtual keyboard handling | 6, 7 | M1 | Both are mobile browser chrome interacting with layout |
| T6: iOS Safari export fix | 8 | M1 | Isolated change in export.ts |
| T7: Number input mobile optimization | 9 (merged with 7) | M1 | Trivial fix |

### Execution order

```text
T7 → T3 → T1 → T5 → T2 → T6 → T4
```

Rationale: T7 and T3 are quick wins with immediate impact. T1 is the highest-impact core change. T5 establishes safe area foundations before T2's large layout rework. T6 is independent and low priority. T4 is a Milestone 2 item.

## Shared Design Decisions

These decisions apply across multiple tasks and should be referenced during implementation:

- **Pointer Events API throughout** — Already migrated in task 012. Continue using Pointer Events, not Touch Events, for multi-touch gesture detection (track multiple `pointerId`s).
- **`touch-action: none` stays on canvas** — The canvas already prevents default browser touch handling. Custom gestures must fully replace it.
- **Pebble editor is the primary target** — Pixel editor can remain desktop-only for now. Responsive and touch improvements focus on the Pebble layout.
- **Breakpoint strategy** — Specific values to be determined during T2 planning. Expected split: mobile (<640px), tablet (640–1024px), desktop (>1024px).
- **CSS custom properties for responsive values** — Leverage existing token system (`pebble-tokens.css`) rather than hardcoding media query values.

## Relationship to Existing Items

- **M2 "iPad + Apple Pencil optimization (hover preview, palm rejection)"** — Renamed to **"Apple Pencil: hover preview + palm rejection"** to disambiguate from general touch support. That item covers Apple-specific APIs (hover detection, palm rejection); the tasks here cover general touch/mobile support that works across all devices.
- **Deferred "Responsive layout — extract SwiftUI size class transitions, adapt to web CSS breakpoints"** — Superseded by T2. The original item was tied to the Dual Shell PoC (native + web comparison). Since native development is deferred, T2 addresses responsive layout independently for the web shell.
