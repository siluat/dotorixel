# DOTORIXEL

DOTORIXEL is a pixel art editor with a Svelte web shell, an Apple SwiftUI shell, and a shared Rust core. This document captures the project's domain vocabulary so design decisions and architecture reviews can refer to concepts by their canonical names.

## Language

### Document & Layers

**Document**:
The artifact a user edits and saves — one piece of pixel art with its own canvas dimensions, layer stack, and active-layer pointer.
_Avoid_: artwork (too vague — also used for portfolio sharing), composition (overlaps with the rendering term), image (used for reference images and exports).

**Layer**:
A named slot inside a Document — exactly one of Pixel Layer or Reference Layer — carrying its own visibility and opacity.
_Avoid_: frame (animation term), tile, slice, stack (the *collection* of layers; an individual entry is a Layer).

**Pixel Layer**:
The Layer variant that owns a pixel buffer matching the Document's canvas — the only kind drawing tools target and exports include.
_Avoid_: paint layer, draw layer, raster layer.

**Reference Layer**:
A singleton Layer holding a source image and its Reference Layer Placement as an in-Document tracing reference, fixed below the Pixel Layers and excluded from every pixel output.
_Avoid_: imported image, tracing layer, reference image (Reference Window's term).

**Reference Layer Placement**:
A Reference Layer's source-to-document geometry — the position and uniform scale that map the source image onto the Document canvas.
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
A pointer-driven color-pick lifecycle that opens at a target pixel, shows a Loupe, and commits the centered pixel to a draw color slot on release.
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

**Placement Intent**:
The semantic that produces a Reference Window Placement — *centered* (offset from the viewport center by a Cascade Index) or *at-point* (centered on a user-supplied coordinate).
_Avoid_: placement strategy, placement mode.

**Cascade Index**:
A per-document counter, advanced only by *centered* gallery opens, that staggers successive Reference Windows so they don't fully cover each other.
_Avoid_: stagger index, offset count.

**Drop Batch**:
A single drag-and-drop import of one or more files whose *at-point* placements cascade only among themselves and never advance the Cascade Index.
_Avoid_: drop group, drop session.
