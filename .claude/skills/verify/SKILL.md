---
name: verify
description: Build, launch, and drive the DOTORIXEL web editor to verify changes at the GUI surface. Use when a change needs runtime observation in the real app rather than tests.
---

# Verify — DOTORIXEL web editor

## Launch

- `bun run dev` (run in background) — runs wasm-pack build + paraglide compile, then Vite on `http://localhost:5173/`. Ready in ~10s.
- Editor entry: open `/` → click "Start Drawing" → SPA-navigates to `/editor`.

## Drive (agent-browser)

- `agent-browser open http://localhost:5173/ && agent-browser wait --load networkidle && agent-browser snapshot -i` — then interact with `@eN` refs.
- **Canvas drawing**: `click` only accepts selectors, not coordinates. Dispatch PointerEvents on `.pixel-canvas` via `eval --stdin`:
  `pointerdown` (buttons: 1) → optional `pointermove`s → `pointerup` (buttons: 0), each with `bubbles: true, clientX/clientY` in viewport px.
- **Assertions**: the status bar is the cheapest oracle — `agent-browser eval "document.querySelector('[class*=status]')?.textContent"` returns `"W × H  Marquee: WxH at (x, y)  <tool>"`.
- Keyboard: `agent-browser press "ControlOrMeta+z"` (undo — sends ⌘ on macOS, Ctrl elsewhere), etc.
- Screenshots: `agent-browser screenshot <scratchpad>/NN-step.png`, then Read the file.

## Gotchas

- **Locale**: opening `/ko/...` directly does NOT switch the locale (cookie-first strategy keeps `en`). Click the 한국어 / 日本語 link on the landing page instead, then re-enter the editor.
- **Workspace persists** (IndexedDB): a reload or re-entry restores the previous document, tools, and Marquee — don't assume a blank canvas on arrival.
- Panel buttons are plain-text matchable: `agent-browser click "text=Rotate Canvas Right"` (Playwright text= is exact-ish substring; region-tier "Rotate Right" won't collide with "Rotate Canvas Right").
