# DOTORIXEL

A 2D pixel art editor. Positioned as a learning-first, cross-platform tool.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Prerequisites

- [bun](https://bun.sh/) v1.3+
- [Rust](https://www.rust-lang.org/tools/install) stable
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

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
