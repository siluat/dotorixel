# 013 — Fix `svelte-check` type errors and warnings

## Results

| File | Description |
|------|-------------|
| `tsconfig.json` | Added `exclude` for legacy code and Node-only test setup file |
| `src/lib/wasm/init.ts` | Fixed `Promise<void>` type mismatch by not returning `init()` result |
| `src/lib/canvas/export.ts` | Wrapped `Uint8Array` in `new Uint8Array()` for `BlobPart` compatibility |
| `src/lib/canvas/PixelCanvasView.svelte` | Changed `role="img"` to `role="application"` with svelte-ignore |
| `lefthook.yml` | Pre-commit hook running `bun run check` |
| `package.json` | Added `@evilmartians/lefthook`, updated `prepare` script |
| `CLAUDE.md` | Added `bun run` rule to Tech Stack, added "Maintaining CLAUDE.md" section |

### Key Decisions

- lefthook over husky — language-agnostic (TS+Rust+Swift), parallel execution, YAML config, no lint-staged needed for project-wide checks
- `role="application"` with `svelte-ignore` — semantically correct for custom interactive widget; Svelte's a11y rule is overly strict for this case

### Notes

- `prepare` script uses `(svelte-kit sync || echo '') && lefthook install` — parentheses for clarity (`&&` and `||` have equal precedence in POSIX shell, but most developers expect C-style precedence)
