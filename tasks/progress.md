# Progress

## Currently Working On

None

## Last Completed

Safe area and virtual keyboard handling (notch, home indicator, keyboard push)

## Next Up

- Layer system: basic infrastructure (add/delete/reorder)
  - Core M3 foundation. Layer properties, copy/paste, and flip/transform depend on this.
- Right-click draws with background color (mouse input)
  - Independent. Touches Rust core `ToolType::apply` — can be done in parallel with layer work.
- Touch modifier alternatives (Shift-constrain, Alt-eyedropper UI for touchscreen)
  - Independent UI feature. No dependency on other M3 tasks.
