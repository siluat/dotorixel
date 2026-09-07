---
title: Apple Document Snapshot — centralize ownership of capture and reconstruction
status: done
created: 2026-09-07
---

## Problem Statement

On the Apple shell, saving and reopening a Document, generating saved-work
thumbnails, and exporting during a Floating Selection each assemble the same
Document information. Adding Frames and Cels required updating these paths
together. Omitting the frame axis during export reconstruction can collapse a
multi-frame Document into a single frame, so developers adding Document fields
must know the forwarding rules of every consumer.

TabSnapshot currently combines Document content with tab identity, name, zoom,
and presentation state. Passing that value directly into a shared module would
make thumbnails and exports depend on unnecessary tab knowledge. Existing
Floating Selection pixel projection and regression tests already concentrate
much of the behavior; the problem is the field assembly and ordering knowledge
left in callers, not missing tests or file size.

## Solution

Introduce a Swift module on the Apple shell that owns the Document Snapshot,
covering both capture of preservable state and Document reconstruction.
TabSnapshot combines that value with tab state. Restore, thumbnails, and exports
that require reconstruction use the shared module.

Preserve user-visible save, restore, and export results. Existing stored data
remains readable and writable without migration, and partial-corruption recovery
policies remain intact. Exports without a Floating Selection retain the existing
path that uses the original Document directly.

## User Stories

1. As an Apple user, I want every Layer and Cel in a saved Document to reopen intact, so that I can continue editing without losing pixels.
2. As an animation author, I want Frame order, durations, and the Active Frame preserved, so that I can resume at the moment I was editing.
3. As a user moving a Floating Selection, I want auto-save and export to preserve the existing pre-commit pixels, so that a transient preview does not change the saved result.
4. As a user with recovery pending after cancelling a Floating Selection, I want the existing recovery pixels and active-Layer pointer projection preserved, so that an incomplete intermediate state is not saved.
5. As a user exporting multiple Frames, I want spritesheets and GIFs to retain every Frame even during a Floating Selection, so that the animation remains complete.
6. As a Reference Layer user, I want its source, placement, and display state restored after saving, so that I can keep drawing against the same reference.
7. As a user exporting a Document, I want Reference Layer and Onion Skin pixels excluded, so that only the authored pixels reach the output.
8. As a Marquee user, I want the existing region restored when reopening, so that I do not have to select the editing area again.
9. As a user with multiple tabs, I want each tab's name, zoom, pan, and presentation state preserved under the existing policies alongside its content.
10. As a user browsing saved work, I want thumbnails to show the saved Active Frame, so that I can identify the Document I need.
11. As a user with data saved by an older version, I want Documents without Frame metadata to continue opening as a single Frame.
12. As a user with partially corrupted stored data, I want existing recovery to discard only the damaged animation or Reference Layer where possible, so that readable pixels survive.
13. As a user performing ordinary exports, I want this architecture change to avoid unnecessary full-Document copies or reconstruction.
14. As a developer adding a Document field, I want to update shared rules instead of separate restore, thumbnail, and export assembly code.
15. As a developer, I want tab presentation separated from Document content, so that I can use shared reconstruction without creating a tab.
16. As a developer, I want internal assembly mistakes to surface as validation failures instead of being mistaken for storage corruption and silently repaired.
17. As a developer, I want tests of pixels, Frames, and storage round trips to remain valid when the module's implementation changes.

## Implementation Decisions

- **Place the module in the Apple shell.** The new Swift module is named
  `DocumentSnapshot`. Do not change the Rust core, UniFFI interface or generated
  bindings, or web shell. Design a future project file format separately when
  actual shared rules emerge.
- **Own capture and reconstruction together.** Extracting a data type or adding
  a forwarding function around fromLayers is not sufficient. Keep Document field
  collection, Floating Selection projection wiring, reconstruction argument
  assembly, and Marquee restoration in the shared implementation. Consumers must
  not reassemble field combinations or perform additional restoration steps.
- **Separate Document and tab state.** A Document Snapshot includes canvas
  dimensions; Pixel Layer order, metadata, pixels, and Cels; the Frame axis,
  durations, and Active Frame; the Reference Layer; the active-Layer pointer;
  the Layer naming counter; and the Marquee. Tab identity and name, viewport,
  grid and Onion Skin visibility, and Timeline panel collapse remain in
  TabSnapshot. Do not add Playback or History to persisted state.
- **Accommodate the existing binding's presentation argument.** The Timeline
  panel collapse value accepted by the current hydration constructor remains
  tab-owned presentation state, wired through with its existing value when
  restoring a tab. Do not modify the core or binding to remove this argument,
  or require consumers to supply an entire TabSnapshot for shared reconstruction.
- **Reuse the Floating Selection module.** FloatingSelectionLifecycle remains
  the authority for baseline pixels and the recovery active-Layer pointer.
  DocumentSnapshot owns the wiring that applies that projection to the complete
  Layer and Cel state. The active Frame's compatibility pixels and corresponding
  Cel pixels must agree, while Cels on other Frames remain intact. Preserve
  existing Marquee handling for persistence.
- **Capture is a read.** Do not commit or cancel a Floating Selection for
  capture, thumbnails, or export. Do not mutate the live Document, Active Frame,
  Playback, History, or dirty state. Do not start persisting transient Reference
  Layer Placement drafts.
- **Connect restore, thumbnails, and export.** Tab restoration and reopening
  saved work use shared reconstruction. Thumbnails use the saved Active Frame's
  Pixel-only composite. Export reconstruction required by a Floating Selection
  or pending recovery uses the same field assembly rules, retaining existing
  PNG, SVG, GIF, and spritesheet encoding semantics.
- **Distinguish Reference preservation from pixel-output exclusion.** A Document
  Snapshot that preserves a Reference Layer must coexist with outputs that
  exclude Reference pixels. Documents with an active Reference Layer must
  reconstruct successfully. Do not remove Reference pixels after encoding.
- **Keep the direct path for ordinary exports.** Encode the original Document
  when neither a Floating Selection nor pending recovery exists. Shared logic
  must not force every export through Snapshot capture and Document
  reconstruction. Blank-document detection still examines preservation pixels
  across every Layer and Frame, without adding unnecessary full reconstruction.
- **Keep storage-specific conversion and recovery in the adapter.** The existing
  storage adapter owns SwiftData record conversion, Reference source encoding
  and decoding, numeric conversions and corruption screening, single-frame
  recovery of a damaged frame axis, Reference removal, and active-pointer
  repair. The shared module reconstructs supplied state through existing core
  validation and does not hide internal assembly failures behind arbitrary data
  recovery. Preserve each consumer's existing failure-handling scope.
- **Keep the on-disk schema.** Change only the in-memory nesting of TabSnapshot;
  retain the existing DocumentRecord and WorkspaceRecord storage formats.
  Shared reconstruction must accept absent Frame metadata from older versions
  and the fallback representation of corrupted animation data. Introduce no
  separate data migration.
- **Define completion in terms of depth.** The leverage consumers gain at the
  shared module's interface is freedom from knowing field assembly and
  projection order. If the original field lists reappear in each consumer,
  the locality improvement is incomplete. Do not introduce generic adapters or
  new abstraction seams solely for tests.

## Testing Decisions

- The agreed primary seam is the `DocumentSnapshot` interface. Use real
  AppleDocument instances to test observable capture and reconstruction results,
  not private helpers, field-forwarding call sequences, or mock call counts.
- Retain existing TabState and Workspace storage round-trip and export-result
  tests. When shared-rule tests move into the new module, remove only lower-level
  tests whose meaning is completely duplicated. Do not replace all consumer
  integration tests.
- Use multiple Layers and Frames with distinct pixels to verify round-trip
  preservation of Frame order, durations, Active Frame, each Cel's pixels, Layer
  attributes, active pointers, counters, and Marquee. Avoid tests that pass only
  because the snapshot and original share the same reference.
- Verify existing baseline pixel and active-Layer pointer projection for an
  active Floating Selection and pending recovery. When only one of several
  Frames is targeted, other Cels must not disappear or be overwritten. Preserve
  the live Document, transient state, History, and dirty state across capture.
- Restore a Document with an active Reference Layer. Its source, placement, and
  display state must survive without appearing in thumbnails or pixel output.
  Documents without a Marquee must also round-trip successfully.
- Spritesheet and GIF exports during a Floating Selection must retain every
  Frame and the formats' existing timing and order semantics. Preserve PNG and
  SVG output and Onion Skin exclusion. Assert decoded results when encoded
  bytes themselves are not the relevant contract.
- Use the real in-memory SwiftData adapter to preserve existing storage format,
  legacy single-frame restoration, invalid Cel-axis recovery, damaged Reference
  handling, and active-pointer repair. Distinguish internal reconstruction
  errors from this adapter's fallback behavior.
- After separating tab presentation, verify the existing differences between
  automatic restoration and saved-work reopening: viewport policy, Timeline
  collapse, grid visibility, and Onion Skin state.
- Reuse relevant prior art in WorkspaceSnapshotTests, SessionPersistenceTests,
  ExportFormatTests, PngExportTests, FloatingSelectionTests, and SaveFlowTests.
  Use the existing Swift Testing environment and verify compilation of the
  Apple targets affected by the state-shape change.
- Review the implementation to confirm ordinary exports are not forced through
  the new Snapshot capture and reconstruction path. Do not add instrumentation
  dependencies to the public interface or introduce a broad performance
  benchmark suite solely for this check.

## Out of Scope

- Splitting the Rust core Document's public interface, changing bindings, or
  refactoring the web shell in parallel.
- Project file format design, JSON encoding, or file import/save implementation.
- SwiftData on-disk schema changes, data migration, or new recovery policies.
- Changes to Floating Selection, Playback, or Edit Baseline lifecycles or
  user-visible behavior.
- New export formats or options, Reference-inclusive output, or thumbnail UI.
- Auto-save failure notifications, dirty-marking policy changes, and other
  separate backlog items.
- Generic storage abstractions, new adapter frameworks, or module splits broader
  than the domain requires.

## Further Notes

- This PRD was finalized through a sequential design discussion of architecture
  review candidate 1. The maintainer approved shared ownership of capture and
  reconstruction, separation of Document and tab state, preservation of the
  on-disk schema, adapter-owned recovery, Apple-shell placement, and the
  testing seam.
- The review examined the latest 60 commits, 26 of which changed TabState.
  Field-wiring friction in animation persistence and extended exports motivated
  the work. Existing regression coverage is substantial; this is not classified
  as a fix for a confirmed data-loss bug.
- Document Snapshot is a domain value for preservation and reconstruction, not
  a History Snapshot or an encoded project file. The glossary records this
  distinction.
- The design respects the existing decisions to keep core Document cohesive,
  exclude Reference Layer pixels from output, and use Deferred History Commit.
  No new ADR is needed.
- This work may help future project-file work, but does not establish a mandatory
  dependency or predefine a file schema shared by both shells.

## Notes

### 2026-09-07 — Implementation and verification complete

- Work branch: `refactor/297-apple-document-snapshot`.
- `DocumentSnapshot` owns state capture, preservation-oriented Floating
  Selection Layer/Cel projection, Document reconstruction, and Marquee
  restoration. Apple production code now assembles `AppleDocument.fromLayers`
  in this module alone.
- `TabSnapshot.document` separates content from tab state. Tab restoration,
  saved-work thumbnails, and Floating Selection export use shared reconstruction.
- Ordinary exports use the original Document directly. Blank-document detection
  reads only shared preservation Layer projections, avoiding Reference source
  copies and Document reconstruction.
- SwiftData storage schema, corruption screening and recovery, Rust core,
  bindings, and web shell remain unchanged. Existing consumer tests now read
  through the nested state.
- New module tests cover full-frame round trips independent of later source
  edits, Floating Selection projection, read-only preservation of pending
  recovery, Reference preservation and pixel-output exclusion, and validation
  failures for incorrectly assembled Frame data.
- TDD confirmed failures for the absent module, missing Floating Selection input,
  and missing nested Document state before implementation. The 71 save, restore,
  and export integration tests passed before full verification.
- Full suite on iPad Pro 11-inch (M5), iOS 26.4: **810 tests passed**,
  **908 executions** including dynamic parameter cases, with no failures or skips.
- macOS arm64 build, Markdown checks, and `git diff --check` passed.
  The existing AutoSave `defaultDebounce` actor-isolation warning remains
  outside this task's scope.
- Completion log and task lists were updated through `/task-done`.

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/State/DocumentSnapshot.swift` | Centralizes Document capture/reconstruction, Floating Selection preservation projection, and blank-document detection |
| `apple/Dotorixel/State/WorkspaceSnapshot.swift` | Separates Document content from tab identity and presentation |
| `apple/Dotorixel/State/TabState.swift` | Connects restore, save, and export to the shared module while preserving the direct path for ordinary exports |
| `apple/Dotorixel/Persistence/SessionPersistence.swift` | Adapts nested state and shared thumbnail reconstruction; preserves storage schema and corruption recovery |
| `apple/DotorixelTests/DocumentSnapshotTests.swift` | Covers independent Frame round trips, Floating Selection/recovery, Reference exclusion, and invalid Frame assembly |
| `apple/DotorixelTests/WorkspaceSnapshotTests.swift` | Retains capture and restore result checks after state separation |
| `apple/DotorixelTests/SessionPersistenceTests.swift` | Retains storage round-trip, legacy compatibility, and corruption recovery checks |
| `apple/DotorixelTests/AutoSaveTests.swift` | Retains Floating Selection, recovery, and Reference auto-save checks |
| `CONTEXT.md` | Distinguishes Document Snapshot from tab state and History Snapshot |
| `tasks/{done,todo,progress}.md`, `docs/platform-status.md` | Records completion, refreshes next tasks, and states cross-platform preservation principles |

### Key Decisions

- Capture and reconstruction share one Swift module to reduce field assembly
  knowledge in consumers.
- Storage adapters retain format-specific conversion and recovery; the shared
  module does not hide core validation failures. No Rust core, binding, or
  on-disk schema changes were needed.
- Existing Floating Selection baseline ownership is reused. Ordinary exports
  and blank-document detection incur no unnecessary full reconstruction.

### Notes

- The full pinned iOS simulator suite passed: 810 tests, 908 executions including
  dynamic parameter cases. The macOS arm64 build also passed. The existing
  AutoSave actor-isolation warning remains.
- Edit lifecycle deepening and project file format design are separate tasks.
