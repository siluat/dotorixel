---
title: Apple native — recent colors row
status: done
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Track and display **recent colors** on the Apple shell, matching the web editor.

State: an ordered list of hex strings, most-recent first, **max 12**, deduplicated
case-insensitively (re-using a color moves it to the front). In-memory only for
now — persistence arrives with Phase 4 (the web persists this in the workspace
snapshot; note the parity gap in the issue when closing).

Recording rules (web parity — the list records colors *used*, not colors
*browsed*):

- When a **drawing stroke starts** (pencil, shapes, fill), record the stroke's
  draw color — foreground or background per the pressed button. The eraser
  records nothing.
- When the **eyedropper commits**, record the sampled color.
- Merely selecting a color in the palette or picker records nothing.

UI: a "Recent" labeled swatch row in the RightPanel color section (web
RightPanel is the reference — it renders below the palette). Hidden while the
list is empty. Tapping a recent swatch sets the foreground color.

The recording points hook into the 230 session lifecycle (stroke-start effects)
and the 234 commit path — mirror how the web folds an "add recent color" effect
into those two moments rather than scattering calls per tool.

## Acceptance criteria

- Drawing with pencil/shape/fill adds the used color to the front of the list;
  drawing with the eraser does not.
- A right-click stroke records the background color it drew with.
- An eyedropper commit records the sampled color.
- Selecting a palette color without drawing records nothing.
- The list dedupes case-insensitively, caps at 12, most-recent first.
- The Recent row appears once the first color is recorded, shows swatches in
  order, and tapping one sets the foreground color.
- List semantics unit-tested (dedupe, cap, ordering); RightPanel snapshot
  baseline updated with a populated Recent row.

## Blocked by

- [230 — stroke session architecture](230-apple-stroke-sessions.md)
- [234 — eyedropper tool](234-apple-eyedropper.md)

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/State/EditorState.swift` | `recentColors: [Color]` state + `recordRecentColor` (dedupe, cap 12, most-recent first); `commitColorPick` folds eyedropper commits into the list |
| `apple/Dotorixel/Tools/StrokeSession.swift` | `StrokeSessionHost.recordRecentColor` seam — sessions never call it directly |
| `apple/Dotorixel/Tools/EditorTool.swift` | `recordsDrawColor` per-tool declaration (web `addsActiveColor` analog; eraser/eyedropper/move opt out) |
| `apple/Dotorixel/Tools/StrokeEngine.swift` | single stroke-begin recording point, next to draw-color resolution |
| `apple/Dotorixel/Views/RightPanel.swift` | "Recent" label + swatch row below the color picker; hidden while empty; tap sets foreground |
| `apple/DotorixelTests/RecentColorsTests.swift` | recording points + list semantics (8 tests via `EditorState` public interface) |
| `apple/DotorixelTests/DockedRegionSnapshotTests.swift` | populated Recent row content-regression snapshot + committed baseline |
| `apple/DotorixelTests/README.md` | notes the one content-regression snapshot in the tier-sizing suite |
| `apple/DotorixelTests/StrokeEngineTests.swift` | fake host protocol conformance (no-op — behavior covered in `RecentColorsTests`) |

### Key Decisions

- **`[Color]` storage, not hex strings.** Type-safe (no hex parsing can fail);
  numeric RGB equality makes the web's case-insensitive dedupe inherent. In
  practice every recorded color is opaque, so alpha never splits entries the
  web would merge.
- **Two recording moments, sessions untouched.** Stroke begin records in
  `StrokeEngine.begin` gated by the per-tool `recordsDrawColor` flag (mirrors
  web tool authoring's `addsActiveColor`); eyedropper commits record inside
  `commitColorPick`. No session class changed.
- **Naming: `recordRecentColor` vs web `addRecentColor`.** Deliberate — the
  issue's own vocabulary is "record", and it pairs with `recordsDrawColor`
  inside the Apple shell.
- **The Recent row wraps** (`LazyVGrid`, 22pt swatches) instead of mirroring
  the web's single flex row that squeezes all twelve swatches into the panel
  width.

### Notes

- **Parity gap:** the list is in-memory only; the web persists it in the
  workspace snapshot. Closes with Phase 4 (multi-tab + persistence).
- Tap-sets-foreground is verified by inspection + snapshot only — the Apple
  test stack has no interaction layer (ViewInspector deliberately deferred,
  see `apple/DotorixelTests/README.md`).
