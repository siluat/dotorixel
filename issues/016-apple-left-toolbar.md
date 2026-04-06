---
title: "Apple native: LeftToolbar"
status: done
created: 2026-04-06
parent: 014-apple-native-docked-layout.md
---

## What to build

Implement the LeftToolbar panel with tool selection and undo/redo controls, replacing the placeholder from the layout skeleton.

Contents (top to bottom):
- Pencil button (active by default)
- Eraser button
- Separator
- Undo button (disabled when history is empty)
- Redo button (disabled when redo stack is empty)

Requires a new `ToolButtonStyle(isActive:)` ButtonStyle — 44x44pt frame, active state uses accent color (see parent PRD "Button styles" section).

All state is already in EditorState (`activeTool`, `canUndo`, `canRedo`). No state model changes needed.

## Acceptance criteria

- [ ] ToolButtonStyle implemented with active/inactive/disabled visual states
- [ ] LeftToolbar displays pencil, eraser, separator, undo, redo
- [ ] Tapping pencil/eraser switches the active tool and updates button states
- [ ] Undo/redo buttons reflect EditorState history availability
- [ ] Tapping undo/redo performs the expected canvas operation
- [ ] Buttons meet 44pt minimum touch target

## Blocked by

- [015 — Design tokens + layout skeleton](015-apple-layout-skeleton.md)

## Scenarios addressed

- Scenario 3: User selects pencil or eraser → tool button shows active state
- Scenario 4: User taps undo/redo → canvas reverts/reapplies, buttons disable when empty

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Views/LeftToolbar.swift` | Pencil, eraser, separator, undo, redo buttons with correct layout and spacing |
| `apple/Dotorixel/Style/ToolButtonStyle.swift` | Updated: active state uses accentSubtle bg + accent text; 36pt visual / 44pt touch target; disabled opacity; tint parameter for action buttons |
| `apple/Dotorixel/Style/DesignTokens.swift` | Added accentSubtle, radiusSm, disabledOpacity tokens |
| `apple/DotorixelTests/DesignTokensTests.swift` | Added tests for accentSubtle, radiusSm, disabledOpacity |

### Key Decisions

- **Visual size vs touch target separation**: Buttons render at 36×36pt (matching web) inside a 44×44pt touch target (Apple HIG). `contentShape(Rectangle())` ensures the full 44pt area is tappable.
- **ToolButtonStyle tint parameter**: Instead of a separate ActionButtonStyle, added a `tint` parameter to ToolButtonStyle. Tool buttons use `textSecondary` (default), undo/redo use `textTertiary`.
- **Active state matches web, not PRD**: PRD specified opaque accent background with white text, but web uses semi-transparent `accentSubtle` (#B07A3018) with accent text. Followed web as source of truth per PRD directive.
