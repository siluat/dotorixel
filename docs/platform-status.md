# Platform Status

Feature implementation status across Core (Rust), Web (SvelteKit + Canvas2D), and Apple (SwiftUI + Metal).

**Legend**: ✅ Done | 🔧 Partial | ⬜ Not done | — N/A

## Drawing Tools

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Pencil | ✅ | ✅ | ✅ | |
| Eraser | ✅ | ✅ | ✅ | |
| Line | ✅ | ✅ | ⬜ | Snapshot-restore preview |
| Rectangle | ✅ | ✅ | ⬜ | Outline only, snapshot-restore preview |
| Ellipse | ✅ | ✅ | ⬜ | Outline only, snapshot-restore preview |
| Flood fill | ✅ | ✅ | ⬜ | BFS, 4-connectivity |
| Eyedropper | — | ✅ | ⬜ | Drag-and-commit with live 9×9 loupe (hatched out-of-canvas + checkerboard transparent cells); releases to FG (left-click) or BG (right-click); skips transparent pixels |
| Move | — | ✅ | ⬜ | Drag to reposition canvas content, snapshot-restore preview, `move` cursor |
| Right-click background color | — | ✅ | ⬜ | All tools draw with BG color on right-click; eraser unchanged |
| Stroke interpolation | ✅ | ✅ | ✅ | Bresenham algorithm |
| Pixel-perfect filter | ✅ | ✅ | ⬜ | L-corner 3-window rule (Aseprite-style); stateless with `TailState` carry; WASM + UniFFI bindings exported. Web: pencil/eraser strokes wired through `createPixelPerfectOps` decorator; topBar/mAppBar toggle with IndexedDB-persisted preference (default ON), disabled on non-freehand tools |

## Canvas

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Create / resize | ✅ | ✅ | ✅ | 1–256px, presets available, 9-position anchor selector (Web) |
| Clear | ✅ | ✅ | ⬜ | RightPanel (docked) + Settings tab (mobile) |

## History

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Undo / redo | ✅ | ✅ | ✅ | Snapshot-based, dimension-aware (resize undoable on Web) |
| Document undo / redo | 🔧 | 🔧 | ⬜ | Core (#088): `HistoryManager` extended with internal `HistoryEntry` enum (`Canvas` / `Document` variants). New public methods `push_document` / `undo_document` / `redo_document` capture and restore the full `Document` (layer stack + `next_layer_number`). Existing canvas-path API preserved unchanged. `DEFAULT_MAX_SNAPSHOTS=100` shared across both paths. WASM (#089): the three Document-snapshot methods exposed on `WasmHistoryManager`. TS shell does not yet call them (`TabState` still uses canvas-path). Not yet exposed through Apple bindings |

## Viewport

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Zoom | ✅ | ✅ | ✅ | Discrete levels + continuous |
| Pan | ✅ | ✅ | ✅ | |
| Fit to viewport | ✅ | ✅ | ✅ | |

## Color

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Color model (RGBA) | ✅ | ✅ | ✅ | Hex conversion in Core + Web |
| HSV conversion | — | ✅ | ⬜ | `rgbToHsv()` / `hsvToRgb()` |
| Color picker | — | ✅ | ✅ | Web: custom HSV picker, Apple: SwiftUI |
| Preset palette | — | ✅ | ✅ | 18 Pebble colors |
| Recent colors | — | ✅ | ⬜ | Last 12 used |
| FG/BG color swap | — | ✅ | ⬜ | Swap button + per-swatch color picker |
| Color loupe overlay | — | ✅ | ⬜ | 9×9 magnifier + hex chip during eyedropper drag (mouse) and 400ms long-press (touch) with quadrant-flip positioning (stays fully visible near viewport edges) |

## Rendering

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Pixel rendering | — | ✅ | ✅ | Canvas2D / Metal |
| Checkerboard transparency | — | ✅ | ✅ | |
| Grid overlay + toggle | — | ✅ | ✅ | Auto-hidden below 4px |

## Export

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| PNG | ✅ | ✅ | 🔧 | Apple: core ready, UI disabled |
| SVG | ✅ | ✅ | ⬜ | Apple: core ready, UI not wired |
| Export UI — desktop | — | ✅ | ⬜ | Popover: format selector, filename input, confirmation |
| Export UI — mobile | — | ✅ | — | Bottom sheet (vaul-svelte); format selector, filename input, export button |

## Input

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Mouse / trackpad | — | ✅ | ✅ | |
| Touch | — | ✅ | ✅ | Pointer Events / UITouch; Web: pinch-zoom + two-finger pan + touch deferral + long-press eyedropper |
| Apple Pencil | — | — | ✅ | |
| Keyboard shortcuts | — | ✅ | ✅ | Web: tool switch (P/E/L/U/O/F/I/V) + grid toggle (G) + undo/redo (Ctrl+Z/Y) + Alt eyedropper + Space pan + X swap colors + Shift constrain + `/` shortcut hints; Apple: undo/redo only |

## i18n

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Internationalization | — | ✅ | ⬜ | Paraglide.js, URL path routing (`/ko/`, `/ja/`; root `/` for EN); root auto-detects browser language, explicit choice persists via localStorage |

## Analytics

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Page view tracking | — | ✅ | — | Umami Cloud, auto SPA tracking |
| Custom event tracking | — | ✅ | — | Tool usage, canvas resize, export, session duration |
| CSP headers | — | ✅ | — | Vercel response headers |

## Multi-image Workflow

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Tab management (Workspace) | — | ✅ | ⬜ | Workspace model, page wiring, TabStrip UI complete |
| Session persistence | — | ✅ | ⬜ | Multi-tab save/restore via IndexedDB; debounced auto-save with per-document dirty tracking; versioned document schema (V1/V2) with `saved` flag — saved documents survive tab close |
| Save dialog on tab close | — | ✅ | ⬜ | Blank canvas detection, save/delete/cancel modal, focus trap, keyboard accessible |
| Saved work browser (desktop) | — | ✅ | ⬜ | Browse/open/delete saved documents; card grid with thumbnails, empty state, delete confirmation |
| Saved work browser (mobile) | — | ✅ | — | Bottom sheet (vaul-svelte); shared card grid, AppBar trigger, responsive 2/3 column grid |

## Layers

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Document/Layer model | 🔧 | 🔧 | ⬜ | Core (#087): `Document` (width/height, ordered layer stack, active-layer UUID, monotonic `next_layer_number`, `timelinePanelCollapsed` flag) + `Layer` (id, name, pixels, visible, opacity) + `LayerError` (`Display + Error`). Mutators: `add_layer` (insert above active, becomes active), `remove_layer` (relocate active to neighbor; rejects last), `reorder_layer` (clamps), `set_active_layer`, `set_pixel`, `resize`. `composite()` returns row-major RGBA via straight source-over, multiplying `opacity` into source alpha and skipping `visible=false`. WASM (#089): `WasmDocument` facade exposes constructor, getters, index-based layer access, mutators, and `composite() -> Vec<u8>` (`ImageData`-compatible). Layer IDs accepted as UUID v4 strings (TS-side `crypto.randomUUID()`). TS shell does not yet construct it. Not yet wired through Apple. ADR records web-first / Apple-preserved (single-canvas) split |

## Reference Images

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Gallery store + persistence | — | ✅ | ⬜ | Per-doc reactive store; round-trips through `WorkspaceRecord.references?` (optional, absent → empty); references for closed-but-saved docs are not retained yet |
| Import pipeline | — | ✅ | ⬜ | File picker; PNG/JPEG/WebP/GIF, ≤10 MB; `createImageBitmap` decode + `OffscreenCanvas` thumbnail (256px longest edge, aspect preserved) |
| Drag-and-drop import | — | ✅ | ⬜ | `canvasDropzone` Svelte action wires `dragenter/over/leave/drop` and toggles `data-drag-over` for a CSS-only highlight ring (action filters non-file drags via `dataTransfer.types`). Modal/sheet drop targets reuse existing validator and add to gallery only. Canvas-area drop adds to gallery AND auto-displays each ref via `store.display()` with cascading offsets (`index × CASCADE_OFFSET`); drop position centered on the cursor and clamped so the title bar stays on-screen via pure `compute-drop-placement` (sizing shared with initial placement via `compute-window-size`). Sequential `import-reference-files` returns `{imported, errors}` so partial batches keep valid imports and surface per-file rejections. `CASCADE_OFFSET` centralized to `reference-window-constants` (gallery sequential-open + canvas multi-drop share one constant) |
| Browser UI | — | ✅ | ⬜ | TopBar `Images` button; ReferenceBrowser modal (wide/x-wide), ReferenceBrowserSheet (compact/medium); gallery card with thumbnail/filename/dimensions, delete confirmation, empty state, Eye/EyeOff display toggle |
| Display on canvas | — | ✅ | ⬜ | `DisplayState` per-instance record (refId, visible, x/y/w/h, minimized, zOrder) round-trips through `WorkspaceRecord.displayStates?` (optional, absent → empty); `ReferenceWindowOverlay` mounts above canvas/below editor chrome; pointer-absorb on window, pass-through on overlay container; placement math centralized in `reference-window-placement.ts` (`createPlacement` / `refitPlacement` / `commitMove` / `commitResize` over `Placement` / `PlacementIntent` / `Viewport`); initial placement = viewport center + cascade offset, size = `min(natural, viewport×0.3)` on longer edge with shared `MIN_WINDOW_EDGE = 80` floor and viewport upper-bound cap; viewport-shrink lifecycle `ReferenceImagesStore.refitAll(docId, viewport)` (driven by a `$effect` watching `editor.viewportSize`) shrinks any window that no longer fits aspect-preservingly and writes the new geometry to the store (B-비율유지 — regrow does not restore pre-shrink size); overlay renders stored geometry verbatim, no render-time projection |
| Multi-window z-order + cascade | — | ✅ | ⬜ | `store.display()` and `store.show()` bump `zOrder` above the current max so the most recently displayed/focused window is on top; overlay sorts by `zOrder` and marks the top one `data-active="true"`; `store.nextCascadeIndex(docId)` returns count of currently visible windows so cascade offsets `index × 24px` from the viewport center and resets to 0 once all windows are dismissed; window root `pointerdown` raises via `store.show()` with `.title-bar-button` guard (close/minimize don't flicker-raise); resize-handle pointerdown bubbles to root so resize also raises; clicking an already-displayed gallery card raises that window then closes the modal (explicit "show" action); `zOrder` persists through reload via `displayStatesSnapshot`/`restoredDisplayStates` |
| Move + resize | — | ✅ | ⬜ | Title-bar drag (PointerEvents, X-button guard) updates `DisplayState.x/y` continuously and clamps to viewport on release via `commitMove` (throw-and-snap-back UX preserved); bottom-right handle resize via `commitResize` per move event — drag-time clamp, so the handle stops at the viewport edge during the drag (dominant-axis aspect-locked, uniform scale-up to `MIN_WINDOW_EDGE` floor); 44×44 hit area on the handle (`::before`) with subtle two-line diagonal grip (`::after`, `--ds-text-tertiary`); store mutators `setDisplayPosition`/`setDisplaySize` mark the doc dirty for auto-save so position/size survive reload |
| Minimize (window-shade) | — | ✅ | ⬜ | Title-bar minimize button (`ChevronUp`/`ChevronDown` toggling icon) and double-click on title bar both flip `DisplayState.minimized` via `store.setMinimized`; body and resize handle removed from DOM via `{#if !minimized}` so the accessibility tree shows only the title bar; container `style:height` switches to `auto`, `data-minimized` attribute drops the title-bar `border-bottom` for a clean pill silhouette; minimized window remains draggable; pre-minimize size restored on toggle (no x/y/w/h mutation); `closest('button')` guard on dblclick mirrors the pointerdown shield so dblclicks on the close/minimize buttons don't double-toggle |
| Color sampling — Eyedropper | — | ✅ | ⬜ | When the Eyedropper tool is active, tapping a reference window's image samples the pixel under the pointer into the foreground color. Pure `samplePixel(DecodedImage, x, y)` extractor + pure `windowToImageCoords` (floor-then-clamp defends trailing-edge off-by-one) + thin async `sampler(blob, x, y)` boundary using `createImageBitmap` → `OffscreenCanvas.getImageData` (stateless, no cache); `TabState.referenceSampleCommit` routes through the existing `#applyEffects` dispatcher to emit `colorPick(foreground) + addRecentColor + markDirty` for opaque samples; transparent (a===0) and decode failure are silent. Letterbox region around the image naturally falls through to z-order activation since `onpointerdown` is bound to the `<img>` element |
| Color sampling — long-press + drag | — | ✅ | ⬜ | Tool-independent. New framework-agnostic `long-press` detector at `src/lib/gestures/` (single-pointer, 400 ms threshold, 8 px Euclidean radius, `pointerDown → onFire → onMove → onEnd` lifecycle plus pre-fire `onCancel`). `ReferenceWindow` branches on `pointerType === 'touch' \|\| 'pen'` to the detector with `setPointerCapture`. After fire: `referenceSampleStart` decodes the blob once (cached for the session) and activates a `referenceSamplingSession` with the centered grid; `referenceSampleMove` re-samples around the new image coords; both apply the centered pixel as a live foreground preview (no recent-colors entry); `referenceSampleEnd` commits via the session — same `colorPick + addRecentColor + markDirty` effects as the Eyedropper path. `#refSampleSeq` invalidates stale async starts (e.g., a second long-press while the first decode is still in flight); ghost-session prevention when release beats the first decode is handled separately in #080 via the `#endPending` flag. `$effect` cleanup disposes the detector; `.image` `touch-action: none` prevents browser pan/zoom interception. (Mouse path and short-tap routing through the same lifecycle added in #080.) |
| Color sampling — long-press loupe | — | ✅ | ⬜ | During reference image long-press sampling a `<Loupe>` overlay appears, showing the 9×9 RGBA neighborhood around the sampled pixel — visual parity with the canvas Eyedropper loupe. Reuses the shared `SamplingSession` via a `createReferenceSamplingPort(DecodedImage): SamplingPort` adapter wrapping a once-decoded `DecodedImage` (`decodeReferenceBlob` runs `createImageBitmap` → `OffscreenCanvas.getImageData` once on long-press start; subsequent moves read RGBA synchronously from the cached buffer, avoiding `createImageBitmap` per pointer-move). Page-level `<svelte:window>` pumps pointer screen coords into `referenceSamplingSession.updatePointer()` so the loupe's quadrant-flip + viewport clamping reuses the canvas implementation. Single `<Loupe>` instance at page root (position: fixed) serves both docked and tabs layouts. Existing `CanvasSamplingPort` interface renamed to `SamplingPort` to reflect that both the canvas and reference adapters are now realized |
| Color sampling — mouse loupe parity | — | ✅ | ⬜ | Mouse press-and-drag on a reference image (Eyedropper tool active) engages the same `referenceSampleStart`/`Move`/`End` lifecycle as touch/pen long-press, so the loupe appears on press and tracks the cursor while held. `quickSamplingEnabled: boolean` prop on `ReferenceWindow`/`Overlay` replaces the previous `onSamplePixelAt` callback-as-flag — both touch short-tap and mouse press route through the unified lifecycle (touch keeps tool-independent long-press; quick-sampling is gated to Eyedropper). `LoupeInputSource` plumbed through `onSampleStart` so loupe positioning reuses the canvas mouse-vs-touch offset (mouse: diagonal; touch/pen: centered above). Async-decode race for fast clicks defended by a `#endPending` flag in `tab-state` (release before decode resolves still commits via the in-flight start; new starts reset). Native HTML5 `<img>` drag suppressed via `draggable="false"` (regression-defense test asserts the attribute) so mouse `pointermove` reaches the lifecycle |

## UI

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Design token system | — | ✅ | ✅ | `--ds-*` tokens (web), `DesignTokens` enum (Apple), light theme |
| Pebble UI theme | — | ✅ | ⬜ | Floating panels, earth tones (web legacy; Apple removed) |
| Editor UI theme | — | ✅ | ✅ | `--ds-*` tokens, docked layout skeleton (Apple); TopBar + LeftToolbar + RightPanel + StatusBar all implemented |
| Responsive layout | — | ✅ | ⬜ | 4 breakpoints: compact/medium/wide/x-wide via matchMedia + CSS Grid/Flex |
| Toolbar tooltip | — | ✅ | ⬜ | Custom styled tooltip on hover (tool name + shortcut badge), Svelte action, GeistPixel-Square font |
| Tab bar slide indicator | — | ✅ | ⬜ | ease-in-out-cubic 180ms, pure CSS `--active-index` |
| Landing page | — | ✅ | — | Hero (+ editor mockup) / Features / Roadmap sections, nav with GitHub link, i18n (EN/KO/JA), responsive at 600/1024px, `--ds-*` tokens |
| Safe area handling | — | ✅ | ⬜ | `viewport-fit=cover` + `env(safe-area-inset-*)` on all routes |
