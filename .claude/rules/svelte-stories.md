---
globs: **/*.stories.svelte
---

# Svelte Stories Conventions

Rules for writing Svelte component stories in this project.

- **Co-locate with the component.** Story files live next to their component: `Component.stories.svelte` beside `Component.svelte`. This follows the "group code by what changes together" architecture principle.
- **Svelte CSF v5 format.** Use `defineMeta` in `<script module>` and the destructured `Story` component. No CSF3 (JS object) format.
- **Let autotitle handle hierarchy.** Omit the `title` property — Storybook generates sidebar hierarchy from the file path automatically. Only set `title` when the desired hierarchy differs from the physical location.
- **Reuse pure data factory functions for story data.** Prefer `createCanvas()`, `createCanvasWithColor()` etc. over manually constructing test data. Only use deterministic, side-effect-free functions — mock anything that involves I/O, global state, or randomness.
