---
title: Floating reference image windows
status: open
created: 2026-04-16
---

## Problem Statement

DOTORIXEL users cannot keep visual references (character sketches, color palette photos, pose references) inside the editor while drawing. The only workaround is to keep a separate browser tab or viewer open and alt-tab between it and the editor — disruptive in general, and especially hostile on narrow screens and touch devices where window management is expensive.

A related pain point: sampling a color from a reference image currently requires an external tool (OS color picker, a second image editor) because there is no in-editor path from "I see that color over there" to "that color is now my foreground."

Inspired by Pixquare's "Reference images" feature — a distinct capability from Pixquare's "Reference Layer" (canvas-integrated, deferred to Milestone 3's layer system work as feature B).

## Solution

Introduce **floating reference image windows** that sit in the editor workspace, independent of the canvas. Users open a **References browser modal** from a new TopBar button, import images (file picker or drag-drop), and toggle individual references on as floating windows overlaid on the canvas viewport. Each window can be moved, resized (aspect-locked), minimized (window-shade), and closed without losing the gallery entry. **Long-press + drag on any displayed reference samples color directly into foreground**, regardless of which tool is active; the Eyedropper tool also works on reference windows for discoverability.

References are **scoped per document (tab)** and **persisted in the workspace session** (IndexedDB) — they survive a page reload, but are not part of the document schema and therefore do not travel with exported or shared documents. This keeps the role split clean versus the future Reference Layer (Milestone 3), which will live inside the layer system and be part of the document.

## Key Scenarios

1. User clicks the References button in the TopBar → a modal opens showing the current tab's reference gallery (or an empty state).
2. User drags a PNG file onto the empty state in the modal → the file is validated and added to the gallery as a card; the image is not yet displayed on the canvas (display off).
3. User clicks a gallery card's body → the modal closes and the reference appears as a floating window centered in the canvas viewport.
4. User drags the window's title bar → the window follows the pointer; the canvas is not affected.
5. User drags the bottom-right resize handle → the window scales while preserving aspect ratio; minimum size (roughly 80×80) is enforced.
6. User clicks the minimize button in the title bar (or double-clicks the title bar) → the image area collapses, leaving only the title bar in place; clicking restore expands to the previous size.
7. User long-presses on a displayed reference image and drags → the pixel under the pointer is live-previewed as the new foreground color; releasing commits.
8. User activates the Eyedropper tool and taps a reference image → the tapped pixel becomes the foreground color without long-press.
9. User selects the pencil tool and clicks on a canvas area covered by a reference window → the window absorbs the input; nothing is drawn on the canvas underneath.
10. User toggles a second reference on from the gallery → it appears centered in the viewport with a cascade offset (~24px down-right from the previous window) and becomes the top of the z-order.
11. User clicks on an older window → that window rises to the top of the z-order (auto LIFO).
12. User clicks a floating window's close (X) button → the window disappears from the canvas but the gallery entry remains; it can be displayed again later.
13. User clicks Delete on a gallery card → a confirmation dialog appears; on confirm, the reference is permanently removed and its floating window (if any) is closed.
14. User switches tabs → all floating windows of the previous tab disappear; the new tab's windows (if any) are restored at their last positions and minimize states.
15. User reloads the page → each tab's gallery, display states, window positions, sizes, and minimize states are restored.
16. User drops an 11 MB JPG → import is rejected with a "file too large (max 10 MB)" message.
17. User drops an SVG or HEIC file → import is rejected with an "unsupported format" message.
18. User drops an image onto the editor canvas area (outside the modal) → the reference is imported and immediately displayed as a floating window at the drop coordinates.

## Implementation Decisions

### Data Model

- `ReferenceImage` — persistent record: id, filename, original Blob, thumbnail Blob, MIME type, natural width/height, byte size, addedAt.
- `DisplayState` — per-instance window state: refId, visible, x, y, width, height, minimized, zOrder.

### Scope & Persistence

- References live at the **workspace level, keyed by document id**. Each tab has an independent gallery and display set.
- Stored inside `WorkspaceRecord` (IndexedDB). `DocumentSchema` is **not** modified — references do not travel with documents.
- A new workspace schema version is introduced; older records migrate to an empty references map.
- Image payloads are stored as Blobs (IndexedDB supports Blob natively).

### Modules

**New** — a `reference-images` library under `src/lib/` containing types, a reactive store, import/validation, thumbnail generation, color sampling, and a reusable long-press gesture detector. UI components under `src/lib/ui-editor/` for the individual floating window, the overlay container, the gallery grid, and desktop/mobile modal wrappers.

**Modified** — session storage types and serialization, the workspace module (to expose per-tab references), the TopBar (new entry button), the editor page (to render the overlay and modal).

### Module Boundaries

- Store has no UI dependencies; components subscribe via Svelte reactivity.
- `ReferenceWindow` receives `DisplayState` via props and reports changes via callbacks; no direct store coupling, to enable isolated component tests.
- `sampler`, `thumbnail`, and `import` avoid DOM dependencies beyond `OffscreenCanvas` / `ImageBitmap`, keeping them testable in happy-dom.
- `long-press` is a generic pointer gesture utility, not tied to reference-images, and may be reused elsewhere.

### Core Placement

Implemented entirely in TypeScript in the web shell. Rust core is not used: this is Web MVP only, and browser Canvas APIs handle image decoding and pixel sampling cheaply — WASM FFI overhead would exceed the operation cost. If Apple Native later needs this, it will use native SwiftUI / Image I/O rather than sharing core.

### Input & Import Policy

- MVP import sources: **file picker + drag-drop**. Clipboard paste is explicitly deferred to backlog.
- Allowed MIME types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`. SVG/HEIC/BMP/TIFF are rejected.
- File size cap: 10 MB per image, enforced at import.
- Drop target disambiguation: drop inside the modal → add to gallery only; drop on the editor canvas area → add to gallery and display at drop coordinates.

### Window Behavior

- Operations: move (title bar drag), resize (single bottom-right handle, aspect locked), minimize (window-shade — title bar only, position preserved), close (keeps gallery entry), color-sample (long-press + drag or Eyedropper).
- Z-order: auto LIFO. Clicking a window or toggling display brings it to front.
- Initial placement: drop coordinate when imported via canvas drop; viewport center with ~24px cascade when toggled from gallery. Cascade resets once all windows are dismissed. Out-of-viewport placements clamp to safe bounds.
- Initial size: `min(natural, viewport × 0.3)` for the longer edge, preserving aspect. Hard minimum roughly 80×80.
- Pointer events: the window absorbs input (no pass-through). Z-index is above the canvas but below editor chrome (TopBar, LeftToolbar, RightPanel, StatusBar).

### Color Sampling

- Two trigger paths, sharing a single sampler implementation:
  - **Long-press + drag** — works regardless of active tool. Threshold ~500ms; movement within a small radius before threshold does not cancel.
  - **Eyedropper tool** — any tap on a reference window samples, matching the canvas eyedropper UX.
- Live preview: foreground color updates continuously during drag; release commits. No separate confirmation UI.
- Foreground only — background sampling is out of scope for MVP (not present on the canvas Eyedropper either).

### UI Entry Point

- TopBar receives a new icon button next to the existing My Works (FolderOpen) button, using the same icon-button pattern (`.icon-btn`). No feature-gating toggle in Settings.
- Desktop modal uses the existing `createModal` overlay pattern; compact tier uses a BottomSheet, mirroring the `SavedWorkBrowser` / `SavedWorkBrowserSheet` split.
- Gallery card interaction: clicking the card body displays the reference and closes the modal (mirroring My Works' "click to open" UX). A small Hide/Delete button on each card supports in-modal management without dismissing.
- Gallery card content: thumbnail, original filename, image dimensions, display toggle, delete button (with confirmation dialog following My Works' pattern).

### Responsive

- TopBar button is visible across all tiers (compact / medium / wide / x-wide).
- Window interaction uses unified PointerEvents so mouse and touch share the same code path. Touch targets on window chrome meet the 44×44 minimum on compact/medium.

## Testing Decisions

Tests target external behavior only. Prior art to mirror: [`session-storage.test.ts`](../src/lib/session/session-storage.test.ts) (persistence round-trips), [`tool-registry.test.ts`](../src/lib/canvas/tool-registry.test.ts) (state transitions), [`workspace.svelte.test.ts`](../src/lib/canvas/workspace.svelte.test.ts) (reactive state), [`modal.svelte.test.ts`](../src/lib/ui/modal.svelte.test.ts) (modal interaction).

### Unit tests (Deep modules)

- **Import validator** — accept/reject per MIME type, reject above 10 MB, extract correct metadata (dimensions, byte size).
- **Thumbnail generation** — longest edge constrained to 256px, aspect ratio preserved across a range of input sizes including square, landscape, and portrait.
- **Color sampler** — (blob, x, y) → RGBA correctness; boundary coordinates (0,0 and w-1,h-1); transparent pixels preserved.
- **Long-press detector** — fires after the threshold; does not fire on early release; tolerates minor movement during pre-threshold.
- **Reference store** — import/toggle/delete sequences, z-order LIFO on display and focus, correct ref set exposed on tab switch, workspace record round-trip preserves display state including minimize flag.

### Component tests (@testing-library/svelte, happy-dom)

- **`ReferenceWindow`** — drag updates position via callback, resize preserves aspect, minimize/restore toggles collapsed state, close fires without removing the ref.
- **`ReferenceGallery`** — card body click fires select + close, delete flow shows confirmation dialog and requires confirm, empty state renders and accepts drag-drop.

### E2E (Playwright)

- End-to-end flow: import → display → drag → sample → reload → restored state.
- Tab-switching isolation: tab A references do not appear on tab B.
- Drop target disambiguation: modal drop stays in gallery, canvas drop auto-displays.

### Tests omitted

- `ReferenceLayer` and the modal/sheet wrappers are thin composition layers; their correctness emerges from the integrated E2E coverage.

## Rejected Alternatives

- **Reference Layer integration (feature B)** — making references a non-editable canvas layer. Rejected for this PRD because it belongs with Milestone 3's layer system work; use cases and coordinate semantics differ. Both features will coexist, each serving a distinct workflow.
- **Document-scoped persistence** — putting references into `DocumentSchema`. Rejected: forces a V2 → V3 migration, inflates IndexedDB usage (full-resolution refs per document), and leaks references when documents are shared or exported.
- **Workspace-global scope** — same references visible across all tabs. Rejected per user preference: references should be contextual to the document being worked on, not a global editor overlay.
- **Pointer pass-through on reference windows** — letting drawing input reach the canvas underneath. Rejected: breaks long-press color sampling and undermines "what happens when I click here" predictability. Move/minimize/hide give sufficient access to the canvas beneath.
- **Settings feature-gate** — requiring users to enable references in Settings before the TopBar button appears. Rejected: references are core, not niche; gating hurts discoverability without a current UI-crowding problem.
- **Edge-dock minimize** — collapsing minimized windows into a dedicated dock area. Rejected: dock placement, overflow, and responsive-tier behavior all exceed MVP scope. Window-shade gives equivalent utility at a fraction of the complexity.
- **Clipboard paste import** — Ctrl/Cmd+V to import from clipboard. Deferred to backlog due to keyboard shortcut precedence complexity and iOS Safari inconsistencies.
- **Rich window controls** — opacity slider, lock toggle, flip H/V, rotate. Deferred to backlog pending user feedback.
- **Rust core implementation** — moving image decoding and sampling into the shared core. Rejected: Web MVP only; FFI overhead outweighs the trivial browser-native implementation.

## Out of Scope

- Apple Native shell support (separate follow-up after Web MVP ships).
- Clipboard paste import (backlog).
- Advanced window controls: opacity, lock, flip, rotate (backlog).
- Extended formats: SVG, HEIC, BMP, TIFF.
- Frame-level control of animated GIFs (browser-native playback only; reconsidered alongside Milestone 4 animation work).
- Background color sampling.
- Rename / reorder / duplicate / multi-select / search / filter inside the gallery.
- Including references in the document file or share/export payloads.
- Reference Layer (Milestone 3, feature B).
- Multi-user collaboration or reference sharing.

## Further Notes

- **Milestone 3 coupling** — the `sampler` and `thumbnail` modules are reusable as-is for the future Reference Layer. The "Original size" restore UX from Aseprite's reference layer is a good candidate for a shared title bar context menu item ("Reset size") so that both features present a consistent restore gesture.
- **Apple Native port** — the data model (`ReferenceImage`, `DisplayState`) is platform-neutral and portable to SwiftUI with Core Data (or file-system-backed) persistence. Storage and gestures will be native; no core sharing needed.
- **CSP** — verify that deployed Content Security Policy allows `img-src: blob:`. Vite's default dev config allows `blob:`; production CSP must be checked before ship.
- **Observation points post-ship** — average number of references retained per user (for pagination need), whether the 10 MB cap is right-sized, whether 500ms long-press feels fast/slow across device classes, and whether clipboard paste demand surfaces enough to promote out of backlog.
