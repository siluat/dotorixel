---
title: Export UI — format selector and filename input
status: open
created: 2026-04-08
---

## Problem Statement

The editor's export button is hardcoded to PNG. As more export formats are added (SVG, and eventually GIF/spritesheet), users need a way to choose the format. Users also have no way to customize the exported filename — it is always auto-generated.

## Solution

Replace the single-action export button with an export control that lets users select a format and optionally customize the filename before downloading.

## Key Scenarios

1. The user clicks the export button → a format selector appears showing available formats (PNG, SVG).
2. The user selects PNG and clicks export → a PNG file is downloaded, same as current behavior.
3. The user selects SVG and clicks export → an SVG file is downloaded.
4. The user sees a filename input field with a placeholder showing the default name (e.g., `dotorixel-16x16`) → the user can type a custom name or leave it blank to use the default.
5. The user types "my-art" in the filename field and exports as PNG → the downloaded file is named `my-art.png`.
6. The user leaves the filename field empty and exports → the default name `dotorixel-{width}x{height}.{ext}` is used.
7. The user changes the canvas size after opening the export control → the placeholder filename reflects the new dimensions.

## Implementation Decisions

- **Format selector**: A simple control (radio buttons, segmented control, or dropdown) listing available formats. Starts with PNG and SVG; designed to accommodate future formats without layout changes.
- **Filename input**: A text input with the default filename as placeholder text. The file extension is determined by the selected format and appended automatically — users do not type the extension.
- **Default filename pattern**: `dotorixel-{width}x{height}` (no extension in the input; extension added on download).
- **Export function signature change**: `exportAsPng` and future `exportAsSvg` accept an optional filename parameter. The existing `generateExportFilename` is extended to support format selection.
- **Scope**: Web shell only. Apple native export UI is handled separately in Phase 1 tasks.

## Testing Decisions

This is primarily a UI wiring task. The core export functions (`encode_png`, `encode_svg`) are tested in Rust core. The filename generation logic (applying custom name, appending correct extension) is a pure function and should be unit tested.

## Rejected Alternatives

- **Separate buttons per format**: Does not scale as formats are added. A single export flow with format selection is more maintainable.
- **Modal dialog**: Heavier than needed for two fields (format + filename). A lightweight inline control or popover is sufficient.

## Out of Scope

- SVG export core implementation (covered by issue 031).
- Apple native export UI.
- Additional export formats beyond PNG and SVG.
- Export quality/compression settings.

## Further Notes

- The .pen design task "Sync: export UI format options updated in Editor frames" should be completed before or alongside this implementation to keep the design file in sync.
