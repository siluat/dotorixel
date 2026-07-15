---
title: Apple native — enable PNG export (existing disabled button)
status: done
created: 2026-07-14
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 1: Layout
finish, "quick wins" group.

## What to build

The Apple shell's TopBar already renders an Export button, but it is permanently
disabled with its action deferred to this task. Enable it: tapping Export encodes the
current canvas as a PNG and saves it through the platform-native save flow.

The PNG encoder already exists across the FFI boundary (`ApplePixelCanvas.encodePng()`
in the UniFFI bindings, returning encoded bytes); this slice is shell wiring only.
Use SwiftUI's `.fileExporter` for the save flow so one implementation serves both
macOS (save panel) and iPadOS (Files document picker), consistent with the RFC's
"SwiftUI-native controls" principle.

Match the web's export conventions for parity:

- 1× scale — one canvas pixel per image pixel (the web exports the raw canvas;
  scaled export is a later concern on both shells).
- Default filename `dotorixel-{width}x{height}.png`.

Encoding can fail (`encodePng()` throws); a failure or a cancelled save panel must
not crash or corrupt editor state.

## Acceptance criteria

- The Export button in TopBar is enabled (full opacity, tappable).
- Tapping Export presents the platform save flow and, on confirm, writes a valid PNG
  file: correct pixel dimensions, drawn pixels in their drawn colors, undrawn pixels
  transparent.
- The default filename follows `dotorixel-{width}x{height}.png`.
- Cancelling the save flow leaves the editor unaffected; an encode failure surfaces
  without crashing.
- Works on both macOS and iPadOS destinations.
- Unit tests cover the export-document path (encoded bytes are a decodable PNG with
  expected dimensions and pixel content).

## Blocked by

None - can start immediately.

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Export/PngExportDocument.swift` | New — `FileDocument` wrapper holding pre-encoded PNG bytes for `.fileExporter` |
| `apple/Dotorixel/State/EditorState.swift` | `makePngExportDocument()` (1× encode via core `encodePng()`) + `defaultExportFilename` |
| `apple/Dotorixel/Views/TopBar.swift` | Export button enabled; `.fileExporter(contentType: .png)` save flow + failure alert |
| `apple/DotorixelTests/PngExportTests.swift` | New suite — PNG decodability + dimensions, pixel-content preservation, filename convention |
| `apple/DotorixelTests/__Snapshots__/DockedRegionSnapshotTests/topBar*.png` | Baselines re-recorded for the now-enabled button (pinned iPad Pro 11" sim) |

### Key Decisions

- One `.fileExporter(isPresented:document:contentType:defaultFilename:)` implementation
  serves both macOS (save panel) and iPadOS (Files picker), per the RFC's
  "SwiftUI-native controls" principle.
- Filename convention duplicated natively (trivial, stable template — Core Placement
  rule of thumb); cross-referenced to `generateExportFilename` in
  `src/lib/canvas/export.ts` for sync.
- Named `defaultExportFilename`, not `exportFilename` — it is the suggested name the
  user can override in the save panel.

### Notes

- `fileWrapper(configuration:)` has no unit test: `FileDocument.WriteConfiguration`
  has no public initializer (known SwiftUI testability limitation). Covered instead by
  manual macOS E2E (enabled button, default filename, save, cancel); encoded-bytes
  validity is covered by the unit suite.
- Export-failure alert shows `AppleError`'s `String(reflecting:)` text (UniFFI
  `errorDescription`). Accepted trade-off: encode failure of a valid in-memory canvas
  is practically unreachable, and realistic failures (file writes) are Cocoa errors
  with user-appropriate messages.
- Vocabulary watch: `PngExportDocument` uses "Document" in the SwiftUI `FileDocument`
  sense — revisit naming when Phase 3 introduces the domain **Document** on Apple.
- iPadOS runtime save flow not manually exercised (same single implementation; unit
  and snapshot tests run on the iPad simulator).
