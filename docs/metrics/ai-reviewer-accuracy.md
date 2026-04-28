# AI Reviewer Accuracy

Tracks accept/reject ratios per AI reviewer bot on PR review comments.

## Running Totals

| Reviewer | Total | Accept | Reject | Miss | Accept % | Recall |
|----------|-------|--------|--------|------|----------|--------|
| greptile-apps[bot] | 62 | 49 | 13 | 49 | 79% | 50% |
| cubic-dev-ai[bot] | 40 | 34 | 6 | 60 | 85% | 36% |
| coderabbitai[bot] | 85 | 55 | 30 | 41 | 65% | 57% |

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
| #153 | greptile-apps[bot] | Accept | Mouse-branch clamping absent — mirror touch pattern for degenerate viewports |
| #153 | greptile-apps[bot] | Accept | Clarify "right edge at 1300" test comment with full derivation |
| #153 | coderabbitai[bot] | Accept | `.hex` line-height: 16px — lock CHIP_HEIGHT_PX=24 contract vs ~17px default |
| #153 | greptile-apps[bot] | Miss | Did not flag `.hex` default line-height drift vs CHIP_HEIGHT_PX |
| #153 | coderabbitai[bot] | Miss | Did not flag mouse-branch missing clamp on degenerate viewports |
| #153 | coderabbitai[bot] | Miss | Did not flag misleading "right edge at 1300" test comment |
| #153 | cubic-dev-ai[bot] | Miss | Did not flag mouse-branch missing clamp on degenerate viewports |
| #153 | cubic-dev-ai[bot] | Miss | Did not flag misleading "right edge at 1300" test comment |
| #153 | cubic-dev-ai[bot] | Miss | Did not flag `.hex` default line-height drift vs CHIP_HEIGHT_PX |
| #153 | greptile-apps[bot] | Accept | Touch branch missing y-clamp after vertical flip — clips on mobile-portrait heights |
| #153 | coderabbitai[bot] | Miss | Did not flag touch-branch missing y-clamp (APPROVED review) |
| #153 | cubic-dev-ai[bot] | Miss | Did not flag touch-branch missing y-clamp |
| #156 | cubic-dev-ai[bot] | Accept | Y center axis uses artPixelsAcross instead of artPixelsDown — non-square art bug |
| #156 | greptile-apps[bot] | Accept | End pixel assertion compares against initialStartPixel — silently passes on uniform canvas |
| #156 | greptile-apps[bot] | Accept | WasmFilterResult.free() omitted — FinalizationRegistry mitigates but explicit free preferred for stroke-scoped object |
| #156 | cubic-dev-ai[bot] | Miss | Did not flag end pixel assertion using wrong initial reference |
| #156 | cubic-dev-ai[bot] | Miss | Did not flag WasmFilterResult.free() omission |
| #156 | greptile-apps[bot] | Miss | Did not flag Y center axis bug in artCenterFromGeometry |
| #157 | cubic-dev-ai[bot] | Accept | AC "middle preserved" vs "middle erased" ambiguity — resolved by English translation in amend |
| #157 | greptile-apps[bot] | Reject | `toCss` helper duplication — rule of three, defer until third PP test |
| #157 | greptile-apps[bot] | Reject | Missing pre-paint sanity assertion — contrast assertions already trap silent failure, pencil test has no such guard |
| #157 | greptile-apps[bot] | Miss | Did not flag AC/Key Decisions ambiguity from Korean wording |
| #157 | coderabbitai[bot] | Miss | Did not flag AC/Key Decisions ambiguity (rate-limited review) |
| #158 | greptile-apps[bot] | Accept | `aria-disabled="false"` rendered on enabled PP button — suppress with `\|\| undefined` (TopBar) |
| #158 | greptile-apps[bot] | Accept | `aria-disabled="false"` rendered on enabled PP button (AppBar, same finding as TopBar) |
| #158 | cubic-dev-ai[bot] | Accept | PP button remains clickable when aria-disabled — add component-level click guard |
| #158 | coderabbitai[bot] | Accept | PP button click guard (AppBar; "Also applies to: 75-83" covers TopBar) |
| #158 | cubic-dev-ai[bot] | Accept | platform-status.md "session-persisted" misdocuments IndexedDB-backed storage |
| #158 | greptile-apps[bot] | Miss | Did not flag PP button click guard |
| #158 | greptile-apps[bot] | Miss | Did not flag platform-status.md "session-persisted" misdocumentation |
| #158 | cubic-dev-ai[bot] | Miss | Did not flag `aria-disabled="false"` noise on enabled PP button |
| #158 | coderabbitai[bot] | Miss | Did not flag `aria-disabled="false"` noise on enabled PP button |
| #158 | coderabbitai[bot] | Miss | Did not flag platform-status.md "session-persisted" misdocumentation |
| #161 | greptile-apps[bot] | Accept | Missing exhaustive `default` in drawStart switch — null-deref risk if new DrawTool kind added |
| #161 | greptile-apps[bot] | Accept | `ToolContext` rebuilt per draw call in dragTransform (inconsistent with continuous opener) |
| #161 | coderabbitai[bot] | Accept | `FakePixelCanvas.get_pixel` hardcoded `{0,0,0,0}` — inconsistent with `pixels()`/`restore_pixels` state buffer |
| #161 | coderabbitai[bot] | Accept | Vacuous `restore_pixels` assertion in shapePreview test — use `restoreCalls.length` for real verification |
| #161 | coderabbitai[bot] | Accept | `ToolContext` rebuild in 3 non-continuous openers (duplicate of greptile finding) |
| #161 | coderabbitai[bot] | Reject | Length-validate `restore_pixels` input — "fail at the boundary, trust the core" applies to test stubs |
| #162 | greptile-apps[bot] | Accept | Hardcoded `artPixelCss = pixelSize*2` assumption — add runtime guard on even checker-tile span |
| #162 | greptile-apps[bot] | Reject | `Vec::remove` O(n) in filter loop — batch n~10, premature optimization per YAGNI |
| #162 | greptile-apps[bot] | Miss | Did not flag action emission order (same-batch revisit of reverted tip was wiped) |
| #162 | greptile-apps[bot] | Miss | Did not flag missing negative joint assertions for stair corners |
| #162 | greptile-apps[bot] | Miss | Did not flag "current filter" wording that contradicts the fix in test comment |
| #162 | coderabbitai[bot] | Accept | Emit actions in processing order — same-batch revisit of reverted tip was wiped |
| #162 | coderabbitai[bot] | Accept | Add negative assertions for stair joints (1,0), (2,1), (3,2) to complete PP contract |
| #162 | coderabbitai[bot] | Accept | Reword "the current filter reverts" → "the previous filter reverted" in test comment |
| #162 | coderabbitai[bot] | Miss | Did not flag hardcoded `artPixelCss` assumption |
| #162 | cubic-dev-ai[bot] | Miss | Did not flag hardcoded `artPixelCss` assumption |
| #162 | cubic-dev-ai[bot] | Miss | Did not flag action emission order (same-batch revisit wipe) |
| #162 | cubic-dev-ai[bot] | Miss | Did not flag missing negative joint assertions |
| #162 | cubic-dev-ai[bot] | Miss | Did not flag "current filter" wording in test comment |
| #163 | greptile-apps[bot] | Accept | `customTool` type-signature `spec` shadows outer config — rename to `strokeSpec` |
| #163 | coderabbitai[bot] | Accept | SessionHost JSDoc overstates "fields resolved at stroke begin" — `isShiftHeld` is live, collaborators are mutable |
| #163 | cubic-dev-ai[bot] | Accept | SessionHost JSDoc live vs snapshot contract (duplicate of coderabbit) |
| #163 | coderabbitai[bot] | Accept | Issue 076 note "ToolContext construction per sample" — actually per opened stroke session |
| #163 | greptile-apps[bot] | Miss | Did not flag SessionHost JSDoc live/snapshot contract |
| #163 | greptile-apps[bot] | Miss | Did not flag ToolContext lifecycle wording in issue 076 |
| #163 | coderabbitai[bot] | Miss | Did not flag `customTool` spec parameter shadowing |
| #163 | cubic-dev-ai[bot] | Miss | Did not flag `customTool` spec parameter shadowing |
| #163 | cubic-dev-ai[bot] | Miss | Did not flag ToolContext lifecycle wording in issue 076 |
| #164 | greptile-apps[bot] | Accept | `activeTabIndex` not bounds-checked on Workspace hydration — corrupt snapshot yields `undefined` activeTab |
| #164 | coderabbitai[bot] | Accept | session.test.ts explicit `notifyTabClosed` after `closeTab` masks auto-notifier regression |
| #164 | coderabbitai[bot] | Reject | `closeTab` index validation — internal API, project trusts internal callers per CLAUDE.md |
| #164 | greptile-apps[bot] | Miss | Did not flag test redundancy masking `Workspace.closeTab` auto-notifier path |
| #164 | coderabbitai[bot] | Miss | Did not flag `activeTabIndex` bounds-check gap on hydration |
| #164 | greptile-apps[bot] | Accept | Missing `foregroundColor` in `openSession` call — new users see dark-gray→black flick on fresh session |
| #164 | cubic-dev-ai[bot] | Accept | Clamp restored `activeTabIndex` on hydration (duplicate of greptile finding) |
| #164 | cubic-dev-ai[bot] | Reject | `closeTab` index validation (duplicate of coderabbitai rejection) — internal API, trust callers |
| #164 | cubic-dev-ai[bot] | Reject | `setActiveTab` index validation — internal API, same rationale as closeTab |
| #164 | coderabbitai[bot] | Miss | Did not flag missing `foregroundColor` in `openSession` call |
| #164 | cubic-dev-ai[bot] | Miss | Did not flag missing `foregroundColor` in `openSession` call |
| #165 | greptile-apps[bot] | Accept | Stale `.first()` reference in vacuous-pass guard comment — finding valid; fix taken differently (rewrote comment to describe invariant rather than chase selector name) |
| #165 | coderabbitai[bot] | Miss | Did not flag stale `.first()` reference in guard comment (APPROVED review) |
| #165 | cubic-dev-ai[bot] | Miss | Did not flag stale `.first()` reference in guard comment (APPROVED review) |
| #166 | coderabbitai[bot] | Accept | `pointercancel` routed to `pointerUp` → `onSampleEnd` commits color; should map to `onSampleCancel` like other disruption paths |
| #166 | greptile-apps[bot] | Miss | Did not flag `pointercancel` routing to commit path (APPROVED review) |
| #166 | cubic-dev-ai[bot] | Miss | Did not flag `pointercancel` routing to commit path (APPROVED review) |
| #167 | coderabbitai[bot] | Accept | Window resize during sampling — viewport stale until next pointer event; restore prior behavior |
| #167 | cubic-dev-ai[bot] | Accept | Window resize stale viewport (duplicate of coderabbit/greptile) |
| #167 | greptile-apps[bot] | Accept | Window resize stale viewport (duplicate of coderabbit/cubic) |
| #167 | coderabbitai[bot] | Accept | `commitTarget` non-reset rationale in `reset()` — added a one-line comment |
| #167 | coderabbitai[bot] | Reject | `as const` on loupe-config exports — no consumer narrows on literals, hypothetical benefit |
| #167 | cubic-dev-ai[bot] | Miss | Did not flag `commitTarget` non-reset rationale |
| #167 | greptile-apps[bot] | Miss | Did not flag `commitTarget` non-reset rationale |
| #168 | greptile-apps[bot] | Accept | Clear `referenceErrors` when References modal closes — stale banners on reopen |
| #168 | cubic-dev-ai[bot] | Accept | Clear `referenceErrors` on modal close (duplicate of greptile) |
| #168 | greptile-apps[bot] | Reject | `Promise.allSettled` for parallel imports — typical 1–5 file batches, simpler sequential control flow preferred |
| #168 | cubic-dev-ai[bot] | Accept | Thumbnail dimensions round to 0 for extreme aspect ratios — clamp to min 1px |
| #168 | cubic-dev-ai[bot] | Accept | Block elements (`div`/`p`) inside `<button class="empty-trigger">` — invalid HTML5 button content model |
| #168 | coderabbitai[bot] | Accept | Block elements inside `<button>` empty-trigger (duplicate of cubic) |
| #168 | coderabbitai[bot] | Reject | `onDelete` throws → focus loss — `onDelete` is sync in-memory mutation, no failure path |
| #168 | coderabbitai[bot] | Reject | `referenceErrors` global, not per-document — modal-close clear addresses primary case; per-tab scoping deferred to #056 |
| #168 | greptile-apps[bot] | Miss | Did not flag thumbnail 0-dim rounding bug |
| #168 | greptile-apps[bot] | Miss | Did not flag block-in-button HTML violation |
| #168 | coderabbitai[bot] | Miss | Did not flag stale `referenceErrors` on modal close |
| #168 | coderabbitai[bot] | Miss | Did not flag thumbnail 0-dim rounding bug |
| #168 | greptile-apps[bot] | Reject | Type duplication `ReferenceImageRecord` vs `ReferenceImage` — deliberate IDB↔app boundary, mirrors existing `ViewportRecord`/`SharedStateRecord` pattern |
| #168 | greptile-apps[bot] | Reject | Stale-entry load path in `session-persistence.ts` restore — writer rebuilds map each save, producer cannot create the state being defended against |
| #168 | coderabbitai[bot] | Accept | `.card-text` `<div>` inside `.card-open` `<button>` — same HTML5 phrasing-content rule as the empty-state, missed in earlier round |
| #168 | greptile-apps[bot] | Miss | Did not flag `.card-text` div-in-button violation |
| #168 | cubic-dev-ai[bot] | Miss | Did not flag `.card-text` div-in-button violation (caught the empty-state variant but missed the card variant) |
| #169 | greptile-apps[bot] | Accept | Duplicate `Placement` type — import from compute-initial-placement.ts |
| #169 | greptile-apps[bot] | Reject | `DisplayStateRecord` shape alias to `DisplayState` — deliberate persistence/domain boundary, mirrors `ReferenceImageRecord` pattern |
| #169 | greptile-apps[bot] | Reject | `show`/`close` unconditional `markDirty` guard — internal API, call site already guards via `displayStateFor` |
| #169 | greptile-apps[bot] | Miss | Did not flag Korean particle 을 → 을(를) alternation |
| #169 | greptile-apps[bot] | Miss | Did not flag missing JSDoc contract on `computeInitialPlacement` |
| #169 | greptile-apps[bot] | Miss | Did not flag missing left/top=0 assertion in fit-larger-than-viewport test |
| #169 | greptile-apps[bot] | Miss | Did not flag cascadeIndex collision when reopening after close |
| #169 | cubic-dev-ai[bot] | Miss | Did not flag duplicate `Placement` type |
| #169 | cubic-dev-ai[bot] | Miss | Did not flag Korean particle 을 → 을(를) alternation |
| #169 | cubic-dev-ai[bot] | Miss | Did not flag missing JSDoc on `computeInitialPlacement` |
| #169 | cubic-dev-ai[bot] | Miss | Did not flag missing left/top=0 assertion in fit test |
| #169 | cubic-dev-ai[bot] | Miss | Did not flag cascadeIndex collision when reopening after close |
| #169 | coderabbitai[bot] | Accept | Korean particle 을 → 을(를) alternation for vowel-final filenames |
| #169 | coderabbitai[bot] | Accept | JSDoc contract on `computeInitialPlacement` — non-obvious algorithm warrants doc |
| #169 | coderabbitai[bot] | Accept | objectUrl action duplication — defer to third consumer per "rule of three" |
| #169 | coderabbitai[bot] | Accept | Pin left/top=0 in "fits larger than viewport" overlay test |
| #169 | coderabbitai[bot] | Accept | Cascade index based on visible count collides with closed-but-tracked windows |
| #169 | coderabbitai[bot] | Reject | JSDoc on all public store methods — defaults to no comments unless WHY non-obvious |
| #169 | coderabbitai[bot] | Reject | `display()` upsert to prevent duplicate refId — internal API trusts caller's guard |
| #169 | coderabbitai[bot] | Reject | JSDoc on DisplayState fields — types are self-documenting |
| #169 | coderabbitai[bot] | Reject | `show()` no-op fallback when entry absent — same internal-API rationale |
| #169 | coderabbitai[bot] | Reject | Raise z-order on already-visible click — PRD #056 explicitly defers to #059 |
| #169 | coderabbitai[bot] | Miss | Did not flag duplicate `Placement` type |
| #172 | greptile-apps[bot] | Accept | Min-size floor breaks for negative/zero proposed dims (computeResize) |
| #172 | greptile-apps[bot] | Accept | Missing pointercancel/lostpointercapture handlers leak drag/resize state |
| #172 | greptile-apps[bot] | Accept | `touch-action: none` missing on `.title-bar` |
| #172 | cubic-dev-ai[bot] | Accept | Min-size floor breaks for negative/zero proposed dims (duplicate of greptile) |
| #172 | cubic-dev-ai[bot] | Accept | Missing pointercancel/lostpointercapture handlers (duplicate of greptile) |
| #172 | cubic-dev-ai[bot] | Accept | `touch-action: none` on `.title-bar` (duplicate of greptile) |
| #172 | coderabbitai[bot] | Accept | Min-size floor breaks for zero/negative proposed dims (duplicate of greptile) |
| #172 | coderabbitai[bot] | Accept | `touch-action: none` on `.title-bar` (duplicate of greptile) |
| #172 | coderabbitai[bot] | Miss | Did not flag missing pointercancel/lostpointercapture handlers |
| #173 | coderabbitai[bot] | Accept | Test-count off-by-three in 058 Results table (5 → 8) |
| #173 | coderabbitai[bot] | Accept | Add regression test asserting dblclick on title-bar buttons doesn't toggle minimize (`closest('button')` guard) |
| #173 | greptile-apps[bot] | Accept | Merge two adjacent `{#if !minimized}` blocks in ReferenceWindow.svelte |
| #173 | greptile-apps[bot] | Miss | Did not flag test-count off-by-three in 058 Results table |
| #173 | greptile-apps[bot] | Miss | Did not flag missing dblclick guard regression test |
| #173 | cubic-dev-ai[bot] | Miss | Did not flag test-count off-by-three in 058 Results table |
| #173 | cubic-dev-ai[bot] | Miss | Did not flag missing dblclick guard regression test |
| #173 | cubic-dev-ai[bot] | Miss | Did not flag adjacent `{#if !minimized}` block merge |
| #174 | coderabbitai[bot] | Accept | progress.md/issue 059 wording: store.show() is not idempotent — mutates zOrder above current max on every call |
| #174 | coderabbitai[bot] | Accept | Add regression test pinning displayed-card branch — extracted orchestration to pure selectReference helper for unit-testability |
| #174 | greptile-apps[bot] | Miss | Did not flag inaccurate "idempotent" show() wording (Confidence 5/5 — safe to merge) |
| #174 | greptile-apps[bot] | Miss | Did not flag missing regression test for displayed-card raise path |
| #174 | cubic-dev-ai[bot] | Miss | Did not flag inaccurate "idempotent" show() wording (APPROVED review) |
| #174 | cubic-dev-ai[bot] | Miss | Did not flag missing regression test for displayed-card raise path |
| #175 | greptile-apps[bot] | Accept | sampler.ts full-image getImageData allocates ~48 MB for 12 MP — use (x,y,1,1) for 4 bytes |
| #175 | greptile-apps[bot] | Miss | Did not flag `.resolves.toBeDefined()` with sync-feeling fireEvent.pointerDown |
| #175 | cubic-dev-ai[bot] | Accept | sampler.ts memory efficiency (duplicate of greptile) |
| #175 | cubic-dev-ai[bot] | Accept | `.resolves.toBeDefined()` test cleanup with fireEvent.pointerDown |
| #175 | cubic-dev-ai[bot] | Miss | Did not flag windowToImageCoords/samplePixel doc-comment gap |
| #175 | coderabbitai[bot] | Accept | windowToImageCoords export doc comments — matches sibling pure-utility convention |
| #175 | coderabbitai[bot] | Reject | latest-sample-wins token for sampleReferencePixel — explicitly deferred per issue Notes |
| #175 | coderabbitai[bot] | Reject | sampleReferencePixel method doc comment — inconsistent with TabState sibling-method convention |
| #175 | coderabbitai[bot] | Reject | handleSampleReference method doc comment — inconsistent with EditorController sibling-method convention |
| #175 | coderabbitai[bot] | Miss | Did not flag `.resolves.toBeDefined()` test cleanup |
| #176 | greptile-apps[bot] | Accept | `dispose()` leaves trackedId/origin/last/fired intact — post-dispose pointerUp can fire onEnd |
| #176 | greptile-apps[bot] | Accept | `pendingTapCoords` overwritten by simultaneous second touch — early release samples wrong location |
| #176 | coderabbitai[bot] | Reject | Rename "Blocked by" → "Dependencies (completed)" in issue 079 — established convention across `issues/` tree |
| #176 | cubic-dev-ai[bot] | Miss | Did not flag `dispose()` leaving non-timer state intact |
| #176 | cubic-dev-ai[bot] | Miss | Did not flag `pendingTapCoords` overwrite by simultaneous second touch |
| #176 | coderabbitai[bot] | Miss | Did not flag `dispose()` leaving non-timer state intact (APPROVED review) |
| #176 | coderabbitai[bot] | Miss | Did not flag `pendingTapCoords` overwrite by simultaneous second touch (APPROVED review) |
