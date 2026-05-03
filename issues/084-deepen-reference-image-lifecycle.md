---
title: Deepen reference image lifecycle — promote intake/display orchestration into a References class
status: done
created: 2026-05-03
---

## What to build

Promote the reference-image lifecycle (intake → add → placement → display) from `+page.svelte` and the thin `select-reference.ts` wrapper into a deepened `References` class at `src/lib/reference-images/references.svelte.ts` (renamed from `reference-images-store.svelte.ts`). The current `ReferenceImagesStore` exposes data-shaped CRUD primitives (`add`, `display`, `show`, `close`, `nextCascadeIndex`); domain rules — *centered* Placement Intent for gallery opens, *at-point* Placement Intent with intra-Drop-Batch cascade for drag-drop, "open or raise" semantics for gallery selection, three-state toggle visibility, and batch file intake — currently live as inline orchestration in `+page.svelte` (~120 LOC) and a thin coordinator `select-reference.ts` (46 LOC) that re-imports `createPlacement` and `store.nextCascadeIndex` to assemble a centered placement.

The deepened `References` exposes lifecycle-shaped public methods so the page never reaches into `createPlacement`, `CASCADE_OFFSET`, `nextCascadeIndex`, or `displayReference`/`selectReference`:

- `importToGallery(files, docId): Promise<{ errors }>` — batch validate/decode/thumbnail/add, no display.
- `importDroppedBatch(files, docId, anchor, viewport): Promise<{ errors }>` — same intake plus *at-point* Placement Intent with intra-Drop-Batch cascade applied internally.
- `openCentered(refId, docId, viewport)` — gallery card click; ensures visible. Existing display state → raise z-order; missing → fresh *centered* Placement Intent (consumes the document's Cascade Index).
- `toggleDisplay(refId, docId, viewport)` — gallery toggle button; cycles visibility. visible→close, hidden→show, missing→fresh-centered (preserves current "first toggle opens" UX).

Three primitives become structurally private (`#`-prefixed): `#add`, `#display`, `#nextCascadeIndex`. They are owned exclusively by the four lifecycle methods above. `show`, `close`, and the geometry setters (`setDisplayPosition` / `setDisplaySize` / `setMinimized`) remain public because `ReferenceWindowOverlay.svelte` and `ReferenceWindow.svelte` invoke them directly for window-level UI (X button, z-raise, drag/resize/minimize) — those are not lifecycle operations and have valid callers outside the lifecycle path.

`ImportError` and `ImportFileError` types move from `import-reference-image.ts` into `references.svelte.ts` as part of the public surface. `import-reference-files.ts`, `import-reference-image.ts`, `select-reference.ts` (and their test files) are deleted; their orchestration folds into `References` as a private `#importOne` helper, while the pure helpers `import-validator.ts` and `thumbnail.ts` remain free functions called internally.

Domain vocabulary added to `CONTEXT.md`: **Drop Batch** — a single drag-and-drop import operation whose at-point Placement Intents cascade linearly from the drop anchor by `index × CASCADE_OFFSET` and never advance the document's Cascade Index.

User-visible behaviour is unchanged.

## Acceptance criteria

- `src/lib/reference-images/references.svelte.ts` exports a `References` class with the public surface above plus the existing query/snapshot/window-mutation/removal/refit methods. `add`, `display`, and `nextCascadeIndex` are `#`-prefixed private; new `#importOne` and `#ensureDisplayed` helpers are also private.
- `importToGallery` validates, decodes, thumbnails, and adds each file in input order, returning `{ errors: ImportFileError[] }`. No display state is created. Localized error messaging stays at the page (consumes `ImportFileError`).
- `importDroppedBatch` performs the same intake, then for each successfully imported reference creates an *at-point* `Placement` whose anchor is `(anchor.x + index × CASCADE_OFFSET, anchor.y + index × CASCADE_OFFSET)` and registers display state. Errors returned identically to `importToGallery`.
- `openCentered` ensures the reference is visible: existing `DisplayState` → raise z-order via the same path the existing `show()` uses; missing → consume `nextCascadeIndex(docId)` and create a *centered* `Placement`. Net result: window is visible at the maximum z-order on return.
- `toggleDisplay` cycles visibility: visible→close, hidden→show (raise z-order), missing→fresh-centered (same path as `openCentered`). Preserves the current "first toggle opens" UX.
- `ImportError` and `ImportFileError` types are exported from `references.svelte.ts`. Page imports updated accordingly.
- `+page.svelte` reference-related imports collapse from 9 to 2 (`References` types + `ReferenceImage` type). The four reference handlers (`importToGallery`, `handleCanvasDrop`, `handleReferenceSelect`, `handleReferenceToggleDisplay`) shrink to ≤5 LOC each, performing only `editor.workspace.references.X(...)` plus error i18n. `createPlacement` and `CASCADE_OFFSET` are not imported by the page.
- Files deleted: `select-reference.ts`, `select-reference.test.ts`, `import-reference-files.ts`, `import-reference-files.test.ts`, `import-reference-image.ts`, `import-reference-image.test.ts` (361 LOC total). Coverage relocated into `references.svelte.test.ts`.
- File renamed: `reference-images-store.svelte.ts` → `references.svelte.ts`, class `ReferenceImagesStore` → `References`. Importers updated: `workspace.svelte.ts`, `ReferenceWindowOverlay.svelte`, `+page.svelte`, plus the renamed test file.
- `import-validator.ts`, `thumbnail.ts`, and their test files unchanged. `reference-window-placement.ts`, `reference-window-constants.ts`, `reference-image-types.ts`, `display-state-types.ts` unchanged in shape.
- `CONTEXT.md` gains a **Drop Batch** entry under "Reference Windows"; the Relationships section gains "An *at-point* **Placement Intent** belongs to a **Drop Batch**, which determines its intra-batch stagger from the drop anchor." (Both already applied as part of the design conversation that produced this issue.)
- `bun run check` + `bun run test` + `cargo test` green at every commit.

## Commits

Following the 077 pattern: sugar first, atomic switch, atomic delete + encapsulation, separate rename.

| # | Type | Scope | Consumers touched |
|---|------|-------|-------------------|
| 1 | additive | Add `importToGallery`, `importDroppedBatch`, `openCentered`, `toggleDisplay` to existing `ReferenceImagesStore`. New methods call the existing `importReferenceImage` free function (still exported from its file). New unit specs in `reference-images-store.svelte.test.ts`. | 0 |
| 2 | migration | `+page.svelte` switches to the new methods. `select-reference.ts`, `import-reference-files.ts`, `import-reference-image.ts`, `createPlacement`, `CASCADE_OFFSET` no longer imported by page. Page handler bodies shrink to delegations + i18n. | 1 (page) |
| 3 | deletion + encapsulation | Delete `select-reference.{ts,test.ts}`, `import-reference-files.{ts,test.ts}`, `import-reference-image.{ts,test.ts}`. Inline `importReferenceImage` logic as `#importOne` private helper. Move `ImportError`/`ImportFileError` types into the store file. Make `add`/`display`/`nextCascadeIndex` `#`-private. | 0 |
| 4 | rename | File `reference-images-store.svelte.ts` → `references.svelte.ts`, class `ReferenceImagesStore` → `References`. Update importers. | 4 (workspace, overlay, page, test file) |

## Decision Document

### Module name and rename

`References` (matching the field name `editor.workspace.references`). The previous `ReferenceImagesStore` named the class after data; after absorbing intake + display lifecycle, the dominant surface is verbs over the per-document collection of reference images. Short noun matches the 077 precedent (`Workspace`, `EditorController`).

### Lifecycle-shaped vs. intent-shaped public surface

Lifecycle-shaped wins. The page reads as user actions (`importToGallery`, `openCentered`, `toggleDisplay`); CONTEXT.md domain types (`PlacementIntent`) stay internal. Three-branch toggle semantics (visible/hidden/missing) carry domain meaning that should live in the method body, not at every caller.

### `openCentered` vs. `toggleDisplay` split

Two methods, distinct semantics. `openCentered` always ends visible (open or raise). `toggleDisplay` cycles visibility but reuses the same fresh-centered path on missing state. Sharing a single method with a mode argument would push the mode decision to callers without simplifying internals.

### Toggle on missing state

Preserves current behaviour: missing → fresh centered placement. Changing this would silently break the gallery toggle button's "first click opens" UX.

### `show`/`close` stay public

`ReferenceWindowOverlay.svelte` calls `show` (z-raise on click) and `close` (X button) directly; these are window-level UI primitives, not lifecycle operations. Keeping them public preserves the existing seam without forcing the overlay to route through lifecycle methods.

### Intake folded inside

`import-reference-files.ts` and `import-reference-image.ts` orchestration moves into `References` as a `#importOne` private helper. Pure helpers `validateFile` and `computeThumbnailDimensions` remain free functions because they are independently useful and trivially testable in isolation.

### `add`/`display`/`nextCascadeIndex` made private

Structural enforcement, not convention. Their only callers (page, `select-reference.ts`) disappear in commit 2; making them `#`-private in commit 3 prevents reintroduction without a code-review catch.

### Drop Batch terminology

Sharpened in `CONTEXT.md` so the `importDroppedBatch` method name reads as a domain term rather than implementation jargon. Cascade math (`index × CASCADE_OFFSET` along both axes) is part of the definition because it is observable behaviour.

## Testing Decisions

- `references.svelte.test.ts` (renamed from `reference-images-store.svelte.test.ts`) absorbs:
  - existing 442 LOC of CRUD/snapshot/refit specs;
  - `select-reference.test.ts` (126 LOC) → coverage of `openCentered` (open/raise paths) and `toggleDisplay` (3-branch);
  - `import-reference-files.test.ts` (64 LOC) → `importToGallery` batch ordering + per-file error collection;
  - `import-reference-image.test.ts` (29 LOC) → single-file validation + decode failure → `ImportFileError` shape (asserted through `importToGallery` calls).
- `import-validator.test.ts` and `thumbnail.test.ts` remain unchanged.
- No new tests for `#importOne` / `#ensureDisplayed` private helpers; their behaviour is observed through the four public lifecycle methods.

## Out of Scope

- The 4 remaining shallow sampling helpers (`sampler.ts`, `sample-pixel.ts`, `sampling-port.ts`, `decode-reference-blob.ts`) and the duplicate `samplePixel` name. Tracked separately as a follow-up deepening candidate.
- Changes to `ReferenceWindow.svelte`, `ReferenceWindowOverlay.svelte`, `ReferenceBrowser.svelte`, `ReferenceGalleryGrid.svelte`. The overlay's direct `show`/`close`/`set*` calls are intentionally preserved.
- Changes to `reference-window-placement.ts`, `reference-window-constants.ts`. These are stable post-082/083 and remain `References`'s internal collaborators.
- Persistence schema changes. `toSnapshot` / `displayStatesSnapshot` / `restored` / `restoredDisplayStates` shape unchanged.

## Blocked by

None — can start immediately.

## Results

| File | Description |
|------|-------------|
| `src/lib/reference-images/references.svelte.ts` | Renamed from `reference-images-store.svelte.ts`. Class renamed `ReferenceImagesStore` → `References`. Adds `importToGallery`, `importDroppedBatch`, `openCentered`, `toggleDisplay` lifecycle methods plus private `#importOne`, `#displayCentered`, `#nextCascadeIndex`. `ImportError` and `ImportFileError` types now exported from this file. |
| `src/lib/reference-images/references.svelte.test.ts` | Renamed from `reference-images-store.svelte.test.ts`. Absorbs coverage from the deleted intake/select tests. Replaces `vi.spyOn(singleImport, 'importReferenceImage')` with `vi.stubGlobal('createImageBitmap', …)` + a fake `OffscreenCanvas`, since `#importOne` is no longer reachable as a free function. Adds `installFakeImageDecoding` / `installDecodeFailure` helpers. |
| `src/lib/reference-images/select-reference.{ts,test.ts}` | Deleted. `selectReference` and `displayReference` orchestration folded into `References.openCentered` / `References.toggleDisplay`. |
| `src/lib/reference-images/import-reference-files.{ts,test.ts}` | Deleted. Batch intake folded into `References.importToGallery` / `importDroppedBatch`. |
| `src/lib/reference-images/import-reference-image.{ts,test.ts}` | Deleted. Single-file intake (validate → `createImageBitmap` → `OffscreenCanvas` thumbnail) inlined as `References.#importOne`. `THUMBNAIL_LONGEST_EDGE = 256` moved alongside it. |
| `src/lib/canvas/editor-session/workspace.svelte.ts` | Updated import path and class name (`ReferenceImagesStore` → `References`). |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte` | Updated `store` prop type to `References`. The overlay's direct `show` / `close` / `set*` calls are intentionally preserved — the geometry/visibility primitives stay public for window-level UI. |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte.test.ts` | Updated import path and class name. Existing fixture-only `store.add(…)` / `store.display(…)` calls preserved (see Key Decisions). |
| `src/routes/editor/+page.svelte` | The four reference handlers (`importToGallery`, `handleCanvasDrop`, `handleReferenceSelect`, `handleReferenceToggleDisplay`) shrank to delegations + i18n only. Page no longer imports `select-reference`, `import-reference-files`, `createPlacement`, or `CASCADE_OFFSET`. `ImportError` type now imported from `references.svelte`. |

### Key Decisions

- **`add` and `display` stay public** — diverges from the issue's "0 consumers touched" claim for commit 3. Discovered during commit 3 prep that `ReferenceWindowOverlay.svelte.test.ts` (~50 fixture calls) and `workspace.svelte.test.ts` (1 call) use these primitives to build display states with precise coordinates — fixture seams that have no lifecycle meaning. Routing those through lifecycle methods would degrade test readability for no real enforcement gain (the issue's `restoredDisplayStates` constructor option already permits state-injection fixtures by design). `#nextCascadeIndex` *is* `#`-private, which captures the issue's enforcement intent for the cascade-slot ownership.
- **No `#ensureDisplayed` helper** — the issue lists this as a private helper, but with `add`/`display` staying public the only place that benefits is `openCentered`, where one inline call to `this.show(…)` covers it. Keeping it inline keeps the lifecycle method readable as a 2-branch decision rather than a delegation.
- **Fake decoder via `vi.stubGlobal` rather than DI seam** — `#importOne` is properly private, so the previous `vi.spyOn(singleImport, 'importReferenceImage')` pattern no longer applies. Adding a constructor-injected decoder dependency would have grown the public surface for a test concern. Stubbing `createImageBitmap` and `OffscreenCanvas` globals matches the "fail at the boundary, trust the core" rule and keeps `References` API focused on lifecycle, not infrastructure.

### Notes

- 4 commits as planned (additive → migration → deletion+encapsulation → rename), all green at each step (`bun run check`, `bun run test`, `cargo test`).
- Test count change: 847 → 836. Net −11 = 6 deleted test files (~10 cases) + 4 removed `nextCascadeIndex` direct unit tests − 3 absorbed validation/decode cases now covered via `importToGallery`.
- `+page.svelte` reference imports collapsed from 9 to 4 (3 components, 1 type, 1 dropzone) — slightly more than the issue's projected "9 to 2" because the issue counted only library imports, not Svelte component imports. The intent (no `select-reference`/`createPlacement`/`CASCADE_OFFSET` at the page) is satisfied.
- Out-of-scope cleanups still pending — the 4 shallow sampling helpers (`sampler.ts`, `sample-pixel.ts`, `sampling-port.ts`, `decode-reference-blob.ts`) and the duplicate `samplePixel` name remain a separate deepening candidate.
