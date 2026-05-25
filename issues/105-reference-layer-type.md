---
title: "Reference Layer type — tracing reference for pixel artwork"
status: done
created: 2026-05-16
---

## Problem Statement

Pixel art creators commonly trace over a reference — a photo, a sketch, an existing artwork — to guide proportions, colors, and silhouettes. DOTORIXEL today offers Reference Window (PRD-053), but that is a sampling/preview affordance: it is workspace-scoped, does not survive reload, and cannot sit behind a partly transparent paint layer as a stable tracing backdrop.

The key user expectation is that a Reference Layer shows the **original image** on the editor canvas. It must not be converted into document pixels, downsampled into the pixel-art grid, or rendered as if it were part of the artwork's pixel buffer. The pixel layers remain the drawable artwork; the Reference Layer is a document-scoped visual aid behind them.

PRD-086 (Layer system: basic infrastructure) explicitly left the `Reference Layer / Pixel Layer split (umbrella enum transition)` as a follow-up. This PRD fills that slot, with one important constraint: Reference Layer is a persistent underlay, not another reorderable paint layer.

## Solution

Introduce a **Reference Layer** as a document-scoped tracing underlay:

- It stores the original decoded source image plus a placement (position + uniform scale).
- It is rendered in the viewport as the original bitmap under the Pixel Layer composite.
- It is persisted with the Document and participates in undo/redo for placement, visibility, delete, and replacement.
- It is excluded from exported PNG/SVG and saved-work thumbnails.
- It is always bottom-most by z-order and cannot be reordered.
- A Document can contain at most one Reference Layer.

Loading a new reference image when one already exists **replaces** the existing Reference Layer's image and resets its placement to auto-fit. Before that replacement proceeds, the user must be told that the existing reference will be replaced and must confirm.

Reference Window remains unchanged: file drops onto the canvas create Reference Windows, not Reference Layers. Reference Layer creation is a deliberate Timeline Panel action.

### Key Shape Changes

- **Type model**: the Document distinguishes drawable **Pixel Layers** from an optional singleton **Reference Layer**. Implementation may keep an umbrella `LayerKind`, but the invariant is strict: at most one Reference Layer, always below all Pixel Layers.
- **Rendering model**: `Document.composite()` is Pixel-only. The web shell draws the Reference Layer as a viewport-native underlay, then draws the Pixel Layer composite over it. Reference pixels are never baked into the document RGBA buffer.
- **Export model**: export paths use Pixel-only data. `composite_for_export()` may remain as an explicit export API, but it must be equivalent to Pixel-only composition.
- **Timeline Panel**: Reference appears as a fixed bottom row when present. It has a kind icon, visibility/delete controls, active selection for placement, and Fit to canvas. It has no reorder affordance.
- **Import flow**: the dedicated Reference icon sets or replaces the singleton Reference Layer. If one exists, show a confirmation before opening/replacing. The Pixel `+` path remains unchanged.
- **Viewport overlay**: when the Reference Layer is active, an overlay with handles lets the user move and resize its placement. The overlay traces the viewport underlay, not a composited document-pixel footprint.

## User Stories

1. As a pixel artist, I want to import a reference image into my document, so that the trace target persists across sessions instead of disappearing every reload.
2. As a pixel artist, I want the reference image to display behind my paint layers as the original image, so that I can trace over it without it being converted into pixel-art pixels.
3. As a pixel artist, I want the reference image not to appear in exported PNG/SVG or saved-work thumbnails, so that I publish only my own artwork.
4. As a pixel artist, I want a dedicated, obvious entry point for setting the Reference Layer, so that I do not confuse it with adding a normal paint layer.
5. As a pixel artist, I want the Pixel Layer `+` button to stay a single click, so that the frequent action does not get slower.
6. As a pixel artist, I want only one Reference Layer per document, so that the tracing underlay remains unambiguous.
7. As a pixel artist, when I already have a Reference Layer and choose to load another image, I want to be warned that the existing image will be replaced and asked to confirm.
8. As a pixel artist, I want the Reference Layer to always stay below all Pixel Layers, so that it behaves like a tracing backdrop rather than artwork.
9. As a pixel artist, I want Reference Layer ordering to be fixed, so that I cannot accidentally move the reference above my artwork.
10. As a pixel artist, I want to hide/show or delete the Reference Layer, so that I can inspect the artwork cleanly or remove the tracing aid entirely.
11. As a pixel artist, I want to drag the Reference Layer handles to move and resize it, so that I can align it visually with the work.
12. As a pixel artist, I want one click on Fit to canvas to make the reference fill as much of the canvas as possible without cropping, so that I can quickly return to a useful tracing baseline.
13. As a pixel artist, I want placement changes to be undoable, so that I can experiment freely.
14. As a pixel artist, I want each layer row in the Timeline Panel to show a distinct icon for Pixel vs Reference, so that I can tell at a glance which is which.
15. As a pixel artist, I want to activate the Reference Layer for placement edits, so that the same selection model works across the panel.
16. As a pixel artist, when the Reference Layer is active and I select a drawing tool, I want the tool to silently no-op with clear passive UI feedback, so that mis-clicks are harmless.
17. As a pixel artist, I want my Reference Layer's source dimensions to survive reload, so that Fit to canvas always uses the same source-image baseline.
18. As a pixel artist importing a reference much larger than my canvas, I want the initial placement to auto-fit aspect-preservingly so I can see the whole reference at once.
19. As a pixel artist resizing my canvas while a Reference Layer is in place, I want the placement to follow the chosen anchor, so that anchor selection means the same thing for the underlay.
20. As a pixel artist using a precise reference, I want to nudge the active Reference Layer 1 pixel at a time with arrow keys, so that I can align it without mouse precision.
21. Cancelled on 2026-05-24: Shift while dragging a corner handle does not snap to absolute integer scale multiples in v1.
22. As a pixel artist importing a large file, I want the Reference row to show a loading state and the import button to become busy, so that I get immediate feedback.
23. As a pixel artist who picked an unsupported or corrupt file, I want a brief error toast and no leftover row.
24. As a pixel artist whose storage quota is near full, I want failed import or replacement to roll back cleanly with a clear toast.
25. As a pixel artist on a touch device, I want placement handles to be comfortably finger-sized regardless of canvas zoom.

## Implementation Decisions

### Document Model

The Document owns:

- a reorderable list of Pixel Layers;
- zero or one Reference Layer;
- the active layer id, which may point to either kind.

If the current Rust structure keeps `Layer { kind: LayerKind }`, all Document mutators must enforce these invariants:

- no more than one `LayerKind::Reference`;
- Reference is always the bottom-most render depth;
- Reference cannot be moved by reorder operations;
- importing a new reference replaces the existing Reference payload rather than appending another layer.

The long-term shape can be either an explicit `Option<ReferenceLayer>` plus `Vec<PixelLayer>`, or an umbrella layer list with invariant checks. The user-facing contract above is the source of truth.

### Reference Data

Reference data stores:

- source RGBA buffer at natural dimensions;
- source width/height;
- display name, defaulting to the imported file name and falling back to localized `"Reference"`;
- visibility;
- placement `{ x, y, scale }` with uniform scale only.

The source RGBA buffer is never mutated by canvas resize, export, or Pixel Layer drawing.

### Rendering Contract

The on-screen editor render is a two-stage shell composition:

1. Draw the visible Reference Layer source image into the canvas viewport using its placement, clipped to the document bounds.
2. Draw the Pixel Layer composite over it.

This means:

- Reference display uses the original bitmap as the source of truth.
- Reference display is not downsampled into the document's pixel grid.
- `Document.composite()` must not contain Reference pixels.
- Pixel Layer opacity and alpha blend over the reference visually in the viewport, but the reference never contaminates pixel buffers, history snapshots, exports, or thumbnails.

If the renderer needs a preview during placement drag, the draft placement lives in the shell render path. The Document is mutated only on commit.

### Import and Replacement Flow

A dedicated Reference Layer icon sits next to the existing Pixel `+`.

Flow:

1. User clicks the Reference icon.
2. If the document already has a Reference Layer, show a confirmation explaining that choosing a new image will replace the existing reference. Cancel stops here.
3. Open file picker.
4. Decode via `src/lib/reference-images/decode-reference-blob.ts`.
5. Set the singleton Reference Layer with source RGBA + dimensions + display name.
6. Compute initial placement as auto-fit, aspect-preserving, centered.
7. Make the Reference Layer active.

Replacement resets placement to auto-fit. It does not preserve the previous image's placement because the new source may have unrelated dimensions and aspect ratio.

Loading/failure behavior:

- During decode, the Reference row shows a skeleton/spinner state and the import icon is disabled with a spinner.
- Decode failure removes the skeleton row and shows a localized toast.
- Storage quota failure rolls back to the prior state. If replacing, the old Reference Layer remains intact.

### Initial Placement

`set_reference_layer` or `add_reference_layer` computes:

```text
scale  = min(canvas_width / source_width, canvas_height / source_height, 1.0)
center = (canvas_width / 2, canvas_height / 2)
```

- Source smaller than canvas: `scale = 1.0`, centered.
- Source larger than canvas: scaled down so the full source is visible, centered.
- Fit to canvas later sets `scale = min(canvas_width / source_width, canvas_height / source_height)` without the `1.0` cap, then centers the projected source footprint.

### Canvas Resize × Placement

Canvas resize transforms Reference placement with the same 9-anchor policy used for Pixel Layer crop/extend:

```text
anchor_x_factor in {0, 0.5, 1.0}  // left, center, right
anchor_y_factor in {0, 0.5, 1.0}  // top, center, bottom

placement.x += (new_width  - old_width)  * anchor_x_factor
placement.y += (new_height - old_height) * anchor_y_factor
placement.scale  // unchanged
```

The source buffer is never modified. If the projected footprint extends past the resized canvas, the viewport naturally clips it.

### Timeline Panel

Reference appears as a fixed bottom row whenever present:

- It shows the Reference kind icon.
- It can be selected/activated for placement.
- It can be hidden or deleted.
- It can show Fit to canvas when active.
- It does not show a reorder handle.
- Pixel Layer reorder operations cannot move any Pixel Layer below the Reference row.

The row's fixed position is part of the model, not only CSS.

### Tool Behavior

- Drawing tools (pencil, brush, eraser, bucket, shape) silently no-op when the Reference Layer is active. The canvas cursor switches to `not-allowed` on desktop; no toast and no disabled toolbar buttons.
- The Move tool is the only selected tool that can translate the Reference overlay body. Corner handles remain direct placement controls regardless of the selected tool: corner drag uniformly scales, and arrows nudge placement.
- Eyedropper and Canvas Sampling Sessions are read-only active-layer sampling flows. Pixel Layers sample document pixels; Reference Layers sample the placed source image explicitly in original source-image coordinates. UI sampling uses sub-document-pixel pointer targets so the Loupe tracks the source image smoothly, not in document-pixel jumps. This does not make Reference pixels part of the artwork buffer or `Document.composite()`.

### Viewport Placement Overlay

When the active layer is Reference, the viewport renders:

| Zone | Pointer action | Cursor |
|---|---|---|
| Four corner handles | Drag: uniform scale around opposite corner | `nwse-resize` / `nesw-resize` |
| Body | Move tool active: drag to translate. Other tools: no placement movement | `move` only while Move tool is active |
| Outside placement | Tool default | Tool cursor |

Edge-midpoint handles are omitted because placement is uniform-scale only.
If the active Reference footprint overflows the visible document frame, viewport pan bounds expand to include that projected footprint so the actual corner handles remain reachable by panning.

Commit semantics:

- Pointer drag previews in real time using a draft placement.
- Pointer release commits via `set_reference_placement` and pushes one Document snapshot.
- Pointer cancel or Escape drops the preview without committing.
- Keyboard nudge commits per key event.

Handle sizing remains screen-space constant: about 12px visual on desktop, 16px on touch, with invisible hit padding to meet touch target expectations.

### Persistence

V4 storage persists the singleton Reference Layer as part of the Document record. Existing V3 documents migrate all existing layers as Pixel Layers and no Reference Layer.

The persisted shape must preserve:

- source image data or a source blob that can be decoded on hydrate;
- natural width/height;
- placement;
- visibility;
- display name.

History snapshots include the Reference Layer state so placement, visibility, delete, and replacement are undoable.

### Apple Shell

This PRD makes no Apple shell UI changes. Apple still preserves the single `PixelCanvas` interface per `docs/decisions/web-document-layer-apple-preserved.en.md`. Reference Layer support on Apple arrives in a future phase.

## Testing Decisions

Test observable contracts, not internal layout.

### Deep-Module Unit Tests

- `ReferencePlacement`: fit-to-canvas computes an aspect-preserving centered placement; builders are value-pure; resize anchor transform updates position without mutating source size.
- Document singleton invariant: setting a Reference Layer twice replaces the existing one; no second Reference layer is appended.
- Document z-order invariant: Reference is always below Pixel Layers; reorder operations cannot move it.
- Document composite contract: `Document.composite()` contains Pixel Layers only.
- V3 -> V4 migration: existing documents become Pixel-only documents with no Reference Layer.

### Recommended Integration Coverage

- Import flow: no existing Reference -> file picker -> decode -> Reference row appears active.
- Replacement flow: existing Reference -> click Reference icon -> confirmation required -> cancel preserves old reference; confirm + decode replaces image and resets placement.
- Failed replacement: decode/quota failure leaves old Reference intact.
- Renderer: visible Reference underlay appears behind semi-transparent Pixel Layers, while export output excludes it.
- Timeline: Reference row is fixed bottom and has no reorder affordance; Pixel reorder cannot move below it.
- Drawing tools: Reference active produces no pixel mutation and shows passive cursor feedback.
- Placement overlay: overlay tracks the underlay placement, previews during drag, commits one snapshot on release.

### Deferred

- Advanced Reference source sampling controls, such as lock/disable toggles or numeric sample-space readouts.
- Public E2E can be added before release: import reference -> trace pixel layer -> export -> assert reference absent -> reload -> reference restored.

## Rejected Alternatives

### Reference Layer participates in `Document.composite()`

Rasterize the Reference source into the document pixel buffer through a sampler and blend it with Pixel Layers.

**Rejected because**: it converts the reference into document pixels and loses the source image fidelity the user expects. On small pixel canvases, a photo becomes downsampled/pixelated before it reaches the viewport, which is the exact failure this PRD is correcting.

### Reference Layer is reorderable like Pixel Layers

Let the user move Reference above or between Pixel Layers.

**Rejected because**: Reference is a tracing backdrop, not artwork. Fixed bottom z-order keeps the model simple and prevents accidental reference-over-art states.

### Multiple Reference Layers per Document

Allow importing several independent Reference Layers.

**Rejected for v1**: the immediate tracing workflow needs one backdrop. Multiple sources introduce ordering, selection, export, replacement, and UI density questions. If future workflow demand appears, solve it explicitly instead of accidentally via append semantics.

### Include Reference Layer in exports

Treat visible Reference as part of the published artwork.

**Rejected because**: Reference is input, not output. Exporting it risks leaking source material and defeats tracing.

### Per-layer "include in export" toggle

Add an `exported` flag to every layer.

**Rejected for v1**: the default behavior is unambiguous: Pixel Layers export, Reference does not. A general flag adds schema and UI complexity for a workflow not currently requested.

### Drag-and-drop creates Reference Layer

Make dropping files on the canvas set the document Reference Layer.

**Rejected because**: drops already belong to Reference Window's low-commitment preview/sampling workflow. Reference Layer is deliberate trace setup and uses the Timeline Panel icon.

### Shift snaps placement scale to absolute integer multiples

While corner-dragging the Reference placement overlay, snap `placement.scale` to `1.0, 2.0, 3.0, ...` when Shift is held.

**Rejected for v1**: `ReferencePlacement.scale` is absolute source-image-to-document-pixel scale. Large references fit into small canvases with useful fractional scales far below `1.0`; snapping to `1.0` makes the reference image jump to a huge footprint. This is not the intended clean-scale behavior. Future clean-placement constraints should be designed explicitly, likely as relative-to-fit snapping, numeric placement controls, or source-pixel alignment.

## Out of Scope

- Rasterize Reference Layer into a Pixel Layer.
- Multiple Reference Layers.
- Reordering Reference relative to Pixel Layers.
- Reference source color sampling.
- Reference Layer rename beyond using the imported file name.
- Opacity slider UI beyond existing shared layer opacity support.
- Apple shell Reference Layer support.
- Reference Window <-> Reference Layer conversion.
- Clipboard paste import.
- Multi-touch pinch-to-scale on the placement overlay.
- Crop/mask/rotate/non-uniform scale.
- Source-image cache compaction or mipmaps.
- Deep IndexedDB quota management beyond import-time rollback/toast.

## Impact on Existing Sub-Issues

This PRD was corrected on 2026-05-22 after implementation review revealed the old model was compositing Reference into the document pixel buffer.

- 109's nearest-neighbor sampler is no longer part of on-screen Reference display, but remains useful for explicit Reference source color sampling.
- 110 must be reworked: `Document.composite()` must become Pixel-only, Reference must be singleton/fixed-bottom, and import must replace instead of append.
- 112/125's Reference-source `try_get_pixel` behavior is v1 scope for Eyedropper and Canvas Sampling only; it must not feed composition or export.
- 116's export exclusion remains directionally correct, but tests should not assume on-screen `composite()` includes Reference pixels.
- 117's kind icon and activation remain useful, but reorder support for Reference is superseded. The Timeline row must remove Reference reorder affordances.
- 118 now implements set/replace with confirmation rather than append-new-layer import.
- 126 is the correction slice that brings the already-landed core/render/persistence foundation back in line before 118 proceeds.
- 122 is cancelled: absolute integer-scale snapping is not part of Reference Layer v1.

## Further Notes

- PRD-053 stated that Reference Layer "will live inside the layer system and be part of the document" (`issues/053-floating-reference-window.md:19`). This remains true for persistence, history, and Timeline identity, but not for document-pixel composition.
- ADR `docs/decisions/reference-layer-excluded-from-export.en.md` records the export and render-path split.
- Existing Reference Window image decoding remains the source of supported formats.
