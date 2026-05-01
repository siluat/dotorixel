# DOTORIXEL

DOTORIXEL is a pixel art editor with a Svelte web shell, an Apple SwiftUI shell, and a shared Rust core. This document captures the project's domain vocabulary so design decisions and architecture reviews can refer to concepts by their canonical names.

## Language

### Sampling

**Sampling Session**:
A pointer-driven color-pick lifecycle — the user opens a session at a target pixel, a loupe shows the surrounding grid, and on release the centered pixel commits to a draw color slot.
_Avoid_: color picker session, eyedropper session (eyedropper is a tool, not a session).

**Sampling Port**:
The narrow `width / height / get_pixel(x, y)` surface a sampling session reads from. The pixel canvas satisfies it directly; reference images satisfy it through a decoded RGBA buffer.
_Avoid_: pixel source, image data.

**Loupe**:
The on-screen overlay shown during a sampling session — a magnified grid centered on the sampled pixel, positioned to avoid the user's pointer.
_Avoid_: zoom preview, magnifier.

**Canvas Sampling Session**:
A sampling session against the active pixel canvas. The port is always available, so `start` is synchronous; there is no press-time foreground preview — only commit-on-release.

**Reference Sampling Session**:
A sampling session against an imported reference image. The port becomes available only after the blob is decoded, so `start` is asynchronous; emits a press-time foreground preview and tracks the foreground in real time during the drag, with the recent-color entry deferred until release.
_Avoid_: reference picker, deferred sampling session.

## Relationships

- A **Sampling Session** drives a **Loupe** and reads through a **Sampling Port**.
- A **Canvas Sampling Session** holds a synchronous reference to the active canvas as its **Sampling Port**.
- A **Reference Sampling Session** binds its **Sampling Port** asynchronously through a blob decode and discards the bound port on release.

## Example dialogue

> **Dev:** "If the user long-presses a reference window while a canvas sampling session is already active, do we cross-commit?"
> **Domain expert:** "No — the two are partitioned by where the press lands. Long-pressing the canvas opens a **Canvas Sampling Session**; long-pressing a reference window opens a **Reference Sampling Session**. They share the **Loupe** and the **Sampling Port** contract, but their lifecycles are independent."
