---
title: Reference images — long-press + drag color sampling
status: open
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

Long-pressing (~500ms) on a displayed reference window, regardless of the active tool, triggers color sampling; dragging live-previews the foreground color; releasing commits. Reuses the `sampler` module from #060 and introduces a generic `long-press` gesture utility.

- **`long-press` utility** — generic pointer-gesture detector under `src/lib/`: fires after a threshold (~500ms), tolerates minor pre-threshold movement within a small radius, cancels on early release. Not tied to reference-images — designed for reuse.
- **Reference window integration** — attach long-press to the image body. On fire, switch into "sampling" mode: pointer moves update foreground color live via `sampler`; pointer up commits; pointer leave/cancel commits last value.
- **Tool independence** — works with pencil, shape, fill, etc. active. The long-press does not activate drawing; the window's pointer-absorb policy keeps the canvas inert underneath.
- **No separate confirmation UI** — live preview + release is the entire interaction.

## Acceptance criteria

- Long-pressing (~500ms) on a reference window begins sampling regardless of active tool.
- Dragging during sampling updates the foreground color live; releasing commits.
- Short press (below threshold) does not sample.
- Small pointer jitter during pre-threshold does not cancel the long-press.
- Foreground color reflects the pixel under the pointer at release time.
- Unit tests: `long-press` detector (fires after threshold, early-release cancels, movement-within-radius tolerated); integration through `sampler` produces the same RGBA as the Eyedropper path for the same coordinates.
- Component test: long-press simulation on `ReferenceWindow` updates foreground via the color state surface.

## Blocked by

- [060 — Reference images — color sampling via Eyedropper tool](060-reference-images-eyedropper-sampling.md)

## Scenarios addressed

- Scenario 7 (long-press + drag samples live; release commits)
