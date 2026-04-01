# 053 — Fix keyboard shortcuts not working after clicking action buttons

## Plan

Remove `button` from the `isInteractiveTarget` selector so that only text-input elements (input, select, textarea, contenteditable) block keyboard shortcuts. This matches established conventions in graphics editors where toolbar buttons never interfere with global shortcuts.

### Files to modify

**`src/lib/canvas/editor-state.svelte.ts`** (line 38)

Before:
```typescript
return target.closest('button, input, select, textarea, [contenteditable="true"]') !== null;
```

After:
```typescript
return target.closest('input, select, textarea, [contenteditable="true"]') !== null;
```

### Tests

**`src/lib/canvas/editor-state.svelte.test.ts`**

Add `target` option to `keyDown` helper. Add test cases:

- Tool shortcuts work when a button element is focused
- Ctrl+Z/Y work when a button element is focused
- Shortcuts are still blocked when an input element is focused

### Verification

1. `bun run test` — all tests pass
2. `bun run check` — type check passes
3. Manual: click toolbar button, then press shortcut keys (P, E, Ctrl+Z)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-state.svelte.ts` | Renamed `isInteractiveTarget` → `isTextInputTarget`, removed `button` from CSS selector |
| `src/lib/canvas/editor-state.svelte.test.ts` | Added `// @vitest-environment happy-dom`, added `target` option to `keyDown` helper, added 4 focus-related tests |
| `package.json` | Added `happy-dom` dev dependency |

### Key Decisions

- Renamed function to `isTextInputTarget` to match narrowed semantics — buttons are not text input elements.
- Adopted `happy-dom` over jsdom for DOM test environment — faster, lighter, sufficient for this project's needs. Applied via per-file `// @vitest-environment happy-dom` directive to avoid impacting other test files.

### Notes

- The `// @vitest-environment happy-dom` directive applies to the entire file. Existing tests are unaffected because they use `target: null`, which bypasses the `instanceof HTMLElement` check.

