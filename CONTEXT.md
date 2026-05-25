# DOTORIXEL

DOTORIXEL is a pixel art editor with a Svelte web shell, an Apple SwiftUI shell, and a shared Rust core. This document captures the project's domain vocabulary so design decisions and architecture reviews can refer to concepts by their canonical names.

## Language

### Document & Layers

**Document**:
The artifact a user edits and saves — a single piece of pixel art with its own canvas dimensions, layer stack, and active layer pointer. One Document per tab. Persisted to IndexedDB; opened and edited at runtime through a single `Document` model that owns the layer stack and exposes composite, resize, history, and structural mutation as first-class operations.
_Avoid_: artwork (too vague — also used for portfolio sharing), composition (overlaps with the rendering term), image (used for reference images and exports).

**Layer**:
The umbrella term for a named slot inside a Document. A Layer is one of two kinds — **Pixel Layer** or **Reference Layer** — and carries per-layer display flags (visibility, opacity) regardless of kind. Drawing tools operate against the active Layer when it is a Pixel Layer; on a Reference Layer they silently no-op. Pixel Layers form the reorderable artwork stack; the singleton Reference Layer, when present, is fixed below every Pixel Layer and rendered separately as a viewport underlay.
_Avoid_: frame (animation term), tile, slice, stack (the *collection* of layers; an individual entry is a Layer).

**Pixel Layer**:
A Layer that owns a pixel buffer matching the Document's canvas dimensions. The variant that drawing tools target and the only variant that contributes to exports (PNG, SVG, saved-work thumbnail). The original Layer shape from PRD-086 is exactly this variant.
_Avoid_: paint layer, draw layer, raster layer.

**Reference Layer**:
A singleton Layer that holds a decoded source image plus a Reference Layer Placement, used as a tracing reference inside the Document. The user can adjust its visibility, opacity, position, and scale, but cannot draw on it or reorder it above Pixel Layers. Rendered by the shell as an original-image viewport underlay and **excluded from `Document.composite()`, exports, and saved-work thumbnails**. Persisted in the Document so it survives reload and undo/redo, but never published as part of the artwork. Distinct from a Reference Window (workspace-scoped, sampling-oriented).
_Avoid_: imported image, tracing layer, reference image (Reference Window's term).

**Reference Layer Underlay**:
A shell-facing projection of a visible Reference Layer used to draw the original source image in the viewport and interpret placement-based source sampling.
_Avoid_: overlay (ambiguous with UI chrome), render layer, reference image.

**Reference Layer Placement**:
A Reference Layer's source-to-document geometry — the position and uniform scale that map the source image onto the Document canvas. On import, large sources are aspect-fit into the canvas while smaller sources stay at natural size; "Fit to canvas" aspect-fits the source into the current canvas, allows upscaling, and centers the result. Composite sampling is nearest-neighbor.
_Avoid_: position, transform, geometry, viewport (all overloaded).

**Reference Layer Placement Interaction**:
The pointer- and keyboard-driven lifecycle for editing a Reference Layer Placement in the canvas viewport, covering draft placement, drag/nudge updates, cancel, and commit semantics.
_Avoid_: placement drag, overlay edit, transform interaction.

**Document Change Journal**:
The web-shell module that applies classified changes to the active Document and owns the shell-side follow-up sequence: undo snapshot capture when appropriate, canvas dimension mirrors, viewport reclamp, render invalidation, and dirty notification. It distinguishes undoable Document changes (Layer edits, Reference Layer Placement commits, resize, clear), persisted UI state changes (active Layer, timeline panel collapsed), and transient UI state changes (dialogs, import busy state, resize anchor). The Rust core Document remains the authority for Document invariants; the journal owns only the web shell's change procedure around it.
_Avoid_: document transaction (implies database semantics), change manager (too vague), history wrapper (too narrow).

### Sampling

**Sampling Session**:
A pointer-driven color-pick lifecycle — the user opens a session at a target pixel, a loupe shows the surrounding grid, and on release the centered pixel commits to a draw color slot.
_Avoid_: color picker session, eyedropper session (eyedropper is a tool, not a session).

**Sampling Port**:
The narrow `width / height / get_pixel(x, y)` surface a sampling session reads from. `get_pixel` returns a color or `null` when an in-bounds coordinate has no readable pixel. Pixel canvases satisfy it directly; Canvas Sampling Sessions adapt the active Document's active-layer sampling path; reference images satisfy it through a decoded RGBA buffer.
_Avoid_: pixel source, image data.

**Loupe**:
The on-screen overlay shown during a sampling session — a magnified grid centered on the sampled pixel, positioned to avoid the user's pointer.
_Avoid_: zoom preview, magnifier.

**Canvas Sampling Session**:
A sampling session against the active Document's sampled layer data. The port is always available, so `start` is synchronous; there is no press-time foreground preview — only commit-on-release. Pixel Layers sample document pixels; Reference Layers sample the placed source image in original image coordinates.

**Reference Sampling Session**:
A sampling session against an imported reference image. The port becomes available only after the blob is decoded, so `start` is asynchronous; emits a press-time foreground preview and tracks the foreground in real time during the drag, with the recent-color entry deferred until release.
_Avoid_: reference picker, deferred sampling session.

### Reference Windows

**Reference Window**:
A floating, draggable, resizable view of an imported reference image, anchored inside the active canvas viewport.
_Avoid_: reference panel, image window, ref overlay.

**Reference Window Placement**:
A Reference Window's geometry within the canvas viewport — `{x, y, width, height}`. Always fits aspect-preservingly inside the current viewport; when the viewport shrinks, the placement is rewritten in place rather than projected at render time.
_Avoid_: position, geometry, layout.

**Placement Intent**:
The semantic that produces a Reference Window Placement — *centered* (offset from the viewport center by a Cascade Index) or *at-point* (centered on a user-supplied coordinate).
_Avoid_: placement strategy, placement mode.

**Cascade Index**:
A per-document counter incremented each time the user opens a Reference Window via the gallery (a *centered* Placement Intent), used to stagger successive windows so they don't fully cover each other. *At-point* placements (drops) do not consume or advance the Cascade Index — they cascade only within a single Drop Batch.
_Avoid_: stagger index, offset count.

**Drop Batch**:
A single drag-and-drop import operation containing one or more files. *At-point* Placement Intents within the same Drop Batch cascade linearly from the drop anchor by `index × CASCADE_OFFSET` along both axes; batches do not influence each other, and a Drop Batch never advances the document's Cascade Index.
_Avoid_: drop group, drop session.

## Relationships

- A **Sampling Session** drives a **Loupe** and reads through a **Sampling Port**.
- A **Canvas Sampling Session** holds a synchronous **Sampling Port** adapted from the active Document's active-layer sampling path.
- A **Reference Sampling Session** binds its **Sampling Port** asynchronously through a blob decode and discards the bound port on release.
- A **Reference Window** has exactly one **Reference Window Placement**.
- A **Reference Window Placement** is produced by applying a **Placement Intent** under the current viewport.
- A *centered* **Placement Intent** consumes the document's **Cascade Index**; an *at-point* **Placement Intent** does not.
- An *at-point* **Placement Intent** belongs to a **Drop Batch**, which determines its intra-batch stagger from the drop anchor.
- A **Layer** is exactly one of **Pixel Layer** or **Reference Layer**; both share id, name, visibility, and opacity.
- A **Reference Layer** has exactly one **Reference Layer Placement**.
- A **Reference Layer Underlay** is derived from the visible **Reference Layer** and shares its **Reference Layer Placement**.
- A **Reference Layer Placement Interaction** edits exactly one active **Reference Layer Placement** at a time.
- A **Document Change Journal** applies web-shell changes to the active **Document** and centralizes undo, render invalidation, viewport reclamp, and dirty notification side effects.
- Drawing tools mutate only the active **Pixel Layer**; `Document.composite()` and exports include only Pixel Layers, while the shell draws a visible **Reference Layer** as a viewport underlay before the Pixel composite.
- A **Reference Window** is workspace-scoped and never enters the Document; a **Reference Layer** is Document-scoped and persisted alongside the artwork. The two are independent — neither converts to the other.

## Example dialogue

> **Dev:** "If the user long-presses a reference window while a canvas sampling session is already active, do we cross-commit?"
> **Domain expert:** "No — the two are partitioned by where the press lands. Long-pressing the canvas opens a **Canvas Sampling Session**; long-pressing a reference window opens a **Reference Sampling Session**. They share the **Loupe** and the **Sampling Port** contract, but their lifecycles are independent."

> **Dev:** "After the user drops three files on the canvas, then opens a fourth from the gallery, where does the fourth land?"
> **Domain expert:** "The drop produced three *at-point* **Placement Intents** — they cascaded only within that batch and didn't touch the **Cascade Index**. The gallery open is a *centered* **Placement Intent**, so it consumes the next **Cascade Index** for that document, which is still 0 if no gallery opens preceded the drop."

> **Dev:** "When the user drags a Reference Layer corner and then presses Escape, did the Reference Layer Placement change?"
> **Domain expert:** "No — that was an in-flight **Reference Layer Placement Interaction**. Escape cancels its draft placement, so only a clean commit updates the **Reference Layer Placement**."
