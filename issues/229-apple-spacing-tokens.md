---
title: Apple spacing tokens — mirror the web spacing scale (PRD)
status: done
created: 2026-07-15
---

## Problem Statement

The Apple shell's docked chrome views space their contents with inline numeric
literals (`2`, `4`, `8`, `12`, `16`). The web shell already names these values as a
design-token spacing scale (`--ds-space-1` through `--ds-space-8`), but the Apple
design-token namespace has no spacing section, so every SwiftUI view re-states raw
numbers that the web expresses by name.

For the developer this means three recurring costs:

- **No design intent.** A reviewer reading `spacing: 12` cannot tell whether 12 is
  a scale step, a web-CSS raw value being mirrored, or an arbitrary choice.
- **Drift risk.** As the Apple shell grows through the catch-up phases, each new
  view copies literals from neighbors; a value that should change everywhere (or
  deliberately differ) has no single authority.
- **Parity audits are manual.** Comparing web and Apple layouts means eyeballing
  raw pixel numbers on one side against token names on the other.

The backlog deferred this until the docked layout settled and reuse was confirmed.
Both conditions now hold: Phase 1 (layout finish) of the Apple catch-up RFC is
complete, and the same five values recur across all four docked chrome views.

## Solution

Extend the Apple design-token namespace with a spacing scale that mirrors the web
sheet's `--ds-space-*` tokens — same numeric naming, same values — and replace the
in-scale inline literals in the four docked chrome views (top bar, left toolbar,
right panel, status bar) with those tokens.

Values that are *not* web tokens (the palette grid's 3, the 6 used for bar edge
padding — both raw CSS values on the web side too) stay component-scoped named
constants, following the existing precedent of component-local sizes documented as
"matching web CSS values (not global design tokens)".

The change is strictly behavior-preserving: rendered output stays pixel-identical,
proven by the existing snapshot baselines passing unchanged.

## User Stories

1. As an Apple shell developer, I want a named spacing scale in the design-token
   namespace, so that I can choose spacing by design intent instead of copying
   magic numbers from neighboring views.
2. As an Apple shell developer, I want the scale's names and values to mirror the
   web's `--ds-space-*` tokens, so that porting a web component's spacing to
   SwiftUI is a direct token-for-token substitution.
3. As a cross-platform maintainer, I want both shells to share one spacing
   vocabulary, so that visual-parity audits compare token names instead of
   eyeballing raw pixel values.
4. As a code reviewer, I want docked chrome views to reference spacing tokens, so
   that any remaining raw number stands out as either an intentional exception or
   a mistake.
5. As a code reviewer, I want intentional off-scale spacing to be a named
   component-scoped constant, so that deviations from the scale are
   self-documenting instead of indistinguishable from arbitrary literals.
6. As a contributor building the next Apple catch-up phases, I want an established
   spacing vocabulary, so that new panels and dialogs stay consistent with the
   existing chrome without reverse-engineering its literals.
7. As a designer, I want one place that lists every spacing value the Apple shell
   uses, so that I can check the implementation against the design token sheet
   without reading view code.
8. As an Apple shell developer, I want regression tests asserting the token
   values, so that an accidental edit to the scale is caught by tests rather than
   visual inspection.
9. As an Apple shell developer, I want this promotion to leave rendering
   pixel-identical, so that existing snapshot baselines remain valid and prove the
   refactor safe.
10. As a maintainer, I want the token file to define only the scale steps the
    shell actually uses, so that it stays a truthful inventory rather than
    speculative infrastructure.
11. As a maintainer, I want each token's doc comment to cite its web counterpart,
    so that provenance is traceable without opening both codebases side by side.
12. As a pixel artist using the Apple app, I want the editor chrome to look and
    behave exactly as before, so that this internal cleanup never disrupts my
    drawing workflow.
13. As an AFK implementation agent, I want the literal→token mapping rules decided
    up front, so that I can execute the substitution mechanically without design
    judgment.

## Implementation Decisions

- **Scale definition.** Add a spacing section to the Apple design-token namespace
  mirroring the web sheet: step 1 = 2, step 2 = 4, step 3 = 8, step 4 = 12,
  step 5 = 16 (points ↔ web px). Numeric naming matches the web tokens 1:1.
- **Only in-use steps.** Define steps 1–5 now — the values the shipped views
  actually use. Steps 6–8 (24/32/48) are added when a first consumer appears,
  matching the token file's existing precedent and the project's
  build-what's-needed-now principle.
- **Doc comments.** Each constant cites its web token name and value, in the same
  style as the existing color and radius tokens.
- **Substitution scope.** The four docked chrome views (top bar, left toolbar,
  right panel, status bar): stack/grid `spacing:` parameters and padding values
  that equal a scale step are replaced by the corresponding token.
- **Off-scale values stay component-local.** 3 (palette grid gap) and 6 (bar edge
  padding, small in-group gaps) are raw CSS values on the web side too — they
  become (or remain) component-scoped named constants per the existing
  component-local-sizes precedent. No Apple-only global tokens are invented; the
  global namespace remains a strict mirror of the web token sheet.
- **Zero stays literal.** `spacing: 0` is structural "no gap", not a design-scale
  value.
- **Sizes are not spacing.** Width/height/frame dimensions (control heights, icon
  sizes) are outside this scale — some are already sizing tokens, the rest stay
  component-local. This task touches gaps and padding only.
- **Plain constants.** Same shape as the existing tokens — static constants, no
  enum wrapper, no spacing "API", no custom view modifiers.
- **Strictly behavior-preserving.** Literal→token substitution only; no value may
  change (3 must not be rounded onto the scale, and no layout "fixes" ride along).
- The dev-only render benchmark view is not editor chrome and is untouched.

## Testing Decisions

- **What makes a good test here:** assert the public contract (token values
  against the web sheet) and the externally visible result (rendered chrome
  unchanged) — never how a view sources a value internally. No "view X uses token
  Y" assertions.
- **Token value suite.** Extend the existing design-token test module with a
  spacing suite asserting each new constant equals its web value — the same
  direct-equality pattern and web-CSS-citing test names as the existing sizing
  suites.
- **Snapshots as the behavior-preservation proof.** The existing docked-region
  snapshot tests (four chrome views × wide/x-wide tiers, pinned iOS simulator)
  must pass without re-recording any baseline. A changed snapshot means the
  substitution altered a value and is a defect, not a baseline update.
- **No static enforcement.** No lint rule banning future inline literals —
  convention and review carry that.
- **Prior art:** the design-token value suites and the docked-region snapshot
  harness (simulator pinning documented in the Apple tests README).

## Out of Scope

- Dark mode / theming work.
- Any change to the web token sheet or web components.
- Normalizing off-scale values onto the scale (that is a visual change).
- Scale steps 6–8 (24/32/48) until a consumer exists.
- Tokenizing the dev-only render benchmark view.
- Lint rules or CI checks banning inline spacing literals.
- Compact-tier layout completion and Phase 2 tool/color work (tracked by the
  Apple catch-up RFC).
- Automated cross-shell token drift checking — reconsider only if drift actually
  bites.

## Further Notes

- Origin: review-backlog item deferred "until the docked layout has settled and
  reuse is confirmed" — both now hold (RFC 013 Phase 1 complete; the five values
  recur across all four docked chrome views).
- **Single-slice size.** Tokens, substitution, and tests fit one PR. Decomposition
  should yield exactly one implementation issue; treating this PRD itself as the
  implementable spec is acceptable.
- Sequencing: independent of RFC 013 Phase 2 content, but landing it first means
  the Phase 2 tool/color views are born on the scale instead of adding more
  literals to migrate later.

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Style/DesignTokens.swift` | Spacing scale `space1`–`space5` (2/4/8/12/16pt) mirroring web `--ds-space-1`–`5`, doc comments cite the web tokens |
| `apple/Dotorixel/Views/TopBar.swift` | In-scale literals → tokens; named `exportLabelSpacing` (web raw `gap: 6px`) and `barEdgePadding` (Apple-specific, see Notes) |
| `apple/Dotorixel/Views/LeftToolbar.swift` | In-scale literals → tokens; named `stripEdgePadding` (web raw `padding: 6px 0`) |
| `apple/Dotorixel/Views/RightPanel.swift` | In-scale literals → tokens; named `paletteGridSpacing` (web raw `gap: 3px`) |
| `apple/Dotorixel/Views/StatusBar.swift` | Horizontal padding literal → `space5` |
| `apple/DotorixelTests/DesignTokensTests.swift` | New spacing suite asserting the five tokens match the web sheet |

### Key Decisions

- Defined only the in-use steps 1–5; steps 6–8 (24/32/48) deferred until a first
  consumer appears, matching the token file's existing precedent.
- Off-scale values (3, 6) stay component-scoped named constants — the global
  namespace remains a strict mirror of the web token sheet.
- `spacing: 0` literals kept (structural "no gap"); sizes and radii untouched.
- Naming unified on SwiftUI vocabulary: `…Spacing` for inter-item gaps,
  `…EdgePadding` for container insets (guide's "consistent domain vocabulary").

### Notes

- PRD imprecision found during implementation: TopBar's 6pt bar edge padding is
  NOT a raw web CSS value — web `.top-bar` uses `--ds-space-5` (16px) on a bare
  logo, while Apple's 6pt plus the 44pt logo hit box yields the same 16pt optical
  margin. The constant's comment documents this.
- Behavior preservation proven as specified: all 8 docked-region snapshots passed
  against existing references (no re-recording); full suite 49 tests green on the
  pinned simulator (iPad Pro 11-inch (M5), iOS 26.4).
