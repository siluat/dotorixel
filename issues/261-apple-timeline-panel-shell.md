---
title: Apple Timeline panel shell — layer sidebar at its final home
status: ready-for-agent
created: 2026-08-01
---

> *This issue was created from a placement-decision review with the user
> after 259 — it supersedes the interim RightPanel placement recorded in
> 258's Key Decisions.*

## Parent

[013 — Apple native catch-up — phased strategy to reach full web parity](013-apple-native-catchup.md)
(Phase 3 — Layer system)

## Why

The web's layer UI lives in the bottom-docked Timeline panel — built at
that final location back in M3 (issue 093), frames-less, and *extended*
with the frame axis in M4 without a rebuild. The Apple shell instead
placed its Layers section in the RightPanel (258–259) because the RFC's
hybrid design decision listed only the pre-Timeline four regions as the
layout reference. That reading is stale: the reference is the web's
*current* docked layout, cross-platform parity is a stated priority, and
the "migrate at Phase 6" note had no recovery guarantee. Migrate now,
before reorder (260) builds drag interactions in a temporary home.

## What to build

A bottom-docked Timeline panel shell (web `TimelinePanel` and the
`092 — TimelinePanel Design Spec` as reference, SwiftUI-native controls
per the hybrid principle), containing the layer sidebar migrated from the
RightPanel:

- **Panel shell** docked below the canvas viewport at the wide/x-wide
  tiers: expanded and collapsed states with a chevron toggle (web parity
  visuals; the frame area stays hidden/placeholder exactly as the web's
  M3 treatment did — the frame axis arrives with Phase 6).
- **Layer sidebar**: the existing rows (active selection, visibility eye)
  and 259's add/remove controls move in unchanged behavior-wise —
  `EditorState` commands are placement-independent and must not change.
- **RightPanel Layers section removed** — one home for layer UI.
- Collapse state is in-memory only (Phase 4 owns persistence, like recent
  colors and pixel-perfect).
- Touch targets ≥ 44 pt; any new labels in the String Catalog (en/ko/ja);
  docked snapshot baselines updated (RightPanel shrinks, new panel strip).

## Acceptance criteria

- The panel renders docked below the canvas at wide/x-wide, with expanded
  ⇄ collapsed toggling; the collapsed strip keeps the chevron reachable.
- Layer rows, active selection, visibility toggling, and add/remove all
  work in the new home with unchanged history semantics (the 258/259 test
  suites stay green without behavioral edits).
- The RightPanel no longer shows a Layers section.
- Existing viewport behavior (zoom/pan/fit, canvas centering) accounts
  for the reduced canvas viewport height.
- Snapshot tests cover the panel's expanded and collapsed states; stale
  RightPanel baselines re-recorded.
- macOS and iPadOS targets build clean.

## Blocked by

- [259 — Apple layer panel — add and remove layers](259-apple-layer-add-remove.md)
