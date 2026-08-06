# Progress

## Currently Working On

Apple catch-up Phase 5 — reference + selection + transforms
([RFC](../issues/013-apple-native-catchup.md)); 1/16 sub-issues done (267),
unblocking 268 + 269. Frontier: {268, 269, 277}.

## Last Completed

[267 — Apple UniFFI selection + transform bindings](../issues/267-apple-uniffi-selection-transform-bindings.md):
the full Marquee / region-op / two-tier transform surface exposed over UniFFI,
expand-only. Marquee crosses as a Record with boundary validation (not the
wasm-style opaque object) — see the issue's Key Decisions.

## Next Up

- [268 — Apple canvas transforms (right panel)](../issues/268-apple-canvas-transforms.md) — Phase 5, unblocked by 267
- [269 — Apple marquee select tool](../issues/269-apple-marquee-select-tool.md) — Phase 5, unblocked by 267
- [277 — Apple UniFFI reference bindings](../issues/277-apple-uniffi-reference-bindings.md) — Phase 5 frontier
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
- Document rename — now spans both shells' saved-work browsers
- Document error conditions on `PixelCanvas` public API
- IndexedDB quota exceeded error handling
- Canvas resize via border drag
- Timelapse recording
- TimelinePanel mobile touch targets — frame + row icon buttons ≥44px on the mobile Timeline tab
- Web pen priority — palm rejection + hover target cell (web counterpart of 252–254)
- Apple tab strip keyboard navigation — ArrowLeft/Right + Home/End roving focus
- Apple layer reorder — interrupted-drag recovery
- Apple layer panel predicates — `canReorderLayers` vs `canRemoveLayer` number consistency
- Apple bindings staleness guard — regenerate Swift bindings on binding-surface change
- Apple auto-save failure surfacing — silent retry today; log + notification later
- Web hydration opacity validation — port the Apple `from_layers` opacity guard
- Web session-save gaps mirrored from the 265 review — unstored-tab skip + shared-state document rewrite
- Flaky e2e: Reference Window reload persistence — investigate if it recurs
