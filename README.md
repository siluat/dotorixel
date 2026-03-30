# DOTORIXEL

A pixel art editor you can open anywhere and start drawing right away.

![Rust](https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white)
![Svelte](https://img.shields.io/badge/Svelte-FF3E00?logo=svelte&logoColor=white)
![Swift](https://img.shields.io/badge/Swift-F05138?logo=swift&logoColor=white)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

## Roadmap

> Currently working on: **Milestone 2 — Production UI**

### Milestone 1 — Usable Editor ✓

The foundation: enough tools and polish to create real pixel art.

- Drawing tools — line, rectangle, circle, flood fill, eyedropper
- HSV color picker with foreground/background swap
- Keyboard shortcuts for tools and editing
- i18n (Korean / English / Japanese)
- Landing page and analytics

### Milestone 2 — Production UI

Overhaul the UI from prototype-level to production quality. Design for all platforms (desktop, iPad, mobile) and plan ahead for layers and animation.

- UI design with Pencil.dev (screen inventory, design system, responsive layouts)
- Design system application (token and component refactoring)
- Touch & mobile support (touch targets, pinch-zoom, safe area, responsive layout)

### Milestone 3 — Editor for Serious Work

Layer support, selection, and project persistence for larger projects.

- Layer system (add/delete/reorder, visibility, opacity)
- Selection & transform (rect select, move, copy/paste, flip)
- Project file format (JSON-based save/load)
- Apple Pencil: hover preview + palm rejection
- Touch modifier alternatives

### Milestone 4 — Animation-Capable Editor

Frame-by-frame animation workflow.

- Frame management and timeline UI
- Onion skinning
- Animation preview
- GIF and spritesheet export

## Tech Stack

| | Component | Technology |
|---|-----------|------------|
| Shared | Core Logic | Rust |
| Web | Bindings | wasm-bindgen |
| | UI | TypeScript + Svelte (SvelteKit, adapter-static) |
| | Rendering | Canvas2D |
| | Deployment | Vercel |
| Apple | Bindings | UniFFI |
| | UI | SwiftUI (macOS + iPadOS) |
| | Rendering | Metal |

## Prerequisites

### Web

- [bun](https://bun.sh/) v1.3+
- [Rust](https://www.rust-lang.org/tools/install) stable
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

### Apple (macOS / iPadOS)

- [Xcode](https://developer.apple.com/xcode/)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen)

## Getting Started

```bash
# Install dependencies
bun install

# Start development server (builds WASM automatically)
bun run dev
```

Open http://localhost:5173 in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Build WASM + start dev server |
| `bun run build` | Build WASM + production build |
| `bun run preview` | Preview production build |
| `bun run wasm:build` | Build WASM module only |
| `bun run check` | Run svelte-check type checking |
| `bun run test` | Run unit tests |
| `bun run storybook` | Start Storybook dev server (port 6006) |
| `bun run build-storybook` | Build static Storybook site |
