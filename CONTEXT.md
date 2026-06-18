# DOTORIXEL

DOTORIXEL is a pixel art editor with a Svelte web shell, an Apple SwiftUI shell, and a shared Rust core. This document captures the project's domain vocabulary so design decisions and architecture reviews can refer to concepts by their canonical names.

## Language

### Document & Layers

**Document**:
The artifact a user edits and saves — one piece of pixel art with its own canvas dimensions, layer stack, frame axis, active-layer pointer, and active-frame pointer.
_Avoid_: artwork (too vague — also used for portfolio sharing), composition (overlaps with the rendering term), image (used for reference images and exports).

**Layer**:
A named slot inside a Document — exactly one of Pixel Layer or Reference Layer — carrying its own visibility and opacity.
_Avoid_: frame (the orthogonal animation-time axis), tile, slice, stack (the *collection* of layers; an individual entry is a Layer).

**Frame**:
An identity-only temporal slot inside a Document. Frames are ordered, always non-empty, and displayed by their 1-based ordinal; duration and names are separate future concepts.
_Avoid_: layer (the orthogonal visual stack axis), page, scene, keyframe (implies timing or interpolation not yet modeled).

**Cel**:
The Pixel Layer payload for one Frame — a `PixelCanvas` at a specific Layer × Frame coordinate. Every Pixel Layer has exactly one Cel for every Frame; an empty Frame is represented by transparent Cels, not missing Cels.
_Avoid_: frame pixels (blurs the axis with the payload), layer copy (suggests duplication semantics), bitmap (too generic).

**Active Frame**:
The Document's current Frame pointer. Pixel drawing, active-layer pixel reads, transforms, and Pixel-only composites operate on each Pixel Layer's Cel for the Active Frame; Reference Layers are frame-independent.
_Avoid_: current frame (informal), selected frame (UI state wording), timeline index (position, not identity).

**Pixel Layer**:
The Layer variant that owns one Cel per Frame, with every Cel matching the Document's canvas dimensions — the only kind drawing tools target and exports include.
_Avoid_: paint layer, draw layer, raster layer.

**Reference Layer**:
A singleton Layer holding a source image and its Reference Layer Placement as an in-Document tracing reference, fixed below the Pixel Layers, frame-independent, and excluded from every pixel output.
_Avoid_: imported image, tracing layer, reference image (Reference Window's term).

**Reference Layer Placement**:
A Reference Layer's source-to-document geometry — the position and uniform scale that map the source image onto the Document canvas. Its invariant — finite position, scale strictly positive and finite — is owned by the core type's validating constructor; adapters only marshal.
_Avoid_: position, transform, geometry, viewport (all overloaded).

**Reference Layer Placement Interaction**:
The pointer- and keyboard-driven lifecycle for editing a Reference Layer Placement in the canvas viewport.
_Avoid_: placement drag, overlay edit, transform interaction.

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
A tab's undo/redo record — a bounded, branch-discarding LIFO: pushing a new entry clears the redo future and evicts the oldest entry once the cap is exceeded. This invariant is owned once by a shared generic ring (`History<T>`); the model split below provides two never-mixed species that each only marshal their own value type. Mixing species is unrepresentable, not guarded.
_Avoid_: undo stack (names only one of the two stacks), history manager (the pre-split type that fused both species behind one enum — superseded by PixelCanvas History / Document History), snapshot stack.

**PixelCanvas History**:
The single-canvas undo/redo species — a LIFO of dimension-aware `Snapshot`s (width, height, pixel buffer) so pixels restore across resize. The Apple shell's history. Canonical core type `PixelCanvasHistory`.
_Avoid_: canvas history (informal), HistoryManager (the pre-split fused name this species was extracted from).

**Document History**:
The layer-aware undo/redo species — a LIFO of whole-`Document` snapshots (layer stack, active-layer pointer, Marquee, counters). The web shell's history; wrapped by the WASM binding. Canonical core type `DocumentHistory`.
_Avoid_: document undo, layer history.
