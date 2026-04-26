---
title: Reference images — gallery foundation (store, persistence, import, modal)
status: done
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

End-to-end foundation: user can open the References modal from the TopBar, import an image via file picker, see it in the gallery, delete it (with confirmation), and have the gallery survive a reload and tab switch. No canvas display yet — that ships in #056.

Covers the full vertical path for this minimum capability:

- **Data / store** — `ReferenceImage` record, reactive per-tab gallery store (`reference-images` under `src/lib/`). See parent PRD §Data Model, §Modules.
- **Persistence** — new `WorkspaceRecord` schema version adding per-docId references map; migration from current version yields empty map. See PRD §Scope & Persistence.
- **Import pipeline** — file-picker + MIME/size validation (PNG/JPEG/WebP/GIF, ≤10 MB) + thumbnail generation (longest edge 256px, aspect preserved). See PRD §Input & Import Policy.
- **UI entry** — TopBar References icon button next to My Works.
- **Modal / BottomSheet** — responsive split mirroring `SavedWorkBrowser` / `SavedWorkBrowserSheet`.
- **Gallery grid** — card with thumbnail, filename, dimensions, delete button; empty state.
- **Delete flow** — confirmation dialog following My Works' pattern.
- **Tab isolation** — switching tabs swaps the gallery; each tab's gallery is independent.

## Acceptance criteria

- TopBar button opens modal (wide/x-wide) or BottomSheet (compact/medium).
- File picker imports PNG/JPEG/WebP/GIF up to 10 MB; rejects other formats and >10 MB with a clear message.
- Gallery card renders thumbnail (≤256px longest edge), original filename, and natural dimensions.
- Deleting a card requires confirmation; confirmed deletion removes the entry permanently.
- Reload restores the gallery for every tab.
- Switching tabs shows the correct per-tab gallery (tab A entries do not appear on tab B).
- Unit tests: import validator (accept/reject matrix), thumbnail generator (aspect/size), store (import/delete/tab-switch), persistence round-trip.
- Component tests: modal opens via TopBar, empty state, gallery card click surface (selection callback wired but no display action yet), delete confirmation flow.
- No changes to `DocumentSchema`.

## Blocked by

- [054 — Reference images — UI design spec](054-reference-images-design.md)

## Scenarios addressed

- Scenario 1 (modal opens with gallery or empty state)
- Scenario 13 (delete with confirmation)
- Scenario 14 (tab switch shows the correct gallery — display states not yet wired, but gallery entries per-tab)
- Scenario 15 (reload restores gallery — display states land in #056)
- Scenario 16 (reject >10 MB)
- Scenario 17 (reject unsupported formats)

## Results

| File | Description |
|------|-------------|
| `src/lib/reference-images/reference-image-types.ts` | `ReferenceImage` record (id, filename, blob, thumbnail, mimeType, naturalWidth/Height, byteSize, addedAt) |
| `src/lib/reference-images/import-validator.ts` (+test) | MIME/size validation; discriminated union result with `unsupported-format` / `too-large` reasons |
| `src/lib/reference-images/thumbnail.ts` (+test) | Pure dimension math (`computeThumbnailDimensions`) for 256px-longest-edge thumbnails, aspect preserved |
| `src/lib/reference-images/import-reference-image.ts` (+test) | Coordinator: validate → `createImageBitmap` → `OffscreenCanvas` thumbnail; `ImportResult` discriminated union with `decode-failed` |
| `src/lib/reference-images/reference-images-store.svelte.ts` (+test) | Per-doc reactive store (`$state` map keyed by docId); `add`/`delete`/`removeDoc`/`forDoc`/`toSnapshot`; injects `DirtyNotifier` to mark workspace dirty on mutations |
| `src/lib/reference-images/ReferenceGalleryGrid.svelte` (+test) | Card grid with thumbnail/filename/dimensions, delete-confirmation dialog, empty state, escape-handler export |
| `src/lib/reference-images/ReferenceBrowser.svelte` | Desktop modal: header + add button, error banner, file picker trigger via empty-state click |
| `src/lib/reference-images/ReferenceBrowserSheet.svelte` | Mobile BottomSheet variant with the same surface |
| `src/lib/canvas/workspace-snapshot.ts` | Added optional `references?: Readonly<Record<string, readonly ReferenceImage[]>>` (absent on pre-existing snapshots) |
| `src/lib/canvas/editor-session/workspace.svelte.ts` (+test) | Owns `ReferenceImagesStore`; hydrates from restored snapshot; includes references in `toSnapshot()` |
| `src/lib/session/session-storage-types.ts` | `ReferenceImageRecord` interface; `WorkspaceRecord.references?: Record<string, ReferenceImageRecord[]>` (optional, absent → empty) |
| `src/lib/session/session-persistence.ts` (+test) | Round-trip references map per tab; deep-clones records on restore |
| `src/lib/ui-editor/TopBar.svelte` / `AppBar.svelte` | `Images` icon button with `onOpenReferences` (TopBar adds `isReferencesOpen` for active state) |
| `src/lib/ui-editor/TopBar.stories.svelte` | Both stories supply the new `onOpenReferences` prop |
| `src/routes/editor/+page.svelte` | Wires `isReferencesOpen` state, error array, file-picker handler, doc-cleanup on save-dialog/browser delete; renders modal/sheet by layout |
| `messages/{en,ko,ja}.json` | 14 new keys: `references_*`, `aria_openReferences`, `aria_deleteReference` |

### Key Decisions
- **Doc-scoped lifecycle** at runtime; **tab-scoped at persistence boundary** — only currently-open tabs persist references via `WorkspaceRecord`. Closed-but-saved docs lose their references in this slice (acceptable trade-off; revisit if/when references need DocumentRecord ownership).
- **No IndexedDB schema bump** — followed the `pixelPerfect?` precedent: `references?` is optional, absent → empty map. Forward-compatible without migrations.
- **Discriminated union for import errors** (`unsupported-format` / `too-large` / `decode-failed`) — actionable messages for the first two; `decode-failed` is genuinely opaque so message is generic.
- **`DirtyNotifier` port injection** for the store — preserves dependency inversion and lets fakes record dirty calls in unit tests without coupling to workspace internals.
- **Pure dimension math extracted** (`computeThumbnailDimensions`) — happy-dom can't reliably exercise `createImageBitmap`/`OffscreenCanvas`, so the coordinator integration test covers only the validation path.

### Notes
- Selection from gallery card is wired but a no-op — display on canvas lands in #056.
- All blob URLs are managed via a Svelte `use:objectUrl` action that revokes on unmount.
- Hidden `<input type="file" multiple>` in the editor page handles multi-file imports; per-file errors are collected into a banner the user can dismiss.
- Hardcoded color/spacing deviations were swept during a guideline audit — error banners and destructive button now use `var(--ds-danger)`; `referencesOpen` renamed to `isReferencesOpen` for question-form boolean naming.
