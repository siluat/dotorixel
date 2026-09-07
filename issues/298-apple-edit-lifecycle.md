---
title: Apple Edit lifecycle — centralize state ownership and transition policy
status: done
created: 2026-09-07
---

## Problem Statement

Apple users rely on drawing, Floating Selection, Frame navigation, Playback,
and Undo/Redo working together without losing pixels or corrupting History.
Adding another editing command should not introduce a different interpretation
of when an in-flight operation must finish, when Playback stops, or which
changes must be saved.

Today, callers in TabState separately assemble stroke guards, Playback stops,
Floating Selection recovery and commit, Edit Baseline resolution, and display
updates. The existing performEdit module hides some of this ordering but still
requires callers to guard live strokes and apply follow-up updates. Stroke,
Paste, navigation, Playback start, and Undo/Redo have additional paths with
intentional differences. Those differences are easy to miss when extending the
editor.

Document and History are also directly accessible outside their owner. Views
mostly need reads, while many tests mutate the live Document to arrange state.
Moving the orchestration into another module without closing that access would
leave the new owner bypassable. Moving only helper functions would leave the
same state coordination in callers through a larger callback interface.

This is an architectural refactor motivated by repeated ordering knowledge,
not a claim that all these paths are currently broken or that TabState should
be split because of its file size.

## Solution

Create a deep Swift Edit lifecycle module that owns the live Document,
Document History, and in-flight editing state, and coordinates the transitions
between Stroke, editing commands, Frame/Layer navigation, Playback, and Undo/Redo.
Preserve current user-visible behavior, including operation-specific ordering
and failure behavior.

Keep the existing tool, Floating Selection, and Playback implementations behind
that coordination. The Rust History ring remains the only authority deciding
whether an Edit changed the Document. The Edit module determines necessary
follow-up effects; TabState performs display updates, viewport corrections, and
persistence notifications without re-deciding each command's policy.

Consumers read the values they need and request edits through the module's
interface. They cannot obtain the live mutable Document or History and bypass
its transition rules. Test the transition contract at that same interface and
retain TabState integration tests for the display and persistence connections.

## User Stories

1. As an Apple user, I want drawing to retain its current begin, sample, end, and cancel behavior, so that this refactor does not change how a stroke feels or lands.
2. As a user drawing a stroke, I want commands that currently reject mid-stroke changes to keep rejecting them, so that the stroke's target and Edit Baseline remain valid.
3. As a user with a Floating Selection, I want each editing command to resolve it under the existing rules, so that its pixels stay attached to the correct Layer and Frame.
4. As a user cutting a Marquee, I want any pending Floating Selection handled before the cut under the existing ordering, so that the Selection Clipboard contains the intended pixels.
5. As a user pasting during Playback, I want Playback to stop and the pasted Floating Selection to become visible under the current behavior, so that I can position it on the Active Frame.
6. As a user nudging a Marquee during Playback, I want the existing Playback stop behavior retained, so that the editing preview is visible.
7. As a user switching the Active Frame, I want a Floating Selection committed to its source Cel before the switch, so that pixels do not move to an unintended Frame.
8. As a user switching the active Layer, I want the existing edit guards and Floating Selection resolution retained, so that the next edit targets the correct Layer.
9. As a user navigating Frames during Playback, I want Active Frame changes to preserve the current Playback behavior, so that navigation does not unexpectedly become a pause action.
10. As a user starting Playback, I want a live stroke or failed Floating Selection resolution to retain its existing veto, so that Playback never starts over an unresolved editing state.
11. As a user whose editing command cannot resolve a Floating Selection, I want the current stop-before-resolution behavior preserved, so that this refactor does not silently resume Playback after a rejected command.
12. As a user pressing Undo with a Floating Selection, I want Undo to cancel that transient operation before consuming committed History, so that my preceding edit remains available.
13. As a user pressing Undo while Floating Selection recovery is pending, I want the existing recovery attempt retained without consuming the previous History entry, so that recovery does not discard earlier work.
14. As a user pressing Redo while a Floating Selection or its recovery is pending, I want the existing rejection retained, so that replacing the Document cannot orphan that state.
15. As a user making a no-op Edit, I want History and the redo future preserved, so that an ineffective operation does not consume Undo or destroy future work.
16. As a user editing Layers, Frames, or canvas dimensions, I want the current undoable steps preserved, so that structural editing remains predictable.
17. As a user watching a stroke preview, I want the display to update before the Edit commits, so that drawing remains responsive without persisting a preview as a completed Edit.
18. As a user navigating the Active Frame, I want its persisted pointer updated without adding a History entry, so that reopening and Undo retain their distinct meanings.
19. As a user playing an animation, I want display updates without Document mutation, dirty marking, or Playback-only History entries, so that previewing does not count as editing.
20. As a user undoing a resize or Reference Layer change, I want existing viewport correction and stale-preview cleanup preserved, so that the restored Document remains reachable and correctly displayed.
21. As a user saving or exporting with a Floating Selection, I want existing Document Snapshot preservation behavior retained, so that transient pixels do not change saved or exported content.
22. As a user switching or closing tabs, I want the current per-tab Playback teardown and independent editing state retained, so that one tab does not affect another tab's lifecycle.
23. As a developer adding an editing command, I want one module to own transition policy and follow-up decisions, so that I do not repeat guard and cleanup sequences in each caller.
24. As a developer writing a view, I want access to the required read results without access to mutable Document or History objects, so that rendering cannot bypass editing rules.
25. As a developer writing regression tests, I want to exercise the same editing interface as callers, so that tests catch missing orchestration rather than only proving isolated helpers work.
26. As a developer testing recovery failures, I want a narrow internal test seam, so that rare failure paths remain testable without exposing mutable state in the production interface.

## Implementation Decisions

- **Place the lifecycle module in the Apple shell.** Use Swift to own the
  shell's editing coordination. Reuse the existing Rust Document and History
  semantics and existing bindings. This is not a shared-core migration or a
  web-shell refactor.
- **Cover all agreed transitions.** Include Stroke, editing commands,
  Frame/Layer navigation, Playback, and Undo/Redo. Do not stop at extracting
  performEdit while leaving the same preparation sequences in Paste, Cut,
  Playback start, or navigation. Existing Reference Layer edit commands must
  follow the same ownership rule while retaining their current gesture policy.
- **Move state ownership with policy.** The Edit module owns the live Document,
  Document History, and in-flight editing state, including Stroke and Floating
  Selection. It owns Document replacement during Undo/Redo and coordinates
  the existing lifecycle implementations. Do not replace direct field access
  with callbacks that make TabState continue managing the same state machine.
- **Reuse deep implementations.** Keep the tool algorithms, StrokeEngine,
  FloatingSelectionLifecycle, and PlaybackController implementations rather
  than flattening them into one implementation. FloatingSelectionLifecycle
  retains its pixel-baseline and recovery responsibilities; PlaybackController
  retains its Playhead and clock responsibilities. Their orchestration belongs
  to the Edit module.
- **Keep ambient workspace state at its existing scope.** Shared tool and
  color state, Selection Clipboard, keyboard modifier state, and temporary-tool
  restoration remain workspace concerns. Preserve their existing connections
  to the tab's editing lifecycle without moving them into per-tab ownership.
- **Close mutable access.** TabState, views, and other consumers must not
  expose or receive a live mutable Document or History as an escape hatch.
  A read-only property returning a mutable reference does not satisfy this
  decision. Supply the reads and projections consumers actually need without
  cloning the entire Document for ordinary display reads. Existing drawing
  surfaces may remain internal seams used by the owned tool implementation.
- **Preserve per-operation ordering.** Admission, validation, Playback stop,
  recovery, Floating Selection resolution, mutation, and follow-up effects must
  retain their current order for each operation. Do not normalize all callers
  to one sequence merely because several steps look alike. Preserve no-op,
  invalid-target, failure, and partial-recovery outcomes as well as successful
  edits. Record behavior problems found during implementation separately.
- **Keep the established Playback distinctions.** An editing command that
  currently stops Playback before attempting Floating Selection resolution
  still leaves Playback stopped if resolution fails. Active Frame navigation
  continues to preserve Playback. Playback start remains subject to the
  existing live-stroke and Floating Selection resolution vetoes.
- **Keep the established Undo/Redo distinctions.** Undo resolves a live
  Floating Selection by cancellation, or retries pending recovery, without
  consuming the preceding committed Edit. Redo stays blocked while either
  state is present. Document replacement must preserve the existing cleanup
  of Reference Layer Placement drafts, stale projections, and display state.
- **Keep Edit Baseline authority in the core.** The shell starts and resolves
  Edits through the existing History interface. It does not predict no-ops,
  supply its own changed-content verdict, or introduce another History ring.
  Preserve baseline resolution on failure and the existing handling of a
  partially applied mutation.
- **Separate effect decisions from their execution.** The Edit module decides
  which follow-up effects a transition requires. TabState performs display
  publication, viewport correction, and dirty notifications. Callers must not
  re-derive effects by operation kind or assume that a History entry is the
  only reason to update the display or persist state. The precise result or
  notification representation is an implementation choice, not a prescribed
  collection of flags.
- **Preserve distinct effect cases.** A stroke preview may update the display
  without committing an Edit. An Active Frame change persists the pointer
  without adding History. Playback alone updates the display without mutating
  the Document or marking it dirty. Starting Playback may first commit a
  pending Floating Selection; that separate Edit retains its own History and
  dirty effects. Preserve existing viewport, Reference underlay, Onion Skin,
  and temporary-tool cleanup behavior when editing changes what they display.
- **Keep Document Snapshot as the preservation authority.** Capture, restore,
  thumbnails, and export continue using the existing preservation rules.
  Accommodate the new owner internally without exposing its live mutable
  objects or duplicating Document field assembly in consumers. Preserve the
  ordinary export path's avoidance of unnecessary full reconstruction.
- **Define depth by what callers no longer know.** Completion requires removal
  of repeated transition guards, resolution ordering, and effect decisions
  from callers. Moving them to another file while callers supply the same
  policy combinations does not improve locality or leverage. Concrete Swift
  type names and method shapes remain implementation choices within these
  constraints.

## Testing Decisions

- **Primary seam: the Edit module's interface.** This seam was explicitly
  agreed during the design discussion. Test through the same semantic
  operations and observable reads used by callers. Use real Document and
  Document History bindings; do not mock the core's content comparison or
  test private helper ordering.
- **Retain TabState integration coverage.** Keep tests that demonstrate that
  effects reach display publication, viewport correction, and persistence
  notifications. Move transition-rule coverage to the Edit module where
  appropriate. Preserve regression scenarios, not every test's existing
  internal access pattern, file placement, or raw version-counter assertion.
- **Arrange initial state before ownership begins.** Build initial Documents
  before constructing the owner, or use an appropriate value fixture. Once
  a test exercises the lifecycle, mutate only through the agreed interface.
  Do not retain a mutable fixture alias to bypass the module after handoff.
  Assertions should use observable pixels, active pointers, available actions,
  History behavior, and effects rather than reaching into private History.
- **Keep failure injection internal.** Reuse existing internal seams for
  Floating Selection apply, cancellation, and recovery failures. Exercise the
  subsequent Edit or Playback request through the public interface to prove
  it actually stops or proceeds correctly. Do not expose a production mutation
  escape hatch solely to arrange a failure.
- **Reuse existing adapters.** Use the existing manual FrameScheduler adapter
  for deterministic Playback transitions and the existing recording
  DirtyNotifier adapter for persistence effects. Do not add speculative
  adapters for dependencies that do not vary.
- **Preserve prior regression coverage.** Existing TabState Playback,
  Floating Selection, Frame operations, Stroke sessions, Navigation Bounds,
  Document Snapshot, and auto-save suites provide the behavioral prior art.
  Retain the existing lower-level tests that protect distinct algorithms or
  recovery contracts; remove only tests fully superseded by equivalent
  interface coverage.
- **Validate shell integration after migration.** Run the relevant focused
  Swift tests while changing ownership, then the full Apple test suite on the
  repository's pinned simulator and the macOS build. Preserve rendered-view
  baselines; fixture changes are not a reason to accept changed UI output.

The transition regression matrix must cover the following observable outcomes:

| Scenario | Required outcome |
|----------|------------------|
| Command or navigation during a live Stroke | Preserve that operation's rejection and ordering; do not replace the stroke target or overlap its Edit Baseline |
| Playback start during a live Stroke | No Playback start; the existing stroke remains intact |
| Failed Floating Selection commit or recovery before a following operation | Preserve the veto, recovery state, prior History, and any earlier Playback stop required by that operation |
| Active Frame or Layer navigation with a Floating Selection | Resolve against the source Cel before switching; preserve operation-specific Playback and persistence behavior |
| Undo with a Floating Selection or pending recovery | Cancel or retry recovery without consuming the preceding committed Edit |
| Redo with a Floating Selection or pending recovery | Reject Document replacement until the blocking state is resolved |
| No-op Edit and failed or partially applied Edit | Resolve the baseline under core comparison, preserving redo for no-ops and the existing undoability of changed content |
| Stroke preview, cancellation, and final commit | Display the correct preview or restored pixels and issue persistence effects only under the existing rules |
| Active Frame navigation without a content Edit | Persist the pointer without creating a History entry |
| Playback without a pending content Edit | Update the display without changing the Document, Active Frame, History, or dirty state |
| Undo/Redo that replaces Document dimensions or Reference content | Preserve viewport correction, stale-draft cleanup, and refreshed projections |
| Capture or export during Floating Selection or pending recovery | Preserve the existing Document Snapshot projection without resolving the live operation |
| Tab activation and close | Preserve outgoing Playback stop, clock teardown, and per-tab lifecycle isolation |

## Out of Scope

- Changes to user-visible editing, navigation, Playback, or failure semantics.
- A new command palette, generic action framework, or plugin dispatch system.
- Rewriting tool algorithms, Floating Selection pixel recovery, the Playback
  clock algorithm, or core History comparison.
- Splitting the core Document interface, changing the UniFFI binding contract,
  or migrating the web shell to this module.
- Changing persistence schemas, defining a project file format, or repeating
  the completed Document Snapshot consolidation.
- Moving viewport geometry, view layout, shared workspace state, or storage
  execution into the Edit module.
- Fixing independently tracked grid dirty-marking, web Playback guard,
  auto-save failure notification, or device interruption issues.
- Requiring a particular Swift class name, command enum, or effect transport
  before implementation establishes the smallest sufficient interface.

## Further Notes

- The design was confirmed through an architecture review and discussion:
  broad transition scope, behavior preservation, ownership transfer, removal
  of mutable access, effect decision/execution separation, and the testing
  seams above were all explicitly accepted.
- The review used commit `6086bb7` as its code baseline. At publication, this
  PRD describes future implementation; no implementation or test execution is
  claimed by the review.
- [Apple Document Snapshot](297-apple-document-snapshot.md) is complete and
  explicitly leaves Edit lifecycle deepening as separate work.
- [Apple Playback controller](288-apple-playback-controller.md) records the
  shell-owned start veto when Floating Selection resolution fails.
- [Web Floating Selection orchestration](182-consolidate-floating-selection-orchestration.md)
  is prior art for concentrating caller knowledge, not a request to repeat
  completed web work or copy web behavior over Apple's intentional differences.
- Respect [Deferred History Commit](../docs/decisions/deferred-history-commit.en.md),
  [the cohesive Document decision](../docs/decisions/document-module-kept-cohesive.en.md),
  and [Reference Layer exclusion from pixel outputs](../docs/decisions/reference-layer-excluded-from-export.en.md).
  This PRD does not reopen those decisions.

## Implementation Notes

- Added `EditLifecycle` as the owner of the live Document, History, Stroke,
  Floating Selection, Playback, and content projections. TabState forwards
  semantic operations and executes synchronous display, persistence, hover,
  and viewport effects in their existing order.
- Added `DocumentRead`, which resolves value-only reads against the current
  owned Document, including after Undo/Redo replacement. External content uses
  Document Snapshot values to prevent retained fixture aliases from mutating
  live content; fresh Documents are created inside the owner. Internal tool
  hosts retain access to drawing surfaces.
- Migrated fixture setup before ownership and moved Playback transition tests
  to the Edit interface. Added interface coverage for failed Floating commits,
  recovery vetoes, effect distinctions, and Document replacement. Failure
  injection uses a real Rust-backed Document and leaves History comparison real.
- Validation exposed an ownership regression: an ephemeral StrokeHost was
  released while tool sessions still held unowned references. EditLifecycle
  now retains its host for its lifetime; the host's owner reference remains
  unowned to avoid a retain cycle. The seven Eyedropper tests pass after the fix.
- The first full run after the lifetime fix executed 815 tests without a crash
  and found one stale fixture alias in the Onion Skin opacity test. That test
  now adds its frame through the editing interface. Rendered-view reference
  images were preserved.

## Validation Results

- Final Apple test run: **815 tests in 141 suites passed**, including rendered
  snapshots, on iPad Pro 11-inch (M5), iOS 26.4. No crash or unexpected restart
  occurred. Parallel test execution was disabled; a log monitor stopped runs
  on a fatal error or unexpected-exit message.
- macOS arm64 build: **passed**.
- Markdown lint and `git diff --check`: **passed**.
- Compared the extracted command implementations with their previous TabState
  bodies to verify that admission, Playback stop, Floating resolution, and
  baseline ordering remained intact. Changes at the shell boundary carry the
  viewport-derived paste center and execute the lifecycle's effects.
- No Rust, binding, web-shell, persistence-schema, or snapshot-reference
  changes were required.


## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/State/EditLifecycle.swift` | Owns editing state, transition policy, read-only content projections, and ordered effect decisions. |
| `apple/Dotorixel/State/TabState.swift` | Delegates editing requests and executes presentation, viewport, and persistence effects. |
| `apple/DotorixelTests/EditLifecycleTests.swift` | Covers transition vetoes, failed commits and recovery, effect distinctions, and content ownership. |
| `apple/DotorixelTests/EditLifecyclePlaybackTests.swift` | Exercises Playback coordination through the Edit interface. |
| `apple/DotorixelTests/DocumentTestSupport.swift` | Supplies pre-ownership fixtures and controlled binding failures using real core History. |
| `apple/DotorixelTests/` | Migrates existing fixtures and retains tool, navigation, persistence, export, and rendered-view regressions. |
| `CONTEXT.md`, `apple/DotorixelTests/README.md` | Documents the ownership boundary and testing approach. |
| `tasks/`, `docs/platform-status.md` | Records completion and the cross-platform editing invariants. |

### Key Decisions

- Keep orchestration in Swift while reusing the existing tool, Floating
  Selection, Playback, and Rust History implementations.
- Expose value-only live reads; accept initial content through Document
  Snapshot values so callers cannot retain mutable aliases.
- Preserve operation-specific ordering and core-owned no-op comparison.
  Deliver effects synchronously so their order remains observable.

### Notes

- All 815 tests in 141 suites passed on the pinned iOS simulator, including
  unchanged rendered-view baselines. The macOS arm64 build also passed.
- The temporary StrokeHost lifetime regression and stale Onion Skin fixture
  were corrected during validation; the final test run had no crashes.
- Physical-device Pencil verification and the separately tracked Playback,
  grid dirty-marking, and auto-save follow-ups remain outside this task.


## PR Review Follow-up

- Fresh tabs now create their Document once inside the Edit owner; restored
  tabs pass their existing Snapshot directly to that owner. Externally
  prepared Documents still cross a value boundary to prevent mutable aliases.
- Clipboard fixture setup suppresses persistence events until handoff, with
  a regression covering both silent preparation and subsequent delivery.
- Begin-time Marquee capture is tested through a real StrokeEngine and pencil
  session. Reference-source tests describe observable refresh, and Playback
  factories share their initial two-frame Document preparation.
- Reference placement draft retention on layer deactivation was already
  present on main. It is tracked separately in the backlog to preserve this
  refactor's behavior contract.
- Review follow-up validation: **816 tests in 141 suites passed** on the
  pinned iOS simulator without crashes; macOS arm64 build, Markdown lint, and
  diff checks passed. The added fixture regression also passed in the focused
  nine-test DirtyNotifier suite.
- A second review identified that the owned Document defaulted the persisted
  Timeline collapse flag to false. Tab restoration now carries that flag into
  the existing hydration closure, preserving the binding contract without a
  second Document construction. The externally prepared Document initializer
  also preserves its binding flag when copying content across the value boundary.
- Collapse hydration follow-up validation: all **816 tests in 141 suites**
  passed without crashes on the pinned iOS simulator; macOS arm64 build passed.
