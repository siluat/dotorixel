---
title: Apple native — i18n via String Catalog (en/ko/ja)
status: done
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — cross-cutting
concern scheduled "around Phase 2, once the tool/menu label set stabilizes".
This slice closes Phase 2.

## What to build

Introduce localization to the Apple shell the native way — a **String Catalog**
(`.xcstrings`) — covering the same three locales as the web (Paraglide):
**en, ko, ja**.

Migrate every user-facing string to localized lookups: tool display names,
section titles (Canvas, Color, Palette, Recent, …), button labels (Clear,
Export, …), alert titles/messages, status-bar text, and accessibility
labels/values across the editor chrome. After this slice, adding a
user-facing string means adding a catalog entry, not a hardcoded literal.

Translation reference: the web's message catalogs are the source of truth for
terminology — reuse their ko/ja translations wherever the same concept appears
(domain-glossary consistency across shells), and follow platform conventions
where the web has no counterpart (e.g. Edit-menu items).

Scope notes:

- Locale switching follows the system language (native convention) — no in-app
  language picker, and URL-style routing does not apply.
- The XcodeGen project definition must pick up the catalog and declared
  localizations so a regenerated project stays localized.
- Number/date formatting is not in scope (nothing user-facing needs it yet);
  the zoom percentage and canvas dimensions stay as-is.

## Acceptance criteria

- A String Catalog exists with en/ko/ja entries for every user-facing string in
  the editor chrome; no hardcoded user-visible literals remain in the docked
  views (spot-checkable by switching the simulator/system language).
- Terminology matches the web's ko/ja catalogs where concepts overlap (tool
  names, Clear, Export, section titles).
- Accessibility labels and values localize too.
- Running the app in ko and ja shows translated chrome without layout breakage
  in the docked regions (snapshot baselines for at least one non-en locale on
  the pinned test host, per the snapshot-testing README).
- Project regeneration via XcodeGen preserves the localization setup.

## Blocked by

Label-set stability — the Phase 2 UI slices that introduce user-facing strings:

- [231 — shape tools](231-apple-shape-tools.md)
- [232 — flood fill](232-apple-flood-fill.md)
- [233 — FG/BG color pair](233-apple-fg-bg-colors.md)
- [234 — eyedropper tool](234-apple-eyedropper.md)
- [235 — sampling loupe](235-apple-sampling-loupe.md)
- [236 — move tool](236-apple-move-tool.md)
- [237 — recent colors](237-apple-recent-colors.md)
- [238 — HSV picker](238-apple-hsv-picker.md)
- [239 — pixel-perfect toggle](239-apple-pixel-perfect.md)
- [240 — Shift constrain + latch](240-apple-shift-constrain.md)
- [241 — keyboard shortcuts](241-apple-keyboard-shortcuts.md)

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Localizable.xcstrings` | String Catalog — 40 entries, en source + translated ko/ja; web-catalog key mapping recorded per entry in `comment` (`web: tool_pencil` …); `Dotorixel`/`HSV` marked `shouldTranslate: false` |
| `apple/Dotorixel/Tools/EditorTool.swift` | `displayName: String` → `LocalizedStringResource` (Foundation-only, no SwiftUI dependency) so the status bar re-resolves per locale |
| `apple/Dotorixel/Views/LeftToolbar.swift` | Composed tool label ("Pencil (P)") resolved eagerly via `String(localized:)` — follows system language |
| `apple/Dotorixel/Views/RightPanel.swift` | Preset accessibility label Int-cast so the catalog format key is a stable `%lld by %lld` |
| `apple/DotorixelTests/LocalizationTests.swift` | New: bundle-localizations contract (en/ko/ja survive XcodeGen regen), catalog completeness gate, tool-terminology web-parity tests (8 tools × 3 locales) |
| `apple/DotorixelTests/DockedRegionSnapshotTests.swift` | 4 ko-locale snapshots (`.wide`, all leaf views) + baselines under `__Snapshots__/` — translated chrome renders without layout breakage |
| `apple/DotorixelTests/EditorToolTests.swift` | Old en-only displayName suite removed — superseded by the terminology-parity suite |
| `apple/DotorixelTests/README.md` | Documents the locale-snapshot coverage class |

### Key Decisions

- **Native-convention keys** (English literal as key) over web-style semantic keys
  (`tool_pencil`): SwiftUI auto-extraction keeps view code natural-language and the
  diff minimal; cross-shell mapping lives in each entry's `comment` field instead.
- **`LocalizedStringResource` for `displayName`**: Foundation type keeps
  `EditorTool` framework-free, resolves with an explicit locale in unit tests, and
  follows the SwiftUI environment locale in `Text` (verified by the ko snapshot).
- **Completeness gate reads the `.xcstrings` source via `#filePath`** — the
  compiled bundle drops per-entry translation state. Same local-gate policy as the
  snapshot tests; revisit if remote CI changes the checkout layout.
- ko chosen as the snapshot locale (widest text-length deltas); DEBUG-only
  benchmark screen excluded from the catalog per scope review.

### Notes

- Accessibility labels resolve via `Locale.current` (system language), not the
  injected environment locale — snapshot tests cover visible text only; VoiceOver
  spot-check by switching the simulator/system language is still recommended.
- Adding a user-facing string without ko/ja translations now fails
  `StringCatalogCompletenessTests` — the "catalog entry, not hardcoded literal"
  contract is test-enforced.
- ja has no snapshot baseline (per scope decision); its terminology is guarded by
  the unit tests instead.
- This closes RFC 013 Phase 2; the RFC stays open for Phases 3–6.
