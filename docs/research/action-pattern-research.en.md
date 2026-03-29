# Action Pattern Research — Toolbar Abstraction

## Background

Researched during the Toolbar button abstraction task. The current ToolbarItem discriminated union serves as a miniature version of the Action pattern. When multiple entry points (menu, shortcuts, command palette) become necessary, evolving toward the Action pattern should be considered.

## Core Concept

> **An Action is a first-class object.** It encapsulates execution logic, availability state, and visual representation (icon, label) into one unit.

In the current architecture, state (`canUndo`) and behavior (`onUndo`) are separate and scattered across the page. In the Action pattern, they are cohesive within a single object.

```typescript
interface Action {
  id: string;
  icon: IconComponent;
  label: string;
  execute: () => void;
  isEnabled: () => boolean;
  isActive?: () => boolean;
}
```

## Key Principles

### 1. Actions Know Their Own State

Rather than the Toolbar holding conditions like `if (hasSelection && canUndo)`, each Action determines its own availability.

### 2. Same Action, Multiple Entry Points

A single Action works identically across toolbar buttons, menu items, keyboard shortcuts, and command palettes. Define once, reuse everywhere.

### 3. Toolbar Only Renders Actions

The Toolbar receives an array of Actions and renders them in the current style (BevelButton, FlatButton, etc.). It has no knowledge of which tools exist or when they should be disabled.

## Framework Survey

| Framework | Abstraction | Key Mechanism |
|---|---|---|
| IntelliJ Platform | `AnAction` | `actionPerformed()` + `update()`. Presentation objects are created per UI location, allowing the same Action to appear differently in toolbar vs menu |
| Eclipse RCP | Command + Handler | Declarative commands separated from behavior (Handler). Toolbar composition declared in plugin.xml |
| WPF/MVVM | `ICommand` | `Execute()` + `CanExecute()`. Defined in ViewModel via RelayCommand/DelegateCommand |
| Qt | `QAction` | A single QAction object registered simultaneously in toolbar, menu, and shortcuts. State changes automatically reflected across all UI |
| Excalidraw | Action system | Keyboard, toolbar, menu, and command palette all use the same Actions. Declarative Action definitions |
| Fluent UI | `CommandBar` | Declarative composition via CommandBarItem. Per-group overflow behavior control |
| Adobe Spectrum | ActionGroup/ActionBar | Composition pattern for Action grouping |

## IntelliJ Model (Most Sophisticated Implementation)

```text
Action (behavior, id, name)
  ↓
Presentation (per UI location: icon, text, enabled, visible)
  ↓
Button UI component (renders the Presentation)
```

- Same Action can show icon-only in toolbar, icon+text in menu
- `ActionGroup` for logical grouping, supports nesting
- ActionManager creates ActionToolbar from action groups

## Common Patterns Across Frameworks

### Hierarchical Action Organization

Complex toolbars organize related Actions logically via `ActionGroup`:
- Groups contain Actions or other Groups
- Groups define layout and overflow behavior
- Toolbar renders a single root group

### Configuration Over Implementation

Most enterprise frameworks use declarative configuration (XML/JSON) for toolbar composition:
- Toolbar structure can be modified without code changes
- Plugin systems can contribute Actions to toolbars

### Presentation Abstraction

Separating Action metadata from visual representation:
- Same Action, different visual representation (toolbar vs menu)
- Button component has no knowledge of Action logic

## DOTORIXEL Applicability

### Current State (Milestone 1)

The ToolbarItem discriminated union is a miniature Action:
- `kind: 'button'` includes icon, label, onclick, disabled, active
- Toolbar (ToolbarLayout) renders items
- Simple enough and appropriate for current requirements

### When to Consider Adoption

When any of the following becomes necessary:
- **Menu bar**: Need to share the same Action across toolbar and menu
- **Keyboard shortcut system**: Current +page.svelte keydown handler could integrate with Actions
- **Command palette**: UI for searching/executing all Actions
- **Plugin/extension system**: Structure for external Action registration

### Migration Path

```text
Current: ToolbarItem[] → Toolbar
  ↓
Phase 1: Introduce Action interface, derive ToolbarItem from Action
Phase 2: Bind keyboard shortcuts to Actions
Phase 3: Reuse same Actions in menu/command palette
```

## References

- [IntelliJ Platform Action System](https://plugins.jetbrains.com/docs/intellij/action-system.html)
- [IntelliJ Toolbar Documentation](https://plugins.jetbrains.com/docs/intellij/toolbar.html)
- [Eclipse Platform Command Framework](https://wiki.eclipse.org/Platform_Command_Framework/)
- [Eclipse Platform UI Command Design](https://wiki.eclipse.org/Platform_UI_Command_Design)
- [WPF Commanding in MVVM](https://riptutorial.com/wpf/example/32653/commanding-in-mvvm)
- [Fluent UI CommandBar](https://learn.microsoft.com/en-us/power-platform/guidance/creator-kit/commandbar)
- [Adobe Spectrum ActionBar](https://spectrum.adobe.com/page/action-bar/)
- [Command Pattern Overview](https://refactoring.guru/design-patterns/command)
- [W3C WAI Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [Excalidraw Action System](https://deepwiki.com/zsviczian/excalidraw/4.2-api-reference-and-integration-examples)
