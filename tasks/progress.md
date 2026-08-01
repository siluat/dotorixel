# Progress

## Currently Working On

None

## Last Completed

[260 — Apple layer panel reorder](../issues/260-apple-layer-reorder.md): rows
reorder from a per-row drag handle, closing **Phase 3 of the Apple catch-up
RFC** — the Apple shell now has the full layer system. Touch/pointer feel is the
one thing tests can't reach (no XCUITest, no simulator touch injection), so the
gesture wants a hands-on pass; two follow-ups from it are in the review backlog.

## Next Up

- Phase 4 of the [Apple catch-up RFC](../issues/013-apple-native-catchup.md) — multi-tab + persistence; needs `/to-tickets` to decompose
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
- Feedback link to Google Form
- [255 — Apple Pencil device verification pass (HITL)](../issues/255-apple-pencil-device-verification.md) — waiting on real-hardware access
- (review) In-editor feedback widget
- Reference image window polish — opacity slider, lock toggle, flip H/V, rotate
- Reference image import — clipboard paste support
- Design: share artwork dialog — URL sharing dialog UI (.pen)
- Share artwork via URL
- FG/BG swap UI improvements
- Dark mode toggle UI
- Document error conditions on `PixelCanvas` public API
- IndexedDB quota exceeded error handling
- Document rename
- Canvas resize via border drag
- Timelapse recording
- TimelinePanel mobile touch targets — frame + row icon buttons ≥44px on the mobile Timeline tab
- Web pen priority — palm rejection + hover target cell (web counterpart of 252–254)
- Apple layer reorder — interrupted-drag recovery
- Apple layer panel predicates — `canReorderLayers` vs `canRemoveLayer` number consistency
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change
- Flaky e2e: Reference Window reload persistence — investigate if it recurs
