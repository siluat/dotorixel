# 054 — Fix scrollbar appearing on UI text selection

## Plan

**Single-file change**: `src/routes/editor/+page.svelte` `<style>` block

Add `user-select: none` to `.editor-docked` and `.editor-tabs` containers.

- Disables text selection across the entire editor UI, eliminating the root cause
- `<input>` elements (RightPanel canvas size, SettingsContent, TopControlsRight) retain text input/selection via browser defaults despite inheriting `user-select: none`

### Verification

1. Desktop layout (≥1024px): drag-select text in TopBar, StatusBar, LeftToolbar, RightPanel → not selectable, no scrollbar
2. Mobile layout (<1024px): drag-select text in AppBar, TabBar, ToolStrip, ColorBar → same
3. RightPanel canvas size input fields: number input/selection works normally
4. SettingsContent input fields: work normally

## Results

| File | Description |
|------|-------------|
| `src/routes/editor/+page.svelte` | Added `user-select: none` to `.editor-docked` and `.editor-tabs` containers |

