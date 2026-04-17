# AI Reviewer Accuracy

Tracks accept/reject ratios per AI reviewer bot on PR review comments.

## Running Totals

| Reviewer | Total | Accept | Reject | Miss | Accept % | Recall |
|----------|-------|--------|--------|------|----------|--------|
| greptile-apps[bot] | 30 | 25 | 5 | 24 | 83% | 51% |
| cubic-dev-ai[bot] | 23 | 19 | 4 | 29 | 83% | 40% |
| coderabbitai[bot] | 43 | 27 | 16 | 22 | 63% | 55% |

## Log

| PR | Reviewer | Verdict | Summary |
|----|----------|---------|---------|
| #131 | greptile-apps[bot] | Accept | Scoped CSS custom property for repeated #8a5d20 |
| #131 | cubic-dev-ai[bot] | Reject | Suggested `on:click` — Svelte 4 syntax, project uses Svelte 5 |
| #131 | cubic-dev-ai[bot] | Reject | Suggested `on:keydown` — same Svelte 4/5 confusion |
| #131 | coderabbitai[bot] | Reject | Claimed status:done conflicts with TopControlsRight — component not rendered |
| #131 | coderabbitai[bot] | Accept | Trim before stripKnownExtension — real trailing-space bug |
| #132 | greptile-apps[bot] | Accept | Form state resets visibly during close animation |
| #132 | greptile-apps[bot] | Reject | Global class names collision risk — names are specific enough |
| #132 | greptile-apps[bot] | Accept | Unused handleExport function — dead code |
| #132 | cubic-dev-ai[bot] | Accept | Form reset timing during close animation (duplicate of greptile) |
| #132 | coderabbitai[bot] | Reject | vaul-svelte Svelte 5 incompatibility — works correctly, tests pass |
| #134 | coderabbitai[bot] | Reject | "constrain tests" wording in RFC — function-name-derived modifier, clear in context |
| #134 | coderabbitai[bot] | Accept | isValidToolType uses `in` operator accepting prototype keys — regression from Set.has() |
| #134 | cubic-dev-ai[bot] | Accept | isValidToolType uses `in` operator (duplicate of coderabbit finding) |
| #134 | greptile-apps[bot] | Miss | Did not flag isValidToolType prototype key regression |
| #135 | coderabbitai[bot] | Reject | Rename `saved` to `isSaved` (persistence.ts) — past participle is idiomatic |
| #135 | coderabbitai[bot] | Reject | Rename `saved` to `isSaved` (types.ts) — same finding |
| #135 | coderabbitai[bot] | Accept | Migration test asserts via normalized read, not raw DB |
| #135 | coderabbitai[bot] | Accept | Await deleteDatabase before reopening in test |
| #135 | coderabbitai[bot] | Accept | Capture documentId before async flush to prevent stale index |
| #135 | cubic-dev-ai[bot] | Accept | Capture documentId before async flush (duplicate of coderabbit) |
| #135 | cubic-dev-ai[bot] | Accept | Migration test asserts via normalized read (duplicate of coderabbit) |
| #135 | cubic-dev-ai[bot] | Miss | Did not flag await deleteDatabase race condition |
| #135 | greptile-apps[bot] | Reject | dispose/flush race in onMount cleanup — pre-existing issue, out of scope |
| #135 | greptile-apps[bot] | Miss | Did not flag migration test raw DB assertion |
| #135 | greptile-apps[bot] | Miss | Did not flag await deleteDatabase race condition |
| #135 | greptile-apps[bot] | Miss | Did not flag stale index after async flush |
| #135 | cubic-dev-ai[bot] | Reject | Claimed greptile running totals mismatch — totals are correct |
| #136 | greptile-apps[bot] | Accept | Enter on Delete/Cancel triggers concurrent save race |
| #136 | cubic-dev-ai[bot] | Accept | Stale saveDialogTabIndex after closeTab during await |
| #136 | cubic-dev-ai[bot] | Accept | Enter-to-save not restricted to input (duplicate of greptile) |
| #136 | greptile-apps[bot] | Miss | Did not flag stale saveDialogTabIndex after closeTab |
| #136 | coderabbitai[bot] | Miss | Did not flag Enter-key concurrent save race |
| #136 | coderabbitai[bot] | Miss | Did not flag stale saveDialogTabIndex after closeTab |
| #136 | coderabbitai[bot] | Accept | Clear saveDialogTabIndex before closeTab in save path (consistency with delete) |
| #136 | greptile-apps[bot] | Miss | Did not flag stale index in save path |
| #136 | cubic-dev-ai[bot] | Miss | Did not flag stale index in save path |
| #137 | greptile-apps[bot] | Accept | Missing initial focus on dialog open |
| #137 | greptile-apps[bot] | Accept | No :focus-visible style on keyboard-focusable cards |
| #137 | greptile-apps[bot] | Miss | Did not flag async onDelete promise discard |
| #137 | greptile-apps[bot] | Miss | Did not flag hardcoded "Close" aria-label |
| #137 | greptile-apps[bot] | Miss | Did not flag missing aria-expanded on TopBar browse button |
| #137 | cubic-dev-ai[bot] | Accept | :focus-visible on cards (duplicate of greptile) |
| #137 | cubic-dev-ai[bot] | Accept | Async onDelete promise discard (duplicate of coderabbit) |
| #137 | cubic-dev-ai[bot] | Miss | Did not flag missing initial focus on dialog open |
| #137 | cubic-dev-ai[bot] | Miss | Did not flag hardcoded "Close" aria-label |
| #137 | cubic-dev-ai[bot] | Miss | Did not flag missing aria-expanded on TopBar browse button |
| #137 | coderabbitai[bot] | Accept | Async onDelete callback — promise discard on IndexedDB failure |
| #137 | coderabbitai[bot] | Accept | Hardcoded "Close" aria-label — i18n inconsistency |
| #137 | coderabbitai[bot] | Accept | Missing aria-expanded on TopBar browse button |
| #137 | coderabbitai[bot] | Miss | Did not flag missing initial focus on dialog open |
| #137 | coderabbitai[bot] | Miss | Did not flag :focus-visible on keyboard-focusable cards |
| #137 | coderabbitai[bot] | Accept | Stacked modal AT — move focus into alertdialog, hide parent from AT |
| #137 | coderabbitai[bot] | Accept | Nested interactive elements — card role="button" containing button |
| #137 | greptile-apps[bot] | Miss | Did not flag stacked modal AT issue |
| #137 | greptile-apps[bot] | Miss | Did not flag nested interactive elements in card |
| #137 | cubic-dev-ai[bot] | Miss | Did not flag stacked modal AT issue |
| #137 | cubic-dev-ai[bot] | Miss | Did not flag nested interactive elements in card |
| #137 | greptile-apps[bot] | Accept | Async delete promise discard — dialog stuck on failure |
| #137 | cubic-dev-ai[bot] | Miss | Did not flag async delete failure in confirmDelete |
| #137 | coderabbitai[bot] | Miss | Did not flag async delete failure in confirmDelete |
| #137 | coderabbitai[bot] | Reject | Claimed running totals mismatch — totals are correct, bot miscounted |
| #137 | coderabbitai[bot] | Reject | ResizeObserver for thumbnails — edge case, modal is fixed 640px width |
| #138 | greptile-apps[bot] | Accept | Race condition — stale close timer fires after sheet re-opened |
| #138 | greptile-apps[bot] | Accept | Accent color shifts from export to browse button via :first-of-type |
| #138 | greptile-apps[bot] | Miss | Did not flag ResizeObserver for responsive thumbnail redraw |
| #138 | cubic-dev-ai[bot] | Accept | Race condition — stale close timer (duplicate of greptile) |
| #138 | cubic-dev-ai[bot] | Miss | Did not flag ResizeObserver for responsive thumbnail redraw |
| #138 | cubic-dev-ai[bot] | Miss | Did not flag accent color :first-of-type regression |
| #138 | coderabbitai[bot] | Accept | Race condition — stale close timer (duplicate of greptile) |
| #138 | coderabbitai[bot] | Reject | Immediate drawerOpen=false — breaks close animation, pattern matches ExportBottomSheet |
| #138 | coderabbitai[bot] | Accept | ResizeObserver for thumbnails — now valid with responsive 2/3 column grid |
| #138 | coderabbitai[bot] | Miss | Did not flag accent color :first-of-type regression |
| #139 | greptile-apps[bot] | Accept | Missing pointercancel handler leaks drag state on iOS |
| #139 | greptile-apps[bot] | Accept | a[href] omitted from focusable selector |
| #139 | greptile-apps[bot] | Accept | Scroll lock never restored on component unmount |
| #139 | greptile-apps[bot] | Accept | Tab key handled twice when delete dialog inside BottomSheet |
| #139 | greptile-apps[bot] | Miss | Did not flag window listener leak on unmount |
| #139 | greptile-apps[bot] | Miss | Did not flag disabled/hidden form controls in selector |
| #139 | coderabbitai[bot] | Accept | Remove unused vaul-svelte dependency (already addressed) |
| #139 | coderabbitai[bot] | Accept | Window event listeners not cleaned on unmount during drag |
| #139 | coderabbitai[bot] | Accept | disabled/hidden form controls in focusable selector |
| #139 | coderabbitai[bot] | Accept | Capture and restore original body overflow value |
| #139 | coderabbitai[bot] | Reject | Test container cleanup — happy-dom resets DOM between files |
| #139 | coderabbitai[bot] | Miss | Did not flag pointercancel handler for iOS |
| #139 | coderabbitai[bot] | Miss | Did not flag a[href] in focusable selector |
| #139 | coderabbitai[bot] | Miss | Did not flag Tab double handling in delete dialog |
| #139 | cubic-dev-ai[bot] | Miss | Did not flag pointercancel handler |
| #139 | cubic-dev-ai[bot] | Miss | Did not flag a[href] selector |
| #139 | cubic-dev-ai[bot] | Miss | Did not flag scroll lock unmount |
| #139 | cubic-dev-ai[bot] | Miss | Did not flag window listener unmount |
| #139 | cubic-dev-ai[bot] | Miss | Did not flag Tab double handling |
| #139 | cubic-dev-ai[bot] | Miss | Did not flag disabled/hidden selector |
| #139 | coderabbitai[bot] | Reject | isTabbable function for hidden/inert/aria-hidden — scenarios don't occur in codebase |
| #140 | greptile-apps[bot] | Accept | Merge duplicate canvas-model imports in draw-tool.ts and tool-runner.svelte.ts |
| #140 | cubic-dev-ai[bot] | Miss | Did not flag duplicate canvas-model imports |
| #140 | coderabbitai[bot] | Miss | Did not flag duplicate canvas-model imports |
| #142 | greptile-apps[bot] | Accept | "Floating Panel" appears in both deprecated list and recommended component patterns — ambiguous |
| #142 | greptile-apps[bot] | Miss | Did not flag `globs:` non-standard frontmatter format |
| #142 | cubic-dev-ai[bot] | Accept | `globs:` frontmatter non-standard — switch to `paths:` + YAML list (duplicate of coderabbit finding) |
| #142 | cubic-dev-ai[bot] | Miss | Did not flag "Floating Panel" naming ambiguity |
| #142 | coderabbitai[bot] | Accept | Use `paths:` + YAML list per Anthropic docs, not `globs:` comma-separated |
| #142 | coderabbitai[bot] | Reject | Tagline "A pixel art editor." too minimal — user-intentional simplification, Future Directions covers positioning |
| #142 | coderabbitai[bot] | Miss | Did not flag "Floating Panel" naming ambiguity |
| #144 | greptile-apps[bot] | Accept | Weak canvas size assertion — `toContainText('24')` passes for partial resize |
| #144 | greptile-apps[bot] | Accept | Stale comment says "change color via palette" but code switches tools |
| #144 | greptile-apps[bot] | Reject | Hardcoded y=10 scan row — art area always starts below row 10 in current renderer |
| #144 | greptile-apps[bot] | Reject | Duplicate smoke test overlap — drawing.test adds status-size/tool checks |
| #144 | greptile-apps[bot] | Miss | Did not flag multi-step redo pixel verification gap |
| #144 | greptile-apps[bot] | Miss | Did not flag scanX clamp and boundary validation |
| #144 | cubic-dev-ai[bot] | Accept | Multi-step redo test lacks pixel verification after redo |
| #144 | cubic-dev-ai[bot] | Accept | Weak canvas size assertion — `toContainText('24')` (duplicate of greptile) |
| #144 | cubic-dev-ai[bot] | Accept | Weak preset size assertion — `toContainText('32')` misses one-axis failures |
| #144 | cubic-dev-ai[bot] | Miss | Did not flag stale comment in history test |
| #144 | cubic-dev-ai[bot] | Miss | Did not flag scanX clamp and boundary validation |
| #144 | coderabbitai[bot] | Accept | scanX not clamped to canvas bounds, artRight/artBottom not validated |
| #144 | coderabbitai[bot] | Accept | Multi-step redo test lacks canRedo and pixel verification (duplicate of cubic) |
| #144 | coderabbitai[bot] | Accept | Stale comment in history test (duplicate of greptile) |
| #144 | coderabbitai[bot] | Reject | Extract save dialog setup helper — 3 tests is acceptable repetition per project guidelines |
| #144 | coderabbitai[bot] | Miss | Did not flag weak canvas size assertions (32×32, 24×24) |
| #144 | coderabbitai[bot] | Miss | Did not flag weak preset size assertion (32) |
| #146 | coderabbitai[bot] | Accept | `curl \| sh` wasm-pack installer — replace with pinned `cargo install --locked` |
| #146 | coderabbitai[bot] | Accept | `bun install --frozen-lockfile` for deterministic CI |
| #146 | coderabbitai[bot] | Reject | Pin `ubuntu-latest` and `rust-toolchain@stable` (nitpick) — low-risk for current scope |
| #146 | coderabbitai[bot] | Miss | Did not flag missing dependency caching |
| #146 | greptile-apps[bot] | Accept | `curl \| sh` wasm-pack installer (duplicate of coderabbit) |
| #146 | greptile-apps[bot] | Accept | Missing dependency caching for cargo, wasm/target, Playwright |
| #146 | greptile-apps[bot] | Miss | Did not flag `bun install --frozen-lockfile` |
| #146 | cubic-dev-ai[bot] | Accept | `curl \| sh` wasm-pack installer (duplicate of coderabbit) |
| #146 | cubic-dev-ai[bot] | Miss | Did not flag `bun install --frozen-lockfile` |
| #146 | cubic-dev-ai[bot] | Miss | Did not flag missing dependency caching |
| #146 | greptile-apps[bot] | Accept | `wasm/target` cache path wrong — workspace target is at repo root |
| #146 | coderabbitai[bot] | Miss | Did not flag `wasm/target` workspace path error |
| #146 | cubic-dev-ai[bot] | Miss | Did not flag `wasm/target` workspace path error |
| #148 | coderabbitai[bot] | Accept | Landing row "responsive at 600px" understates 600/1024 breakpoints |
| #148 | coderabbitai[bot] | Reject | Deeper per-locale E2E assertions (H3, alt) — couples tests to copy; Paraglide compile-time prevents key miss |
| #148 | cubic-dev-ai[bot] | Accept | Editor mockup test only checks visibility, not asset load (`naturalWidth > 0`) |
| #148 | cubic-dev-ai[bot] | Reject | Claimed mockup should be decorative (`alt=""`) — image is informative, team provides translated alt |
| #148 | greptile-apps[bot] | Reject | `color: white` in `.cta` — literal appears in 15+ places across codebase, no `--ds-text-on-accent` token exists |
| #148 | greptile-apps[bot] | Miss | Did not flag platform-status landing row wording inaccuracy |
| #148 | greptile-apps[bot] | Miss | Did not flag editor mockup asset-load verification gap |
| #148 | cubic-dev-ai[bot] | Miss | Did not flag platform-status landing row wording inaccuracy |
| #148 | coderabbitai[bot] | Miss | Did not flag editor mockup asset-load verification gap |
| #149 | greptile-apps[bot] | Accept | `onclick` writes locale on middle-click / modifier-click — should guard non-primary clicks |
| #149 | coderabbitai[bot] | Accept | Scenario #1 says URL becomes `/ko/` but `routeStrategies` keeps URL at `/` |
| #149 | cubic-dev-ai[bot] | Accept | Scenario #1 URL inconsistency (duplicate of coderabbit) |
| #149 | greptile-apps[bot] | Miss | Did not flag Scenario #1 URL inconsistency |
| #149 | coderabbitai[bot] | Miss | Did not flag middle-click localStorage write on language selector |
| #149 | cubic-dev-ai[bot] | Miss | Did not flag middle-click localStorage write on language selector |
| #151 | greptile-apps[bot] | Accept | CSS grid template hardcoded to 9 — extract `--grid-columns` token |
| #151 | greptile-apps[bot] | Accept | `swatch--empty` class applied but has no CSS rule |
| #151 | greptile-apps[bot] | Miss | Did not flag commitTarget first-draw scoping |
| #151 | coderabbitai[bot] | Accept | Scope commitTarget to first-draw in liveSampleLifecycle (expresses pinned-once invariant) |
| #151 | coderabbitai[bot] | Reject | Extract makeRunner test helper — 5 setup sites are intentional variants, not identical duplication |
| #151 | coderabbitai[bot] | Reject | Add comment explaining `#each` index key — idiomatic on fixed-length 81-cell grid |
| #151 | coderabbitai[bot] | Miss | Did not flag hardcoded `repeat(9, ...)` invariant |
| #151 | coderabbitai[bot] | Miss | Did not flag `swatch--empty` without CSS rule |
| #151 | cubic-dev-ai[bot] | Miss | Did not flag hardcoded `repeat(9, ...)` invariant |
| #151 | cubic-dev-ai[bot] | Miss | Did not flag `swatch--empty` without CSS rule |
| #151 | cubic-dev-ai[bot] | Miss | Did not flag commitTarget first-draw scoping |
| #152 | greptile-apps[bot] | Accept | Inline `style:background-color` overrides `.cell--transparent` #FFFFFF base on cells and swatch |
| #152 | greptile-apps[bot] | Accept | Stale JSDoc on `cellFill` referring to "slices E/F" (duplicate of coderabbit) |
| #152 | greptile-apps[bot] | Miss | Did not flag E2E `.first()` palette-swatch default collision |
| #152 | greptile-apps[bot] | Miss | Did not flag test-count off-by-one in issue 066 Results (4 vs 5) |
| #152 | coderabbitai[bot] | Accept | Stale JSDoc on `cellFill` referring to "slices E/F" |
| #152 | coderabbitai[bot] | Miss | Did not flag inline style override on transparent/out-of-canvas cells |
| #152 | coderabbitai[bot] | Miss | Did not flag E2E `.first()` palette-swatch default collision |
| #152 | coderabbitai[bot] | Miss | Did not flag test-count off-by-one in issue 066 Results |
| #152 | cubic-dev-ai[bot] | Accept | Inline style overrides checkerboard base on transparent cells (duplicate of greptile) |
| #152 | cubic-dev-ai[bot] | Accept | E2E `.first()` palette-swatch default collision — add colorAHex + assertion |
| #152 | cubic-dev-ai[bot] | Accept | Test-count off-by-one in issue 066 Results (4 vs 5) |
| #152 | cubic-dev-ai[bot] | Miss | Did not flag stale JSDoc on `cellFill` |
