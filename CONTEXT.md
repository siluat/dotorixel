# DOTORIXEL

DOTORIXEL is a pixel art editor with a Svelte web shell, an Apple SwiftUI shell, and a shared Rust core. This document captures the project's domain vocabulary so design decisions and architecture reviews can refer to concepts by their canonical names.

## Language

### Document & Layers

**Document**:
The artifact a user edits and saves — one piece of pixel art with its own canvas dimensions, layer stack, and active-layer pointer.
_Avoid_: artwork (too vague — also used for portfolio sharing), composition (overlaps with the rendering term), image (used for reference images and exports).

**Layer**:
A named slot inside a Document — exactly one of Pixel Layer or Reference Layer — carrying its own visibility and opacity.
_Avoid_: tile, slice, stack (the *collection* of layers; an individual entry is a Layer). Not a synonym for **Frame** — Layer (space) and Frame (time) are orthogonal axes; a Pixel Layer spans every frame, holding one Cel per frame.

**Pixel Layer**:
The Layer variant that owns a pixel buffer matching the Document's canvas — the only kind drawing tools target and exports include. Whether the active layer is **editable** — a Pixel Layer takes paint and Marquee operations, a Reference Layer takes neither — is owned by one authority: the Document Layer Projection's `isActiveLayerEditable` predicate (`activeLayerKind !== 'reference'`), enforced only at the TabState entries that consult it. The stroke engine and Selection tool trust this precondition rather than re-deciding the rule, and four `isDrawing` guards on `setActiveLayer`/`setActiveFrame`/`removeLayer`/`removeFrame` keep the active layer from switching or vanishing under a live stroke.
_Avoid_: paint layer, draw layer, raster layer.

**Reference Layer**:
A singleton Layer holding a source image and its Reference Layer Placement as an in-Document tracing reference, fixed below the Pixel Layers and excluded from every pixel output.
_Avoid_: imported image, tracing layer, reference image (Reference Window's term).

**Reference Layer Placement**:
A Reference Layer's source-to-document geometry — the position and uniform scale that map the source image onto the Document canvas. Its invariant — finite position, scale strictly positive and finite — is owned by the core type's validating constructor; adapters only marshal.
_Avoid_: position, transform, geometry, viewport (all overloaded).

**Reference Layer Placement Interaction**:
The pointer- and keyboard-driven lifecycle for editing a Reference Layer Placement in the canvas viewport.
_Avoid_: placement drag, overlay edit, transform interaction.

**Reference Footprint**:
A Reference Layer's projected axis-aligned bounding box on the Document canvas — the source image scaled by the placement's scale and width/height-swapped for an odd quarter-turn rotation, expressed in canvas-pixel coordinates as min/max corners (canonical core type `ReferenceFootprint`). Owned by one core authority — `ReferencePlacement::footprint(natural_width, natural_height)`, with the convenience `ReferenceData::footprint()` — so the rotation-aware geometry is computed once in the core rather than re-derived per shell. It is the single producer feeding both Navigation Bounds (unioned with the canvas rectangle) and the viewport underlay's display rect (the shell's `× scaled-pixel + pan` projection of it).
_Avoid_: bounds (the clamped pan region is Navigation Bounds), underlay rect (the shell's display-space projection of this footprint), extent (names only width/height, not the positioned box), projected footprint (informal — `ReferenceFootprint` is the canonical name).

### Frames & Cels

**Frame**:
A single position on a Document's temporal axis — identity-only, carrying no persistent name or counter, and displayed as its 1-based ordinal. It also carries a **duration** (display time, in milliseconds) that is **mutable metadata, not identity**: a retimed frame is the same frame, so frames compare and hash by `id` alone. A Document always holds at least one frame; the axis is ordered and reorderable. Orthogonal to the Layer axis: layers stack in space, frames sequence in time.
_Avoid_: keyframe (there is no interpolation — every frame is explicit), animation frame (verbose), cel (a Frame is the time slot itself; a Cel is one layer's pixels at that slot), layer (the orthogonal spatial axis).

**Cel**:
One Pixel Layer's pixel buffer (a `PixelCanvas`) for one Frame — the cell where the Layer and Frame axes intersect. Every Pixel Layer holds exactly one Cel per Frame (the **grid invariant**: a Pixel Layer's cel keys equal the Document's frame ids, no missing and no extra); a Reference Layer is frame-independent and has no Cels. An empty frame is a transparent Cel, never an absent one.
_Avoid_: frame (that names the time slot, not the per-layer pixels), layer canvas (a Pixel Layer owns one Cel per frame, not a single canvas), tile, snapshot (a History term).

**Active Frame**:
The Frame that drawing and compositing act on — the temporal counterpart of the active-layer pointer. Drawing tools write only the active Layer's active-frame Cel; `composite` blends every visible Pixel Layer's active-frame Cel. Always references a frame present on the axis.
_Avoid_: current frame (informal), playhead (the Playhead is the playback pointer, not the edit pointer), selected frame (the Marquee owns "selection").

**Playback**:
The transient, per-tab preview that runs a Document's frames in sequence over time without mutating it — it owns the Playhead and a clock, advancing by each Frame's duration and either looping back to the first frame or stopping at the last. Purely runtime: a tab always starts stopped, playback pushes no History entry and never marks the Document dirty, and it never moves the Active Frame. Absent from the document schema and the workspace snapshot, so a reopened or duplicated tab starts stopped.
_Avoid_: animation (the capability and the milestone, not the runtime preview), preview (overloaded — also tool and Floating Selection previews), play head (one word).

**Playhead**:
The transient frame pointer Playback advances through the axis, distinct from the Active Frame (the edit pointer, which never moves during Playback). While playing it drives the display buffer — the renderer reads the Playhead frame's `composite_at`, committed art with no Floating Selection overlay — but never editing. Play starts it at the first Frame; pause, a loop-off completion, or a tab/document change discards it, returning the display to the Active Frame.
_Avoid_: active frame (the edit pointer), current frame (informal), cursor (an input/text term).

**Onion Skin**:
The per-tab view aid that renders adjacent Frames' composites as dimmed, tinted **ghosts** beneath the Active Frame's composite in the canvas viewport — the previous neighbor warm, the next cool — never part of any document pixel output, never visible during Playback. The flag lives beside the grid toggle in the per-tab viewport state (persisted with the workspace, reset on saved-document reopen); ghost sources are the neighbors' `composite_at`.
_Avoid_: ghosting (the GIF-export disposal artifact), tracing (Reference Layer vocabulary), overlay (the tool / Floating Selection preview term), underlay (the Reference render step).

### Timeline

**Reorder Interaction**:
The pointer- and keyboard-driven lifecycle for reordering items along one visual axis — begin → clamped preview (allowed-target snap + displacement translate) → drop commit, including tap-vs-drag discrimination and trailing-click suppression when the item doubles as a select target. One implementation; the Timeline's Layer rows (vertical) and Frame ruler cells (horizontal) are its two adapters.
_Avoid_: drag reorder (names only the pointer species), drag & drop (implies data transfer), sort (a data operation, not an interaction).

### Selection

**Marquee**:
A persistent, always-non-empty rectangular region on the active Pixel Layer that bounds Selection-tool operations and clips every drawing tool's output to its bounds.
_Avoid_: selection (names the tool/feature, not the region), selection rectangle (verbose), bounding box (geometry term), region (used generically for pixel-buffer slices).

**Floating Selection**:
A transient pixel buffer lifted from the active Pixel Layer together with its translation offset, committed back as a single undoable step and never persisted.
_Avoid_: floating layer (it is not a Layer and never enters the layer stack), lifted pixels (names only the buffer, not the offset), selection buffer (ambiguous with Selection Clipboard), pasted layer.

**Selection Clipboard**:
A workspace-shared single slot holding the most recent Copy or Cut of a Marquee region as `{ pixels, width, height }`, materialized on paste as a Floating Selection.
_Avoid_: system clipboard (OS-level interop, explicitly out of scope), copy buffer (vague), per-document clipboard (rejected — the buffer is workspace-scoped so cross-tab reuse works).

### Transforms

**Canvas Transform**:
The whole-Document tier of flip and rotate — one operation mirrors or quarter-turns every Pixel Layer's every Cel (all frames together); rotate additionally swaps the Document's canvas width/height. The Reference Layer is excluded (a fixed tracing overlay outside canvas transforms), and an active Marquee is carried through the same mapping and clipped to the new canvas. Always one undoable step, applied regardless of the active layer.
_Avoid_: whole-document transform (informal), canvas flip / canvas rotate as tier names (they name single operations, not the tier), sprite transform (Aseprite's vocabulary).

**Marquee Transform**:
The region tier of flip and rotate — mirrors or quarter-turns only the Marquee region of the active Pixel Layer's active-frame Cel; the Document's dimensions, other layers, other frames, and the Reference Layer are untouched. A no-op without a Marquee or while a Reference Layer is active — a no-op pushes no History entry and never marks the Document dirty.
_Avoid_: selection transform (Selection names the tool/feature, not the region), region transform ("region" is used generically for pixel-buffer slices).

### Input

**Input Pipeline**:
The session-level module in front of the canvas viewport that admits or blocks draw/sample input (shortcut-hints admission), restores a temporary tool switch when a stroke ends or cancels, and owns the keyboard and Constrain-latch lifecycles. Reads and plain commands do not pass through it — templates bind `workspace.shared` / `workspace.activeTab` directly.
_Avoid_: editor controller (the deleted facade), canvas interaction (the per-view pointer capture machine), input handler (generic).

### Sampling

**Sampling Session**:
A pointer-driven color-pick lifecycle that opens at a target pixel, shows a Loupe, and commits the centered pixel to a draw color slot on release. Both species share one Loupe-facing observable surface — the sampled grid, the Loupe position, and the pointer feed — distinct from their per-species lifecycle; sealed as the `SamplingSessionView` type ([issue 164](issues/164-seal-sampling-session-view.md)).
_Avoid_: color picker session, eyedropper session (eyedropper is a tool, not a session).

**Loupe**:
The magnified, pointer-avoiding pixel grid shown during a Sampling Session, centered on the sampled pixel.
_Avoid_: zoom preview, magnifier.

**Canvas Sampling Session**:
A Sampling Session against the active Document's sampled layer data.

**Reference Sampling Session**:
A Sampling Session against an imported reference image.
_Avoid_: reference picker, deferred sampling session.

### Reference Windows

**Reference Window**:
A floating, draggable, resizable view of an imported reference image, anchored inside the active canvas viewport.
_Avoid_: reference panel, image window, ref overlay.

**Reference Window Placement**:
A Reference Window's geometry within the canvas viewport — `{x, y, width, height}`, always aspect-fit inside the current viewport.
_Avoid_: position, geometry, layout.

**Reference Window State**:
A Reference Window's full per-document record — its Reference Window Placement plus visibility, minimized flag, and stacking order — the single source of truth the shell renders verbatim.
_Avoid_: display state (legacy code name — "display" collides with rendering vocabulary), placement (names only the geometry subset), window settings.

**Reference Window Placement Interaction**:
The pointer-driven begin → preview → end lifecycle for editing a Reference Window Placement (title-bar move, corner resize), owned end-to-end by the References module. Preview policy — moves preview unclamped and snap inside the viewport at release; resizes clamp live with aspect locked — and commit clamping are internal decisions of this lifecycle, and auto-save dirty marking fires once per completed gesture.
_Avoid_: window drag, move/resize handling, gesture handling (names the input, not the lifecycle).

**Placement Intent**:
The semantic that produces a Reference Window Placement — *centered* (offset from the viewport center by a Cascade Index) or *at-point* (centered on a user-supplied coordinate).
_Avoid_: placement strategy, placement mode.

**Cascade Index**:
A per-document counter, advanced only by *centered* gallery opens, that staggers successive Reference Windows so they don't fully cover each other.
_Avoid_: stagger index, offset count.

**Drop Batch**:
A single drag-and-drop import of one or more files whose *at-point* placements cascade only among themselves and never advance the Cascade Index.
_Avoid_: drop group, drop session.

### Viewport & Navigation

**Navigation Bounds**:
The document-space region a tab's viewport pan is clamped to — the union of the canvas rectangle and, when the active Layer is a Reference Layer, its visible underlay footprint. Defined so that **every** viewport mutation (pan, zoom, zoom-fit, viewport-resize, and the post-document-change reclamp) is held to one region; the canvas can never be panned or zoomed entirely out of reach. Owned by a single viewport authority rather than recomputed per trigger.
_Avoid_: pan limits / scroll bounds (informal), canvas bounds (that is only one input — Navigation Bounds also covers the Reference underlay footprint), viewport bounds (the viewport is the thing being clamped, not the bound).

### History

**History**:
A tab's undo/redo record — a bounded, branch-discarding LIFO: pushing a new entry clears the redo future and evicts the oldest entry once the cap is exceeded. This invariant is owned once by a shared generic ring (`History<T>`); the model split below provides two never-mixed species that each only marshal their own value type. Mixing species is unrepresentable, not guarded. A visual no-op leaves no History entry: command paths guard predictively (skip the push when nothing will change; some content-blind gaps remain — [issue 244](issues/244-command-noop-history-entries.md)), stroke paths retrospectively through the Stroke Baseline.
_Avoid_: undo stack (names only one of the two stacks), history manager (the pre-split type that fused both species behind one enum — superseded by PixelCanvas History / Document History), snapshot stack.

**Stroke Baseline**:
The value captured when a stroke session begins, held pending by the History ring and committed as an undo entry at stroke end only when the stroke actually changed the state — the retrospective half of the no-op invariant. A no-op stroke (out-of-canvas tap, same-color fill or retrace, zero-delta move, cancelled shape preview) leaves no History entry and preserves the redo future. Owned by the core ring for both species; shells mark stroke begin/end and never decide the comparison.
_Avoid_: pending snapshot (Snapshot is the PixelCanvas species' value type), pre-stroke snapshot (the shape sessions' preview-restore copy is a session-local buffer, not this), undo baseline (the baseline equally guards redo preservation).

**PixelCanvas History**:
The single-canvas undo/redo species — a LIFO of dimension-aware `Snapshot`s (width, height, pixel buffer) so pixels restore across resize. The Apple shell's history. Canonical core type `PixelCanvasHistory`.
_Avoid_: canvas history (informal), HistoryManager (the pre-split fused name this species was extracted from).

**Document History**:
The layer-aware undo/redo species — a LIFO of whole-`Document` snapshots (layer stack, active-layer pointer, Marquee, counters). The web shell's history; wrapped by the WASM binding. Canonical core type `DocumentHistory`.
_Avoid_: document undo, layer history.
