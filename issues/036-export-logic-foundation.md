---
title: Export logic foundation — format registry, filename processing, analytics
status: open
created: 2026-04-09
parent: 033-export-ui-web.md
---

## What to build

Create the pure-logic foundation that both the desktop popover and mobile bottom sheet will consume. This includes a format registry (`availableFormats` array with a PNG entry), filename processing functions (stem extraction, known-extension stripping, default name generation), an `exportUIOpen` boolean on `EditorState`, and an updated analytics signature.

See parent PRD [033](033-export-ui-web.md) for filename handling rules and format registry design.

## Acceptance criteria

- `availableFormats` array in the export module with PNG entry (`{ id, label, extension, exportFn }`)
- `buildExportFilename(stem, extension)` returns `{stem}.{extension}`, falling back to `dotorixel-{width}x{height}` when stem is empty
- `stripKnownExtension(input, knownExtensions)` removes a trailing known extension from user input (e.g., `my-art.png` → `my-art`)
- Edge cases handled: input that is only an extension (`.png` → empty → fallback), input with multiple dots (`my.art.work` → unchanged)
- `exportUIOpen` reactive boolean on `EditorState` with a toggle method
- `trackExport(width, height, format)` replaces `trackExport(width, height)` with event name `'export'` and format as property
- Existing `exportAsPng` call sites updated to pass `'png'` format to analytics
- Unit tests cover format registry, filename processing, and extension stripping

## Blocked by

None — can start immediately.

## Scenarios addressed

From parent PRD [033](033-export-ui-web.md):

- Scenario 2: Empty filename → default name download
- Scenario 3: Custom filename → download with custom name
- Scenario 4: Filename with known extension → stripped
- Scenario 12: Reopen → filename empty with placeholder (state reset logic)
- Scenario 13: Only implemented formats shown (registry driven)
