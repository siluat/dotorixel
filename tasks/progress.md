# Progress

## Currently Working On

None

## Last Completed

[226 — Apple view test infrastructure (snapshot testing)](../issues/226-apple-view-test-infrastructure.md): the docked leaf region views (RightPanel/LeftToolbar/TopBar/StatusBar) now have swift-snapshot-testing coverage at the wide/xWide tiers, recorded on a pinned iPad Pro 11" (M5) iOS 26.4 simulator (local gate — no macOS CI yet). Leaf-only by design; `ContentView`/Metal and the `width→tier` link stay out of snapshot scope (covered by `LayoutTierTests`), and XCUITest/ViewInspector are documented as deferred.

## Next Up

- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
- Apple spacing tokens — promote inline 4/8/12/16 literals to constants (docked layout now settled)
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
- Apple Pencil: hover preview + palm rejection
- Feedback link to Google Form
- (review) In-editor feedback widget
- Reference image window polish — opacity slider, lock toggle, flip H/V, rotate
- Reference image import — clipboard paste support
- Design: share artwork dialog — URL sharing dialog UI (.pen)
- FG/BG swap UI improvements
- Dark mode toggle UI
- Document error conditions on `PixelCanvas` public API
- IndexedDB quota exceeded error handling
- Document rename
- Canvas resize via border drag
- Timelapse recording
- TimelinePanel mobile touch targets — frame + row icon buttons ≥44px on the mobile Timeline tab
