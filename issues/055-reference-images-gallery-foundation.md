---
title: Reference images — gallery foundation (store, persistence, import, modal)
status: open
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
