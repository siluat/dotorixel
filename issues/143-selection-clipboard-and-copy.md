---
title: "Selection Clipboard + Copy (Cmd+C) + workspace persistence"
status: ready-for-agent
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

Introduce the workspace-shared Selection Clipboard, wire Cmd/Ctrl+C to copy the Marquee region into it, and persist it alongside other workspace-shared state so the clipboard survives reload and is shared across all tabs.

Scope:

- **Rust core** (`crates/core/src/selection.rs`): `SelectionClipboard` value type — `{ pixels: Vec<u8>, width: u32, height: u32 }`. Plain struct, no mutation methods; consumers replace or read.
- **WASM facade**: expose the type.
- **Workspace.shared** (`workspace.svelte.ts`): new field `selectionClipboard: SelectionClipboardData | null`. Setter `setSelectionClipboard(value)` routes through the workspace so persistence captures the change.
- **Keyboard input** (`keyboard-input.svelte.ts`): Cmd/Ctrl+C dispatches a `copySelection()` host callback. In Idle state, copies the Marquee region pixels via `lift_marquee_pixels()` (does NOT mutate the layer — only reads). With no Marquee, the keystroke is a silent no-op.
- **Workspace persistence**: extend the workspace persistence schema to read/write the `selectionClipboard` field alongside existing shared state (active tool, colors, etc.). The clipboard's pixel buffer is stored as base64-encoded bytes or equivalent serializable form.
- Cross-tab use: copying in tab A and switching to tab B leaves the clipboard intact in `workspace.shared`. (Paste arrives in 148.)

Implementation notes:

- The clipboard captures the active Marquee's pixels at copy-time — a snapshot. Subsequent Marquee changes do NOT affect the clipboard.
- Copy on a Reference-Layer-active Document is a silent no-op (matches 138).

Tests:

- Rust unit test: `SelectionClipboard` round-trips through serialization.
- TS test: `copySelection` populates `workspace.shared.selectionClipboard` with the Marquee region pixels.
- TS test: `copySelection` with no Marquee is silent no-op.
- TS test: `copySelection` on Reference-active is silent no-op.
- Persistence test: clipboard survives a workspace persistence round-trip.
- Cross-tab test: switching tabs preserves the clipboard.

## Acceptance criteria

- `SelectionClipboard` Rust value type exposed through WASM.
- `workspace.shared.selectionClipboard` field with setter routed for persistence.
- Cmd+C with active Marquee copies pixels into the clipboard without mutating the layer.
- Cmd+C with no Marquee is a silent no-op.
- Workspace persistence reads and writes the clipboard.
- Clipboard survives reload.
- Cross-tab clipboard sharing works (single slot across tabs).

## Blocked by

- [136 — Region pixel transformations (lift/clear/composite) + Delete keyboard](136-region-pixel-transformations-and-delete.md)
