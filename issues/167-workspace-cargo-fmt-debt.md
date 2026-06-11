---
title: "Retire the workspace cargo fmt debt"
status: done
created: 2026-06-11
---

## Problem Statement

Sub-issue 110 noted that workspace-level `cargo fmt --check` fails on pre-existing whitespace in the wasm shell (`wasm/src/lib.rs`). The review-backlog item called for a focused formatting pass. Issue 166 later observed the wasm debt appeared already resolved by intervening work, leaving a confirm-and-retire step — but also noted a pre-existing fmt diff in `apple/src/lib.rs`, outside the original item's scope.

## Solution

Confirm the wasm debt is gone, and instead of retiring a half-true item, finish the underlying goal: make workspace-level `cargo fmt --check` pass.

- `wasm/src/lib.rs`: confirmed clean — no fmt diff remained (resolved by intervening work, as issue 166 predicted).
- `apple/src/lib.rs`: 4 fmt diffs (import grouping, long method signatures/chains in the history wrappers); fixed with `cargo fmt`.

## Results

| File | Description |
|------|-------------|
| `apple/src/lib.rs` | `cargo fmt` applied — import grouping and line-wrapping only (+32/−17), no semantic change. |

### Key Decisions

- Widened the item's scope from "wasm fmt debt" to "workspace fmt debt": the wasm half was already resolved, but the same class of debt had moved to `apple/src/lib.rs`. Retiring the item while `cargo fmt --check` still failed at workspace level would have kept the underlying problem alive under a stale label.

### Notes

- Verified: workspace `cargo fmt --check` clean; `cargo check -p dotorixel-apple` passes.
- Pre-commit/CI does not currently enforce `cargo fmt --check` at workspace level — this debt accumulated silently twice (wasm, then apple). If it recurs, consider adding a workspace fmt check to the hook or CI.
