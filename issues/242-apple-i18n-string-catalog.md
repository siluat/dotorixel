---
title: Apple native — i18n via String Catalog (en/ko/ja)
status: ready-for-agent
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
