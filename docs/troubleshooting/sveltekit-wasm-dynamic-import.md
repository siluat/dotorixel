# SvelteKit + WASM Dynamic Import Failure

## Symptom

After running `bun run dev`, the browser shows:

```text
Error: Failed to fetch dynamically imported module: http://localhost:5177/wasm/pkg/dotorixel_wasm.js
```

## Cause

Two issues were stacked together.

1. **`$`-prefixed alias registration**: The `$wasm` alias was configured in `vite.config.ts` under `resolve.alias`. In SvelteKit, `$`-prefixed aliases must be registered in `svelte.config.js` under `kit.alias`. Vite's `resolve.alias` does not feed into SvelteKit's module resolution pipeline.

2. **Vite dev server `fs.allow`**: The `wasm/pkg` directory was not included in Vite's serving allow list, resulting in a 403 Restricted response. SvelteKit's default allow list only covers `src/`, `src/lib/`, `src/routes/`, `.svelte-kit/`, and `node_modules/`.

## Solution

**`svelte.config.js`** — register `$wasm` in `kit.alias`:

```js
kit: {
    adapter: adapter({ fallback: '200.html' }),
    alias: {
        $wasm: 'wasm/pkg'
    }
}
```

**`vite.config.ts`** — add `wasm/pkg` to `server.fs.allow`:

```ts
export default defineConfig({
    plugins: [sveltekit()],
    server: {
        fs: {
            allow: ['wasm/pkg']
        }
    }
});
```

## Lessons Learned

- In a SvelteKit project, `$`-prefixed path aliases must use `kit.alias`. Vite's `resolve.alias` does not participate in SvelteKit's module resolution.
- To serve files from directories outside SvelteKit's defaults, explicitly add them to `server.fs.allow` in `vite.config.ts`.
