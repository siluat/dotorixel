---
title: Export UI — format selector and filename input (web)
status: done
created: 2026-04-09
---

## Problem Statement

The editor currently exports pixel art as PNG with a single click — no format choice, no filename customization. The filename is always `dotorixel-{width}x{height}.png`. As new export formats are added (SVG is next, GIF later), users need a way to choose their desired format and optionally name the file before downloading.

## Solution

Replace the single-click export with an Export UI that opens on button click. On desktop/iPad, a popover appears anchored below the Export button. On mobile, a bottom sheet slides up. Both contain a format selector dropdown (showing only implemented formats), a filename text input with a sensible default, and an "Export {format}" confirmation button. The actual download happens only when the user confirms.

Design reference: [032 — Export UI design](032-export-ui.md)

## Key Scenarios

1. The user clicks the Export button on desktop → a popover appears below the button showing a format dropdown (PNG selected by default), a filename input with placeholder `dotorixel-16x16`, and an "Export PNG" button.
2. The user leaves the filename empty and clicks "Export PNG" → a file named `dotorixel-16x16.png` is downloaded using the default name.
3. The user types `my-art` in the filename input and clicks "Export PNG" → a file named `my-art.png` is downloaded.
4. The user types `my-art.png` in the filename input → the known extension is stripped, and the downloaded file is `my-art.png` (not `my-art.png.png`).
5. The user clicks outside the popover → it closes without exporting.
6. The user presses ESC while the popover is open → it closes.
7. The user re-clicks the Export button while the popover is open → it toggles closed.
8. The user clicks "Export PNG" → the file downloads and the popover closes.
9. On mobile, the user taps the Export button (AppBar or Settings tab) → a bottom sheet slides up with the same format/filename/export controls.
10. On mobile, the user swipes the bottom sheet down → it closes.
11. On mobile, the user taps the overlay behind the bottom sheet → it closes.
12. The user closes and reopens the Export UI → the filename input is empty again (no session persistence), placeholder shows the default name.
13. When only PNG is implemented, the format dropdown shows only PNG. After SVG export is implemented, SVG appears as an additional option without any Export UI code changes beyond adding an entry to the format registry.
14. The user selects SVG from the format dropdown → the confirmation button label updates to "Export SVG".
15. While the popover is open, the Export button in TopBar shows an active/pressed visual state (darker accent).

## Implementation Decisions

- **Export-specific components**: `ExportPopover` and `ExportBottomSheet` are built as Export-dedicated components, not generic Popover/BottomSheet primitives. Generic extraction happens when a second use case arises.
- **BottomSheet via vaul-svelte**: The mobile bottom sheet uses `vaul-svelte` (Svelte port of Vaul) for gesture handling (swipe-to-close, overlay, animation). This avoids reimplementing complex touch interaction from scratch.
- **Desktop popover positioning**: CSS `position: absolute` anchored to the Export button wrapper. No positioning library needed — the button is at a fixed location in TopBar.
- **Popover close behavior**: A Svelte action (`use:clickOutside`) handles outside clicks, excluding the Export button itself to prevent toggle conflicts. ESC key handled via `keydown` listener. Both registered on mount, cleaned up on unmount.
- **State location**: `EditorState` gains an `exportUIOpen` boolean. All four export button locations (TopBar, TopControlsRight, AppBar, SettingsContent) toggle this single state. Only one export button is ever visible at a time per layout mode, so one state suffices.
- **Button behavior change**: All existing export buttons switch from triggering immediate PNG download to opening the Export UI. The actual download moves to the confirmation button inside the popover/sheet.
- **Format registry**: An `availableFormats` array in the export module, where each entry holds `{ id, label, extension, exportFn }`. The format selector dropdown reads this array. Adding a new format means adding one entry — no UI changes needed.
- **Individual export functions**: `exportAsPng()` and future `exportAsSvg()` remain separate functions with their own signatures. Each handles encoding and download internally. The format registry references these functions but does not enforce a common wrapper interface.
- **Filename handling**: The input field holds only the stem (no extension). The extension is determined by the selected format. On export, if the user's input ends with a known format extension (`.png`, `.svg`, etc.), it is stripped before appending the correct extension. Empty input falls back to the default `dotorixel-{width}x{height}`.
- **No filename persistence**: The filename input resets to empty (with placeholder) each time the Export UI opens.
- **Analytics update**: `trackExport(width, height, format)` with event name `'export'` replacing the current `'export-png'`. Format is passed as an event property.
- **i18n**: One new parameterized message key `action_exportFormat({ format })` for the confirmation button label (e.g., "Export PNG", "PNG 내보내기", "PNGをエクスポート"). Mobile sheet title reuses existing `label_export()`.
- **Web shell only**: Apple native export UI is out of scope.

## Testing Decisions

Tests focus on the pure logic extracted from the Export UI — not on component rendering or framework behavior.

- **Format registry logic**: Verify that `availableFormats` correctly maps format IDs to extensions and export functions. Verify adding a new entry makes it available.
- **Filename processing**: Default name generation from canvas dimensions. Extension stripping from user input (known extensions removed, unknown preserved). Empty input fallback to default. Edge cases: input that is only an extension (`.png`), input with multiple dots (`my.art.work`).
- **Prior art**: `crates/core/src/export.rs` has 5 PngExport tests. This task's tests will be TypeScript-side in a new or existing test file under `src/lib/canvas/`.

Components (`ExportPopover`, `ExportBottomSheet`) and their open/close behavior are not unit tested — that is framework and vaul-svelte responsibility.

## Rejected Alternatives

- **Generic Popover/BottomSheet components**: Would create premature abstractions for a single use case. Extract when a second consumer appears (e.g., share dialog).
- **Unified export interface wrapping all formats**: `exportAs(format, canvas, filename)` would force a common signature on functions with different return types (PNG returns bytes, SVG returns string). Each format handling its own download is simpler and already works.
- **Floating UI / positioning library for popover**: The Export button is at a fixed TopBar position — CSS absolute positioning is sufficient. A library adds bundle size for no benefit here.
- **Swipe-to-close from scratch**: Complex gesture implementation (drag threshold, inertia, animation) would be significant effort. vaul-svelte provides this out of the box.
- **Filename session persistence**: Remembering the last filename across popover opens risks accidental reuse. Users customizing filenames is likely a one-off action per export.
- **Segmented control for format selector**: Does not scale well as formats grow (PNG, SVG, GIF, spritesheet). A dropdown accommodates any number of options.

## Out of Scope

- SVG export encoder implementation — tracked in [031](031-svg-export.md).
- Apple native export UI.
- Export presets or saved filename templates.
- File format settings (e.g., PNG compression level, SVG optimization options).

## Further Notes

- The design spec in [032](032-export-ui.md) defines the visual layout, interaction patterns, and platform-specific behaviors. Implementation should match that spec.
- This task is a prerequisite for 031 (SVG export) — the format selector must exist before SVG can be offered as an option.
- The `availableFormats` registry pattern means 031 implementation only needs to add one array entry to surface SVG in the UI.
