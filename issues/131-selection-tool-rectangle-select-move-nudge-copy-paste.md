---
title: "Selection tool — Marquee with move/copy/paste and per-tool clipping"
status: needs-triage
created: 2026-05-28
---

## Problem Statement

Pixel art editing requires moving small regions around — repositioning a sprite's eyes, sliding a wall up by one row, copying a tile to a new spot. Today DOTORIXEL only offers the **Move tool** (shortcut V), which translates the entire active Pixel Layer at once. There is no way to:

- Move only a chosen rectangular region within the same Pixel Layer.
- Cut a region out and paste it somewhere else, or onto another tab.
- Delete a rectangular region's pixels with a single keystroke.
- Nudge a region by 1 px (or 10 px with Shift) using the keyboard.
- Constrain pencil/eraser/fill/shape edits to a chosen rectangular region.

These are foundational pixel-art editing operations. Their absence forces wasteful workflows — drawing pixels back from scratch after a small mistake, splitting work into separate layers just to translate a region, or carefully painting around an area to avoid edges.

The Milestone 2 keyboard-shortcut review reserved **M** for "Selection (Marquee)" (`docs/decisions/keyboard-shortcut-review.md`). This PRD fills that reservation.

## Solution

Introduce a **Selection tool** (shortcut **M**) that defines a rectangular **Marquee** on the active Pixel Layer. The Marquee supports five orthogonal pixel operations:

- **Move**: dragging inside the Marquee lifts the selected pixels into a transient **Floating Selection** buffer, vacates the source region to transparent, and translates the buffer; release commits the buffer back onto the layer in a single undoable step.
- **Delete**: pressing Delete or Backspace while a Marquee is active clears the selected pixels to transparent.
- **Nudge**: pressing arrow keys while a Marquee is active translates the selected pixels by 1 px; Shift+arrow translates by 10 px. The first nudge auto-lifts the region into a Floating Selection; subsequent nudges stack onto the same buffer until it commits.
- **Copy / cut / paste**: Cmd/Ctrl+C copies the Marquee region into a workspace-shared **Selection Clipboard**; Cmd/Ctrl+X cuts (copy + clear); Cmd/Ctrl+V pastes the clipboard buffer as a Floating Selection centered on the viewport-and-canvas intersection.
- **Clipping mask**: while a Marquee is active, *all drawing tools* (pencil, eraser, line, rectangle, ellipse, flood fill) silently clip their output to the Marquee bounds. The user can confine edits to a region without switching tools.

Plus standard dismissal paths:

- **Cancel / dismiss**: Escape cancels an in-progress Floating Selection (reverting source and destination to pre-lift state); with no Floating Selection, Escape clears the Marquee. Pointer-down outside an existing Marquee redefines the Marquee (or, if the press releases without dragging, simply clears the existing Marquee).

The Marquee is rendered as a **marching-ants** dashed rectangle overlay on the canvas viewport, following the same overlay pattern as the existing `ReferenceLayerPlacementOverlay`. The marching ants follow a Floating Selection as it moves, so the user can always see where the selection currently is.

The Marquee is **Document-scoped and persisted with the Document** — it survives reload, tab switching, and active-layer changes (per industry convention, it operates against whichever Pixel Layer is currently active). The Floating Selection buffer is **transient** — never persisted, discarded on tab close or window unload.

The Selection Clipboard is **workspace-shared** (one slot across all open tabs) and persisted with workspace state so that copy-from-tab-A → paste-to-tab-B works within and across sessions.

### Key Shape Changes

- **Domain terms**: introduce **Marquee** (the persistent Document-scoped rectangular region), **Floating Selection** (transient lifted pixel buffer plus current translation offset), and **Selection Clipboard** (workspace-scoped copy/paste buffer).
- **Document model**: gains an optional Marquee plus region-pixel mutators (`lift_marquee_pixels`, `clear_marquee_pixels`, `composite_buffer_at`).
- **Tool model**: a new `selection` tool type with a multi-phase stroke session built on the existing `customTool` sugar, plus a *cross-tool* `DrawingOps` decorator that clips all drawing-tool output to the active Marquee.
- **Persistence**: Document storage moves from v4 to v5 to add Marquee; Workspace persistence learns to read/write the Selection Clipboard.
- **Render path**: a new `SelectionOverlay` Svelte component draws the marching-ants Marquee (which tracks the Floating Selection's current offset when one exists); Floating Selection pixels render through the normal Pixel Layer composite (the lifted buffer is composited as a live preview).

## User Stories

### Defining and dismissing the Marquee

1. As a pixel artist, I want a Selection tool reachable by pressing **M**, so that I can select rectangular regions consistent with industry conventions (Photoshop, GIMP, Aseprite).
2. As a pixel artist, I want to drag from a corner to define a rectangular Marquee on the active Pixel Layer, so that I can confine subsequent edits to a chosen area.
3. As a pixel artist, I want the Marquee to render as an animated marching-ants outline, so that I can clearly see the active selection at any zoom level.
4. As a pixel artist, I want a click-with-no-drag inside the canvas to clear the existing Marquee (not produce a 1×1 selection), so that accidental clicks do not leave tiny selections behind.
5. As a pixel artist, I want Shift+drag to constrain the Marquee to a square, so that I can quickly select tilesheet-style square regions.
6. As a pixel artist, I want pressing Escape with a Marquee but no Floating Selection to clear the Marquee, so that I have a keyboard-fast way to deselect.
7. As a pixel artist, I want the Marquee to clip to the canvas bounds, so that I cannot select pixels outside the document.

### Marquee persistence

8. As a pixel artist, I want the Marquee to persist across reloads and tab switches, so that I do not lose my selection accidentally.
9. As a pixel artist, I want the Marquee to remain after switching to another Pixel Layer, so that I can "use this region on layer A, then on layer B" workflows (matching Photoshop/GIMP/Aseprite convention).
10. As a pixel artist, I want the Marquee to remain visible after switching to a non-Selection tool, so that I can see at a glance that a selection is still active.
11. As a pixel artist, I want the Marquee to stay visible while the Reference Layer is active (operations no-op there, matching the rest of PRD-105), so that switching back to a Pixel Layer immediately resumes my workflow.

### Moving and nudging

12. As a pixel artist, I want to drag inside the Marquee to move the selected pixels, so that I can reposition part of my artwork without redrawing it.
13. As a pixel artist, I want the source region to become transparent the moment I begin dragging the selection, so that the move preview matches the final committed state.
14. As a pixel artist, I want the marching ants to follow the Floating Selection as it moves, so that the Marquee outline always wraps the currently visible pixels.
15. As a pixel artist, I want to release the mouse to commit the move, so that the result is undoable as a single history entry.
16. As a pixel artist, I want pressing Escape mid-drag to revert the in-flight move, so that I can abandon a misplaced drag without using Undo.
17. As a pixel artist, I want Shift held during a Floating Selection drag to constrain movement to the horizontal or vertical axis, so that I can move pixels exactly along a row or column.
18. As a pixel artist, I want pressing arrow keys with a Marquee active to nudge the selected pixels by 1 px in that direction, so that I can align pixels precisely without mouse drift.
19. As a pixel artist, I want Shift+arrow to nudge by 10 px instead of 1 px, so that I can make larger keyboard moves quickly.
20. As a pixel artist, I want pixels translated past the canvas edge during a move to be clipped, so that translation behaves predictably and matches Move tool semantics.

### Delete / copy / cut / paste

21. As a pixel artist, I want pressing Delete or Backspace with a Marquee active (no in-progress drag) to clear the selected pixels to transparent, so that erasing a rectangular region is a single keystroke.
22. As a pixel artist, I want Cmd/Ctrl+C to copy the Marquee region's pixels to a clipboard, so that I can duplicate part of my artwork.
23. As a pixel artist, I want Cmd/Ctrl+X to cut the Marquee region (copy + clear), so that I can move a region somewhere else in two steps.
24. As a pixel artist, I want Cmd/Ctrl+V to paste the clipboard buffer onto the active layer as a Floating Selection centered on the visible canvas area, so that I can position the pasted content before committing.
25. As a pixel artist, I want paste to fall back to the canvas center when the canvas is fully outside the viewport, so that the pasted content is always reachable.
26. As a pixel artist working across tabs, I want to copy a region from one document and paste it into another, so that I can reuse sprites between projects without exporting to disk.
27. As a pixel artist with no Marquee or empty clipboard, I want Cmd+C/X/V and Delete/arrow keys to do nothing silently, so that mistaken keystrokes never produce unexpected side effects.

### Clipping mask (per-tool)

28. As a pixel artist with an active Marquee, I want the Pencil and Eraser to paint or erase only inside the Marquee, so that I can do detail work without worrying about straying outside the region.
29. As a pixel artist, I want the Line, Rectangle, and Ellipse tools to render only the pixels that fall inside the Marquee, so that geometric shapes naturally trim to the selection.
30. As a pixel artist, I want the Flood Fill to fill only inside the Marquee (treating Marquee edges as fill bounds), so that I can fill a region without it overflowing into the rest of the canvas.
31. As a pixel artist using the Move tool (V), I want it to translate the entire active Pixel Layer regardless of the Marquee, so that the two tools — Move (V) for layer-wide translation, Selection (M) for region translation — stay clearly distinct.
32. As a pixel artist using the Eyedropper, I want it to sample any pixel regardless of the Marquee, so that color inspection is never artificially limited.

### Undo / redo

33. As a pixel artist, I want Undo after a committed move to restore both the original source pixels and the original destination pixels, so that one Undo fully reverses the operation.
34. As a pixel artist, I want Undo to also restore the Marquee to its pre-move position, so that a single Undo step represents one self-consistent snapshot of the document.
35. As a pixel artist, I want Undo after a Delete to restore the cleared pixels (Marquee position itself is unchanged), so that a misclick on Delete is recoverable.
36. As a pixel artist, I want Undo after a paste to remove the pasted pixels and restore whatever Marquee existed before the paste, so that pasted content can be discarded cleanly.

### Cross-cutting destructive operations

37. As a pixel artist with a Floating Selection in progress, I want Clear Canvas, Delete Layer, Cmd+V, or switching tools to commit the Floating Selection first, so that my in-progress translation is preserved by intent (Undo can still revert in one step).
38. As a pixel artist, I want Clear Canvas and Delete Layer to preserve the Marquee, so that the Marquee survives operations that change pixel content but not user intent.

### Tool-switch and Reference Layer

39. As a pixel artist switching to another tool with only a Marquee (no Floating Selection) active, I want the Marquee to remain visible, so that switching back to Selection later resumes the same selection.
40. As a pixel artist, I want the Selection tool to silently no-op when the active layer is a Reference Layer (matching all other drawing tools per PRD-105), so that mis-clicks on the Reference are harmless.

### Pointer input

41. As a pixel artist, I want clicking outside the Marquee with no Floating Selection active to begin defining a new Marquee, so that re-selecting is one gesture instead of two.
42. As a pixel artist, I want clicking inside the Marquee when no Floating Selection is yet active to begin a move drag, so that selecting and moving share the same tool.
43. As a pixel artist on a touch device, I want long-press inside the Marquee to suppress the color-sampling loupe, so that selection-related gestures do not accidentally open the eyedropper.
44. As a pixel artist on a touch device, I want long-press outside the Marquee to open the color-sampling loupe as normal, so that I retain my ability to pick colors while in Selection mode.
45. As a pixel artist on a touch device, I want to define and drag a Marquee with my finger, so that selection works on mobile.
46. As a pixel artist, I want the cursor inside the Marquee to switch to `move` when no Floating Selection is yet active, so that the drag-to-move affordance is discoverable.

### Touch and mobile UX

52. As a pixel artist on a touch device, I want a floating Selection action bar to appear near the Marquee with Copy / Cut / Paste / Delete / Deselect buttons, so that every keyboard-only operation has a touch equivalent in v1.
53. As a pixel artist on a touch device with a Floating Selection active, I want the action bar to switch to Done / Cancel / Copy buttons, so that I can commit, revert, or duplicate the floating buffer without keyboard shortcuts.
54. As a pixel artist on any device, I want the Selection action bar to be visible whenever a Marquee is active, so that discovery of selection operations does not depend on knowing keyboard shortcuts.
55. As a pixel artist, I want the action bar to reposition automatically when it would otherwise leave the viewport (e.g., the Marquee is near the top edge), so that the bar is always reachable.
56. As a pixel artist defining a Marquee, I want a dimension tooltip (e.g., "12×8") and crosshair guides aligned with my pointer, so that I can size a rectangular selection precisely without keyboard nudging.
57. As a pixel artist, I want the StatusBar to display the current Marquee dimensions and origin (e.g., "Marquee: 12×8 at (3, 5)") while one is active, so that I can confirm the exact selection at a glance.
58. As a pixel artist on a small phone, I want the Selection action bar to show icons only when screen space is scarce (compact breakpoint) and icon + label on larger screens, so that the bar adapts to the available space.
59. As a pixel artist using Selection on touch, I want the project-wide *Touch modifier alternatives* task to provide Shift-equivalent constraints (square define / axis-lock drag), so that touch users get the same precision shortcuts as keyboard users without Selection-local modifier controls.
60. As a pixel artist using an Apple Pencil, I want Selection to work with the same touch affordances as a finger in v1, so that Pencil users are not blocked while the Pencil-specific optimization arrives separately.

### Edge cases and consistency

47. As a pixel artist, I want my selected pixels to remain in the original layer (not promoted to a new layer), so that the layer stack stays predictable.
48. As a pixel artist using the keyboard hint overlay (slash key), I want to see **M** as the Selection shortcut, so that learning the keymap remains consistent.
49. As a pixel artist with a single-pixel Marquee, I want move/copy/cut/delete/clipping mask to behave consistently with multi-pixel cases, so that the tool has no surprising edge cases.
50. As a pixel artist resizing the canvas while a Marquee is active, I want the Marquee position to follow the chosen resize anchor (matching Reference Layer Placement behavior per PRD-105), so that anchor selection means the same thing across overlays.
51. As a pixel artist using a touch device, I want the Marquee and Floating Selection drag targets to meet the 44pt touch target floor, so that selection is comfortable without a mouse.

## Implementation Decisions

### Domain vocabulary

Three new terms enter `CONTEXT.md` after the PRD lands:

- **Marquee** — a rectangular region on the active Pixel Layer that bounds subsequent pixel operations (Selection-tool operations *and* the clipping mask for every drawing tool). Document-scoped and persistent; survives reload, tab switch, active-layer change, and undo/redo.
- **Floating Selection** — a transient pixel buffer lifted from the active Pixel Layer plus a current translation offset. Created by drag-inside-marquee, by arrow-key nudge, or by paste. Discarded on tool switch / Cmd+V / Clear Canvas / Delete Layer (each committed first), on Escape mid-drag (reverted), or on tab/session destruction.
- **Selection Clipboard** — a workspace-shared single-slot buffer holding `{ pixels, width, height }`. Persisted with workspace state.

### Behavior matrix

Single reference table covering the cross-cutting decisions resolved during grilling. All implementations and tests should defer to this table.

| Concern | Resolution |
|---|---|
| Layer switch with Marquee active | Marquee persists. Operations target the new active Pixel Layer. |
| Click-without-drag on canvas | Drag distance < 1 doc px = no Marquee mutation (existing Marquee is cleared if click was outside; preserved if click was inside). |
| Floating Selection chrome | Marching ants travel with the Floating Selection; opacity of pixels = 1.0. |
| Touch long-press inside Marquee body | Sampling Session suppressed. |
| Touch long-press outside Marquee body | Sampling Session opens normally. |
| Empty Cmd+C / X / V, empty Delete, empty arrows | Silent no-op. |
| Cmd+V with active Floating Selection | Commit current Floating first, then paste new. |
| Cmd+V with active Marquee but no Floating | Previous Marquee is discarded; pasted buffer becomes the new Floating. |
| Tool icon | Lucide `SquareDashed`. |
| i18n key | `tool_selection` (`Selection` / `선택` / `選択`). |
| Shift during Marquee define | Constrain to square (reuse `constrainSquare`). |
| Shift during Floating Selection drag | Constrain movement to horizontal or vertical axis (initial larger delta wins). |
| Shift during arrow nudge | Multiply step by 10. |
| Paste position | Center of (viewport ∩ canvas). If empty intersection, fallback to canvas center. |
| Undo restores Marquee position | Yes — the commit snapshot captures both pixel state and Marquee position. |
| Clear Canvas with Floating | Commit Floating → clear active layer pixels → Marquee preserved. |
| Delete Layer with Floating | Commit Floating → delete layer → Marquee preserved on the new active layer. |
| Marquee visible while a non-Selection tool is active | Yes — marching ants render unchanged. |
| Marquee visible while Reference Layer is active | Yes — marching ants render; operations no-op (matches PRD-105). |
| Move tool (V) × Marquee | Move ignores Marquee; full-layer translate. Clean Move/Selection separation. |
| Eyedropper × Marquee | Eyedropper ignores Marquee; samples anywhere. |
| All other drawing tools × Marquee | Clipped to Marquee bounds via the marquee-clip DrawingOps decorator. |
| Touch parity policy for v1 | Selection-local commands have touch paths in this PRD. Physical keyboard modifier parity is tracked by the project-wide *Touch modifier alternatives* task. |
| Touch action bar location | Floats near Marquee top edge; auto-reposition when crossing the viewport boundary. |
| Touch action bar visibility | Always visible when a Marquee is active (desktop + touch); hidden mid-drag, fades back on release. |
| Touch action bar buttons (Idle) | Copy, Cut, Paste (disabled when clipboard empty), Delete, Deselect. |
| Touch action bar buttons (Floating Selection) | Done, Cancel, Copy. |
| Marquee body touch hit area | Exact bounds — no invisible expansion. Status bar hints "zoom in" when Marquee body < 44pt projected. |
| Pre-press affordance inside Marquee body | None beyond marching ants + action bar; cursor change on desktop already covers hover discovery. |
| One-finger pan with Selection active | Not provided in v1 (2-finger pan / pinch zoom only). Hand tool (`H`, reserved) is the long-term solution. |
| Drag-to-define visual aids | Dimension tooltip ("W×H") and crosshair guides; cleared on release. |
| Apple Pencil (`pointerType: 'pen'`) | Treated as touch in v1. Pencil-specific optimizations (hover preview, precision-only affordances) deferred to the dedicated Pencil task. |
| Marquee dimensions readout | StatusBar shows "Marquee: W×H at (x, y)" while Marquee is active. |
| Responsive action bar | compact (<600px) icon-only; medium+ icon + label. Visual sizing covered by a separate `.pen` design slice. |
| Shift constraint touch path | Provided through the project-wide *Touch modifier alternatives* task. Keyboard Shift behavior remains in the Shift-related Selection sub-issues. |

### Modules

#### Rust core (`crates/core/src/`)

- **`selection.rs` (new)** — `MarqueeRegion` value type. Public constructor `MarqueeRegion::from_drag(x0, y0, x1, y1)` normalizes drag-direction asymmetry; instances are always non-empty (degenerate inputs collapse to 1×1, matching `rectangle_outline`). Methods: `contains(x, y)`, `translate(dx, dy)`, `clip_to(canvas_w, canvas_h) -> Option<Self>`, `(x, y, width, height)` accessors. Trait derives follow `rust-conventions.md`: `Eq`, `Hash`, no `Ord` (column-major derived ordering would mislead given row-major pixel buffers).
- **Region pixel transformations** — pure functions; chosen between `selection.rs` (free functions like `rectangle_outline`) or `canvas.rs` (extension methods on `PixelCanvas`) by the same trade-off the existing shape outlines made. Three operations:
  - `lift_region(canvas, region) -> Vec<u8>` — reads region pixels into a row-major RGBA buffer; partially out-of-bounds regions return only the in-bounds slice padded with transparent.
  - `clear_region(canvas, region)` — sets region pixels to transparent.
  - `composite_region(canvas, buffer, dest_region)` — source-over alpha composite at the destination using the same blend semantics as the existing Pixel Layer composite path.
- **`Document` extensions** — singleton optional Marquee via `marquee() -> Option<MarqueeRegion>` and `set_marquee(Option<MarqueeRegion>)`. Region-pixel mutators delegate to the active Pixel Layer: `clear_marquee_pixels()`, `lift_marquee_pixels() -> Vec<u8>`, `composite_buffer_at(buffer, region)`. All region mutators silently no-op when the active layer is a Reference Layer (matches PRD-105's drawing-tool no-op contract).
- **`SelectionClipboard` value type (in `selection.rs`)** — `{ pixels, width, height }`. Plain struct exposed through UniFFI/WASM as a structured value (no methods that mutate the source; consumers either keep or replace).
- **Canvas resize anchor transform** — extend the existing 9-anchor canvas resize path (PRD-105 established the anchor factors for Reference Layer Placement) to translate the Marquee with the same `anchor_x_factor` / `anchor_y_factor`. Single shared anchor-transform function; both Reference Layer Placement and Marquee call into it.

#### TypeScript web shell (`src/lib/canvas/`)

- **`tools/selection-tool.ts` (new)** — uses the `customTool` escape-hatch sugar. The stroke session reads the current Marquee from `host.document` and decides per-press whether to (a) clear the Marquee on a click-without-drag, (b) define a new Marquee on a drag-from-outside, or (c) lift-and-drag a Floating Selection on a drag-from-inside. Escape during the stroke reverts via the `cancelFloating` host hook.
- **`drawing-ops.ts` — marquee-clip decorator (new)** — `createMarqueeClippedOps(baseOps, marquee)` wraps a `DrawingOps` so that `setPixel`, `applyTool`, `applyStroke`, and `floodFill` short-circuit out-of-Marquee writes. Pattern mirrors `createPixelPerfectOps`. The stroke host composes decorators at stroke begin: `marqueeClip(pixelPerfect(baseOps))` when both are active.
- **`document-change-journal.svelte.ts` extensions** — new intents:
  - `set-marquee: { region: MarqueeRegion | null }` — undoable when classified as user-driven (stroke commit fires this). Interaction-internal preview updates write directly to a transient Document field (not the journal) to avoid polluting history.
  - `clear-marquee-pixels` — Delete/Backspace path; one undo snapshot.
  - `commit-floating-selection: { sourceRegion, destOffset, buffer }` — committed move/paste lifecycle; one undo snapshot covering both the source clear and the destination composite, *plus the Marquee's new position*.
  - `paste-clipboard: { clipboard, destRegion }` — Cmd+V path; does not snapshot at paste time. The snapshot fires when the resulting Floating Selection commits on release. The pre-paste Marquee is captured into the post-commit snapshot's "previous" state so Undo restores it.
- **`SelectionOverlay.svelte` (new)** — renders the Marquee as a marching-ants dashed rectangle (CSS animation on `stroke-dashoffset`); when a Floating Selection is active, the overlay tracks the buffer's current offset so the ants always wrap the visible floating pixels. The Marquee outline is clipped at the canvas boundary so partially off-canvas regions render only their in-bounds portion. Lives alongside `ReferenceLayerPlacementOverlay`. Owns its own pointer surface so cursor zones (`move` inside the Marquee body when no Floating Selection is active, `grabbing` while dragging, `crosshair` outside) are crisp.
- **`keyboard-input.svelte.ts` extensions** — new host callbacks:
  - `clearMarqueeOrFloating()` — Escape: cancel Floating Selection first; else clear Marquee.
  - `deleteMarqueePixels()` — Delete/Backspace.
  - `nudgeMarquee(dx, dy)` — arrow keys; Shift multiplier handled at the keyboard layer (`dx *= 10` when held).
  - `copySelection()`, `cutSelection()`, `pasteClipboard()` — Cmd/Ctrl+C / X / V.
  Keyboard handlers fire only when the canvas (not a text input) is focused, matching the existing `isTextInputTarget` guard.
- **`Workspace.shared` extension** — `selectionClipboard: SelectionClipboardData | null`, with setter routed through `setSelectionClipboard()` so workspace persistence captures the change.
- **Persistence** — Document storage moves from v4 to v5: the v5 record optionally carries `{ marquee: { x, y, width, height } | null }`. Migration: existing v4 documents hydrate with `marquee: null`. Workspace persistence reads/writes the Selection Clipboard alongside other shared state.
- **`wasm/` facade** — Document and module-level exports expose Marquee CRUD plus the region helpers; the structural-compatibility test (`wasm-sync.test.ts`) enforces shape parity at compile time.
- **`tool-registry.ts`** — new entry: `selection` with shortcut `M`, cursor `crosshair`, `isDrawingTool: true`, `isPixelMutationTool: true`.
- **`tool-ui.ts`** — Lucide `SquareDashed` icon, `m.tool_selection()` label.
- **`messages/{en,ko,ja}.json`** — `tool_selection`: `"Selection"` / `"선택"` / `"選択"`.

### Marquee Clipping Mask — per-tool integration

When a Marquee is active on a Pixel Layer document, *every* drawing tool clips its output to the Marquee bounds. The integration is a single decorator at the host layer:

```text
DrawingOps composition order at stroke begin:
  baseOps  →  pixelPerfect (if tool opts in & user toggled)  →  marqueeClip (if Marquee active)
```

The decorator intercepts:

- `setPixel(x, y, color)` — drops writes where `(x, y)` is outside the Marquee.
- `applyTool(x, y, tool, color)` — drops out-of-Marquee writes.
- `applyStroke(pixels, tool, color)` — filters the pixel batch to in-Marquee coordinates before forwarding.
- `floodFill(x, y, color)` — treats Marquee edges as fill boundaries by clipping the WASM fill bounds. If the seed point itself is outside the Marquee, the fill no-ops.

Tools that bypass `DrawingOps` entirely keep their existing semantics:

- **Move tool (V)** — uses `shiftPixels` directly on the active layer buffer (`move-tool.ts:55`). Marquee has no effect.
- **Eyedropper** — read-only sampling. Marquee has no effect.

This composition keeps the clipping mask invisible to individual tool implementations — each existing tool keeps its current code; gaining mask awareness is a host-layer concern.

### Touch and mobile UX

v1 ships touch paths for Selection-local commands and visual feedback. The mechanism is a small Svelte component, a StatusBar slot, and two drag-time visual aids; together they replace cursor states, Selection keyboard commands, and physical Esc/Delete keys for touch users without losing anything for keyboard users. Physical modifier parity (Shift-equivalent constraints and Alt-eyedropper) belongs to the project-wide *Touch modifier alternatives* task so every tool shares the same modifier UI.

#### Selection action bar (`SelectionActionBar.svelte`, new)

A floating horizontal toolbar that renders next to an active Marquee. Buttons depend on state:

- **Idle (Marquee active, no Floating Selection)**: `Copy`, `Cut`, `Paste`, `Delete`, `Deselect`. `Paste` is disabled when the Selection Clipboard is empty.
- **Floating Selection active**: `Done`, `Cancel`, `Copy`. `Done` commits at the current offset; `Cancel` reverts the lift; `Copy` captures the floating buffer to the clipboard.

Behavior:

- Always rendered when a Marquee is active (desktop + touch) — discoverability for keyboard-averse users.
- Default position: 8 px above the Marquee top edge in screen space. When that would overflow the viewport top, fall back to below the Marquee bottom edge; when both overflow, sticky to the viewport edge closest to the Marquee.
- Hidden mid-drag (any pointer drag interaction) to avoid covering the work area; fades back in on release (`prefers-reduced-motion` skips the fade).
- Responsive (per `screen-inventory.md` breakpoints): compact (<600px) = icon-only buttons; medium+ = icon + label. Tooltip on hover at wide+. Detailed visual sizing is covered by a separate `.pen` design slice (treat as a sibling to PRD-106).
- Touch target: every button meets the 44 × 44 pt floor with invisible padding when icon-only.
- All button labels go through `messages/{en,ko,ja}.json` (keys: `action_selectionCopy`, `action_selectionCut`, `action_selectionPaste`, `action_selectionDelete`, `action_selectionDeselect`, `action_selectionDone`, `action_selectionCancel`).
- Visual styling uses existing `--ds-*` design tokens; no new tokens introduced.

#### StatusBar Marquee readout

`StatusBar.svelte` gains a new slot that renders `"Marquee: {W}×{H} at ({x}, {y})"` whenever a Marquee is active. Hidden when no Marquee exists. The compact breakpoint may abbreviate to `"{W}×{H}"`. i18n key: `status_marquee`.

This is the persistent equivalent of the drag-time dimension tooltip (below). Together, the two cover both "during drag" and "between operations" information needs.

#### Drag-time visual aids

Two helpers render only while the user is actively dragging a Marquee corner (define phase):

- **Dimension tooltip** — a small `"W×H"` label that follows the live pointer position, biased above the touch contact point and clamped to viewport edges.
- **Crosshair guides** — 1 px subtle stroke (using `--ds-border-subtle`) extending from the pointer to the viewport edges along both axes. No animation, so respect for `prefers-reduced-motion` is automatic.

Both helpers disappear on pointer release. They render identically across pointer types (mouse / pen / touch) — the precision they offer is useful for all input modalities, and lump-summing them avoids `pointerType` branching.

#### Touch interactions not changed by this PRD

- **Pinch zoom** — the existing canvas-interaction pinch logic already terminates any active stroke at the start of pinch, which gives Selection a sane default (any in-progress define or drag commits per the standard "release = commit" rule). No new behavior needed.
- **Two-finger pan** — works through the same multi-touch pipeline used for pinch; preserves the Marquee since the panning gesture is decoupled from the Selection stroke. No new behavior needed.
- **One-finger pan** with Selection active is *not* provided in v1. The future Hand tool (`H`, reserved in `docs/decisions/keyboard-shortcut-review.md`) is the long-term solution; revisit when it lands.

#### Apple Pencil

`pointerType: 'pen'` is treated as touch in v1 — same code path, same affordances (action bar, drag aids, StatusBar). Pencil-specific optimizations (hover preview, palm rejection, precision-only behavior) belong to the dedicated *Apple Pencil* task in the backlog and are explicitly out of scope here. The visual aids are useful even at Pencil precision, so this PRD does not waste them.

#### Dependency on *Touch modifier alternatives*

The Shift modifier in this PRD has three roles: square constraint during define, axis-lock during Floating Selection drag, and 10× multiplier during arrow nudge. The Shift-related Selection sub-issues implement the physical keyboard behavior only. Touch-reachable Shift-equivalent behavior is part of the project-wide *Touch modifier alternatives* task, alongside the Alt-eyedropper alternative, so the modifier UI is shared across shape tools and Selection rather than duplicated locally.

### Interaction state machine

Single canonical lifecycle for a Selection-tool stroke:

```text
Idle (Marquee may exist) ──┐
   │  click-only (no drag)  inside or outside
   │  ────────────────────► clear Marquee if click was outside; no-op if inside
   │
   │  pointer-down inside Marquee
   │  & no Floating Selection
   ↓
LiftAndDrag ──────────────► CommitOnRelease (one history snapshot)
   │                               │
   │  Escape                       ↓
   │                            Idle (Marquee preserved at new offset)
   │
   │  pointer-down outside Marquee, drag ≥ 1 doc px
   ↓
DefineMarquee ────────────► Idle (new Marquee committed; no pixel mutation)
```

Keyboard paths layered on top of the same state machine:

- **Arrow / Shift+Arrow** with Marquee and no Floating Selection: auto-lift → translate → leave a Floating Selection active. Subsequent arrow presses stack translations into the same buffer. Tool switch, Cmd+V, Clear Canvas, Delete Layer, or pointer-down outside commit.
- **Delete / Backspace**: from Idle, clears Marquee pixels. From Floating Selection state, commits Floating first, then clears the new region.
- **Cmd/Ctrl+C**: from Idle, copies Marquee pixels. From Floating Selection state, copies the floating buffer instead so the visible region is what gets copied.
- **Cmd/Ctrl+X**: Cmd+C followed by Delete (from Idle only; commits Floating Selection first when active).
- **Cmd/Ctrl+V**: commits any active Floating Selection first, then pastes the clipboard buffer as a Floating Selection centered on (viewport ∩ canvas); falls back to canvas center on empty intersection. Any pre-existing Marquee is discarded.
- **Escape**: cancels Floating Selection if active (revert lift); else clears Marquee.

### Cursor and overlay

- `SelectionOverlay.svelte` sets `cursor: move` inside the Marquee body when no Floating Selection is active; `cursor: grabbing` while dragging a Floating Selection; outside the Marquee = tool default (`crosshair`).
- Marching-ants animation: 1px dashed `var(--ds-accent)` stroke with 1px outer wash for contrast on arbitrary pixel colors; `@keyframes` shifts `stroke-dashoffset` 0→8 in 600ms `linear infinite`. Respect `prefers-reduced-motion`: hold the animation at offset 0 with no shift.
- Marquee outline clips at the canvas boundary so partial off-canvas regions render only their in-bounds portion.
- Touch hit-area: a transparent 44pt-equivalent padding around the Marquee edge so finger touch is comfortable, mirroring the placement overlay's touch sizing.
- The marching ants continue rendering identically when a non-Selection tool is active and when the active layer is a Reference Layer (operations no-op but the visual remains).

### Apple shell

This PRD makes no Apple shell changes. Apple Phase 1 (responsive tiers, clear canvas, PNG export, Shift-constrain) does not include the Selection tool. Apple support for Selection arrives in a future phase; the Rust core's `MarqueeRegion` + region transformations and `SelectionClipboard` become directly available through UniFFI at that time.

## Testing Decisions

A good test for this PRD asserts **observable contracts on Marquee state, pixel buffer contents, history entries, and Selection Clipboard contents** — not internal sequencing of journal calls or the exact pointer-event handlers. Four modules are in test scope (confirmed during planning); other modules ship without dedicated unit coverage.

### Rust core — `MarqueeRegion` + region transformations

- `from_drag` normalizes drag-direction asymmetry (`(5, 5) → (2, 2)` produces the same region as `(2, 2) → (5, 5)`).
- `clip_to(canvas_w, canvas_h)` clamps a region that extends past canvas bounds; clipping a fully-outside region returns `None`.
- `contains(x, y)` is consistent with `rectangle_outline`'s degenerate-case convention.
- `translate(dx, dy)` shifts both corners; chaining `translate` then `clip_to` does not double-clip.
- `lift_region` extracts row-major RGBA preserving alpha; partially-out-of-bounds regions return only the in-bounds slice padded with transparent.
- `clear_region` writes transparent only inside the region; out-of-region pixels are untouched.
- `composite_region` source-over alpha matches the existing Pixel Layer composite path; partial off-canvas destination is clipped without modifying out-of-bounds pixels.
- Edge cases: 1×1 marquee, marquee equal to canvas, marquee entirely off-canvas, marquee with `dx = -width` (full translate-out).
- Canvas resize-with-anchor preserves the Marquee position relative to the chosen anchor (mirrors Reference Layer Placement anchor transform from PRD-105).

Prior art: `tool.rs` boundary tests and `interpolate_pixels` directional tests are the model.

### Rust core — `Document` Marquee API

- Setting a Marquee on a Document persists in `marquee()` reads.
- `clear_marquee_pixels()` no-ops when no Marquee is set.
- `clear_marquee_pixels()` on a Reference-Layer-active Document does not mutate any pixel buffer.
- `lift_marquee_pixels()` followed by `composite_buffer_at` at the same region restores the original buffer (round-trip identity).
- Marquee persists when the active layer changes (no implicit clear).
- Marquee persists when a Pixel Layer is removed (operations target the new active layer).

Prior art: existing Document tests for layer mutators in `crates/core/src/document.rs`.

### TS — Document Change Journal: selection-related intents

- `set-marquee` with an equal region is a no-op (no snapshot, no dirty notification, no render invalidation).
- `commit-floating-selection` captures one undo snapshot covering both source-clear, destination-composite, *and Marquee position change*. Undo restores all three; Redo re-applies.
- `clear-marquee-pixels` captures one undo snapshot; Undo restores the cleared region. Marquee position is unchanged by the operation.
- `paste-clipboard` does not capture an undo snapshot at paste time. The snapshot fires when the resulting Floating Selection commits on release, with the pre-paste Marquee captured as the "previous" Marquee state.
- Intents on a Reference-Layer-active Document are no-ops without firing render invalidation or dirty notifications.
- Clear Canvas with an active Floating Selection commits the Floating before clearing.
- Delete Layer with an active Floating Selection commits the Floating before deleting.

Prior art: existing `document-change-journal.test.ts` is the structural model. Mirror its `will-change → snapshot → apply → after` 4-phase shape.

### TS — `marqueeClippedOps` decorator (DrawingOps)

- `setPixel` inside Marquee writes through; outside is dropped.
- `applyTool` (pencil, eraser, line, rectangle, ellipse) inside Marquee writes through; outside is dropped.
- `applyStroke` filters batches: in-Marquee pixels written, out-of-Marquee filtered out before forwarding.
- `floodFill` with seed inside Marquee fills connected pixels treating Marquee edges as bounds; seed outside Marquee no-ops.
- Composition with `pixelPerfectOps`: when a Marquee is active and pixel-perfect is enabled, the pixel-perfect filter sees the marquee-clipped output, not the raw pencil output.
- No Marquee active: decorator is a pass-through (identity).

Prior art: `pixel-perfect-ops.test.ts` is the structural model for `DrawingOps` decorator tests.

### TS — Selection tool stroke session

- Click-without-drag outside existing Marquee: Marquee cleared.
- Click-without-drag inside existing Marquee: no-op (Marquee preserved).
- Drag from outside Marquee enters DefineMarquee; drag updates a preview without committing; release commits one journal entry.
- Drag from inside existing Marquee enters LiftAndDrag; the source region clears immediately; release commits one journal entry with both source and destination changes.
- Shift held during DefineMarquee constrains to square.
- Shift held during LiftAndDrag constrains movement to one axis (initial larger delta wins).
- Escape during LiftAndDrag reverts both the source clear and the floating buffer's offset.
- Tool switch during LiftAndDrag commits at the current offset (no implicit cancel).
- Cmd+V during LiftAndDrag commits first, then pastes.
- Selection on a Reference-Layer-active Document silently no-ops at the stroke level.
- Touch-pen-mouse parity: the same lift-translate-commit flow runs across all `PointerType` values.
- Touch long-press inside Marquee body suppresses Sampling Session start; outside Marquee body opens it normally.

Prior art: `move-tool.test.ts` exercises `shiftPixels`; the stroke-session tests in `tool-runner.svelte.test.ts` / `editor-controller.svelte.test.ts` show how to drive a `DrawTool` through `start / draw / end` lifecycles with fake hosts.

### Not covered by automated tests (manual verification only)

- Marching-ants animation smoothness across zoom levels and `prefers-reduced-motion`.
- Cross-tab clipboard paste between two open tabs in the same workspace.
- Session reload restoring a persisted Marquee.
- Touch-target ergonomics for the 44pt hit area.
- Floating Selection visual chrome (ants tracking the buffer offset).

These are validated through the dev server with the canvas focused, per `CLAUDE.md` UI testing guidance.

## Out of Scope

- **Selection shapes beyond rectangular.** No lasso, polygonal, magic-wand, or color-similarity selections in v1.
- **Boolean selection ops (Shift+drag add, Alt+drag subtract, Shift+Alt intersect).** v1's Shift means "constrain to square during define." Boolean composition is a separate feature.
- **Marquee corner resize handles.** Once committed, the Marquee is immutable except by redefining; no corner-drag resize in v1.
- **Selection inversion / select-all / deselect-all shortcuts.** Standard Cmd+A / Cmd+Shift+A / Cmd+D shortcuts come in a follow-up if a concrete workflow demand appears.
- **Modify selection.** No expand / contract / feather / smooth.
- **Anti-aliased selection.** Pixel art is hard-edged — no alpha masking on selection boundaries.
- **Selection transform.** No scale / rotate / skew / flip on the Floating Selection. The dedicated "Flip/transform" task in the Milestone 3 backlog covers these separately.
- **Promote-to-layer.** No "convert Floating Selection to new layer" action — the layer stack stays unchanged.
- **Selection across multiple layers.** v1's Marquee operates on one Pixel Layer at a time.
- **Multi-region selection.** Only one Marquee at a time per Document.
- **Paste at original document coordinates.** v1 always centers paste on (viewport ∩ canvas). Cmd+Shift+V variant deferred.
- **System clipboard interop.** The Selection Clipboard is internal-only — no integration with the OS clipboard, no paste-from-image-file in v1.
- **Right-click context menu inside Marquee.** Desktop users use keyboard shortcuts or the always-visible Selection action bar; a separate context menu is redundant in v1.
- **Touch long-press context menu inside Marquee.** Superseded by the always-visible Selection action bar (v1 already covers Cut/Copy/Paste/Delete/Deselect on touch).
- **Pencil-specific Selection optimizations.** Hover preview, precision-only affordances, and palm rejection live in the dedicated *Apple Pencil* backlog task.
- **One-finger pan with Selection active.** Future Hand tool (`H`, reserved) covers this scenario consistently across all drawing tools.
- **First-time onboarding hint** for Selection. Deferred until a project-wide onboarding pattern exists.
- **Apple shell support.** Native iPad / macOS Selection tool deferred to a future Apple phase.

## Further Notes

- `docs/decisions/keyboard-shortcut-review.md` reserved `M` for "Selection (Marquee)" during Milestone 2; this PRD honors that reservation.
- The Marquee + Floating Selection split mirrors industry tools (Photoshop's "marching ants" + "selected layer in flight") and the existing project pattern where stable Document state (Reference Layer Placement) is separated from interaction state (Reference Layer Placement Interaction). Document Change Journal handles both the same way: stable state lives in the core, transient interaction state lives in the shell.
- The Marquee clipping mask is a host-layer concern, not a per-tool concern. Existing drawing tools keep their code; gaining mask awareness happens once in the stroke host's DrawingOps composition. This avoids spreading Marquee knowledge across each tool.
- Selection Clipboard's workspace scope mirrors the rest of `workspace.shared` (active tool, colors, recent colors, pixel-perfect toggle); a per-document clipboard was rejected because copy-from-A-paste-to-B is the common workflow.
- The current `moveTool` (V) — which translates the entire Pixel Layer — remains alongside the new Selection tool (M). They serve different scopes: full-layer translate vs region select-and-move. No deprecation is planned.
- `CONTEXT.md` will gain a **Selection** section after the PRD merges so the new vocabulary becomes canonical before sub-issues land.

### Dependencies and ordering

- **`Touch modifier alternatives`** (project-wide Shift/Alt toggle, currently a Milestone-3 backlog item) owns touch access to Shift-equivalent Selection constraints and Alt-eyedropper behavior. The Shift-related Selection sub-issues own only the physical keyboard behavior, so they can proceed independently. `tasks/todo.md` reflects this split.

### Follow-up items (v1.1 or later)

The grilling that produced this PRD surfaced the following items that v1 does not solve but should not be forgotten:

- **Apple Pencil-specific Selection behavior** — hover preview, palm rejection, and precision-only affordances that exploit Pencil's 1 px accuracy. Belongs to the dedicated *Apple Pencil* backlog task.
- **Hand tool (`H`) with Selection** — once the Hand tool is implemented, revisit Selection's one-finger pan story; `H` becomes the canonical "switch to pan briefly" path on both desktop and touch.
- **Boolean selection composition** — Shift+drag adds, Alt+drag subtracts, Shift+Alt intersects. Conflicts with v1's Shift = square-constraint. If demand appears, the standard resolution is "Shift starts as constraint, but if a Marquee already exists and the drag starts outside it, Shift means add" — Photoshop's heuristic.
- **Marquee corner resize handles** — once committed, drag a Marquee corner to resize without redefining.
- **Paste at original coordinates** (`Cmd+Shift+V`) — useful for tilesheet alignment workflows. Skipped from v1 because nudge can refine alignment after a standard paste.
- **Undo during Floating Selection** — should behave as Escape (cancel the floating, revert pixel state). Implementation note: when Undo is invoked with a Floating Selection active, route it to the Escape path before consulting the history stack.
- **Layer hide × Floating Selection** — toggling visibility of the active layer mid-floating is rare but unspecified. Default behavior (Floating preview continues to render even when source layer is hidden) is reasonable; revisit if user feedback shows confusion.
- **First-time onboarding hint for Selection** — a single-occurrence toast explaining the action bar and drag-to-move. Deferred until a project-wide onboarding pattern exists.
- **`Cmd+A` / `Cmd+D` / `Cmd+Shift+I`** — Select-all, deselect, invert. Trivial to add once the core APIs exist.

An ADR may be warranted for the **Floating Selection lifecycle on tool switch = commit (not cancel)** decision, since a future contributor might flip it without realizing the user-intent rationale.
