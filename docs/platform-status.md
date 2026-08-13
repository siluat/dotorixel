# Platform Status

Feature implementation status across Core (Rust), Web (SvelteKit + Canvas2D), and Apple (SwiftUI + Metal).

**Legend**: ✅ Done | 🔧 Partial | ⬜ Not done | — N/A

## Drawing Tools

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Pencil | ✅ | ✅ | ✅ | |
| Eraser | ✅ | ✅ | ✅ | |
| Line | ✅ | ✅ | ✅ | Snapshot-restore preview |
| Rectangle | ✅ | ✅ | ✅ | Outline only, snapshot-restore preview |
| Ellipse | ✅ | ✅ | ✅ | Outline only, snapshot-restore preview |
| Flood fill | ✅ | ✅ | ✅ | BFS, 4-connectivity; one-shot tap fill on both shells |
| Eyedropper | — | ✅ | ✅ | Drag-and-commit; releases to FG (left-click/touch) or BG (right-click); skips transparent and out-of-bounds samples; not undoable. Apple samples the composite; Web samples the active layer. Loupe overlay tracked in its own row |
| Move | — | ✅ | ✅ | Drag shifts the whole canvas relative to the drag anchor (never cumulative); off-canvas pixels clipped on commit, vacated areas transparent |
| Selection / Marquee | 🔧 | 🔧 | 🔧 | Web complete. Apple: Marquee/Floating, clipboard, keyboard operations, touch action bar, and relaunch persistence complete; Reference Layer integration pending. |
| Right-click background color | — | ✅ | ✅ | Supported paint tools draw with BG on right-click; eraser stays transparent. Apple: macOS right-click + iPadOS pointer secondary button; touch always FG |
| Stroke interpolation | ✅ | ✅ | ✅ | Bresenham algorithm |
| Pixel-perfect filter | ✅ | ✅ | ✅ | L-corner 3-window rule (Aseprite-style). Toggle default ON, disabled on non-freehand tools; persisted with the session on both shells |

## Canvas

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Create / resize | ✅ | ✅ | ✅ | 1–256px, presets available; resize undoable on both shells (restores pixels + dimensions + Marquee); an active Marquee follows the anchor, then clips to the new bounds or clears without overlap. Anchor: 9-position selector (Web), top-left fixed (Apple) |
| Clear | ✅ | ✅ | ✅ | History-integrated, no confirm dialog; clears the active Pixel Layer on both shells. Web: RightPanel (docked) + Settings tab (mobile); Apple: RightPanel |
| Flip / transform | ✅ | ✅ | ✅ | Core/Web Canvas transforms all Pixel Layers and frames; Apple applies them to its current single frame. Marquee transforms only the selected region; Reference Layers stay fixed. |

## History

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| PixelCanvas History (single-canvas) | ✅ | ⬜ | ⬜ | Dimension-aware snapshots (pixels + W/H). Core-only species — no shell consumes it since Apple moved onto Document History |
| Document History | ✅ | ✅ | ✅ | Whole-`Document` snapshots (layer stack + Marquee + counters); both shells' undo path. Its own species — never mixed with the PixelCanvas path (unrepresentable, not runtime-guarded) |
| Edit Baseline (no-op discard) | ✅ | ✅ | ✅ | Commits at an Edit's end only if state changed (Apple: pixels, Web: whole Document); no-op Edits — strokes and commands alike — preserve redo. Core-owned comparison, and the only way to record: no eager push exists |

## Viewport

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Zoom | ✅ | ✅ | ✅ | Discrete levels + continuous |
| Pan | ✅ | ✅ | ✅ | |
| Fit to viewport | ✅ | ✅ | ✅ | |
| Navigation Bounds clamp | 🔧 | ✅ | ⬜ | Clamp (pan/zoom/zoom-fit/resize) to canvas ∪ active-Reference footprint via one viewport sink. Rotation-aware footprint and clamp op are both core; the union is computed Web-side |

## Color

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Color model (RGBA) | ✅ | ✅ | ✅ | Hex conversion in Core + Web |
| HSV conversion | — | ✅ | ✅ | Shell-side math on both shells (simple, stable — Core Placement) |
| Color picker | — | ✅ | ✅ | Custom HSV picker (SV square + hue strip) on both shells; achromatic colors keep the current hue. Assistive edits via split axes: web arrow keys (Shift = coarse), Apple VoiceOver adjustable. Read-only hex readout row on both shells |
| Preset palette | — | ✅ | ✅ | 18 Pebble colors |
| Recent colors | — | ✅ | ✅ | Last 12 used, deduped, most-recent first; persisted with the session on both shells |
| FG/BG color swap | — | ✅ | ✅ | Swap button + per-swatch color picker. Apple: swap button; palette/picker set FG only |
| Color loupe overlay | — | ✅ | ✅ | 9×9 magnifier + hex chip during eyedropper drag; quadrant-flip/clamp keeps it visible near edges. Web also shows it on 400ms long-press (touch); Apple: eyedropper strokes only, finger gets the touch offset (pencil = mouse) |

## Rendering

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Pixel rendering | — | ✅ | ✅ | Canvas2D / Metal |
| Multi-layer composite | ✅ | ✅ | ✅ | Visible Pixel Layers blend bottom-to-top; Reference renders separately below them. Core/Web frame-addressed reads support playback, onion skinning, and export; Apple remains single-frame |
| Checkerboard transparency | — | ✅ | ✅ | |
| Grid overlay + toggle | — | ✅ | ✅ | Auto-hidden below 4px |

## Export

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| PNG | ✅ | ✅ | ✅ | 1× scale, default filename `dotorixel-{w}x{h}.png` on both shells; Apple: system save flow (macOS save panel / iPadOS Files picker) |
| SVG | ✅ | ✅ | ⬜ | Apple: core ready, UI not wired |
| GIF (animated) | ✅ | ✅ | ⬜ | Timeline order, per-frame durations (centisecond quantization), infinite loop, binary transparency (α≥128), exact colors within palette limit; hidden/Reference layers excluded; Apple: core ready, UI not wired |
| Spritesheet (PNG) | ✅ | ✅ | ⬜ | Horizontal strip, tile = canvas size, frames in Timeline order, full RGBA; hidden/Reference layers excluded; sheet-marked default filename; Apple: core ready, UI not wired |
| Export UI — desktop | — | ✅ | 🔧 | Web popover: format selector, filename input, confirmation; Apple: one-tap PNG button, filename edited in the system save dialog |
| Export UI — mobile | — | ✅ | — | Bottom sheet (vaul-svelte); format selector, filename input, export button |

## Input

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Mouse / trackpad | — | ✅ | ✅ | |
| Touch | — | ✅ | ✅ | Pointer Events / UITouch. Both: pinch-zoom + two-finger pan; strokes bind to the originating touch; finger begin deferred so a pinch start never paints; a second finger ends the stroke. Web adds long-press eyedropper |
| Apple Pencil | — | — | ✅ | Draws immediately (no finger deferral). Palm rejection: a touching pencil outranks fingers — begins over a resting palm, ignores them mid-stroke, suppresses pinch/pan — and a hovering pencil blocks finger begins entirely. Device pass (255) pending |
| Pencil hover preview | — | — | 🔧 | Hover-capable iPads (M2+, Pencil 2/Pro): live single-cell highlight of the target while hovering; clears on touch-down, off-canvas, or hover exit. Pencil-only (finger/pointer hover excluded). State contract unit-tested; hardware pass (255) pending |
| Keyboard shortcuts | — | ✅ | ✅ | Both: tools, X/G, undo/redo, Alt eyedropper, Shift constrain, text guard, selection arrows/Delete/Escape/C/X/V. Apple adds Edit-menu undo/redo; Space pan and `/` hints remain web-only. |
| Constrain latch | — | ✅ | ✅ | Re-tap the active constrainable tool (line/rect/ellipse/selection) to latch the Shift constraint keyboard-free; OR-combined with Shift; mid-stroke toggle re-resolves the in-flight shape instantly |
| Tool selection a11y | — | ✅ | ⬜ | Tool buttons form an ARIA radiogroup: aria-checked + roving tabindex, Arrow-key nav (wraps), Space/Enter activates (latch on constrainable). Latch state announced via a polite SR live region |

## i18n

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Internationalization | — | ✅ | ✅ | EN/KO/JA on both shells, shared terminology. Web: Paraglide.js, URL path routing (root `/`, auto-detect + localStorage). Apple: String Catalog, follows system language, no in-app picker |

## Analytics

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Page view tracking | — | ✅ | — | Umami Cloud, auto SPA tracking |
| Custom event tracking | — | ✅ | — | Tool usage, canvas resize, export, session duration |
| CSP headers | — | ✅ | — | Vercel response headers |

## Multi-image Workflow

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Tab management (Workspace) | — | ✅ | ✅ | Add/switch/close tab strip on both shells; tool/colors shared across tabs, document/history/viewport per tab; close routes via the save dialog on both |
| Session persistence | — | ✅ | ✅ | Web: IndexedDB V7 multi-frame restore. Apple: SwiftData single-frame restore; Reference is temporarily omitted while Pixel Layers keep saving. Both recover corrupt stores to a fresh session |
| Save dialog on tab close | — | ✅ | ✅ | Blank canvas detection (hidden layers count as content), save/delete/cancel; saved tabs close without prompting. Web: focus-trapped modal; Apple: native sheet |
| Saved work browser (desktop) | — | ✅ | ✅ | Browse/open/delete; open tabs excluded; reopening resets the viewport. Cards use Pixel-only composite thumbnails; Apple remains single-frame until Phase 6 |
| Saved work browser (mobile) | — | ✅ | — | Bottom sheet; opens full Document snapshots while cards use composite thumbnails |

## Layers

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Document/Layer model | 🔧 | 🔧 | 🔧 | Pixel Layer stack with active layer, visibility, opacity, Timeline collapse state, and Pixel-only composite. Apple: layer panel with select + visibility + add/remove/reorder (mid-stroke seals on all) |
| Frame cel-grid | ✅ | ✅ | ⬜ | One Cel per Pixel Layer per frame (grid invariant); Reference frame-independent. Web: undoable add/duplicate/remove/reorder + set-active journal intents (undo restores frame+cel); multi-frame V7 persistence round-trips through the snapshot |
| Per-frame duration | ✅ | ✅ | ⬜ | Each frame holds a display duration; default 100ms (10fps); identity unchanged when retimed. 1–60000ms clamp at the shell boundary (core trusts the value). Web complete: active-frame editor in the timeline corner (ms + derived fps), undoable, V7-persisted. Apple pending |
| Reference Layer (timeline kind) | ✅ | ✅ | 🔧 | Singleton viewport underlay with Pixel-only composites. Apple: native import/render/row complete; editing, sampling, placement, navigation bounds, and persistence pending |
| Timeline panel | — | 🔧 | 🔧 | Web uses a bottom-docked Layer × Frame grid. Apple uses a layer sidebar with drag reorder, fixed bottom Reference row, and placeholder frame area; Web mobile row targets remain pending |
| Playback (animation) | — | ✅ | ⬜ | Per-tab engine: transient Playhead + rAF clock holds each frame its `duration_ms` (carry → no drift), loops or stops at end. Previews committed art via `composite_at` — no Document mutation/history/dirty, never persisted; tab/document change stops it. Transport strip (Play/Pause · Loop · ▼ playhead) wired on docked + mobile |
| Onion skinning | — | ✅ | ⬜ | Adjacent-frame ghosts while drawing (prev/next 1, clamped, no wrap): prev warm / next cool, dimmed, committed art on top; hidden during Playback; never in exports; per-tab persisted toggle in the transport strip |

## Reference Images

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Gallery store + persistence | — | ✅ | ⬜ | Per-doc reactive store; round-trips through `WorkspaceRecord.references?` (optional, absent → empty); references for closed-but-saved docs are not retained yet |
| Import pipeline | — | ✅ | ✅ | PNG/JPEG/WebP/GIF, ≤10 MiB, actionable failures. Web also creates 256px thumbnails; Apple decodes native RGBA for its singleton Reference Layer |
| Drag-and-drop import | — | ✅ | ⬜ | Drag onto modal/sheet adds to gallery. Drag onto canvas adds AND displays each ref with cascade offsets, drop position centered on cursor (clamped so the title bar stays on-screen). Partial batches keep valid imports and surface per-file rejections |
| Browser UI | — | ✅ | ⬜ | TopBar `Images` button; ReferenceBrowser modal (wide/x-wide), ReferenceBrowserSheet (compact/medium); gallery card with thumbnail/filename/dimensions, delete confirmation, empty state, Eye/EyeOff display toggle |
| Display on canvas | — | ✅ | 🔧 | Web uses persistent movable multi-window references. Apple renders one fit-to-canvas underlay below pixels; direct placement and relaunch persistence remain pending |
| Multi-window z-order + cascade | — | ✅ | ⬜ | Newly displayed/focused window goes to top of `zOrder`; topmost is `data-active`. Cascade offset 24px from viewport center per visible window; resets to 0 when all dismissed. Root pointerdown raises (close/minimize guards prevent flicker). zOrder persists through reload |
| Move + resize | — | ✅ | ⬜ | Title-bar drag follows unclamped, clamps to viewport on release (throw-and-snap-back). Resize handle (44×44 hit area) clamps live, aspect-locked, 80px floor. Auto-save fires once per completed gesture; one window gesture at a time |
| Minimize (window-shade) | — | ✅ | ⬜ | Title-bar minimize button + title-bar double-click toggle `minimized`. Body/resize handle removed from DOM (accessibility tree shows title bar only); pre-minimize size restored on toggle. Window remains draggable while minimized |
| Color sampling — Eyedropper | — | ✅ | ⬜ | Eyedropper tool active + tap a reference image → samples pixel into foreground. Transparent samples and decode failures are silent. Letterbox area around the image falls through to z-order activation |
| Color sampling — long-press + drag | — | ✅ | ⬜ | Tool-independent. Touch/pen long-press (400ms threshold, 8px slop) on a reference image starts a sampling session; drag re-samples; release commits via the same `colorPick + addRecentColor` path as the Eyedropper. Decoded image cached for the session so pointer-moves avoid `createImageBitmap` |
| Color sampling — long-press loupe | — | ✅ | ⬜ | Shared `<Loupe>` overlay (single instance at page root) shows the 9×9 RGBA neighborhood during reference long-press sampling — visual parity with the canvas Eyedropper loupe. Reuses the same `SamplingSession` via a reference-side `SamplingPort` adapter |
| Color sampling — mouse loupe parity | — | ✅ | ⬜ | Mouse press-and-drag on a reference image (Eyedropper active) engages the same sample lifecycle as touch/pen, so the loupe appears on press and tracks the cursor. Loupe positioning reuses the canvas mouse-vs-touch offset (mouse: diagonal; touch/pen: centered above) |

## UI

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Design token system | — | ✅ | ✅ | `--ds-*` tokens (web), `DesignTokens` enum (Apple; spacing scale mirrors in-use steps 1–5), light theme |
| Pebble UI theme | — | ✅ | ⬜ | Floating panels, earth tones (web legacy; Apple removed) |
| Editor UI theme | — | ✅ | ✅ | `--ds-*` tokens, docked layout skeleton (Apple); TopBar + LeftToolbar + RightPanel + TimelinePanel + StatusBar all implemented |
| Responsive layout | — | ✅ | 🔧 | Web: compact/medium/wide/x-wide via matchMedia + CSS Grid, ≥44px targets. Apple: docked adapts wide↔x-wide (1440pt panel/bar sizing); iPad-compact deferred to the mobile paradigm |
| Toolbar tooltip | — | ✅ | ✅ | Tool name + shortcut hint on hover. Web: custom styled tooltip (GeistPixel-Square). Apple: native macOS tooltip; the hint also rides the accessibility label on both OSes |
| Tab bar slide indicator | — | ✅ | ⬜ | ease-in-out-cubic 180ms, pure CSS `--active-index` |
| Landing page | — | ✅ | — | Hero (+ editor mockup) / Features / Roadmap sections, nav with GitHub link, i18n (EN/KO/JA), responsive at 600/1024px, `--ds-*` tokens |
| Safe area handling | — | ✅ | ⬜ | `viewport-fit=cover` + `env(safe-area-inset-*)` on all routes |
