# 057 — Canvas Resize UX Improvements

## Plan

### Context

The canvas resize feature needs two UX improvements:
1. **Anchor direction selector** — Currently resize always anchors to top-left. A 3×3 grid lets users choose the anchor position.
2. **Validation alert** — Currently out-of-range input is silently clamped. An inline alert informs users of the valid range.

Design completed in task 056 (`docs/pencil-dotorixel.pen`).

### Implementation Steps

#### Step 1: Rust Core — ResizeAnchor Enum + Resize Logic

**Files:** `crates/core/src/canvas.rs`, `crates/core/src/lib.rs`

- Add `ResizeAnchor` enum (9 variants: TopLeft–BottomRight, Default = TopLeft)
- `content_offset()` method: compute source→destination pixel offset based on anchor
  - Integer arithmetic (factor 0/1/2, /2): truncation on odd deltas (standard pixel editor behavior)
- Add `resize_with_anchor()` method; existing `resize()` delegates to TopLeft
  - Maintain row-level bulk copy optimization
- Re-export `ResizeAnchor` from `lib.rs`
- Tests: TopLeft backward compat, Center/BottomRight expand, Center shrink, asymmetric resize, default validation

#### Step 2: WASM Bindings

**File:** `wasm/src/lib.rs`

- `WasmResizeAnchor` enum (following existing `WasmToolType` pattern)
- `to_core()` conversion method
- Add `WasmPixelCanvas::resize_with_anchor()` method

#### Step 3: TypeScript Types + EditorState

**Files:** `src/lib/canvas/view-types.ts`, `src/lib/canvas/editor-state.svelte.ts`

- Add `ResizeAnchor` type (kebab-case string union, following `ToolType` pattern)
- Add `resizeAnchor` state field to `EditorState` (default: `'top-left'`)
- Update `handleResize` to read `this.resizeAnchor` and call `resize_with_anchor()`
- TS→WASM mapping function (`toWasmResizeAnchor`)

#### Step 4: i18n Messages

**Files:** `messages/en.json`, `messages/ko.json`, `messages/ja.json`

- `label_anchor`, `validation_dimensionRange` (with `{min}` and `{max}` params)
- 9 anchor position accessibility labels (`anchor_topLeft` – `anchor_bottomRight`)

#### Step 5: ValidationAlert Component

**New files:** `src/lib/ui-editor/ValidationAlert.svelte`, `ValidationAlert.stories.svelte`

- Props: `message: string`
- `role="alert"`, lucide `AlertTriangle` icon
- Error color: `#B0503A` (warm terracotta — Pebble UI palette harmony)
- Left 3px accent bar, background at 8% opacity
- Responsive: mobile (padding 10px 12px, font 12px) / desktop (padding 6px 8px, font 10px)

#### Step 6: AnchorSelector Component

**New files:** `src/lib/ui-editor/AnchorSelector.svelte`, `AnchorSelector.stories.svelte`

- Props: `selected: ResizeAnchor`, `onSelect: (anchor: ResizeAnchor) => void`
- 3×3 CSS Grid buttons with directional arrow SVGs (center uses dot)
- Cell size: mobile 36px / desktop 24px, gap 4px/2px
- States: default (`--ds-bg-hover` + `--ds-text-tertiary`), selected (`--ds-accent` + white)
- `aria-label` (i18n) and `aria-pressed` on each button

#### Step 7: Existing UI Integration

**`SettingsContent.svelte`** (compact/medium breakpoint):
- Add `resizeAnchor`, `onAnchorChange` props
- Commit-time validation (blur/Enter) — avoid alert during mid-typing states
- Block commit on invalid values + show ValidationAlert
- Place ValidationAlert (conditional) + AnchorSelector after size-row
- Error border `#B0503A` on invalid inputs
- Update `SettingsContent.stories.svelte`

**`RightPanel.svelte`** (wide/x-wide breakpoint):
- Same changes (props, commit-time validation, component integration)

**`+page.svelte`** (editor page):
- Pass `editor.resizeAnchor` to SettingsContent and RightPanel

> Note: `ui-editor/TopControlsRight.svelte` is not used in the editor route (stories only). Not modified in this task.

#### Step 8: Tests

- Rust: `resize_with_anchor` tests (included in Step 1)
- WASM integration: add `resize_with_anchor` call tests to `wasm-canvas.test.ts`

## Results

| File | Description |
|------|-------------|
| `crates/core/src/canvas.rs` | `ResizeAnchor` enum (9 variants) + `resize_with_anchor()` with row-level bulk copy; MAX_DIMENSION 128→256; 9 new tests |
| `crates/core/src/lib.rs` | Re-export `ResizeAnchor` |
| `wasm/src/lib.rs` | `WasmResizeAnchor` enum + `resize_with_anchor()` WASM binding |
| `src/lib/canvas/view-types.ts` | `ResizeAnchor` string union type |
| `src/lib/canvas/editor-state.svelte.ts` | `resizeAnchor` state field + `RESIZE_ANCHOR_MAP` + `handleResize` uses anchor |
| `src/lib/ui-editor/ValidationAlert.svelte` | Inline error alert component (background + icon + text) |
| `src/lib/ui-editor/ValidationAlert.stories.svelte` | Default + LongMessage stories |
| `src/lib/ui-editor/AnchorSelector.svelte` | 3×3 grid radiogroup with directional arrow SVGs |
| `src/lib/ui-editor/AnchorSelector.stories.svelte` | TopLeft / Center / BottomRight stories |
| `src/lib/ui-editor/SettingsContent.svelte` | Integrated ValidationAlert + AnchorSelector; commit-time validation |
| `src/lib/ui-editor/SettingsContent.stories.svelte` | Updated with new props |
| `src/lib/ui-editor/RightPanel.svelte` | Same integration as SettingsContent |
| `src/lib/ui-editor/RightPanel.stories.svelte` | Updated with new props |
| `src/routes/editor/+page.svelte` | Wire `resizeAnchor` + `onAnchorChange` to both panels |
| `messages/en.json`, `ko.json`, `ja.json` | Anchor labels, validation message, 9 position a11y labels |
| `src/lib/wasm/wasm-canvas.test.ts` | 2 new WASM integration tests for `resize_with_anchor` |
| `docs/pencil-dotorixel.pen` | Updated validation alert design to match implementation |

### Key Decisions

- Validation alert: removed left accent bar from design spec — simpler look preferred over original Variant B
- MAX_DIMENSION raised from 128 to 256 during implementation
- Error color `#B0503A` managed via `--_error-color` component-scoped CSS custom property (not promoted to global token)
- `isValidDimension` delegates to `WasmPixelCanvas.is_valid_dimension()` — single source of truth in Rust core
- `ui-editor/TopControlsRight.svelte` not modified — not used in editor route (stories only)

### Notes

- AnchorSelector uses `role="radiogroup"` / `role="radio"` with `aria-checked` but does not implement arrow key navigation between cells (Tab works)
- Validation alert shows only on commit (blur/Enter), not during typing, to avoid noise from intermediate input states

