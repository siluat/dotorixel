---
title: Reference images — color sampling via Eyedropper tool
status: open
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

When the Eyedropper tool is active, tapping a reference window samples the pixel under the pointer into the foreground color — no long-press required. Introduces the shared `sampler` module used by both trigger paths.

- **`sampler` module** — pure function mapping `(Blob, x, y)` → RGBA, using `OffscreenCanvas` / `ImageBitmap`. No DOM dependencies beyond those APIs. Reusable for the Milestone 3 Reference Layer.
- **Eyedropper integration** — reference windows become valid sampling surfaces for the Eyedropper tool. Sampling writes to the foreground color via the existing color-state interface.
- **Coordinate mapping** — window pointer coords → image-natural coords via current display width/height.

## Acceptance criteria

- With Eyedropper active, tapping a reference window sets the foreground color to that pixel.
- Transparent pixels sample as transparent (alpha preserved).
- Sampling works at window corners (0,0 and w-1,h-1) without off-by-one.
- Sampling works on resized and minimized-then-restored windows.
- Unit tests: `sampler` correctness across square / landscape / portrait images, boundary coords, transparent pixels.
- Component test: Eyedropper tap updates foreground color via the established color state surface.

## Blocked by

- [056 — Reference images — display on canvas + close](056-reference-images-display-close.md)

## Scenarios addressed

- Scenario 8 (Eyedropper tap on reference window sets foreground)
