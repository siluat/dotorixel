---
title: Apple Timeline panel shell — layer sidebar at its final home
status: done
created: 2026-08-01
---

> *This issue was created from a placement-decision review with the user
> after 259 — it supersedes the interim RightPanel placement recorded in
> 258's Key Decisions.*

## Parent

[013 — Apple native catch-up — phased strategy to reach full web parity](013-apple-native-catchup.md)
(Phase 3 — Layer system)

## Why

The web's layer UI lives in the bottom-docked Timeline panel — built at
that final location back in M3 (issue 093), frames-less, and *extended*
with the frame axis in M4 without a rebuild. The Apple shell instead
placed its Layers section in the RightPanel (258–259) because the RFC's
hybrid design decision listed only the pre-Timeline four regions as the
layout reference. That reading is stale: the reference is the web's
*current* docked layout, cross-platform parity is a stated priority, and
the "migrate at Phase 6" note had no recovery guarantee. Migrate now,
before reorder (260) builds drag interactions in a temporary home.

## What to build

A bottom-docked Timeline panel shell (web `TimelinePanel` and the
`092 — TimelinePanel Design Spec` as reference, SwiftUI-native controls
per the hybrid principle), containing the layer sidebar migrated from the
RightPanel:

- **Panel shell** docked below the canvas viewport at the wide/x-wide
  tiers: expanded and collapsed states with a chevron toggle (web parity
  visuals; the frame area stays hidden/placeholder exactly as the web's
  M3 treatment did — the frame axis arrives with Phase 6).
- **Layer sidebar**: the existing rows (active selection, visibility eye)
  and 259's add/remove controls move in unchanged behavior-wise —
  `EditorState` commands are placement-independent and must not change.
- **RightPanel Layers section removed** — one home for layer UI.
- Collapse state is in-memory only (Phase 4 owns persistence, like recent
  colors and pixel-perfect).
- **Cleanup while migrating** (from the 259 Standards review): the panel
  icon buttons (add `+`, remove `✕`, visibility eye) repeat the same
  compact-chrome/44pt-hit-area shape and comment — extract a shared
  icon-button helper so the idiom and its rationale live once.
- Touch targets ≥ 44 pt; any new labels in the String Catalog (en/ko/ja);
  docked snapshot baselines updated (RightPanel shrinks, new panel strip).

## Acceptance criteria

- The panel renders docked below the canvas at wide/x-wide, with expanded
  ⇄ collapsed toggling; the collapsed strip keeps the chevron reachable.
- Layer rows, active selection, visibility toggling, and add/remove all
  work in the new home with unchanged history semantics (the 258/259 test
  suites stay green without behavioral edits).
- The RightPanel no longer shows a Layers section.
- Existing viewport behavior (zoom/pan/fit, canvas centering) accounts
  for the reduced canvas viewport height.
- Snapshot tests cover the panel's expanded and collapsed states; stale
  RightPanel baselines re-recorded.
- macOS and iPadOS targets build clean.

## Blocked by

- [259 — Apple layer panel — add and remove layers](259-apple-layer-add-remove.md)

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Views/TimelinePanel.swift` | New bottom-docked panel: header (`+` / `Layers` label / chevron), divider, body of layer sidebar (256pt) → divider → frame placeholder. Collapsed renders the header strip alone — the body and add action leave the hierarchy, so no row control stays focusable. Sidebar and frame column scroll as one unit, keeping row N aligned with cell N. |
| `apple/Dotorixel/Style/PanelIconButton.swift` | Shared panel icon-button view (compact glyph + 44pt hit area + disabled dimming), the 259 Standards review's extraction. Used by add / remove / visibility / chevron and the RightPanel swap. |
| `apple/Dotorixel/Views/RightPanel.swift` | Layers section removed; swap button moved onto `PanelIconButton` (5 sizing constants dropped). |
| `apple/Dotorixel/State/EditorState.swift` | `isTimelinePanelCollapsed` (`private(set)`) + `toggleTimelinePanel()`. In-memory only; not undoable. No layer command changed. |
| `apple/Dotorixel/ContentView.swift` | Panel docked in the canvas column only, matching the web grid's `toolbar timeline panel` row. The canvas `GeometryReader` shrinks by the panel height and its existing `onChange(of: geo.size)` refits the viewport on every collapse/expand. |
| `apple/Dotorixel/Style/DesignTokens.swift` | `timelinePanelHeight` (200) and `timelineSidebarWidth` (256); header doc corrected to describe what the file actually mirrors. |
| `apple/Dotorixel/Localizable.xcstrings` | 4 entries × en/ko/ja: `Layers · %@`, `Collapse layers panel`, `Expand layers panel`, `Frames arrive with animation support`. |
| `apple/DotorixelTests/EditorStateTests.swift` | `EditorState — Timeline panel collapse`: default expanded + toggle round-trip; collapsing records no history entry and no re-render signal. |
| `apple/DotorixelTests/DesignTokensTests.swift` | Panel height and sidebar width value tests. |
| `apple/DotorixelTests/DockedRegionSnapshotTests.swift` | 4 `TimelinePanel` snapshots (expanded / collapsed / multi-layer / ko). The multi-layer layer-row baseline moved here from `RightPanel`; 5 RightPanel baselines re-recorded. |
| `apple/DotorixelTests/README.md` | Documents `TimelinePanel` as the one docked region with no tier-driven axis. |

### Key Decisions

- **Panel height 200pt, not the spec's proportion.** 092 §8 specifies desktop
  expanded 180 (header 32 + ≈4.5 rows of 32). Apple rows are 44pt for touch, so
  scaling the spec's row count would give 244pt and eat the canvas viewport on a
  portrait iPad. 200pt keeps the header plus ≈3.5 rows. No tier variance — neither
  the web nor the spec varies this panel at the 1440 breakpoint, so it is the one
  docked region without a `LayoutTier` parameter.
- **Frame area follows the spec's M3 treatment** (092 §7): one static cell column
  per layer plus a hint, so the frame ruler grows into reserved space in Phase 6.
  The hint is user-facing wording ("Frames arrive with animation support") rather
  than the web's internal milestone phrasing, and is in the String Catalog.
- **Docked to the canvas column only.** The web grid places `timeline` between
  `toolbar` and `panel`, not spanning them; the Apple layout now nests
  canvas + panel in a `VStack` inside the region `HStack` to match.
- **Layer row type scale restored to the spec value.** 258 used 11pt to fit the
  200pt right panel; the 256pt sidebar takes the 13pt of 092 §1 (`name-text`
  fontSize 13, "13px Inter · truncate end") and web `.name`
  (`--ds-font-size-md`), with `lineLimit(1)` + tail truncation for the ellipsis.
- **Disabled icon dimming corrected to the web value.** 258/259 dimmed the
  disabled remove `✕` to 0.55; web `.remove-btn:disabled` is 0.35. Remove is the
  only panel icon that disables today, so `PanelIconButton` holds one constant —
  a second disable-capable button would make it per-call-site.

### Notes

- Collapse state is session-transient by design; Phase 4 owns persistence
  alongside recent colors and pixel-perfect.
- `PanelIconButton` is deliberately distinct from `IconButtonStyle` (the TopBar's
  chrome: full 44pt fill, 18pt glyph, hover/press background). Both live in
  `Style/` so the two icon-button idioms are found together.
- The composed `ContentView` layout stays outside snapshot coverage (the
  Metal-backed canvas boundary documented in the tests README); the docked result
  was verified by running the app on the pinned iPad simulator.
- Reorder (260) now builds its drag interaction in this final home, as intended.
