# 019 — Remove Tauri from project

## Results

| File | Description |
|------|-------------|
| `src-tauri/` | Entire directory deleted |
| `Cargo.toml` | Removed `"src-tauri"` from workspace members |
| `package.json` | Removed `"tauri"` script and `@tauri-apps/cli` devDependency |
| `vite.config.ts` | Removed `watch.ignored` for src-tauri |
| `CLAUDE.md` | Removed Tauri references from 6 sections (Tech Stack, Core Bindings, Rust Migration, Architecture, Security, Testing) |
| `bun.lock` | Regenerated (1 package removed) |
| `Cargo.lock` | Regenerated |

### Key Decisions

- Historical/research documents (`docs/research/`, `tasks/done.md`, `tasks/todo.md` Deferred section) left unchanged — preserves context for future re-evaluation

### Notes

- Tauri was already an empty shell (0 custom commands, 0 frontend imports) — no runtime behavior changes
- Can be re-added via `tauri init` if needed
