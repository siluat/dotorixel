---
title: Apple Frame Duration Draft lifecycle — own input transitions and commit targeting
status: done
created: 2026-09-08
---

## Problem Statement

Apple users expect a duration entered for one Frame to affect that Frame,
even when focus, the Active Frame, the active tab, or the Timeline panel changes
before input finishes. A transition must not apply unfinished text to another
Document, produce an extra History entry, or leave editor shortcuts blocked.

The current Frame Duration Draft module resolves strings and range limits,
while its caller owns draft text, focus transitions, commit targeting, panel
teardown, and synchronization with stored duration. Existing tests exercise
parsing and the eventual duration command separately, leaving the intervening
input lifecycle dependent on view callback ordering.

This is a depth and locality improvement, not a claim that every transition
is broken. In particular, cross-tab targeting requires verification: the
current view observes Frame identity and stored duration without explicitly
tracking the draft's originating tab.

## Solution

Deepen the Apple Frame Duration Draft module to own the complete input
lifecycle: draft text, originating tab and Frame, confirmation, cancellation,
target transitions, and reconciliation with stored values. It requests
duration changes through the existing Edit module, which retains ownership of
Document mutation, edit admission, and History.

The Timeline input adapter forwards events and displays the module's state.
It no longer decides which Frame a draft belongs to or assembles the sequence
of commit and reconciliation itself. Preserve established behavior and make
the agreed cross-tab rule explicit: switching tabs resolves the draft against
its original tab and Frame, ends that draft, and displays the destination's
stored duration.

## User Stories

1. As an Apple user, I want typing to change only my draft, so that unfinished text does not change the Document or History.
2. As an Apple user, I want Enter to confirm the duration without forcing focus away, so that I can continue editing in place.
3. As an Apple user, I want losing input focus to confirm my draft, so that moving to another control retains a valid entry.
4. As an Apple user, I want Escape to restore the stored duration and release focus, so that the subsequent focus-loss event cannot commit cancelled text.
5. As an Apple user, I want switching Frames to confirm the draft for the Frame I was editing, so that it cannot retime the newly active Frame.
6. As an Apple user, I want the duration field to show the newly active Frame's stored value, so that the displayed number identifies the current target.
7. As an Apple user, I want switching tabs to resolve input against its originating tab and Frame, so that one Document's draft never edits another Document.
8. As an Apple user, I want a tab switch to end the old draft and show the destination's stored duration, so that unfinished text does not travel between tabs.
9. As an Apple user, I want collapsing the Timeline to confirm my draft and release its focus state, so that reopening does not revive stale input or block shortcuts.
10. As an Apple user, I want invalid, empty, and fractional entries to revert on confirmation, so that the duration remains valid.
11. As an Apple user, I want integer entries outside the supported range to be clamped, so that extreme input produces a predictable valid duration.
12. As an Apple user, I want a confirmed retime to be one undoable Edit, so that one Undo restores the previous duration and Redo reapplies it.
13. As an Apple user, I want an unchanged or rejected confirmation to preserve History and the redo future, so that input events do not consume meaningful editing steps.
14. As an Apple user, I want repeated completion events to avoid additional effective edits, so that Enter followed by focus loss or panel teardown is safe.
15. As an Apple user, I want Undo/Redo changes to the stored duration reflected in the input, so that the field does not display stale text.
16. As an Apple user, I want a missing target or a command rejected during a stroke to retain the existing Edit behavior, so that duration input cannot bypass editing rules.
17. As an Apple user, I want the fps readout to follow the committed duration, so that unfinished text never changes the displayed timing estimate.
18. As an Apple user, I want existing input appearance, localized labels, and keyboard behavior preserved, so that the refactor does not change how I use the Timeline.
19. As a developer, I want one module to own draft transitions and confirmation targeting, so that adding an event does not duplicate ordering rules in callers.
20. As a developer, I want to test the same lifecycle interface used by the Timeline adapter with real editing behavior, so that regressions are caught before they reach users.

## Implementation Decisions

- **Keep the implementation in the Apple shell.** This is a Swift input
  lifecycle module. Reuse the existing Document and History implementation
  and bindings; do not move shell focus policy into the shared core.
- **Deepen the existing Frame Duration Draft concept.** Parsing and clamping
  belong inside the same module as draft ownership and transition policy.
  Do not merely extract another helper while leaving the ordering knowledge
  in the Timeline caller.
- **Own confirmation through reconciliation.** The module resolves the draft,
  requests the existing duration edit, and reconciles its displayed value
  with the actual stored result. Returning an intent that makes the view
  reconstruct this sequence does not satisfy the agreed depth.
- **Keep the Edit module authoritative.** Reuse its public editing interface
  and value-only reads. Do not expose mutable Document or History, open an
  Edit Baseline while the user types, duplicate stroke guards, or independently
  decide whether a command earned a History entry.
- **Bind input to both tab and Frame.** Retain enough originating-target
  identity and access to resolve the draft after the active target changes.
  Frame identity alone is insufficient for choosing a Document. A late event
  for the old input must not act on the destination's draft.
- **Preserve completion semantics.** Enter confirms in place; focus loss
  confirms; Escape restores the stored value and releases focus. A Frame
  switch resolves against the Frame being left and then displays the newly
  active Frame's duration. A tab switch resolves against the originating tab
  and Frame and ends the old draft.
- **Keep teardown idempotent.** Closing the Timeline's input surface confirms
  the draft, clears its focus state, and releases its shortcut focus claim.
  Correctness must not depend on whether a focus callback or disappearance
  callback arrives first. Reopening starts from stored state.
- **Preserve stored-value synchronization.** Same-Frame stored changes,
  including Undo/Redo, replace the displayed draft as they do today. Read the
  actual post-command value rather than assuming that a requested edit was
  accepted. Missing Frame IDs and stroke-time rejection retain existing
  behavior; do not retry against another target or recreate a removed Frame.
- **Retain range ownership.** Read the binding's exported duration bounds.
  Preserve existing integer parsing, invalid-input reversion, and range
  clamping, including negative and oversized input that cannot be passed as
  an unsigned duration. Keep fps derived from committed milliseconds.
- **Keep the Timeline adapter narrow.** Native focus bindings and rendering
  stay with the input adapter; draft policy stays behind the lifecycle seam.
  Continue using the existing workspace focus-owner mechanism so ending this
  input does not release another input's shortcut claim.
- **Avoid speculative indirection.** Prefer the existing in-process Edit
  interface and real test dependencies. No generic form framework or new
  adapter protocol is justified solely to make the module mockable.
- **Keep persistence unchanged.** Draft text is transient and is not added
  to Document Snapshot, workspace storage, or History. Preserve existing
  persistence notifications from accepted duration edits.

## Testing Decisions

- **Use one primary lifecycle seam.** The user confirmed that callers and
  tests should use the Frame Duration Draft module's same interface, including
  its confirmation request and stored-value reconciliation. Exercise it with
  a real tab and the existing Edit module and core History.
- **Assert observable outcomes.** Check displayed draft, per-Frame stored
  duration, unaffected targets, focus release behavior, and Undo/Redo results.
  Do not assert internal helper calls, callback counts, or the implementation's
  private state layout.
- **Follow existing test prior art.** The tab duration tests already verify
  per-Frame isolation, clamping, stroke rejection, and real Undo/Redo. The
  Edit lifecycle tests verify transitions through public requests. Reuse the
  existing pre-ownership Document fixtures rather than mutating live content
  behind its owner.
- **Cover the complete transition matrix.** Include Enter, focus loss,
  Escape followed by focus loss, Enter followed by teardown, both orders of
  focus loss and teardown, Frame switching during input, tab switching during
  input, and reopening the collapsed Timeline. Cross-tab cases must assert
  that only the originating Document changes and the destination displays its
  own duration; include repeated or delayed old-input completion events.
- **Cover invalidation and rejection.** Include a target Frame removed while
  input is pending, a duration command rejected during a stroke, and same-Frame
  stored changes from Undo/Redo. Verify that rejected input does not become a
  deferred edit against another Frame.
- **Preserve no-op regression defense.** Test unchanged values, invalid input,
  and clamping back to the stored value with an existing redo future, not only
  an empty History. A real confirmation must be undone exactly once.
- **Move parsing cases to the deeper test surface.** Preserve coverage for
  whitespace, fractional and non-numeric input, negatives, and oversized
  integers. Once equivalent lifecycle coverage exists, remove redundant tests
  tied solely to the superseded shallow interface. Keep independent tests of
  the existing Edit contract.
- **Retain adapter verification.** Module tests do not prove that SwiftUI
  emits or routes the required events. Verify actual focus and observation
  wiring, especially Frame/tab switches and panel teardown, with appropriate
  integration checks. Retain existing rendered Timeline and localization
  regressions; record any device-only checks as unverified when not exercised.
- **Validate both Apple targets.** Run the relevant Apple regression suites
  and required checks on the pinned simulator, and verify the macOS build.
  Broaden testing where changed event wiring or shared state creates regression
  risk. Do not update visual baselines to conceal unintended UI changes.

## Out of Scope

- Web-shell changes or a cross-platform input abstraction.
- Changes to duration range ownership, parsing syntax, fps behavior, or timing
  semantics beyond the explicitly agreed tab-targeting contract.
- New UI, styling, localization, or interaction affordances.
- Changes to the existing Edit, Playback, Floating Selection, or History
  policies, and unrelated dirty-marking or persistence fixes.
- A broader redesign of tab closing, save/discard flows, or application shutdown.
- Rendering projection deepening, export changes, and the other architecture
  review candidate.
- Persisting drafts, background draft recovery, or a generic form framework.

## Further Notes

- This PRD records the architecture review and subsequent user-approved
  decisions. The lifecycle testing seam was explicitly confirmed before
  publication; no additional design interview is required to start the work.
- [Issue 287](287-apple-frame-duration.md) records the original duration
  behavior and binding-owned range decision.
- [Issue 298](298-apple-edit-lifecycle.md) established the Edit module's
  ownership. This work builds on that completed refactor rather than reopening it.
- The [Frame Duration Draft glossary entry](../CONTEXT.md) records the
  originating-target meaning. The
  [deferred History commit ADR](../docs/decisions/deferred-history-commit.en.md)
  remains authoritative for no-op comparison and the redo future.
- At PRD publication, evidence consists of static source and test review.
  Cross-tab input behavior has not been reproduced through the UI, and no
  implementation or runtime test run has occurred for this PRD yet.

## Implementation Notes — 2026-09-08

Implemented on `refactor/apple-frame-duration-draft-lifecycle` as one bounded
task, following the user's explicit request to proceed directly from this PRD.

- Frame Duration Draft now owns raw input, its originating tab and Frame,
  confirmation, cancellation, completion, and stored-value reconciliation.
  Parsing is private implementation. All duration mutations still use the
  existing Edit interface and core History.
- A native Frame Duration Field adapter forwards focus, completion, stored
  observation, Escape, and disappearance events. Its identity follows the tab
  instance, so tab switching finishes the original draft and creates input
  from the destination's stored value.
- Each mounted duration field has a distinct workspace focus claim. Delayed
  release cannot clear a different tab's or reopened field's claim.
- A native Timeline test reproduced the previous cross-tab loss: entering
  250 ms and switching to a tab with the same Frame ID left the originating
  Frame at 100 ms. The corrected test passes with both equal and different
  destination durations.
- Lifecycle tests also reproduced two observation-order problems: a delayed
  confirmation echo replacing newer text, and focus loss after Undo restoring
  stale input before the queued observation. Reconciliation now ignores the
  former and respects the stored value in the latter, preserving the redo future.
- Previous parsing cases now run through the lifecycle with real Edit and
  History. Native input checks cover Frame/tab switching, completion followed
  by focus loss, Timeline collapse/reopen, and Undo/Redo display updates.

### Validation

- Focused duration, native input, and workspace-focus regression run:
  **22 tests in 5 suites passed**.
- Complete Apple run on iPad Pro 11-inch (M5), iOS 26.4:
  **821 tests in 143 suites passed**, including unchanged rendered snapshots.
  The run reported no test failures, crashes, or unexpected restarts.
- macOS arm64 build: **passed**.
- `bun run check`: **passed with 0 errors and 0 warnings**.
- Markdown lint and `git diff --check`: **passed**.
- Physical keyboard Return/Escape and device keyboard ergonomics remain a
  hands-on verification limit. Native tests feed UIKit control events; they
  do not synthesize physical key presses. The lifecycle's confirmation and
  cancellation contracts are covered automatically.

### Development Guide Review Follow-up

- Replaced the lifecycle test's string-valued completion events and catch-all
  branch with a `Completion: CaseIterable` enum and an exhaustive switch.
  The test runs every enum case, so misspelled or unhandled events can no
  longer silently exercise the finish path.
- The focused lifecycle suite passed: **8 tests**, including all four
  completion cases, on the pinned iOS simulator. Production code is unchanged.

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Views/FrameDurationDraft.swift` | Owns draft targeting, completion, cancellation, validation, and stored-value reconciliation through the existing Edit interface. |
| `apple/Dotorixel/Views/FrameDurationField.swift` | Connects native input events to a draft with a separate focus claim per mounted field. |
| `apple/Dotorixel/Views/TimelinePanel.swift` | Delegates duration input and gives each tab its own field lifetime. |
| `apple/Dotorixel/ContentView.swift`, `apple/Dotorixel/State/Workspace.swift` | Routes independent duration input focus claims without releasing another field's claim. |
| `apple/DotorixelTests/FrameDurationLifecycleTests.swift` | Verifies transition ordering, rejected edits, stale-event handling, and real History outcomes. |
| `apple/DotorixelTests/FrameDurationDraftTests.swift` | Verifies parsing and clamping through the lifecycle, including no-op redo preservation. |
| `apple/DotorixelTests/FrameDurationInputTests.swift` | Verifies actual SwiftUI Timeline input, Frame/tab switching, collapse/reopen, and focus wiring. |
| `apple/DotorixelTests/WorkspaceTests.swift`, `apple/DotorixelTests/README.md` | Updates focus regression fixtures and documents the testing seam and device-only limits. |
| `CONTEXT.md`, `tasks/`, `docs/platform-status.md` | Records the draft terminology, completed task, and cross-platform duration behavior. |

### Key Decisions

- Keep input policy in Swift and mutation admission and History in the
  existing Edit module; no Rust, binding, or persistence-schema changes.
- Preserve the originating tab and Frame until resolution, and end a mounted
  draft on teardown so delayed events cannot target its replacement.
- Use stored duration changes as authoritative when observation and focus
  events arrive in different orders; ignore already reconciled echoes.
- Test observable results through the lifecycle with real Edit and History,
  retaining native input and rendered-layout checks for adapter wiring.

### Notes

- Full Apple regression: 821 tests in 143 suites passed on the pinned iOS
  simulator; macOS arm64 build passed. The subsequent test-only enum cleanup
  passed the focused eight-test lifecycle suite with all four completion cases.
- Existing rendered snapshot references are unchanged. Repository checks and
  Markdown lint passed.
- Physical keyboard Return/Escape and device keyboard ergonomics remain a
  hands-on verification limit, as documented above.

### PR Review Follow-up

- Accepted cubic's documentation findings on PR #388: keep the Dual Shell
  comparison deferred rather than promoting its subtasks into Next Up, and
  restore the platform-status description of integer clamping and invalid
  input reverting to the stored duration.
- Declined CodeRabbit's blanket 80% docstring threshold: the lifecycle API
  already documents its contracts, consistent with the development guide.
