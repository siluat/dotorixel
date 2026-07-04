---
title: "Enforce rustfmt in pre-commit and fix existing violations (PRD)"
status: done
created: 2026-07-04
---

## Problem Statement

The lefthook pre-commit hook guards the web shell (`bun run check`) and
markdown files (markdownlint), but the Rust workspace — the shared core that
both shells depend on — has no formatting gate at all. `cargo fmt --check`
currently reports 3 violations that have already drifted onto `main`, and
nothing prevents new ones from landing with every Rust commit.

Unformatted code accumulates two costs: review attention leaks from behavior
to style, and later commits that touch drifted lines pick up incidental
formatting churn that obscures their real diff. Both costs grow silently
until someone runs `cargo fmt` and produces a noisy cleanup commit — the
situation this PRD resolves once, and then prevents.

## Solution

Bring the workspace to a clean formatting baseline and keep it there:

1. **Fix the baseline.** Run `cargo fmt` to resolve the 3 existing
   violations — two in the core layer module, one in the wasm binding
   crate's test module. All are mechanical line-wrapping differences with
   no behavior change.
2. **Gate future commits.** Add a rustfmt command to the lefthook
   pre-commit configuration: when any staged file matches `*.rs`, run
   `cargo fmt --check` across the whole workspace. A formatting violation
   blocks the commit and prints rustfmt's diff, so the fix (`cargo fmt`)
   is always one command away.

## User Stories

1. As a contributor, I want commits containing mis-formatted Rust code to
   be blocked at pre-commit, so that formatting drift never lands on `main`.
2. As a code reviewer, I want PR diffs free of incidental formatting churn,
   so that my attention stays on behavior changes.
3. As a contributor, I want the formatting contract to be rustfmt's default
   style with no custom configuration, so that any editor's format-on-save
   agrees with the hook out of the box.
4. As an AFK agent, I want formatting enforced automatically at commit
   time, so that I cannot forget a separate formatting step.
5. As a contributor making a web-only or docs-only commit, I want the
   rustfmt check to trigger only when Rust files are staged, so that
   unrelated commits stay fast.
6. As a contributor, I want the check to cover every workspace crate (core,
   wasm bindings, Apple bindings), so that no crate silently drifts out of
   style.
7. As a contributor, I want the 3 pre-existing violations fixed in the same
   task that adds the gate, so that my next Rust commit doesn't fail on
   drift I didn't cause.
8. As a contributor blocked by the hook, I want the failure output to show
   rustfmt's diff of the offending lines, so that I can see exactly what to
   fix.
9. As a contributor blocked by the hook, I want `cargo fmt` to fix
   everything the check complains about, so that recovery is a single
   command.
10. As a maintainer, I want formatting enforced by tooling rather than
    review comments, so that the convention doesn't depend on human
    vigilance.

## Implementation Decisions

- The lefthook pre-commit gains a third command alongside the existing
  `check` and `markdownlint` commands, following their structure.
- The command is **staged-file-gated but workspace-wide**: a `*.rs` glob
  decides *whether* it runs, and `cargo fmt --check` from the repo root
  decides *what* it checks (all workspace members). Rationale: cargo
  resolves each crate's edition automatically — invoking bare `rustfmt` on
  `{staged_files}` would require keeping an `--edition` flag manually in
  sync with the manifests — and a workspace-wide check guarantees the whole
  tree stays clean, not just the touched files. The workspace is small, so
  the cost of the wider check is negligible.
- rustfmt's **default style is the contract**; no `rustfmt.toml` is
  introduced.
- The 3 existing violations are fixed by running `cargo fmt` — no manual
  edits, no behavior change.

## Testing Decisions

- **No new automated tests.** The change is hook configuration plus a
  formatting-only diff; there is no runtime behavior to regression-test. A
  good test observes external behavior, and the only external behavior here
  lives at the pre-commit boundary.
- **Behavioral verification at the pre-commit seam** (one-off, manual):
  1. After the baseline fix, `cargo fmt --check` exits 0 workspace-wide.
  2. Staging a deliberately mis-formatted `.rs` file blocks the commit and
     prints the rustfmt diff (undone afterwards).
  3. A commit staging no Rust files does not trigger the rustfmt command.
- **Behavior-neutrality of the baseline fix** is proven by the existing
  suite: the workspace's inline unit tests (`cargo test`) pass unchanged.
  Two of the three violations sit inside test functions themselves, so the
  suite exercises the reformatted lines directly.

## Out of Scope

- CI-side formatting enforcement — no Rust CI workflow exists today;
  pre-commit remains the only gate after this task.
- clippy or any other lint gate — this task is formatting only.
- Custom rustfmt configuration or style debates — the default style is the
  contract.
- Formatting gates for non-Rust code beyond what already exists.

## Further Notes

- This is a single-commit-sized chore: the PRD is intentionally
  implementable as one vertical slice. If it is broken down at all, one
  sub-issue suffices; implementing directly from this PRD is equally valid.

## Results

| File | Description |
|------|-------------|
| `lefthook.yml` | Added `rustfmt` pre-commit command — `glob: "*.rs"` trigger, workspace-wide `cargo fmt --check` |
| `crates/core/src/layer.rs` | Fixed 2 formatting violations (method-chain wraps), generated by `cargo fmt` |
| `wasm/src/lib.rs` | Fixed 1 formatting violation (argument-list wrap), generated by `cargo fmt` |

### Key Decisions

- Staged-file-gated, workspace-wide check: the `*.rs` glob decides *whether*
  the command runs; `cargo fmt --check` from the repo root then checks all
  workspace members. Chosen over `rustfmt --check {staged_files}`, which would
  require keeping an `--edition` flag manually in sync with the manifests.
- rustfmt's default style is the contract — no `rustfmt.toml` introduced.

### Notes

- Verified at the pre-commit seam: a deliberately mis-formatted staged `.rs`
  file blocks with rustfmt's diff (exit 1); markdown-only staging skips the
  command (`no matching staged files`); `cargo fmt --check` exits 0 after the
  baseline fix; `cargo test` passes unchanged (473 core + 38 wasm, 0 failed).
- lefthook 2.x quirk: running a single command manually uses the singular
  `--command` flag (`bunx lefthook run pre-commit --command rustfmt`).
