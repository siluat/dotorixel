# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the domain glossary, when present.
- **`docs/decisions/`** — read ADRs (architecture decision records) that touch the area you're about to work in. This repo uses `docs/decisions/` instead of the conventional `docs/adr/`.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

This is a single-context repo.

```text
/
├── CONTEXT.md              ← created lazily by /grill-with-docs when needed
├── docs/decisions/         ← ADRs (e.g. uniffi-mutex-interior-mutability.ko.md)
└── src/, crates/, apple/
```

The codebase has multiple shells (web / Apple) and a Rust core, but the domain (pixel art editing) is unified. Re-evaluate switching to multi-context only if shell-specific domain divergence becomes real.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts `docs/decisions/uniffi-mutex-interior-mutability.ko.md` — but worth reopening because…_
