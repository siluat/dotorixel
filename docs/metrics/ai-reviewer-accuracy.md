# AI Reviewer Accuracy

Tracks accept/reject ratios per AI reviewer bot on PR review comments.

## Running Totals

| Reviewer | Total | Accept | Reject | Miss | Accept % | Recall |
|----------|-------|--------|--------|------|----------|--------|
| greptile-apps[bot] | 150 | 116 | 34 | 156 | 77% | 43% |
| cubic-dev-ai[bot] | 110 | 92 | 18 | 176 | 84% | 34% |
| coderabbitai[bot] | 209 | 151 | 58 | 114 | 72% | 57% |

## Log

| PR | Reviewer | Verdict | Summary |
|----|----------|---------|---------|
| #265 | cubic-dev-ai[bot] | Accept | Tool radio group roles lacked matching keyboard focus and arrow-key selection behavior |
| #265 | coderabbitai[bot] | Miss | Did not flag radio group keyboard/focus behavior mismatch |
| #265 | greptile-apps[bot] | Miss | Did not flag radio group keyboard/focus behavior mismatch |
| #265 | coderabbitai[bot] | Accept | Fixed Constrain status IDs were duplicated across multiple toolbar mounts |
| #265 | cubic-dev-ai[bot] | Miss | Did not flag duplicated Constrain status IDs across multiple toolbar mounts |
| #265 | greptile-apps[bot] | Miss | Did not flag duplicated Constrain status IDs across multiple toolbar mounts |
| #265 | coderabbitai[bot] | Accept | Replace aria-current tool selection with radiogroup/radio aria-checked semantics |
| #265 | cubic-dev-ai[bot] | Accept | Same finding — aria-current was wrong for tool selection; fixed with radio semantics instead of aria-pressed |
| #265 | greptile-apps[bot] | Miss | Did not flag aria-current tool selection semantics |
| #265 | coderabbitai[bot] | Accept | Derive Constrain latch toolbar test labels and tool sets from tool-ui source exports |
| #265 | cubic-dev-ai[bot] | Accept | Same finding — shared Constrain latch test helper duplicated tool labels and constrainable sets |
| #265 | greptile-apps[bot] | Accept | Same finding — test helper list duplicated the production constrainable tool set |
| #265 | coderabbitai[bot] | Accept | Tool selection buttons used aria-pressed for mutually exclusive selection; switched to aria-current |
| #265 | cubic-dev-ai[bot] | Miss | Did not flag tool selection buttons using aria-pressed for non-toggle selection state |
| #265 | greptile-apps[bot] | Miss | Did not flag tool selection buttons using aria-pressed for non-toggle selection state |
| #265 | cubic-dev-ai[bot] | Accept | Constrain latch status text lacked a live region, so retap state changes may not be announced |
| #265 | cubic-dev-ai[bot] | Accept | ToolStrip and LeftToolbar duplicated Constrain latch specs; extracted a shared toolbar contract |
| #265 | coderabbitai[bot] | Miss | Did not flag missing Constrain latch live-region announcement |
| #265 | greptile-apps[bot] | Miss | Did not flag missing Constrain latch live-region announcement |
| #265 | coderabbitai[bot] | Miss | Did not flag duplicated Constrain latch toolbar specs |
| #265 | greptile-apps[bot] | Miss | Did not flag duplicated Constrain latch toolbar specs |
| #263 | cubic-dev-ai[bot] | Reject | Flagged the release-active asserts as contradicting a debug_assert "pattern"; they are the accepted round-1 fix, and the remaining debug_asserts are redundant tripwires, not sole invariant enforcement |
| #263 | coderabbitai[bot] | Accept | fit_to_canvas/auto_fit guarded only by debug_assert — invariant escapable in release; promoted to release-active assert |
| #263 | greptile-apps[bot] | Accept | Same finding — fit_to_canvas can silently produce scale 0 in release builds |
| #263 | coderabbitai[bot] | Accept | wasm set_reference_placement / builder add_reference_layer docs lacked placement-validation error conditions |
| #263 | coderabbitai[bot] | Reject | get_x/get_y/get_scale rename contradicts rust-conventions (C-GETTER bare-noun getters; simple getters need no rustdoc) |
| #263 | greptile-apps[bot] | Miss | Did not flag missing error-condition docs on the wasm placement entry points |
| #263 | cubic-dev-ai[bot] | Miss | Did not flag release-escapable placement constructor preconditions |
| #263 | cubic-dev-ai[bot] | Miss | Did not flag missing error-condition docs on the wasm placement entry points |
| #262 | cubic-dev-ai[bot] | Accept | Issue 165 Results table abbreviated the ReferenceWindowOverlay test path; expanded to the full path |
| #262 | coderabbitai[bot] | Miss | Did not flag the abbreviated test file path in issue 165 Results |
| #262 | greptile-apps[bot] | Miss | Did not flag the abbreviated test file path in issue 165 Results |
| #260 | greptile-apps[bot] | Accept | Hoisted per-iteration `layers_metadata()` out of loops/find (one of seven sites) |
| #260 | cubic-dev-ai[bot] | Reject | `kind: string` → union breaks `WasmDocument` structural-compat; proper fix needs a `WasmLayerKind` wasm enum (deferred) |
| #260 | cubic-dev-ai[bot] | Miss | Did not flag per-iteration `layers_metadata()` calls in loops |
| #260 | coderabbitai[bot] | Miss | Did not flag per-iteration `layers_metadata()` calls in loops |
| #259 | greptile-apps[bot] | Accept | BORDER_PX JSDoc named the renamed `--loupe-border` property; should be `--loupe-border-width` |
| #259 | cubic-dev-ai[bot] | Accept | BORDER_PX JSDoc named the renamed `--loupe-border` property; should be `--loupe-border-width` |
| #259 | coderabbitai[bot] | Miss | Did not flag stale `--loupe-border` JSDoc on BORDER_PX |
| #259 | cubic-dev-ai[bot] | Accept | progress.md used `LOUPE_WIDTH`/`HEIGHT` shorthand instead of the `LOUPE_HEIGHT` constant |
| #259 | greptile-apps[bot] | Miss | Did not flag `LOUPE_WIDTH`/`HEIGHT` shorthand in progress.md |
| #259 | coderabbitai[bot] | Miss | Did not flag `LOUPE_WIDTH`/`HEIGHT` shorthand in progress.md |
| #258 | greptile-apps[bot] | Accept | Rust-parity test became a tautology after viewportOps shorthand delegation; compare to WASM effective_pixel_size directly |
| #258 | cubic-dev-ai[bot] | Accept | Rust-parity test became a tautology after viewportOps shorthand delegation; compare to WASM effective_pixel_size directly |
| #258 | coderabbitai[bot] | Miss | Did not flag tautological Rust-parity test |
| #257 | greptile-apps[bot] | Accept | Zoom tests dropped post-zoom pan assertions; restored them and added zoom×footprint clamp coverage |
| #257 | coderabbitai[bot] | Miss | Did not flag dropped post-zoom pan assertions in viewport zoom tests |
| #257 | cubic-dev-ai[bot] | Miss | Did not flag dropped post-zoom pan assertions in viewport zoom tests |
| #256 | coderabbitai[bot] | Accept | Enforce ModalState read-only contract — ActiveModal variants and saved-work documents readonly |
| #256 | cubic-dev-ai[bot] | Miss | Did not flag mutable ModalState payload bypassing transitions |
| #256 | greptile-apps[bot] | Miss | Did not flag mutable ModalState payload bypassing transitions |
| #255 | cubic-dev-ai[bot] | Accept | Guard Floating Selection outside-drag commit while Reference Layer is active |
| #255 | coderabbitai[bot] | Miss | Did not flag Reference-active outside-drag Floating Selection commit |
| #255 | greptile-apps[bot] | Miss | Did not flag Reference-active outside-drag Floating Selection commit |
| #254 | coderabbitai[bot] | Accept | Bind test projection to the current Document getter |
| #254 | cubic-dev-ai[bot] | Miss | Did not flag stale test projection getter |
| #254 | greptile-apps[bot] | Miss | Did not flag stale test projection getter |
| #254 | cubic-dev-ai[bot] | Accept | Cache Document Layer Projection within render version during sampling |
| #254 | coderabbitai[bot] | Miss | Did not flag repeated projection rebuild in sampling hot path |
| #254 | greptile-apps[bot] | Miss | Did not flag repeated projection rebuild in sampling hot path |
| #252 | greptile-apps[bot] | Accept | Add vertical constrainAxis helper test |
| #252 | coderabbitai[bot] | Accept | Add vertical and tie-break constrainAxis helper tests |
| #252 | cubic-dev-ai[bot] | Miss | Did not flag incomplete constrainAxis helper branch coverage |
| #252 | greptile-apps[bot] | Accept | Derive stored Floating Selection axis from constrainAxis output |
| #252 | cubic-dev-ai[bot] | Accept | Derive stored Floating Selection axis from constrainAxis output |
| #252 | coderabbitai[bot] | Miss | Did not flag duplicated axis-selection logic |
| #252 | coderabbitai[bot] | Accept | Rename stateful Floating Selection offset helper away from query-style wording |
| #252 | greptile-apps[bot] | Miss | Did not flag stateful Floating Selection offset helper naming |
| #252 | cubic-dev-ai[bot] | Miss | Did not flag stateful Floating Selection offset helper naming |
| #251 | cubic-dev-ai[bot] | Accept | Clear DefineMarquee stroke state after commit to prevent stale modifier preview |
| #251 | coderabbitai[bot] | Miss | Did not flag stale DefineMarquee modifier preview after stroke end |
| #251 | greptile-apps[bot] | Miss | Did not flag stale DefineMarquee modifier preview after stroke end |
| #249 | greptile-apps[bot] | Accept | Use group role for Tab-navigated selection action buttons |
| #249 | greptile-apps[bot] | Accept | Hide action bar when projected Marquee is smaller than one screen pixel |
| #249 | coderabbitai[bot] | Accept | Clarify platform status pending scope as Floating-state controls |
| #249 | coderabbitai[bot] | Accept | Align progress terminology around Floating Selection controls |
| #249 | coderabbitai[bot] | Miss | Did not flag selection action group role mismatch |
| #249 | cubic-dev-ai[bot] | Miss | Did not flag selection action group role mismatch |
| #249 | coderabbitai[bot] | Miss | Did not flag zero-size projected Marquee action bar |
| #249 | cubic-dev-ai[bot] | Miss | Did not flag zero-size projected Marquee action bar |
| #249 | greptile-apps[bot] | Miss | Did not flag platform status pending-scope wording |
| #249 | cubic-dev-ai[bot] | Miss | Did not flag platform status pending-scope wording |
| #249 | greptile-apps[bot] | Miss | Did not flag progress terminology mismatch |
| #249 | cubic-dev-ai[bot] | Miss | Did not flag progress terminology mismatch |
| #248 | greptile-apps[bot] | Accept | Preserve explicit null pre-paste Marquee snapshot during Floating Selection commit undo |
| #248 | cubic-dev-ai[bot] | Accept | Preserve explicit null pre-paste Marquee snapshot during Floating Selection commit undo |
| #248 | coderabbitai[bot] | Reject | Paste remains a transient Floating Selection preview until commit marks the document dirty |
| #248 | coderabbitai[bot] | Miss | Did not flag explicit null pre-paste Marquee snapshot fallback |
| #245 | greptile-apps[bot] | Reject | Keep arrow-key preventDefault before drawing guard to suppress native scroll |
| #245 | greptile-apps[bot] | Accept | Document intentional key-repeat behavior for arrow nudge |
| #245 | greptile-apps[bot] | Accept | Rename idle Floating Selection commit helper to match UI and document call sites |
| #245 | coderabbitai[bot] | Accept | Copy after uncommitted nudge should read the Floating Selection buffer |
| #245 | cubic-dev-ai[bot] | Accept | Copy after uncommitted nudge should read the Floating Selection buffer |
| #245 | cubic-dev-ai[bot] | Accept | Rename idle Floating Selection commit helper to match UI and document call sites |
| #245 | greptile-apps[bot] | Miss | Did not flag copy-after-nudge Floating Selection clipboard bug |
| #245 | coderabbitai[bot] | Miss | Did not flag idle Floating Selection helper naming mismatch |
| #245 | coderabbitai[bot] | Miss | Did not flag arrow nudge key-repeat intentionality documentation |
| #245 | cubic-dev-ai[bot] | Miss | Did not flag arrow nudge key-repeat intentionality documentation |
| #244 | greptile-apps[bot] | Accept | Page-level Escape ordering can leave Floating Selection canvas interaction stale |
| #244 | coderabbitai[bot] | Miss | Did not flag page-level Escape ordering stale canvas interaction |
| #244 | cubic-dev-ai[bot] | Miss | Did not flag page-level Escape ordering stale canvas interaction |
| #243 | cubic-dev-ai[bot] | Accept | Guard selection copy shortcut while Alt is held |
| #243 | coderabbitai[bot] | Accept | Document SelectionClipboard buffer-length invariant |
| #243 | coderabbitai[bot] | Reject | Keep SelectionClipboard as a plain value without constructor or custom serde validation |
| #243 | coderabbitai[bot] | Accept | Remove GitHub issue auto-close keyword from local issue reference |
| #243 | coderabbitai[bot] | Miss | Did not flag Alt-modified selection copy shortcut |
| #243 | greptile-apps[bot] | Miss | Did not flag Alt-modified selection copy shortcut |
| #243 | cubic-dev-ai[bot] | Miss | Did not flag SelectionClipboard buffer-length invariant documentation gap |
| #243 | greptile-apps[bot] | Miss | Did not flag SelectionClipboard buffer-length invariant documentation gap |
| #243 | cubic-dev-ai[bot] | Miss | Did not flag GitHub issue auto-close keyword mismatch |
| #243 | greptile-apps[bot] | Miss | Did not flag GitHub issue auto-close keyword mismatch |
| #242 | coderabbitai[bot] | Accept | Pin Floating Selection preview, restore, and commit to the source layer |
| #242 | cubic-dev-ai[bot] | Accept | Pin Floating Selection preview to the source layer after active layer changes |
| #242 | cubic-dev-ai[bot] | Accept | Commit Floating Selection against the source layer after active layer changes |
| #242 | greptile-apps[bot] | Miss | Did not flag active-layer drift for Floating Selection source layer |
| #242 | greptile-apps[bot] | Accept | Remove unreachable `outA === 0` branch after nonzero source alpha |
| #242 | cubic-dev-ai[bot] | Accept | Remove unreachable `outA === 0` branch after nonzero source alpha |
| #242 | coderabbitai[bot] | Miss | Did not flag unreachable source-over alpha branch |
| #242 | greptile-apps[bot] | Accept | Collapse duplicate Floating Selection destination region computation |
| #242 | cubic-dev-ai[bot] | Accept | Collapse duplicate Floating Selection destination region computation |
| #242 | coderabbitai[bot] | Miss | Did not flag duplicate Floating Selection destination region computation |
| #242 | coderabbitai[bot] | Accept | Include lifted-source baseline in Floating Selection journal commit test |
| #242 | cubic-dev-ai[bot] | Accept | Include lifted-source baseline in Floating Selection journal commit test |
| #242 | greptile-apps[bot] | Miss | Did not flag missing Floating Selection lifted-source test baseline |
| #242 | coderabbitai[bot] | Accept | Include lifted-source baseline in off-canvas Floating Selection test |
| #242 | greptile-apps[bot] | Miss | Did not flag missing off-canvas Floating Selection lifted-source baseline |
| #242 | cubic-dev-ai[bot] | Miss | Did not flag missing off-canvas Floating Selection lifted-source baseline |
| #242 | coderabbitai[bot] | Accept | Rename pixel test helper to query-style `getPixelAt` |
| #242 | greptile-apps[bot] | Miss | Did not flag query-style pixel helper naming |
| #242 | cubic-dev-ai[bot] | Miss | Did not flag query-style pixel helper naming |
| #242 | cubic-dev-ai[bot] | Reject | Floating Selection cursor does not persist after pointer-up in this PR |
| #241 | cubic-dev-ai[bot] | Accept | Clamp tooltip position using computed dynamic width |
| #241 | coderabbitai[bot] | Miss | Did not flag fixed-width tooltip positioning after dynamic width |
| #241 | greptile-apps[bot] | Miss | Did not flag fixed-width tooltip positioning after dynamic width |
| #241 | cubic-dev-ai[bot] | Accept | Clamp drag-aid guide coordinates to viewport bounds |
| #241 | cubic-dev-ai[bot] | Accept | Format drag tooltip dimensions as integer pixel counts |
| #241 | cubic-dev-ai[bot] | Accept | Let drag tooltip width expand beyond fixed 64px minimum |
| #241 | coderabbitai[bot] | Miss | Did not flag unclamped drag-aid guide coordinates |
| #241 | greptile-apps[bot] | Miss | Did not flag unclamped drag-aid guide coordinates |
| #241 | coderabbitai[bot] | Miss | Did not flag unformatted drag tooltip dimensions |
| #241 | greptile-apps[bot] | Miss | Did not flag unformatted drag tooltip dimensions |
| #241 | coderabbitai[bot] | Miss | Did not flag fixed-width drag tooltip |
| #241 | greptile-apps[bot] | Miss | Did not flag fixed-width drag tooltip |
| #239 | coderabbitai[bot] | Reject | One-off Marquee containment helper keeps fractional bounds policy readable |
| #237 | cubic-dev-ai[bot] | Accept | Trust MarqueeRegion non-empty invariant in bounded flood-fill conversion |
| #237 | coderabbitai[bot] | Miss | Did not flag unreachable MarqueeRegion empty-bounds guard |
| #237 | greptile-apps[bot] | Miss | Did not flag unreachable MarqueeRegion empty-bounds guard |
| #237 | coderabbitai[bot] | Accept | Reject zero-sized Marquee bounds before WASM drag conversion |
| #237 | cubic-dev-ai[bot] | Accept | Intersect caller flood-fill bounds with active Marquee bounds |
| #237 | cubic-dev-ai[bot] | Accept | Document `flood_fill_bounded` false cases |
| #237 | coderabbitai[bot] | Accept | Rename continuous-tool Marquee helper to action-style constructor |
| #237 | coderabbitai[bot] | Accept | Rename fake fill-bounds predicate to query-style name |
| #237 | coderabbitai[bot] | Accept | Rename marquee-clipped bounds helper to action-style constructor |
| #237 | coderabbitai[bot] | Accept | Document DrawingOps Marquee bounds contract |
| #237 | coderabbitai[bot] | Accept | Rename stroke DrawingOps factory and boolean |
| #237 | coderabbitai[bot] | Accept | Replace scalar flood-fill rectangle bounds with CanvasRect |
| #237 | cubic-dev-ai[bot] | Miss | Did not flag zero-sized Marquee bounds conversion |
| #237 | greptile-apps[bot] | Miss | Did not flag zero-sized Marquee bounds conversion |
| #237 | coderabbitai[bot] | Miss | Did not flag dropped caller flood-fill bounds |
| #237 | greptile-apps[bot] | Miss | Did not flag dropped caller flood-fill bounds |
| #237 | coderabbitai[bot] | Miss | Did not flag incomplete bounded flood-fill rustdoc |
| #237 | greptile-apps[bot] | Miss | Did not flag incomplete bounded flood-fill rustdoc |
| #237 | cubic-dev-ai[bot] | Miss | Did not flag continuous-tool helper naming |
| #237 | greptile-apps[bot] | Miss | Did not flag continuous-tool helper naming |
| #237 | cubic-dev-ai[bot] | Miss | Did not flag fake fill-bounds predicate naming |
| #237 | greptile-apps[bot] | Miss | Did not flag fake fill-bounds predicate naming |
| #237 | cubic-dev-ai[bot] | Miss | Did not flag marquee-clipped helper naming |
| #237 | greptile-apps[bot] | Miss | Did not flag marquee-clipped helper naming |
| #237 | cubic-dev-ai[bot] | Miss | Did not flag DrawingOps Marquee bounds documentation gap |
| #237 | greptile-apps[bot] | Miss | Did not flag DrawingOps Marquee bounds documentation gap |
| #237 | cubic-dev-ai[bot] | Miss | Did not flag stroke DrawingOps factory naming |
| #237 | greptile-apps[bot] | Miss | Did not flag stroke DrawingOps factory naming |
| #237 | cubic-dev-ai[bot] | Miss | Did not flag scalar flood-fill rectangle bounds |
| #237 | greptile-apps[bot] | Miss | Did not flag scalar flood-fill rectangle bounds |
| #236 | greptile-apps[bot] | Accept | Source row should not be marked as drag target on pointerdown |
| #236 | coderabbitai[bot] | Miss | Did not flag source row drag-target semantics |
| #236 | cubic-dev-ai[bot] | Miss | Did not flag source row drag-target semantics |
| #234 | greptile-apps[bot] | Accept | Release builds should enforce `composite_region` buffer length |
| #234 | coderabbitai[bot] | Accept | Document public selection region APIs with rustdoc |
| #234 | coderabbitai[bot] | Accept | Document TS Marquee methods with TSDoc |
| #234 | coderabbitai[bot] | Miss | Did not flag release-only missing `composite_region` buffer guard |
| #234 | cubic-dev-ai[bot] | Miss | Did not flag release-only missing `composite_region` buffer guard |
| #234 | greptile-apps[bot] | Miss | Did not flag Rust selection region API documentation gap |
| #234 | cubic-dev-ai[bot] | Miss | Did not flag Rust selection region API documentation gap |
| #234 | greptile-apps[bot] | Miss | Did not flag TS Document Marquee method documentation gap |
| #234 | cubic-dev-ai[bot] | Miss | Did not flag TS Document Marquee method documentation gap |
| #233 | coderabbitai[bot] | Accept | Returning to anchor after drag should refresh Marquee preview |
| #233 | cubic-dev-ai[bot] | Accept | Returning to anchor after drag should refresh Marquee preview |
| #233 | greptile-apps[bot] | Miss | Did not flag stale Marquee preview when returning to anchor after drag |
| #232 | coderabbitai[bot] | Accept | Clear Marquee preview baseline before commit-side dirty effects |
| #232 | cubic-dev-ai[bot] | Miss | Did not flag stale preview baseline during commit-side dirty effects |
| #232 | greptile-apps[bot] | Miss | Did not flag stale preview baseline during commit-side dirty effects |
| #232 | cubic-dev-ai[bot] | Accept | Selection preview should not be persisted before commit |
| #232 | coderabbitai[bot] | Accept | Add already-V5 Marquee preservation test |
| #232 | coderabbitai[bot] | Accept | Document migrateV4ToV5 public contract |
| #232 | coderabbitai[bot] | Miss | Did not flag selection preview persistence before commit |
| #232 | greptile-apps[bot] | Miss | Did not flag selection preview persistence before commit |
| #232 | cubic-dev-ai[bot] | Miss | Did not flag already-V5 Marquee preservation test gap |
| #232 | greptile-apps[bot] | Miss | Did not flag already-V5 Marquee preservation test gap |
| #232 | cubic-dev-ai[bot] | Miss | Did not flag migrateV4ToV5 public contract documentation gap |
| #232 | greptile-apps[bot] | Miss | Did not flag migrateV4ToV5 public contract documentation gap |
| #231 | coderabbitai[bot] | Accept | Clear should be blocked while a draw stroke is active |
| #231 | cubic-dev-ai[bot] | Accept | Clear should be blocked while a draw stroke is active |
| #231 | cubic-dev-ai[bot] | Accept | Reference Layer clear no-op should not push undo or dirty state |
| #231 | greptile-apps[bot] | Miss | Did not flag clear during active draw stroke |
| #231 | coderabbitai[bot] | Miss | Did not flag Reference Layer clear no-op undo pollution |
| #231 | greptile-apps[bot] | Miss | Did not flag Reference Layer clear no-op undo pollution |
| #230 | greptile-apps[bot] | Accept | Off-canvas-only Selection drag should not clear existing Marquee |
| #230 | cubic-dev-ai[bot] | Accept | Off-canvas-only Selection drag should not clear existing Marquee |
| #230 | coderabbitai[bot] | Accept | Rename Move cancel tracking boolean to identify shifted pixels |
| #230 | coderabbitai[bot] | Miss | Did not flag off-canvas-only Selection drag clearing existing Marquee |
| #230 | greptile-apps[bot] | Miss | Did not flag Move cancel tracking boolean naming |
| #230 | cubic-dev-ai[bot] | Miss | Did not flag Move cancel tracking boolean naming |
| #230 | greptile-apps[bot] | Reject | Selection should remain mutation-gated on Reference Layers |
| #230 | coderabbitai[bot] | Accept | Clarify mutation-gate docs for Selection and Reference Layer semantics |
| #230 | cubic-dev-ai[bot] | Reject | Selection should remain mutation-gated on Reference Layers |
| #230 | coderabbitai[bot] | Accept | Rename selection drag boolean to read as user action |
| #230 | cubic-dev-ai[bot] | Accept | Marquee clipping should avoid i32 narrowing and overflow |
| #230 | cubic-dev-ai[bot] | Accept | pointercancel should cancel selection preview instead of committing |
| #230 | greptile-apps[bot] | Miss | Did not flag stroke-gate documentation clarity |
| #230 | cubic-dev-ai[bot] | Miss | Did not flag stroke-gate documentation clarity |
| #230 | greptile-apps[bot] | Miss | Did not flag ambiguous selection drag boolean |
| #230 | cubic-dev-ai[bot] | Miss | Did not flag ambiguous selection drag boolean |
| #230 | greptile-apps[bot] | Miss | Did not flag Marquee clipping overflow |
| #230 | coderabbitai[bot] | Miss | Did not flag Marquee clipping overflow |
| #230 | greptile-apps[bot] | Miss | Did not flag pointercancel committing selection preview |
| #230 | coderabbitai[bot] | Miss | Did not flag pointercancel committing selection preview |
| #229 | greptile-apps[bot] | Accept | Reorder Layer should not reclamp viewport after journal routing |
| #229 | greptile-apps[bot] | Accept | Persisted document UI changes should not sync metrics through shared follow-up |
| #229 | coderabbitai[bot] | Miss | Did not flag Reorder Layer viewport reclamp contract widening |
| #229 | cubic-dev-ai[bot] | Miss | Did not flag Reorder Layer viewport reclamp contract widening |
| #229 | coderabbitai[bot] | Miss | Did not flag persisted UI metric-sync contract widening |
| #229 | cubic-dev-ai[bot] | Miss | Did not flag persisted UI metric-sync contract widening |
| #226 | greptile-apps[bot] | Accept | Stale Reference underlay test describe title |
| #226 | coderabbitai[bot] | Accept | Projector retained source cache after no-underlay projection |
| #226 | coderabbitai[bot] | Reject | Sampling adapter out-of-bounds guard conflicts with SamplingPort contract |
| #226 | coderabbitai[bot] | Reject | Adapter out-of-bounds regression test conflicts with SamplingPort contract |
| #226 | coderabbitai[bot] | Accept | Public getter contract for Reference Layer Underlay was undocumented |
| #226 | coderabbitai[bot] | Miss | Did not flag stale Reference underlay test describe title |
| #226 | greptile-apps[bot] | Miss | Did not flag projector cache retention after no-underlay projection |
| #226 | cubic-dev-ai[bot] | Miss | Did not flag stale Reference underlay test describe title |
| #226 | cubic-dev-ai[bot] | Miss | Did not flag projector cache retention after no-underlay projection |
| #226 | greptile-apps[bot] | Miss | Did not flag public getter contract documentation gap |
| #226 | cubic-dev-ai[bot] | Miss | Did not flag public getter contract documentation gap |
| #225 | coderabbitai[bot] | Accept | PRD out-of-scope still listed Reference source color sampling |
| #225 | coderabbitai[bot] | Accept | try_get_pixel issue claimed Reference sampling matched composite path |
| #225 | greptile-apps[bot] | Accept | screenToCanvasPoint JS rounding could drift from Rust viewport transform |
| #225 | greptile-apps[bot] | Accept | touch pending draw used integer screenToCanvas instead of precise draw target |
| #225 | greptile-apps[bot] | Miss | Did not flag PRD out-of-scope contradiction |
| #225 | cubic-dev-ai[bot] | Miss | Did not flag PRD out-of-scope contradiction |
| #225 | greptile-apps[bot] | Miss | Did not flag stale try_get_pixel composite-path decision |
| #225 | cubic-dev-ai[bot] | Miss | Did not flag stale try_get_pixel composite-path decision |
| #225 | coderabbitai[bot] | Miss | Did not flag screenToCanvasPoint rounding drift |
| #225 | cubic-dev-ai[bot] | Miss | Did not flag screenToCanvasPoint rounding drift |
| #225 | coderabbitai[bot] | Miss | Did not flag touch pending draw integer target |
| #225 | cubic-dev-ai[bot] | Miss | Did not flag touch pending draw integer target |
| #224 | greptile-apps[bot] | Accept | Tool classification should derive from `TOOL_DEFS` |
| #224 | coderabbitai[bot] | Accept | Move no-op test needed non-empty Pixel Layer fixture |
| #224 | coderabbitai[bot] | Miss | Did not flag manual drawing-tool set divergence |
| #224 | greptile-apps[bot] | Miss | Did not flag weak Move no-op fixture |
| #224 | cubic-dev-ai[bot] | Miss | Did not flag manual drawing-tool set divergence |
| #224 | cubic-dev-ai[bot] | Miss | Did not flag weak Move no-op fixture |
| #223 | greptile-apps[bot] | Accept | renderVersion could clear draft before parent placement sync |
| #223 | coderabbitai[bot] | Miss | Did not flag draft clear race |
| #223 | cubic-dev-ai[bot] | Miss | Did not flag draft clear race |
| #131 | greptile-apps[bot] | Accept | Scoped CSS custom property for repeated #8a5d20 |
| #131 | cubic-dev-ai[bot] | Reject | Suggested `on:click` — Svelte 4 syntax, project uses Svelte 5 |
| #131 | cubic-dev-ai[bot] | Reject | Suggested `on:keydown` — same Svelte 4/5 confusion |
| #131 | coderabbitai[bot] | Reject | Claimed status:done conflicts with TopControlsRight — component not rendered |
| #131 | coderabbitai[bot] | Accept | Trim before stripKnownExtension — real trailing-space bug |
| #132 | greptile-apps[bot] | Accept | Form state resets visibly during close animation |
| #132 | greptile-apps[bot] | Reject | Global class names collision risk — names are specific enough |
| #132 | greptile-apps[bot] | Accept | Unused handleExport function — dead code |
| #132 | cubic-dev-ai[bot] | Accept | Form reset timing during close animation (duplicate of greptile) |
| #132 | coderabbitai[bot] | Reject | vaul-svelte Svelte 5 incompatibility — works correctly, tests pass |
| #134 | coderabbitai[bot] | Reject | "constrain tests" wording in RFC — function-name-derived modifier, clear in context |
| #134 | coderabbitai[bot] | Accept | isValidToolType uses `in` operator accepting prototype keys — regression from Set.has() |
| #134 | cubic-dev-ai[bot] | Accept | isValidToolType uses `in` operator (duplicate of coderabbit finding) |
| #134 | greptile-apps[bot] | Miss | Did not flag isValidToolType prototype key regression |
| #135 | coderabbitai[bot] | Reject | Rename `saved` to `isSaved` (persistence.ts) — past participle is idiomatic |
| #135 | coderabbitai[bot] | Reject | Rename `saved` to `isSaved` (types.ts) — same finding |
| #135 | coderabbitai[bot] | Accept | Migration test asserts via normalized read, not raw DB |
| #135 | coderabbitai[bot] | Accept | Await deleteDatabase before reopening in test |
| #135 | coderabbitai[bot] | Accept | Capture documentId before async flush to prevent stale index |
| #135 | cubic-dev-ai[bot] | Accept | Capture documentId before async flush (duplicate of coderabbit) |
| #135 | cubic-dev-ai[bot] | Accept | Migration test asserts via normalized read (duplicate of coderabbit) |
| #135 | cubic-dev-ai[bot] | Miss | Did not flag await deleteDatabase race condition |
| #135 | greptile-apps[bot] | Reject | dispose/flush race in onMount cleanup — pre-existing issue, out of scope |
| #135 | greptile-apps[bot] | Miss | Did not flag migration test raw DB assertion |
| #135 | greptile-apps[bot] | Miss | Did not flag await deleteDatabase race condition |
| #135 | greptile-apps[bot] | Miss | Did not flag stale index after async flush |
| #135 | cubic-dev-ai[bot] | Reject | Claimed greptile running totals mismatch — totals are correct |
| #136 | greptile-apps[bot] | Accept | Enter on Delete/Cancel triggers concurrent save race |
| #136 | cubic-dev-ai[bot] | Accept | Stale saveDialogTabIndex after closeTab during await |
| #136 | cubic-dev-ai[bot] | Accept | Enter-to-save not restricted to input (duplicate of greptile) |
| #136 | greptile-apps[bot] | Miss | Did not flag stale saveDialogTabIndex after closeTab |
| #136 | coderabbitai[bot] | Miss | Did not flag Enter-key concurrent save race |
| #136 | coderabbitai[bot] | Miss | Did not flag stale saveDialogTabIndex after closeTab |
| #136 | coderabbitai[bot] | Accept | Clear saveDialogTabIndex before closeTab in save path (consistency with delete) |
| #136 | greptile-apps[bot] | Miss | Did not flag stale index in save path |
| #136 | cubic-dev-ai[bot] | Miss | Did not flag stale index in save path |
| #137 | greptile-apps[bot] | Accept | Missing initial focus on dialog open |
| #137 | greptile-apps[bot] | Accept | No :focus-visible style on keyboard-focusable cards |
| #137 | greptile-apps[bot] | Miss | Did not flag async onDelete promise discard |
| #137 | greptile-apps[bot] | Miss | Did not flag hardcoded "Close" aria-label |
| #137 | greptile-apps[bot] | Miss | Did not flag missing aria-expanded on TopBar browse button |
| #137 | cubic-dev-ai[bot] | Accept | :focus-visible on cards (duplicate of greptile) |
| #137 | cubic-dev-ai[bot] | Accept | Async onDelete promise discard (duplicate of coderabbit) |
| #137 | cubic-dev-ai[bot] | Miss | Did not flag missing initial focus on dialog open |
| #137 | cubic-dev-ai[bot] | Miss | Did not flag hardcoded "Close" aria-label |
| #137 | cubic-dev-ai[bot] | Miss | Did not flag missing aria-expanded on TopBar browse button |
| #137 | coderabbitai[bot] | Accept | Async onDelete callback — promise discard on IndexedDB failure |
| #137 | coderabbitai[bot] | Accept | Hardcoded "Close" aria-label — i18n inconsistency |
| #137 | coderabbitai[bot] | Accept | Missing aria-expanded on TopBar browse button |
| #137 | coderabbitai[bot] | Miss | Did not flag missing initial focus on dialog open |
| #137 | coderabbitai[bot] | Miss | Did not flag :focus-visible on keyboard-focusable cards |
| #137 | coderabbitai[bot] | Accept | Stacked modal AT — move focus into alertdialog, hide parent from AT |
| #137 | coderabbitai[bot] | Accept | Nested interactive elements — card role="button" containing button |
| #137 | greptile-apps[bot] | Miss | Did not flag stacked modal AT issue |
| #137 | greptile-apps[bot] | Miss | Did not flag nested interactive elements in card |
| #137 | cubic-dev-ai[bot] | Miss | Did not flag stacked modal AT issue |
| #137 | cubic-dev-ai[bot] | Miss | Did not flag nested interactive elements in card |
| #137 | greptile-apps[bot] | Accept | Async delete promise discard — dialog stuck on failure |
| #137 | cubic-dev-ai[bot] | Miss | Did not flag async delete failure in confirmDelete |
| #137 | coderabbitai[bot] | Miss | Did not flag async delete failure in confirmDelete |
| #137 | coderabbitai[bot] | Reject | Claimed running totals mismatch — totals are correct, bot miscounted |
| #137 | coderabbitai[bot] | Reject | ResizeObserver for thumbnails — edge case, modal is fixed 640px width |
| #138 | greptile-apps[bot] | Accept | Race condition — stale close timer fires after sheet re-opened |
| #138 | greptile-apps[bot] | Accept | Accent color shifts from export to browse button via :first-of-type |
| #138 | greptile-apps[bot] | Miss | Did not flag ResizeObserver for responsive thumbnail redraw |
| #138 | cubic-dev-ai[bot] | Accept | Race condition — stale close timer (duplicate of greptile) |
| #138 | cubic-dev-ai[bot] | Miss | Did not flag ResizeObserver for responsive thumbnail redraw |
| #138 | cubic-dev-ai[bot] | Miss | Did not flag accent color :first-of-type regression |
| #138 | coderabbitai[bot] | Accept | Race condition — stale close timer (duplicate of greptile) |
| #138 | coderabbitai[bot] | Reject | Immediate drawerOpen=false — breaks close animation, pattern matches ExportBottomSheet |
| #138 | coderabbitai[bot] | Accept | ResizeObserver for thumbnails — now valid with responsive 2/3 column grid |
| #138 | coderabbitai[bot] | Miss | Did not flag accent color :first-of-type regression |
| #139 | greptile-apps[bot] | Accept | Missing pointercancel handler leaks drag state on iOS |
| #139 | greptile-apps[bot] | Accept | a[href] omitted from focusable selector |
| #139 | greptile-apps[bot] | Accept | Scroll lock never restored on component unmount |
| #139 | greptile-apps[bot] | Accept | Tab key handled twice when delete dialog inside BottomSheet |
| #139 | greptile-apps[bot] | Miss | Did not flag window listener leak on unmount |
| #139 | greptile-apps[bot] | Miss | Did not flag disabled/hidden form controls in selector |
| #139 | coderabbitai[bot] | Accept | Remove unused vaul-svelte dependency (already addressed) |
| #139 | coderabbitai[bot] | Accept | Window event listeners not cleaned on unmount during drag |
| #139 | coderabbitai[bot] | Accept | disabled/hidden form controls in focusable selector |
| #139 | coderabbitai[bot] | Accept | Capture and restore original body overflow value |
| #139 | coderabbitai[bot] | Reject | Test container cleanup — happy-dom resets DOM between files |
| #139 | coderabbitai[bot] | Miss | Did not flag pointercancel handler for iOS |
| #139 | coderabbitai[bot] | Miss | Did not flag a[href] in focusable selector |
| #139 | coderabbitai[bot] | Miss | Did not flag Tab double handling in delete dialog |
| #139 | cubic-dev-ai[bot] | Miss | Did not flag pointercancel handler |
| #139 | cubic-dev-ai[bot] | Miss | Did not flag a[href] selector |
| #139 | cubic-dev-ai[bot] | Miss | Did not flag scroll lock unmount |
| #139 | cubic-dev-ai[bot] | Miss | Did not flag window listener unmount |
| #139 | cubic-dev-ai[bot] | Miss | Did not flag Tab double handling |
| #139 | cubic-dev-ai[bot] | Miss | Did not flag disabled/hidden selector |
| #139 | coderabbitai[bot] | Reject | isTabbable function for hidden/inert/aria-hidden — scenarios don't occur in codebase |
| #140 | greptile-apps[bot] | Accept | Merge duplicate canvas-model imports in draw-tool.ts and tool-runner.svelte.ts |
| #140 | cubic-dev-ai[bot] | Miss | Did not flag duplicate canvas-model imports |
| #140 | coderabbitai[bot] | Miss | Did not flag duplicate canvas-model imports |
| #142 | greptile-apps[bot] | Accept | "Floating Panel" appears in both deprecated list and recommended component patterns — ambiguous |
| #142 | greptile-apps[bot] | Miss | Did not flag `globs:` non-standard frontmatter format |
| #142 | cubic-dev-ai[bot] | Accept | `globs:` frontmatter non-standard — switch to `paths:` + YAML list (duplicate of coderabbit finding) |
| #142 | cubic-dev-ai[bot] | Miss | Did not flag "Floating Panel" naming ambiguity |
| #142 | coderabbitai[bot] | Accept | Use `paths:` + YAML list per Anthropic docs, not `globs:` comma-separated |
| #142 | coderabbitai[bot] | Reject | Tagline "A pixel art editor." too minimal — user-intentional simplification, Future Directions covers positioning |
| #142 | coderabbitai[bot] | Miss | Did not flag "Floating Panel" naming ambiguity |
| #144 | greptile-apps[bot] | Accept | Weak canvas size assertion — `toContainText('24')` passes for partial resize |
| #144 | greptile-apps[bot] | Accept | Stale comment says "change color via palette" but code switches tools |
| #144 | greptile-apps[bot] | Reject | Hardcoded y=10 scan row — art area always starts below row 10 in current renderer |
| #144 | greptile-apps[bot] | Reject | Duplicate smoke test overlap — drawing.test adds status-size/tool checks |
| #144 | greptile-apps[bot] | Miss | Did not flag multi-step redo pixel verification gap |
| #144 | greptile-apps[bot] | Miss | Did not flag scanX clamp and boundary validation |
| #144 | cubic-dev-ai[bot] | Accept | Multi-step redo test lacks pixel verification after redo |
| #144 | cubic-dev-ai[bot] | Accept | Weak canvas size assertion — `toContainText('24')` (duplicate of greptile) |
| #144 | cubic-dev-ai[bot] | Accept | Weak preset size assertion — `toContainText('32')` misses one-axis failures |
| #144 | cubic-dev-ai[bot] | Miss | Did not flag stale comment in history test |
| #144 | cubic-dev-ai[bot] | Miss | Did not flag scanX clamp and boundary validation |
| #144 | coderabbitai[bot] | Accept | scanX not clamped to canvas bounds, artRight/artBottom not validated |
| #144 | coderabbitai[bot] | Accept | Multi-step redo test lacks canRedo and pixel verification (duplicate of cubic) |
| #144 | coderabbitai[bot] | Accept | Stale comment in history test (duplicate of greptile) |
| #144 | coderabbitai[bot] | Reject | Extract save dialog setup helper — 3 tests is acceptable repetition per project guidelines |
| #144 | coderabbitai[bot] | Miss | Did not flag weak canvas size assertions (32×32, 24×24) |
| #144 | coderabbitai[bot] | Miss | Did not flag weak preset size assertion (32) |
| #146 | coderabbitai[bot] | Accept | `curl \| sh` wasm-pack installer — replace with pinned `cargo install --locked` |
| #146 | coderabbitai[bot] | Accept | `bun install --frozen-lockfile` for deterministic CI |
| #146 | coderabbitai[bot] | Reject | Pin `ubuntu-latest` and `rust-toolchain@stable` (nitpick) — low-risk for current scope |
| #146 | coderabbitai[bot] | Miss | Did not flag missing dependency caching |
| #146 | greptile-apps[bot] | Accept | `curl \| sh` wasm-pack installer (duplicate of coderabbit) |
| #146 | greptile-apps[bot] | Accept | Missing dependency caching for cargo, wasm/target, Playwright |
| #146 | greptile-apps[bot] | Miss | Did not flag `bun install --frozen-lockfile` |
| #146 | cubic-dev-ai[bot] | Accept | `curl \| sh` wasm-pack installer (duplicate of coderabbit) |
| #146 | cubic-dev-ai[bot] | Miss | Did not flag `bun install --frozen-lockfile` |
| #146 | cubic-dev-ai[bot] | Miss | Did not flag missing dependency caching |
| #146 | greptile-apps[bot] | Accept | `wasm/target` cache path wrong — workspace target is at repo root |
| #146 | coderabbitai[bot] | Miss | Did not flag `wasm/target` workspace path error |
| #146 | cubic-dev-ai[bot] | Miss | Did not flag `wasm/target` workspace path error |
| #148 | coderabbitai[bot] | Accept | Landing row "responsive at 600px" understates 600/1024 breakpoints |
| #148 | coderabbitai[bot] | Reject | Deeper per-locale E2E assertions (H3, alt) — couples tests to copy; Paraglide compile-time prevents key miss |
| #148 | cubic-dev-ai[bot] | Accept | Editor mockup test only checks visibility, not asset load (`naturalWidth > 0`) |
| #148 | cubic-dev-ai[bot] | Reject | Claimed mockup should be decorative (`alt=""`) — image is informative, team provides translated alt |
| #148 | greptile-apps[bot] | Reject | `color: white` in `.cta` — literal appears in 15+ places across codebase, no `--ds-text-on-accent` token exists |
| #148 | greptile-apps[bot] | Miss | Did not flag platform-status landing row wording inaccuracy |
| #148 | greptile-apps[bot] | Miss | Did not flag editor mockup asset-load verification gap |
| #148 | cubic-dev-ai[bot] | Miss | Did not flag platform-status landing row wording inaccuracy |
| #148 | coderabbitai[bot] | Miss | Did not flag editor mockup asset-load verification gap |
| #149 | greptile-apps[bot] | Accept | `onclick` writes locale on middle-click / modifier-click — should guard non-primary clicks |
| #149 | coderabbitai[bot] | Accept | Scenario #1 says URL becomes `/ko/` but `routeStrategies` keeps URL at `/` |
| #149 | cubic-dev-ai[bot] | Accept | Scenario #1 URL inconsistency (duplicate of coderabbit) |
| #149 | greptile-apps[bot] | Miss | Did not flag Scenario #1 URL inconsistency |
| #149 | coderabbitai[bot] | Miss | Did not flag middle-click localStorage write on language selector |
| #149 | cubic-dev-ai[bot] | Miss | Did not flag middle-click localStorage write on language selector |
| #151 | greptile-apps[bot] | Accept | CSS grid template hardcoded to 9 — extract `--grid-columns` token |
| #151 | greptile-apps[bot] | Accept | `swatch--empty` class applied but has no CSS rule |
| #151 | greptile-apps[bot] | Miss | Did not flag commitTarget first-draw scoping |
| #151 | coderabbitai[bot] | Accept | Scope commitTarget to first-draw in liveSampleLifecycle (expresses pinned-once invariant) |
| #151 | coderabbitai[bot] | Reject | Extract makeRunner test helper — 5 setup sites are intentional variants, not identical duplication |
| #151 | coderabbitai[bot] | Reject | Add comment explaining `#each` index key — idiomatic on fixed-length 81-cell grid |
| #151 | coderabbitai[bot] | Miss | Did not flag hardcoded `repeat(9, ...)` invariant |
| #151 | coderabbitai[bot] | Miss | Did not flag `swatch--empty` without CSS rule |
| #151 | cubic-dev-ai[bot] | Miss | Did not flag hardcoded `repeat(9, ...)` invariant |
| #151 | cubic-dev-ai[bot] | Miss | Did not flag `swatch--empty` without CSS rule |
| #151 | cubic-dev-ai[bot] | Miss | Did not flag commitTarget first-draw scoping |
| #152 | greptile-apps[bot] | Accept | Inline `style:background-color` overrides `.cell--transparent` #FFFFFF base on cells and swatch |
| #152 | greptile-apps[bot] | Accept | Stale JSDoc on `cellFill` referring to "slices E/F" (duplicate of coderabbit) |
| #152 | greptile-apps[bot] | Miss | Did not flag E2E `.first()` palette-swatch default collision |
| #152 | greptile-apps[bot] | Miss | Did not flag test-count off-by-one in issue 066 Results (4 vs 5) |
| #152 | coderabbitai[bot] | Accept | Stale JSDoc on `cellFill` referring to "slices E/F" |
| #152 | coderabbitai[bot] | Miss | Did not flag inline style override on transparent/out-of-canvas cells |
| #152 | coderabbitai[bot] | Miss | Did not flag E2E `.first()` palette-swatch default collision |
| #152 | coderabbitai[bot] | Miss | Did not flag test-count off-by-one in issue 066 Results |
| #152 | cubic-dev-ai[bot] | Accept | Inline style overrides checkerboard base on transparent cells (duplicate of greptile) |
| #152 | cubic-dev-ai[bot] | Accept | E2E `.first()` palette-swatch default collision — add colorAHex + assertion |
| #152 | cubic-dev-ai[bot] | Accept | Test-count off-by-one in issue 066 Results (4 vs 5) |
| #152 | cubic-dev-ai[bot] | Miss | Did not flag stale JSDoc on `cellFill` |
| #153 | greptile-apps[bot] | Accept | Mouse-branch clamping absent — mirror touch pattern for degenerate viewports |
| #153 | greptile-apps[bot] | Accept | Clarify "right edge at 1300" test comment with full derivation |
| #153 | coderabbitai[bot] | Accept | `.hex` line-height: 16px — lock CHIP_HEIGHT_PX=24 contract vs ~17px default |
| #153 | greptile-apps[bot] | Miss | Did not flag `.hex` default line-height drift vs CHIP_HEIGHT_PX |
| #153 | coderabbitai[bot] | Miss | Did not flag mouse-branch missing clamp on degenerate viewports |
| #153 | coderabbitai[bot] | Miss | Did not flag misleading "right edge at 1300" test comment |
| #153 | cubic-dev-ai[bot] | Miss | Did not flag mouse-branch missing clamp on degenerate viewports |
| #153 | cubic-dev-ai[bot] | Miss | Did not flag misleading "right edge at 1300" test comment |
| #153 | cubic-dev-ai[bot] | Miss | Did not flag `.hex` default line-height drift vs CHIP_HEIGHT_PX |
| #153 | greptile-apps[bot] | Accept | Touch branch missing y-clamp after vertical flip — clips on mobile-portrait heights |
| #153 | coderabbitai[bot] | Miss | Did not flag touch-branch missing y-clamp (APPROVED review) |
| #153 | cubic-dev-ai[bot] | Miss | Did not flag touch-branch missing y-clamp |
| #156 | cubic-dev-ai[bot] | Accept | Y center axis uses artPixelsAcross instead of artPixelsDown — non-square art bug |
| #156 | greptile-apps[bot] | Accept | End pixel assertion compares against initialStartPixel — silently passes on uniform canvas |
| #156 | greptile-apps[bot] | Accept | WasmFilterResult.free() omitted — FinalizationRegistry mitigates but explicit free preferred for stroke-scoped object |
| #156 | cubic-dev-ai[bot] | Miss | Did not flag end pixel assertion using wrong initial reference |
| #156 | cubic-dev-ai[bot] | Miss | Did not flag WasmFilterResult.free() omission |
| #156 | greptile-apps[bot] | Miss | Did not flag Y center axis bug in artCenterFromGeometry |
| #157 | cubic-dev-ai[bot] | Accept | AC "middle preserved" vs "middle erased" ambiguity — resolved by English translation in amend |
| #157 | greptile-apps[bot] | Reject | `toCss` helper duplication — rule of three, defer until third PP test |
| #157 | greptile-apps[bot] | Reject | Missing pre-paint sanity assertion — contrast assertions already trap silent failure, pencil test has no such guard |
| #157 | greptile-apps[bot] | Miss | Did not flag AC/Key Decisions ambiguity from Korean wording |
| #157 | coderabbitai[bot] | Miss | Did not flag AC/Key Decisions ambiguity (rate-limited review) |
| #158 | greptile-apps[bot] | Accept | `aria-disabled="false"` rendered on enabled PP button — suppress with `\|\| undefined` (TopBar) |
| #158 | greptile-apps[bot] | Accept | `aria-disabled="false"` rendered on enabled PP button (AppBar, same finding as TopBar) |
| #158 | cubic-dev-ai[bot] | Accept | PP button remains clickable when aria-disabled — add component-level click guard |
| #158 | coderabbitai[bot] | Accept | PP button click guard (AppBar; "Also applies to: 75-83" covers TopBar) |
| #158 | cubic-dev-ai[bot] | Accept | platform-status.md "session-persisted" misdocuments IndexedDB-backed storage |
| #158 | greptile-apps[bot] | Miss | Did not flag PP button click guard |
| #158 | greptile-apps[bot] | Miss | Did not flag platform-status.md "session-persisted" misdocumentation |
| #158 | cubic-dev-ai[bot] | Miss | Did not flag `aria-disabled="false"` noise on enabled PP button |
| #158 | coderabbitai[bot] | Miss | Did not flag `aria-disabled="false"` noise on enabled PP button |
| #158 | coderabbitai[bot] | Miss | Did not flag platform-status.md "session-persisted" misdocumentation |
| #161 | greptile-apps[bot] | Accept | Missing exhaustive `default` in drawStart switch — null-deref risk if new DrawTool kind added |
| #161 | greptile-apps[bot] | Accept | `ToolContext` rebuilt per draw call in dragTransform (inconsistent with continuous opener) |
| #161 | coderabbitai[bot] | Accept | `FakePixelCanvas.get_pixel` hardcoded `{0,0,0,0}` — inconsistent with `pixels()`/`restore_pixels` state buffer |
| #161 | coderabbitai[bot] | Accept | Vacuous `restore_pixels` assertion in shapePreview test — use `restoreCalls.length` for real verification |
| #161 | coderabbitai[bot] | Accept | `ToolContext` rebuild in 3 non-continuous openers (duplicate of greptile finding) |
| #161 | coderabbitai[bot] | Reject | Length-validate `restore_pixels` input — "fail at the boundary, trust the core" applies to test stubs |
| #162 | greptile-apps[bot] | Accept | Hardcoded `artPixelCss = pixelSize*2` assumption — add runtime guard on even checker-tile span |
| #162 | greptile-apps[bot] | Reject | `Vec::remove` O(n) in filter loop — batch n~10, premature optimization per YAGNI |
| #162 | greptile-apps[bot] | Miss | Did not flag action emission order (same-batch revisit of reverted tip was wiped) |
| #162 | greptile-apps[bot] | Miss | Did not flag missing negative joint assertions for stair corners |
| #162 | greptile-apps[bot] | Miss | Did not flag "current filter" wording that contradicts the fix in test comment |
| #162 | coderabbitai[bot] | Accept | Emit actions in processing order — same-batch revisit of reverted tip was wiped |
| #162 | coderabbitai[bot] | Accept | Add negative assertions for stair joints (1,0), (2,1), (3,2) to complete PP contract |
| #162 | coderabbitai[bot] | Accept | Reword "the current filter reverts" → "the previous filter reverted" in test comment |
| #162 | coderabbitai[bot] | Miss | Did not flag hardcoded `artPixelCss` assumption |
| #162 | cubic-dev-ai[bot] | Miss | Did not flag hardcoded `artPixelCss` assumption |
| #162 | cubic-dev-ai[bot] | Miss | Did not flag action emission order (same-batch revisit wipe) |
| #162 | cubic-dev-ai[bot] | Miss | Did not flag missing negative joint assertions |
| #162 | cubic-dev-ai[bot] | Miss | Did not flag "current filter" wording in test comment |
| #163 | greptile-apps[bot] | Accept | `customTool` type-signature `spec` shadows outer config — rename to `strokeSpec` |
| #163 | coderabbitai[bot] | Accept | SessionHost JSDoc overstates "fields resolved at stroke begin" — `isShiftHeld` is live, collaborators are mutable |
| #163 | cubic-dev-ai[bot] | Accept | SessionHost JSDoc live vs snapshot contract (duplicate of coderabbit) |
| #163 | coderabbitai[bot] | Accept | Issue 076 note "ToolContext construction per sample" — actually per opened stroke session |
| #163 | greptile-apps[bot] | Miss | Did not flag SessionHost JSDoc live/snapshot contract |
| #163 | greptile-apps[bot] | Miss | Did not flag ToolContext lifecycle wording in issue 076 |
| #163 | coderabbitai[bot] | Miss | Did not flag `customTool` spec parameter shadowing |
| #163 | cubic-dev-ai[bot] | Miss | Did not flag `customTool` spec parameter shadowing |
| #163 | cubic-dev-ai[bot] | Miss | Did not flag ToolContext lifecycle wording in issue 076 |
| #164 | greptile-apps[bot] | Accept | `activeTabIndex` not bounds-checked on Workspace hydration — corrupt snapshot yields `undefined` activeTab |
| #164 | coderabbitai[bot] | Accept | session.test.ts explicit `notifyTabClosed` after `closeTab` masks auto-notifier regression |
| #164 | coderabbitai[bot] | Reject | `closeTab` index validation — internal API, project trusts internal callers per CLAUDE.md |
| #164 | greptile-apps[bot] | Miss | Did not flag test redundancy masking `Workspace.closeTab` auto-notifier path |
| #164 | coderabbitai[bot] | Miss | Did not flag `activeTabIndex` bounds-check gap on hydration |
| #164 | greptile-apps[bot] | Accept | Missing `foregroundColor` in `openSession` call — new users see dark-gray→black flick on fresh session |
| #164 | cubic-dev-ai[bot] | Accept | Clamp restored `activeTabIndex` on hydration (duplicate of greptile finding) |
| #164 | cubic-dev-ai[bot] | Reject | `closeTab` index validation (duplicate of coderabbitai rejection) — internal API, trust callers |
| #164 | cubic-dev-ai[bot] | Reject | `setActiveTab` index validation — internal API, same rationale as closeTab |
| #164 | coderabbitai[bot] | Miss | Did not flag missing `foregroundColor` in `openSession` call |
| #164 | cubic-dev-ai[bot] | Miss | Did not flag missing `foregroundColor` in `openSession` call |
| #165 | greptile-apps[bot] | Accept | Stale `.first()` reference in vacuous-pass guard comment — finding valid; fix taken differently (rewrote comment to describe invariant rather than chase selector name) |
| #165 | coderabbitai[bot] | Miss | Did not flag stale `.first()` reference in guard comment (APPROVED review) |
| #165 | cubic-dev-ai[bot] | Miss | Did not flag stale `.first()` reference in guard comment (APPROVED review) |
| #166 | coderabbitai[bot] | Accept | `pointercancel` routed to `pointerUp` → `onSampleEnd` commits color; should map to `onSampleCancel` like other disruption paths |
| #166 | greptile-apps[bot] | Miss | Did not flag `pointercancel` routing to commit path (APPROVED review) |
| #166 | cubic-dev-ai[bot] | Miss | Did not flag `pointercancel` routing to commit path (APPROVED review) |
| #167 | coderabbitai[bot] | Accept | Window resize during sampling — viewport stale until next pointer event; restore prior behavior |
| #167 | cubic-dev-ai[bot] | Accept | Window resize stale viewport (duplicate of coderabbit/greptile) |
| #167 | greptile-apps[bot] | Accept | Window resize stale viewport (duplicate of coderabbit/cubic) |
| #167 | coderabbitai[bot] | Accept | `commitTarget` non-reset rationale in `reset()` — added a one-line comment |
| #167 | coderabbitai[bot] | Reject | `as const` on loupe-config exports — no consumer narrows on literals, hypothetical benefit |
| #167 | cubic-dev-ai[bot] | Miss | Did not flag `commitTarget` non-reset rationale |
| #167 | greptile-apps[bot] | Miss | Did not flag `commitTarget` non-reset rationale |
| #168 | greptile-apps[bot] | Accept | Clear `referenceErrors` when References modal closes — stale banners on reopen |
| #168 | cubic-dev-ai[bot] | Accept | Clear `referenceErrors` on modal close (duplicate of greptile) |
| #168 | greptile-apps[bot] | Reject | `Promise.allSettled` for parallel imports — typical 1–5 file batches, simpler sequential control flow preferred |
| #168 | cubic-dev-ai[bot] | Accept | Thumbnail dimensions round to 0 for extreme aspect ratios — clamp to min 1px |
| #168 | cubic-dev-ai[bot] | Accept | Block elements (`div`/`p`) inside `<button class="empty-trigger">` — invalid HTML5 button content model |
| #168 | coderabbitai[bot] | Accept | Block elements inside `<button>` empty-trigger (duplicate of cubic) |
| #168 | coderabbitai[bot] | Reject | `onDelete` throws → focus loss — `onDelete` is sync in-memory mutation, no failure path |
| #168 | coderabbitai[bot] | Reject | `referenceErrors` global, not per-document — modal-close clear addresses primary case; per-tab scoping deferred to #056 |
| #168 | greptile-apps[bot] | Miss | Did not flag thumbnail 0-dim rounding bug |
| #168 | greptile-apps[bot] | Miss | Did not flag block-in-button HTML violation |
| #168 | coderabbitai[bot] | Miss | Did not flag stale `referenceErrors` on modal close |
| #168 | coderabbitai[bot] | Miss | Did not flag thumbnail 0-dim rounding bug |
| #168 | greptile-apps[bot] | Reject | Type duplication `ReferenceImageRecord` vs `ReferenceImage` — deliberate IDB↔app boundary, mirrors existing `ViewportRecord`/`SharedStateRecord` pattern |
| #168 | greptile-apps[bot] | Reject | Stale-entry load path in `session-persistence.ts` restore — writer rebuilds map each save, producer cannot create the state being defended against |
| #168 | coderabbitai[bot] | Accept | `.card-text` `<div>` inside `.card-open` `<button>` — same HTML5 phrasing-content rule as the empty-state, missed in earlier round |
| #168 | greptile-apps[bot] | Miss | Did not flag `.card-text` div-in-button violation |
| #168 | cubic-dev-ai[bot] | Miss | Did not flag `.card-text` div-in-button violation (caught the empty-state variant but missed the card variant) |
| #169 | greptile-apps[bot] | Accept | Duplicate `Placement` type — import from compute-initial-placement.ts |
| #169 | greptile-apps[bot] | Reject | `DisplayStateRecord` shape alias to `DisplayState` — deliberate persistence/domain boundary, mirrors `ReferenceImageRecord` pattern |
| #169 | greptile-apps[bot] | Reject | `show`/`close` unconditional `markDirty` guard — internal API, call site already guards via `displayStateFor` |
| #169 | greptile-apps[bot] | Miss | Did not flag Korean particle 을 → 을(를) alternation |
| #169 | greptile-apps[bot] | Miss | Did not flag missing JSDoc contract on `computeInitialPlacement` |
| #169 | greptile-apps[bot] | Miss | Did not flag missing left/top=0 assertion in fit-larger-than-viewport test |
| #169 | greptile-apps[bot] | Miss | Did not flag cascadeIndex collision when reopening after close |
| #169 | cubic-dev-ai[bot] | Miss | Did not flag duplicate `Placement` type |
| #169 | cubic-dev-ai[bot] | Miss | Did not flag Korean particle 을 → 을(를) alternation |
| #169 | cubic-dev-ai[bot] | Miss | Did not flag missing JSDoc on `computeInitialPlacement` |
| #169 | cubic-dev-ai[bot] | Miss | Did not flag missing left/top=0 assertion in fit test |
| #169 | cubic-dev-ai[bot] | Miss | Did not flag cascadeIndex collision when reopening after close |
| #169 | coderabbitai[bot] | Accept | Korean particle 을 → 을(를) alternation for vowel-final filenames |
| #169 | coderabbitai[bot] | Accept | JSDoc contract on `computeInitialPlacement` — non-obvious algorithm warrants doc |
| #169 | coderabbitai[bot] | Accept | objectUrl action duplication — defer to third consumer per "rule of three" |
| #169 | coderabbitai[bot] | Accept | Pin left/top=0 in "fits larger than viewport" overlay test |
| #169 | coderabbitai[bot] | Accept | Cascade index based on visible count collides with closed-but-tracked windows |
| #169 | coderabbitai[bot] | Reject | JSDoc on all public store methods — defaults to no comments unless WHY non-obvious |
| #169 | coderabbitai[bot] | Reject | `display()` upsert to prevent duplicate refId — internal API trusts caller's guard |
| #169 | coderabbitai[bot] | Reject | JSDoc on DisplayState fields — types are self-documenting |
| #169 | coderabbitai[bot] | Reject | `show()` no-op fallback when entry absent — same internal-API rationale |
| #169 | coderabbitai[bot] | Reject | Raise z-order on already-visible click — PRD #056 explicitly defers to #059 |
| #169 | coderabbitai[bot] | Miss | Did not flag duplicate `Placement` type |
| #172 | greptile-apps[bot] | Accept | Min-size floor breaks for negative/zero proposed dims (computeResize) |
| #172 | greptile-apps[bot] | Accept | Missing pointercancel/lostpointercapture handlers leak drag/resize state |
| #172 | greptile-apps[bot] | Accept | `touch-action: none` missing on `.title-bar` |
| #172 | cubic-dev-ai[bot] | Accept | Min-size floor breaks for negative/zero proposed dims (duplicate of greptile) |
| #172 | cubic-dev-ai[bot] | Accept | Missing pointercancel/lostpointercapture handlers (duplicate of greptile) |
| #172 | cubic-dev-ai[bot] | Accept | `touch-action: none` on `.title-bar` (duplicate of greptile) |
| #172 | coderabbitai[bot] | Accept | Min-size floor breaks for zero/negative proposed dims (duplicate of greptile) |
| #172 | coderabbitai[bot] | Accept | `touch-action: none` on `.title-bar` (duplicate of greptile) |
| #172 | coderabbitai[bot] | Miss | Did not flag missing pointercancel/lostpointercapture handlers |
| #173 | coderabbitai[bot] | Accept | Test-count off-by-three in 058 Results table (5 → 8) |
| #173 | coderabbitai[bot] | Accept | Add regression test asserting dblclick on title-bar buttons doesn't toggle minimize (`closest('button')` guard) |
| #173 | greptile-apps[bot] | Accept | Merge two adjacent `{#if !minimized}` blocks in ReferenceWindow.svelte |
| #173 | greptile-apps[bot] | Miss | Did not flag test-count off-by-three in 058 Results table |
| #173 | greptile-apps[bot] | Miss | Did not flag missing dblclick guard regression test |
| #173 | cubic-dev-ai[bot] | Miss | Did not flag test-count off-by-three in 058 Results table |
| #173 | cubic-dev-ai[bot] | Miss | Did not flag missing dblclick guard regression test |
| #173 | cubic-dev-ai[bot] | Miss | Did not flag adjacent `{#if !minimized}` block merge |
| #174 | coderabbitai[bot] | Accept | progress.md/issue 059 wording: store.show() is not idempotent — mutates zOrder above current max on every call |
| #174 | coderabbitai[bot] | Accept | Add regression test pinning displayed-card branch — extracted orchestration to pure selectReference helper for unit-testability |
| #174 | greptile-apps[bot] | Miss | Did not flag inaccurate "idempotent" show() wording (Confidence 5/5 — safe to merge) |
| #174 | greptile-apps[bot] | Miss | Did not flag missing regression test for displayed-card raise path |
| #174 | cubic-dev-ai[bot] | Miss | Did not flag inaccurate "idempotent" show() wording (APPROVED review) |
| #174 | cubic-dev-ai[bot] | Miss | Did not flag missing regression test for displayed-card raise path |
| #175 | greptile-apps[bot] | Accept | sampler.ts full-image getImageData allocates ~48 MB for 12 MP — use (x,y,1,1) for 4 bytes |
| #175 | greptile-apps[bot] | Miss | Did not flag `.resolves.toBeDefined()` with sync-feeling fireEvent.pointerDown |
| #175 | cubic-dev-ai[bot] | Accept | sampler.ts memory efficiency (duplicate of greptile) |
| #175 | cubic-dev-ai[bot] | Accept | `.resolves.toBeDefined()` test cleanup with fireEvent.pointerDown |
| #175 | cubic-dev-ai[bot] | Miss | Did not flag windowToImageCoords/samplePixel doc-comment gap |
| #175 | coderabbitai[bot] | Accept | windowToImageCoords export doc comments — matches sibling pure-utility convention |
| #175 | coderabbitai[bot] | Reject | latest-sample-wins token for sampleReferencePixel — explicitly deferred per issue Notes |
| #175 | coderabbitai[bot] | Reject | sampleReferencePixel method doc comment — inconsistent with TabState sibling-method convention |
| #175 | coderabbitai[bot] | Reject | handleSampleReference method doc comment — inconsistent with EditorController sibling-method convention |
| #175 | coderabbitai[bot] | Miss | Did not flag `.resolves.toBeDefined()` test cleanup |
| #176 | greptile-apps[bot] | Accept | `dispose()` leaves trackedId/origin/last/fired intact — post-dispose pointerUp can fire onEnd |
| #176 | greptile-apps[bot] | Accept | `pendingTapCoords` overwritten by simultaneous second touch — early release samples wrong location |
| #176 | coderabbitai[bot] | Reject | Rename "Blocked by" → "Dependencies (completed)" in issue 079 — established convention across `issues/` tree |
| #176 | cubic-dev-ai[bot] | Miss | Did not flag `dispose()` leaving non-timer state intact |
| #176 | cubic-dev-ai[bot] | Miss | Did not flag `pendingTapCoords` overwrite by simultaneous second touch |
| #176 | coderabbitai[bot] | Miss | Did not flag `dispose()` leaving non-timer state intact (APPROVED review) |
| #176 | coderabbitai[bot] | Miss | Did not flag `pendingTapCoords` overwrite by simultaneous second touch (APPROVED review) |
| #176 | greptile-apps[bot] | Accept | `pendingTapCoords` never cleared on `onEnd` — second long-press silently dropped after first success |
| #176 | cubic-dev-ai[bot] | Miss | Did not flag stale `pendingTapCoords` after `onEnd` (post-fix regression) |
| #176 | coderabbitai[bot] | Miss | Did not flag stale `pendingTapCoords` after `onEnd` (post-fix regression, APPROVED review) |
| #176 | coderabbitai[bot] | Accept | Pre-fire `pointercancel` commits a color sample — clear `pendingTapCoords` before forwarding to detector |
| #176 | greptile-apps[bot] | Miss | Did not flag pre-fire `pointercancel` committing a color sample |
| #176 | cubic-dev-ai[bot] | Miss | Did not flag pre-fire `pointercancel` committing a color sample |
| #176 | cubic-dev-ai[bot] | Accept | Coderabbitai Miss total off-by-one in Running Totals (42 vs 41 actual) |
| #176 | greptile-apps[bot] | Miss | Did not flag coderabbitai Miss total arithmetic mismatch |
| #176 | coderabbitai[bot] | Miss | Did not flag own Miss total arithmetic mismatch |
| #176 | cubic-dev-ai[bot] | Reject | Claimed `pointercancel` clear breaks short-tap commit — conflates `pointerup` (clean release, still commits) with W3C abnormal-termination semantics |
| #177 | greptile-apps[bot] | Reject | `waitForTimeout(200)` after IDB poll — rendered position already polled at lines 186-190; the 200ms is the final reactive-flush cushion, not a substitute for the assertion |
| #177 | greptile-apps[bot] | Accept | `handleDrop` calls `preventDefault` before file check across canvas-dropzone, ReferenceBrowser, ReferenceBrowserSheet — gate on `hasFiles` first for consistency with `handleDragOver` |
| #177 | coderabbitai[bot] | Accept | `canvas-dropzone.ts` `onDrop` calls `preventDefault` before payload-type check (duplicate of greptile pattern, applied to action variant) |
| #177 | coderabbitai[bot] | Accept | `docs/platform-status.md` documents importReferenceFiles return shape as `{refs, errors}` — actual export is `{imported, errors}` |
| #177 | coderabbitai[bot] | Accept | `tasks/progress.md` same `{refs, errors}` vs `{imported, errors}` doc mismatch |
| #177 | greptile-apps[bot] | Miss | Did not flag `{refs, errors}` doc mismatch in platform-status.md |
| #177 | greptile-apps[bot] | Miss | Did not flag `{refs, errors}` doc mismatch in tasks/progress.md |
| #177 | cubic-dev-ai[bot] | Miss | Did not flag `handleDrop` `preventDefault` before file check |
| #177 | cubic-dev-ai[bot] | Miss | Did not flag `{refs, errors}` doc mismatch in platform-status.md |
| #177 | cubic-dev-ai[bot] | Miss | Did not flag `{refs, errors}` doc mismatch in tasks/progress.md |
| #178 | greptile-apps[bot] | Accept | `const REFERENCE_LOUPE_CENTER_INDEX` declared mid-import-block — extracted shared `LOUPE_CENTER_INDEX` to loupe-config.ts |
| #178 | greptile-apps[bot] | Accept | `#referencePort` not cleared on early-return path in `referenceSampleEnd` — moved cleanup before isActive guard |
| #178 | coderabbitai[bot] | Accept | Reference loupe stays null until first pointermove — added `onpointerdown={pushReferencePointer}` to seed initial position |
| #178 | greptile-apps[bot] | Miss | Did not flag stale-coords risk on stationary long-press without onpointerdown |
| #178 | coderabbitai[bot] | Miss | Did not flag `REFERENCE_LOUPE_CENTER_INDEX` declaration in import block |
| #178 | coderabbitai[bot] | Miss | Did not flag asymmetric `#referencePort` cleanup in early-return path |
| #178 | cubic-dev-ai[bot] | Miss | Did not flag `REFERENCE_LOUPE_CENTER_INDEX` declaration in import block |
| #178 | cubic-dev-ai[bot] | Miss | Did not flag asymmetric `#referencePort` cleanup in early-return path |
| #178 | cubic-dev-ai[bot] | Miss | Did not flag stale-coords risk on stationary long-press without onpointerdown |
| #179 | greptile-apps[bot] | Reject | `pointercancel` for mouse commits sample — touch path also commits-on-leave per existing test; mirrors canvas Eyedropper |
| #179 | coderabbitai[bot] | Accept | platform-status.md `#refSampleSeq` race-handling note stale — split responsibility with `#endPending` |
| #179 | coderabbitai[bot] | Reject | Fast-click pending-commit uses down-coord not last-move-coord — consistent with canvas Eyedropper, sub-pixel impact after integer floor |
| #179 | greptile-apps[bot] | Miss | Did not flag stale `#refSampleSeq` race-handling note in platform-status.md |
| #179 | cubic-dev-ai[bot] | Miss | Did not flag stale `#refSampleSeq` race-handling note in platform-status.md |
| #180 | coderabbitai[bot] | Accept | Cancel previous reference sampling session before async decode — race during decode gap let move()/end() touch stale grid |
| #180 | cubic-dev-ai[bot] | Accept | Cancel previous session before await (duplicate of coderabbit) |
| #180 | cubic-dev-ai[bot] | Accept | Add mandatory AI-triage disclaimer to agent brief template per SKILL.md contract |
| #180 | coderabbitai[bot] | Reject | Refresh acceptance checklist post-shipping — Notes section already documents divergences; new template uses bullets without checkboxes |
| #180 | coderabbitai[bot] | Miss | Did not flag missing AI-triage disclaimer in agent brief template |
| #181 | greptile-apps[bot] | Accept | commitResize viewport cap doesn't account for off-origin position — window can extend past viewport edge |
| #181 | coderabbitai[bot] | Accept | commitResize viewport cap ignores anchored origin (duplicate of greptile) |
| #181 | cubic-dev-ai[bot] | Miss | Did not flag commitResize off-origin overflow |
| #181 | coderabbitai[bot] | Accept | createPlacement doc overstates sizing — small images stay at natural size, not `viewport_longer × 0.3` |
| #181 | cubic-dev-ai[bot] | Accept | createPlacement doc overstates sizing (duplicate of coderabbit) |
| #181 | greptile-apps[bot] | Miss | Did not flag createPlacement doc overstating sizing contract |
| #181 | coderabbitai[bot] | Accept | commitResize dominant-axis comparison wrong on shrink drags — pure single-axis shrink silently no-ops |
| #181 | cubic-dev-ai[bot] | Accept | commitResize dominant-axis on shrink drags (duplicate of coderabbit) |
| #181 | greptile-apps[bot] | Miss | Did not flag commitResize dominant-axis bug on shrink drags |
| #182 | coderabbitai[bot] | Accept | Refit `$effect` runs against stale default `tab.viewportSize` `{512, 512}` after openSession swap — would irreversibly shrink restored windows >512px before live DOM measurement; fix moved `refitAll` into `initTabViewport` (proposed gating-on-canvasContainerEl diff would have dropped browser-resize trigger) |
| #182 | greptile-apps[bot] | Miss | Did not flag refit-on-stale-default race (Confidence 4/5 — "safe to merge") |
| #182 | cubic-dev-ai[bot] | Miss | Did not flag refit-on-stale-default race (commented-only review) |
| #182 | cubic-dev-ai[bot] | Accept | Guard refitAll against zero/negative viewport sizes; transient ResizeObserver 0×0 tick could permanently collapse reference windows since refitPlacement only shrinks |
| #182 | coderabbitai[bot] | Miss | Did not flag refitAll zero-viewport guard (APPROVED review on commit e32a56b5) |
| #184 | greptile-apps[bot] | Accept | Double markDirty per resize — explicit notifier.markDirty after reclamp (which already emits via apply) |
| #184 | greptile-apps[bot] | Accept | Double markDirty in canvasReplaced path — persistableChanged sentinel fires on top of reclamp |
| #184 | greptile-apps[bot] | Miss | Did not flag setViewportSize markDirty on layout-only viewportSize |
| #184 | coderabbitai[bot] | Accept | Resize and canvas replacement notify dirty twice (combined A+B finding via reclamp + persistableChanged) |
| #184 | coderabbitai[bot] | Accept | setViewportSize markDirty turns DOM resize / tab switch into session save trigger |
| #184 | coderabbitai[bot] | Reject | "afterwards" → "afterward" American-English style — issue file is historical planning artifact |
| #184 | cubic-dev-ai[bot] | Accept | reclamp triggers markDirty on paths that already call markDirty (combined A+B) |
| #184 | cubic-dev-ai[bot] | Accept | setViewportSize markDirty marks tabs dirty for non-persisted viewport-size changes |
| #185 | greptile-apps[bot] | Accept | Resize leaves pre-resize snapshots in undo stack — canUndo returns true while applySnapshot silently rejects on dimension mismatch in release |
| #185 | greptile-apps[bot] | Reject | `columnCount` uses `rows[0].count` — `DefaultPalette.rows` is a static literal, empty case can't occur per CLAUDE.md |
| #185 | greptile-apps[bot] | Accept | `onChange(of: focusedField)` commits on focus-gain via sibling input — switch predicate to `oldValue == field` |
| #185 | greptile-apps[bot] | Miss | Did not flag verification claim overclaim (issue Notes vs PR plan macOS-only scope) |
| #185 | coderabbitai[bot] | Accept | Resize strands undo stack (duplicate of greptile / cubic — same finding) |
| #185 | coderabbitai[bot] | Accept | Narrow verification claim in issue Notes to macOS — iPadOS smoke test deferred per PR plan |
| #185 | coderabbitai[bot] | Miss | Did not flag `onChange(of: focusedField)` commit-on-focus-gain semantic |
| #185 | cubic-dev-ai[bot] | Accept | Resize leaves incompatible snapshots in undo history (duplicate of greptile / coderabbit) |
| #185 | cubic-dev-ai[bot] | Miss | Did not flag `onChange(of: focusedField)` commit-on-focus-gain semantic |
| #185 | cubic-dev-ai[bot] | Miss | Did not flag verification claim overclaim in issue Notes |
| #187 | greptile-apps[bot] | Accept | remove_layer error-discriminant: RemoveLastLayer guard fires before id check (duplicate of coderabbit) |
| #187 | greptile-apps[bot] | Accept | add_layer silently inserts duplicate UUIDs — added debug_assert! dev-tripwire |
| #187 | coderabbitai[bot] | Accept | remove_layer error-discriminant: resolve id before last-layer guard (duplicate of greptile) |
| #187 | coderabbitai[bot] | Accept | Layer struct + Layer::new lacked rustdoc for field defaults (visible=true, opacity=1.0) |
| #187 | coderabbitai[bot] | Accept | Document::new lacked rustdoc for non-obvious initial state (next_layer_number=2, timeline panel default) |
| #187 | greptile-apps[bot] | Miss | Did not flag missing rustdoc on Layer / Layer::new |
| #187 | greptile-apps[bot] | Miss | Did not flag missing rustdoc on Document::new |
| #187 | coderabbitai[bot] | Miss | Did not flag duplicate-UUID guard gap in add_layer |
| #187 | cubic-dev-ai[bot] | Miss | Did not flag remove_layer error-discriminant ordering |
| #187 | cubic-dev-ai[bot] | Miss | Did not flag duplicate-UUID guard gap in add_layer |
| #187 | cubic-dev-ai[bot] | Miss | Did not flag missing rustdoc on Layer / Layer::new |
| #187 | cubic-dev-ai[bot] | Miss | Did not flag missing rustdoc on Document::new |
| #188 | coderabbitai[bot] | Accept | Doc comment camelCase `nextLayerNumber` → snake_case `next_layer_number` |
| #188 | greptile-apps[bot] | Reject | Variant check ordering — panic after redo_stack push, hardening for catch_unwind out of scope |
| #188 | greptile-apps[bot] | Miss | Did not flag camelCase `nextLayerNumber` doc comment |
| #188 | cubic-dev-ai[bot] | Miss | Did not flag camelCase `nextLayerNumber` doc comment |
| #189 | greptile-apps[bot] | Accept | `WasmDocument::add_layer` silently inserts duplicate UUIDs — return JsError at boundary |
| #189 | cubic-dev-ai[bot] | Accept | Duplicate UUID guard in `add_layer` (duplicate of greptile) |
| #189 | cubic-dev-ai[bot] | Reject | Runtime guard against mixed canvas/document HistoryEntry paths — single-path-per-manager is intentional design with core panic guards |
| #189 | coderabbitai[bot] | Reject | Validate UUID is v4 specifically — generation strategy, not validation contract; non-v4 still functions as a unique id |
| #189 | coderabbitai[bot] | Accept | Doc comments on `WasmDocument::new` and index-based layer getters (`layer_*_at`) — error / out-of-range conditions |
| #189 | coderabbitai[bot] | Accept | Doc comments on `WasmHistoryManager` Document-snapshot methods — snapshot capture, redo-stack clear, None conditions |
| #189 | coderabbitai[bot] | Miss | Did not flag duplicate-UUID guard gap in `add_layer` |
| #189 | greptile-apps[bot] | Miss | Did not flag missing doc comments on `WasmDocument::new` and index-based layer getters |
| #189 | greptile-apps[bot] | Miss | Did not flag missing doc comments on `WasmHistoryManager` Document-snapshot methods |
| #189 | cubic-dev-ai[bot] | Miss | Did not flag missing doc comments on `WasmDocument::new` and index-based layer getters |
| #189 | cubic-dev-ai[bot] | Miss | Did not flag missing doc comments on `WasmHistoryManager` Document-snapshot methods |
| #189 | greptile-apps[bot] | Reject | Mixed canvas/document HistoryEntry paths cause uncatchable WASM panic + state corruption (re-raise of cubic finding with stronger arguments) — same rejection: panic path is unreachable from TS in this dead-code slice and will be statically removed in 091 |
| #190 | greptile-apps[bot] | Accept | `migrateV2ToV3` shares `Uint8Array` between V2 source and V3 layer — clone via `doc.pixels.slice()` |
| #190 | coderabbitai[bot] | Accept | V3 migration `Uint8Array` aliasing (duplicate of greptile finding) |
| #190 | coderabbitai[bot] | Reject | JSDoc `@param`/`@returns`/`@remarks` on `migrateV2ToV3` — restates type signature; current comment intentionally documents only non-obvious history-drop |
| #190 | cubic-dev-ai[bot] | Miss | Did not flag V3 migration `Uint8Array` aliasing (APPROVED review) |
| #191 | greptile-apps[bot] | Accept | Validation-order Notes in issue 101 oversimplified — clarified empty-first, per-layer scan (first-violation-wins on duplicate-id vs dimension-mismatch), then active id |
| #191 | coderabbitai[bot] | Reject | Add contract doc comment for `WasmDocumentBuilder::new(width, height)` — self-evident constructor; surrounding struct + `add_layer` / `build` docs already cover the contract |
| #191 | greptile-apps[bot] | Reject | WASM builder leak on `add_layer` error path — `wasm-bindgen` FinalizationRegistry reclaims; `build()` consumes `self` so try/finally `builder.free()` is unsafe on success; revisit in 091 with corrupt-schema policy |
| #191 | coderabbitai[bot] | Miss | Did not flag validation-order Notes oversimplification |
| #191 | cubic-dev-ai[bot] | Miss | Did not flag validation-order Notes oversimplification (auto-approved review) |
| #191 | greptile-apps[bot] | Accept | Follow-up: `try/finally + builder.free()` mechanics correction (`__destroy_into_raw()` zeroes `__wbg_ptr` → `free(null)` not double-free); loop-scoped `try/catch` pattern recorded in issue 091 Implementation notes |
| #192 | coderabbitai[bot] | Accept | tee primary swapped to `documentOps` so source-of-truth Document write decides stroke success |
| #192 | coderabbitai[bot] | Reject | "future date 2026-05-09" in `tasks/done.md` — today is 2026-05-09 per project context |
| #192 | coderabbitai[bot] | Accept | `Document::get_pixel` Rust doc states OOB → `Err(PixelCanvasError::OutOfBounds)` |
| #192 | coderabbitai[bot] | Accept | `WasmDocument::get_pixel` WASM doc states OOB → `Err(JsError)` |
| #192 | coderabbitai[bot] | Accept | TS `Document.get_pixel` doc states throws on OOB |
| #192 | coderabbitai[bot] | Reject | `activeLayerPixels` error message extra context — internal invariant guard, "trust internal code" |
| #192 | greptile-apps[bot] | Accept | `clear` test undo-after-clear restored: assert pre-clear pixel via `documentReplaced` active layer |
| #192 | greptile-apps[bot] | Reject | `pixelCanvas` active-layer vs `composite()` divergence — forward-looking, single-layer scope; render-cache rebuild switches to `composite()` in #094–097 |
| #192 | greptile-apps[bot] | Miss | Did not flag tee primary deciding stroke result from cache rather than truth |
| #192 | greptile-apps[bot] | Miss | Did not flag missing OOB error contract on `get_pixel` (Rust core) |
| #192 | greptile-apps[bot] | Miss | Did not flag missing OOB error contract on `get_pixel` (WASM facade) |
| #192 | greptile-apps[bot] | Miss | Did not flag missing OOB error contract on `get_pixel` (TS interface) |
| #192 | coderabbitai[bot] | Miss | Did not flag `clear` test undo coverage regression |
| #192 | cubic-dev-ai[bot] | Miss | Did not flag tee primary deciding stroke result from cache (no issues found across 18 files) |
| #192 | cubic-dev-ai[bot] | Miss | Did not flag missing OOB error contract on `get_pixel` (Rust core) |
| #192 | cubic-dev-ai[bot] | Miss | Did not flag missing OOB error contract on `get_pixel` (WASM facade) |
| #192 | cubic-dev-ai[bot] | Miss | Did not flag missing OOB error contract on `get_pixel` (TS interface) |
| #192 | cubic-dev-ai[bot] | Miss | Did not flag `clear` test undo coverage regression |
| #193 | cubic-dev-ai[bot] | Accept | Sidebar-only `overflow-y: auto` decouples sidebar rows from frame cells under overflow — moved scroll ownership to `.body` |
| #193 | coderabbitai[bot] | Miss | Did not flag sidebar/frame-area scroll-alignment regression (APPROVED review) |
| #193 | greptile-apps[bot] | Miss | Did not flag sidebar/frame-area scroll-alignment regression (Confidence 5/5) |
| #193 | greptile-apps[bot] | Accept | `.body` default `align-items: stretch` caps `.sidebar`/`.frame-area` at body height; rows squash under flex-shrink:1 or visible-overflow stays out of body's scrollHeight (Chromium) — set `align-items: flex-start` |
| #193 | cubic-dev-ai[bot] | Miss | Did not flag `.body` flex-stretch scroll-cap regression (APPROVED post-fix review) |
| #193 | greptile-apps[bot] | Accept | `.vdiv` empty divider collapsed to 0px under `.body { align-items: flex-start }` — added `align-self: stretch` so the column separator spans full body height |
| #193 | cubic-dev-ai[bot] | Reject | Revert `.body` to `align-items: stretch` — reintroduces the prior round's P1 (sidebar/frame-area scroll cap); divider regression handled by `align-self: stretch` on `.vdiv` alone |
| #193 | cubic-dev-ai[bot] | Miss | Did not flag `.vdiv` 0-px collapse in the same round (proposed reverting the parent's `align-items` instead of overriding on the empty child) |
| #194 | greptile-apps[bot] | Accept | Missing renderer-assumption guard in fixed tests — even-checker-tile invariant (`artPixelsAcross % 2 === 0`) silently relied on without diagnostic |
| #194 | coderabbitai[bot] | Accept | Factor geometry normalization into shared helper with even-checker-tile guard — partial (X-axis adopted; Y-axis rejected: viewport may crop at mid-pixel, `artPixelsDown` legitimately odd at default 27) |
| #194 | greptile-apps[bot] | Miss | Did not flag helper duplication / centralization opportunity (proposed adding the guard inline at each site) |
| #194 | cubic-dev-ai[bot] | Miss | Did not flag missing renderer-assumption guard (auto-approved 3050b0a) |
| #194 | cubic-dev-ai[bot] | Miss | Did not flag helper duplication / centralization opportunity (auto-approved 3050b0a + 4343d3c) |
| #195 | coderabbitai[bot] | Accept | `addLayer` does not re-derive `pixelCanvas` after `add_layer` switches active layer — invariant ("pixelCanvas reflects active layer") established by ctor + documentReplaced is broken |
| #195 | cubic-dev-ai[bot] | Accept | `pixelCanvas` not re-derived from new active layer after `addLayer` (duplicate of coderabbit) |
| #195 | greptile-apps[bot] | Miss | Did not flag `pixelCanvas`/active-layer desync after `addLayer` (Confidence 5/5, Safe to merge) |
| #196 | greptile-apps[bot] | Accept | `compositeBuffer` staleness — getter mixed captured `doc` with live `this.document` |
| #196 | coderabbitai[bot] | Accept | `compositeBuffer` staleness (duplicate of greptile) |
| #196 | coderabbitai[bot] | Accept | Guard `layer_pixels_at` instead of non-null asserting in `activeLayerPixels` |
| #196 | coderabbitai[bot] | Accept | Blank-tab detection misses hidden-layer content — added `TabState.isDocumentBlank()` iterating all layers |
| #196 | coderabbitai[bot] | Reject | Make canvas dimensions reactive to `renderVersion` — pre-existing pattern, not a 102 regression; parent template already subscribes via `PixelCanvasView` prop |
| #196 | cubic-dev-ai[bot] | Accept | Blank-tab detection misses hidden-layer content (duplicate of coderabbit) |
| #196 | cubic-dev-ai[bot] | Miss | Did not flag `compositeBuffer` staleness |
| #196 | greptile-apps[bot] | Miss | Did not flag `activeLayerPixels` non-null assertion guard |
| #196 | cubic-dev-ai[bot] | Miss | Did not flag `activeLayerPixels` non-null assertion guard |
| #196 | greptile-apps[bot] | Miss | Did not flag blank-tab hidden-layer content discard |
| #198 | coderabbitai[bot] | Reject | `FIXTURE_VIEWPORT` clone-per-call — no test mutates the shared object; defensive copy on every fixture call violates "don't validate scenarios that can't happen" |
| #198 | coderabbitai[bot] | Reject | `compositeV3` opacity clamp / buffer-length guard — function is internal (downstream of `normalizeToV3`); silent skip on malformed layers masks corruption rather than surfacing it |
| #198 | coderabbitai[bot] | Accept | `makeSingleLayerV3` leaves `activeLayerId` pointing at original layerId when callers override `layers` only — auto-derive from `overrides.layers[0].id` |
| #198 | coderabbitai[bot] | Accept | `normalizeToV3` misroutes unknown `schemaVersion` through `migrateV2ToV3` — throw on unsupported versions instead |
| #198 | coderabbitai[bot] | Accept | `tasks/progress.md` says "5 remaining" but lists 6 sub-issues (095/096/097/098/099/100) |
| #198 | greptile-apps[bot] | Miss | Did not flag `makeSingleLayerV3` `activeLayerId` inconsistency (Confidence 5/5, Safe to merge) |
| #198 | greptile-apps[bot] | Miss | Did not flag `normalizeToV3` unknown `schemaVersion` misrouting |
| #198 | greptile-apps[bot] | Miss | Did not flag `progress.md` count mismatch |
| #198 | cubic-dev-ai[bot] | Miss | Did not flag `makeSingleLayerV3` `activeLayerId` inconsistency (No issues found) |
| #198 | cubic-dev-ai[bot] | Miss | Did not flag `normalizeToV3` unknown `schemaVersion` misrouting |
| #198 | cubic-dev-ai[bot] | Miss | Did not flag `progress.md` count mismatch |
| #199 | coderabbitai[bot] | Accept | `createFakeDocument.set_active_layer` throws for valid id `'active'` — violates Document contract (throw only on unknown ids); proposed `if (id !== 'active') throw` |
| #199 | coderabbitai[bot] | Accept | Keyboard test claims "focused row" but never focuses — added `rowB.focus()` + `document.activeElement` assertion + `toHaveBeenCalledTimes(1)` per key |
| #199 | greptile-apps[bot] | Reject | `handleActivateLayer` lacks try/catch for `set_active_layer` throw — forward-looking (095 race), project convention is "don't design for hypothetical future requirements" |
| #199 | greptile-apps[bot] | Miss | Did not flag `createFakeDocument.set_active_layer` contract violation |
| #199 | greptile-apps[bot] | Miss | Did not flag keyboard test focus-path assertion gap |
| #199 | cubic-dev-ai[bot] | Miss | Did not flag `createFakeDocument.set_active_layer` contract violation (auto-approved) |
| #199 | cubic-dev-ai[bot] | Miss | Did not flag keyboard test focus-path assertion gap (auto-approved) |
| #200 | greptile-apps[bot] | Accept | Keyboard activation on remove button bubbles to row handler; row's `preventDefault()` even blocks keyboard removal |
| #200 | coderabbitai[bot] | Accept | Keyboard activation on remove button bubbles to row handler (duplicate of greptile) |
| #200 | cubic-dev-ai[bot] | Accept | Keyboard activation on remove button bubbles to row handler (duplicate of greptile) |
| #200 | coderabbitai[bot] | Reject | Validate layer id before snapshotting — violates "trust the core"; WASM throws on unknown ids; UI never passes invalid ids |
| #200 | coderabbitai[bot] | Accept | Add doc comment to `TabState.removeLayer` (last-layer no-op, throws on unknown id, side effects) |
| #200 | coderabbitai[bot] | Accept | Add keyboard-path regression test for remove-button non-activation |
| #200 | greptile-apps[bot] | Miss | Did not flag missing `removeLayer` doc comment |
| #200 | greptile-apps[bot] | Miss | Did not flag missing keyboard-path regression test |
| #200 | cubic-dev-ai[bot] | Miss | Did not flag missing `removeLayer` doc comment |
| #200 | cubic-dev-ai[bot] | Miss | Did not flag missing keyboard-path regression test |
| #202 | greptile-apps[bot] | Accept | `aria-pressed` + dynamic `aria-label` produces conflicting screen-reader state announcement on visibility toggle (WAI-ARIA APG) |
| #202 | cubic-dev-ai[bot] | Accept | `aria-pressed` + dynamic `aria-label` conflict (duplicate of greptile) |
| #202 | coderabbitai[bot] | Reject | `set_layer_visibility` doc should mention malformed-UUID error path — matches established WASM facade convention (sibling methods all omit it); parser-glue error not part of public contract |
| #202 | coderabbitai[bot] | Miss | Did not flag `aria-pressed` + dynamic `aria-label` conflict on visibility toggle |
| #203 | greptile-apps[bot] | Reject | No visual feedback during pointer drag — out of issue 098 scope; design spec 092 has no drag indicator; defer to follow-up |
| #203 | greptile-apps[bot] | Accept | `handlePointerUp` used last `pointermove` Y instead of the release event's own `clientY` — release at a different Y reordered to wrong target |
| #203 | coderabbitai[bot] | Reject | Add API doc comment to exported `MobileTab` type — string-literal union is self-documenting; project reserves doc comments for non-obvious contracts |
| #203 | coderabbitai[bot] | Accept | Track initiating `pointerId` so a second touch cannot steal or reset an in-flight drag (multi-touch safety) |
| #203 | coderabbitai[bot] | Miss | Did not flag stale `pointermove` Y on release |
| #203 | greptile-apps[bot] | Miss | Did not flag missing `pointerId` tracking against multi-touch drag interference |
| #203 | cubic-dev-ai[bot] | Miss | Did not flag stale `pointermove` Y on release |
| #203 | cubic-dev-ai[bot] | Miss | Did not flag missing `pointerId` tracking against multi-touch drag interference |
| #203 | coderabbitai[bot] | Accept | Add intermediate `not.toHaveBeenCalled()` after secondary pointer release in multi-pointer test — catches a regression where the pointerId guard on pointerup is dropped |
| #203 | greptile-apps[bot] | Miss | Did not flag false-positive risk in multi-pointer test (no intermediate assertion) |
| #203 | cubic-dev-ai[bot] | Miss | Did not flag false-positive risk in multi-pointer test (no intermediate assertion) |
| #204 | coderabbitai[bot] | Accept | Add `aria-expanded` to chevron toggle — disclosure-pattern standard; aria-label swap alone is not the canonical state signal for screen readers |
| #204 | greptile-apps[bot] | Reject | `.header-label` overflow on long layer names when collapsed — layer rename is M3 out-of-scope; all names follow the fixed `layer_default_name` i18n pattern, cannot overflow 32px header |
| #204 | greptile-apps[bot] | Reject | Trailing separator (`Layers · `) if `activeLayerName` falls back to empty — TabState invariant guarantees `activeLayerId ∈ layers` and rename out-of-scope keeps names non-empty; defensive fallback would silence a real bug |
| #204 | cubic-dev-ai[bot] | Reject | Same trailing-separator concern as greptile (line 139 site) — same rationale: TabState invariant + rename out-of-scope |
| #204 | greptile-apps[bot] | Miss | Did not flag missing `aria-expanded` on chevron toggle |
| #204 | cubic-dev-ai[bot] | Miss | Did not flag missing `aria-expanded` on chevron toggle |
| #204 | coderabbitai[bot] | Reject | Lock-in: collapsed state stuck after desktop→mobile viewport — desktop/mobile renders are separate TimelinePanel instances under `{#if layout.isDocked}` / `{:else}`, so viewport change unmounts the desktop instance and remounts the mobile one with default `isCollapsed=false` |
| #205 | coderabbitai[bot] | Accept | Mobile honors persisted `collapsed` flag while chevron is hidden under `@media (max-width: 1023px)` — collapsed document renders header-only with no in-UI path to expand. Fixed by forcing `collapsed={false}` at the mobile call site (PRD-086 makes the LAYERS tab the sole mobile toggle) |
| #205 | greptile-apps[bot] | Miss | Did not flag mobile collapse lock-in (chevron hidden + persisted flag honored at the mobile call site) |
| #205 | cubic-dev-ai[bot] | Miss | Did not flag mobile collapse lock-in (chevron hidden + persisted flag honored at the mobile call site) |
| #206 | greptile-apps[bot] | Accept | `ReferenceData::new` `usize` overflow on wasm32 — `u32×u32×4` cast to `usize` silently wraps on 32-bit; mis-sized `source_rgba` could pass validation. Fix uses `checked_mul` + new `DimensionsTooLarge` variant |
| #206 | cubic-dev-ai[bot] | Accept | Same `usize` overflow as greptile (duplicate finding on `layer.rs:104`) |
| #206 | coderabbitai[bot] | Accept | Same `usize` overflow as greptile (nit, duplicate finding on `layer.rs:104`) |
| #206 | cubic-dev-ai[bot] | Reject | `unreachable!` on Reference-active pixel APIs (`document.rs:307`) — intentional guard per #107 Key Decisions; `WasmDocumentBuilder::add_layer` is Pixel-only, no shell path reaches it; boundary validation deferred to #110 |
| #206 | greptile-apps[bot] | Reject | `from_layers` does not enforce Pixel-active (outside-diff, `document.rs:140-142`) — paired with #107's intentional `unreachable!` design; deferred to #110 with Reference UI |
| #205 | cubic-dev-ai[bot] | Reject | Suggested reverting `collapsed={false}` mobile guard as a regression — would re-introduce the lock-in coderabbit flagged earlier in the same PR; PRD-086 makes the LAYERS tab the sole mobile toggle |
| #207 | greptile-apps[bot] | Reject | `debug_assert!(scale > 0.0)` on `with_scale` — interior value type per "fail at the boundary"; 8×8 min projected size enforced at placement overlay (issues 120-122); claimed scale=0 round-trip shift is incorrect (center invariant holds even at the pathological input) |
| #207 | coderabbitai[bot] | Reject | Parameters/Returns/"Error conditions: None" doc blocks on builders — rust-conventions explicitly skip when signature speaks and forbid restating Result/Option semantics; `restore_to_natural`'s non-obvious center-preserving behavior is already documented |
| #208 | greptile-apps[bot] | Reject | `placement.scale = 0/NaN/∞` guard — type-level concern; fix belongs in `ReferencePlacement` constructor per "type system over runtime validation" + "trust the core". Filed in todo backlog. Also NaN→u32 is well-defined saturating cast (NaN→0) since Rust 1.45, not UB |
| #208 | greptile-apps[bot] | Accept | Widen `source_y * width` index math to usize before the multiply — canvas's u32 pattern is safe under `MAX_DIMENSION=256` but sampler operates on arbitrary source dims |
| #208 | greptile-apps[bot] | Accept | Add y-axis OOB test (`y >= height`) symmetric with the right-edge test — defends against a future width/height swap in the guard |
| #208 | coderabbitai[bot] | Reject | `placement.scale` guard (duplicate of greptile P1) — fix belongs in `ReferencePlacement` constructor per type-system rule |
| #208 | coderabbitai[bot] | Reject | Validate `source_rgba.len()` before indexing — violates "trust the core"; Document maintains the dims-vs-buffer-length invariant via `add_reference_layer` |
| #208 | coderabbitai[bot] | Miss | Did not flag `source_y * width` u32 overflow on large source dims |
| #208 | coderabbitai[bot] | Miss | Did not flag missing y-axis OOB test |
| #208 | cubic-dev-ai[bot] | Reject | `placement.scale` guard (duplicate of greptile P1) — fix belongs in `ReferencePlacement` constructor per type-system rule |
| #208 | cubic-dev-ai[bot] | Miss | Did not flag `source_y * width` u32 overflow on large source dims |
| #208 | cubic-dev-ai[bot] | Miss | Did not flag missing y-axis OOB test |
| #209 | coderabbitai[bot] | Reject | `debug_assert!` → `assert!` on `add_reference_layer` duplicate-ID guard — internal mutation path with caller-supplied fresh `Uuid::new_v4()`; "trust the core" precondition. Boundary check already lives in `Document::from_layers` (`DocumentBuildError::DuplicateLayerId`); sibling `add_layer` uses same `debug_assert!` since layer system landed |
| #211 | greptile-apps[bot] | Accept | Stale `.Codex/skills/` branch-rule exception path |
| #211 | cubic-dev-ai[bot] | Accept | Stale `.Codex/skills/` branch-rule exception path (duplicate of greptile) |
| #211 | coderabbitai[bot] | Accept | Stale `.Codex/skills/` branch-rule exception path (duplicate of greptile) |
| #211 | greptile-apps[bot] | Accept | Incorrect `anthropics/Codex#34912` issue reference in task-done skill |
| #211 | cubic-dev-ai[bot] | Miss | Did not flag incorrect `anthropics/Codex#34912` issue reference |
| #211 | coderabbitai[bot] | Miss | Did not flag incorrect `anthropics/Codex#34912` issue reference |
| #212 | coderabbitai[bot] | Accept | Pixel branch in optional sampler swallowed impossible in-bounds canvas read failures |
| #212 | greptile-apps[bot] | Miss | Did not flag swallowed Pixel Layer invariant break in optional sampler |
| #212 | cubic-dev-ai[bot] | Miss | Did not flag swallowed Pixel Layer invariant break in optional sampler |
| #212 | greptile-apps[bot] | Reject | Claimed PR #212 metrics rows were fabricated before reviews occurred |
| #213 | greptile-apps[bot] | Reject | Narrow `layer_kind_at` TS return type — generated wasm-bindgen type is `string | undefined`, and structural compatibility is the binding contract |
| #213 | greptile-apps[bot] | Reject | Fake document `layer_kind_at(0)` should return undefined — fake models a single Pixel Layer, so `"pixel"` is faithful |
| #213 | greptile-apps[bot] | Reject | Validate `source_rgba` length in WASM facade — core already validates and facade maps the error to `JsError` |
| #213 | greptile-apps[bot] | Reject | Issue-level duplicate of WASM `source_rgba` length validation finding |
| #213 | greptile-apps[bot] | Miss | Did not flag invalid placement scale at the new WASM boundary |
| #213 | coderabbitai[bot] | Reject | Narrow `layer_kind_at` TS return type — generated wasm-bindgen type prevents literal-union structural compatibility |
| #213 | coderabbitai[bot] | Miss | Did not flag invalid placement scale at the new WASM boundary |
| #213 | cubic-dev-ai[bot] | Accept | Validate Reference Layer placement scale at the WASM boundary before writing it into core state |
| #214 | greptile-apps[bot] | Accept | Add `StoredDocument` comment for V4 storage wiring dependency |
| #214 | coderabbitai[bot] | Accept | Remove erroneous `Closes #114` keyword that targets an unrelated GitHub PR |
| #214 | coderabbitai[bot] | Reject | Docstring coverage threshold — repo has no such gate; required checks pass |
| #214 | coderabbitai[bot] | Miss | Did not flag V4 `StoredDocument` storage-wiring dependency |
| #214 | greptile-apps[bot] | Miss | Did not flag PR body closing an unrelated GitHub PR |
| #214 | cubic-dev-ai[bot] | Miss | Did not flag V4 `StoredDocument` storage-wiring dependency |
| #214 | cubic-dev-ai[bot] | Miss | Did not flag PR body closing an unrelated GitHub PR |
| #215 | cubic-dev-ai[bot] | Accept | Non-finite Reference Layer placement x/y could enter core through the V4 hydration WASM boundary |
| #215 | greptile-apps[bot] | Accept | Explicit `ReferenceLayerSnapshot` predicate clarifies workspace hydration; compile-failure claim was overstated |
| #215 | greptile-apps[bot] | Miss | Did not flag non-finite Reference Layer placement x/y at the V4 hydration boundary |
| #215 | coderabbitai[bot] | Miss | Did not flag non-finite Reference Layer placement x/y at the V4 hydration boundary |
| #215 | cubic-dev-ai[bot] | Miss | Did not flag explicit `ReferenceLayerSnapshot` predicate clarity in workspace hydration |
| #215 | coderabbitai[bot] | Miss | Did not flag explicit `ReferenceLayerSnapshot` predicate clarity in workspace hydration |
| #217 | cubic-dev-ai[bot] | Accept | Restore Reference Layer thumbnail exclusion note in platform status |
| #217 | coderabbitai[bot] | Accept | Rename noun-style test helper to action-style `makePixelRgba` |
| #217 | coderabbitai[bot] | Miss | Did not flag platform-status thumbnail exclusion wording regression |
| #217 | greptile-apps[bot] | Miss | Did not flag platform-status thumbnail exclusion wording regression |
| #217 | cubic-dev-ai[bot] | Miss | Did not flag noun-style `pixel` test helper name |
| #217 | greptile-apps[bot] | Miss | Did not flag noun-style `pixel` test helper name |
| #218 | greptile-apps[bot] | Accept | Multi-tab Reference raster cache single-entry thrashes across alternating tabs |
| #218 | greptile-apps[bot] | Accept | Renderer tests did not reset module-level Reference raster cache |
| #218 | coderabbitai[bot] | Miss | Did not flag multi-tab Reference raster cache thrash |
| #218 | coderabbitai[bot] | Miss | Did not flag renderer test cache reset gap |
| #218 | cubic-dev-ai[bot] | Miss | Did not flag multi-tab Reference raster cache thrash |
| #218 | cubic-dev-ai[bot] | Miss | Did not flag renderer test cache reset gap |
| #218 | coderabbitai[bot] | Accept | `Document::reorder_layer` docs missing Reference fixed-bottom clamp contract |
| #218 | coderabbitai[bot] | Accept | `ReferenceUnderlay` interface docs missing source and opacity invariants |
| #218 | coderabbitai[bot] | Accept | `TabState.setReferencePlacement` missing public contract doc |
| #218 | coderabbitai[bot] | Accept | V4 Reference normalization test did not assert Pixel Layer order preservation |
| #218 | greptile-apps[bot] | Miss | Did not flag `reorder_layer` doc contract gap |
| #218 | greptile-apps[bot] | Miss | Did not flag `ReferenceUnderlay` interface doc contract gap |
| #218 | greptile-apps[bot] | Miss | Did not flag `setReferencePlacement` doc contract gap |
| #218 | greptile-apps[bot] | Miss | Did not flag V4 normalization Pixel order assertion gap |
| #218 | cubic-dev-ai[bot] | Miss | Did not flag `reorder_layer` doc contract gap |
| #218 | cubic-dev-ai[bot] | Miss | Did not flag `ReferenceUnderlay` interface doc contract gap |
| #218 | cubic-dev-ai[bot] | Miss | Did not flag `setReferencePlacement` doc contract gap |
| #218 | cubic-dev-ai[bot] | Miss | Did not flag V4 normalization Pixel order assertion gap |
| #218 | coderabbitai[bot] | Accept | `clearReferenceRasterCache` missing public cache-clearing contract doc |
| #218 | greptile-apps[bot] | Miss | Did not flag `clearReferenceRasterCache` public doc contract gap |
| #218 | cubic-dev-ai[bot] | Miss | Did not flag `clearReferenceRasterCache` public doc contract gap |
| #219 | greptile-apps[bot] | Accept | Misleading non-reactive `void tab.renderVersion` read in event-handler helper |
| #219 | greptile-apps[bot] | Accept | Reference Layer error toasts used index keys and message-based timeout dismissal |
| #219 | coderabbitai[bot] | Accept | `ReferenceLayerSource` missing public API contract doc |
| #219 | coderabbitai[bot] | Miss | Did not flag non-reactive `renderVersion` read |
| #219 | coderabbitai[bot] | Miss | Did not flag unstable Reference Layer toast keys and dismissal ids |
| #219 | cubic-dev-ai[bot] | Miss | Did not flag non-reactive `renderVersion` read |
| #219 | cubic-dev-ai[bot] | Miss | Did not flag unstable Reference Layer toast keys and dismissal ids |
| #219 | greptile-apps[bot] | Miss | Did not flag `ReferenceLayerSource` public doc contract gap |
| #219 | cubic-dev-ai[bot] | Miss | Did not flag `ReferenceLayerSource` public doc contract gap |
| #220 | coderabbitai[bot] | Reject | Completion date uses project-local Asia/Seoul date, not GitHub UTC timeline |
| #220 | greptile-apps[bot] | Accept | Add debug assertion for non-zero fit-to-canvas dimensions |
| #220 | coderabbitai[bot] | Miss | Did not flag non-zero fit-to-canvas dimension precondition |
| #220 | cubic-dev-ai[bot] | Miss | Did not flag non-zero fit-to-canvas dimension precondition |
| #220 | cubic-dev-ai[bot] | Reject | `assert!` would duplicate boundary validation inside trusted core geometry helper |
| #221 | greptile-apps[bot] | Accept | `touch-action: none` missing on Reference placement overlay |
| #221 | coderabbitai[bot] | Accept | `touch-action: none` missing on Reference placement overlay (duplicate of greptile) |
| #221 | cubic-dev-ai[bot] | Accept | `touch-action: none` missing on Reference placement overlay (duplicate of greptile) |
| #221 | greptile-apps[bot] | Accept | Issue-level duplicate of Reference placement overlay `touch-action: none` finding |
| #221 | greptile-apps[bot] | Accept | Stale `pendingOverlayTouch` could inject a ghost pointer after overlay unmount |
| #221 | greptile-apps[bot] | Accept | Issue-level duplicate of stale `pendingOverlayTouch` ghost pointer finding |
| #221 | coderabbitai[bot] | Miss | Did not flag stale `pendingOverlayTouch` ghost pointer |
| #221 | cubic-dev-ai[bot] | Miss | Did not flag stale `pendingOverlayTouch` ghost pointer |
| #221 | cubic-dev-ai[bot] | Accept | Window-level `pointercancel` could cancel unrelated active canvas interaction |
| #221 | greptile-apps[bot] | Accept | Overlay blocked wheel/trackpad viewport navigation while Reference Layer was active |
| #221 | greptile-apps[bot] | Miss | Did not flag unrelated window `pointercancel` cancelling active canvas interaction |
| #221 | coderabbitai[bot] | Miss | Did not flag unrelated window `pointercancel` cancelling active canvas interaction |
| #221 | coderabbitai[bot] | Miss | Did not flag overlay wheel/trackpad viewport navigation gap |
| #221 | cubic-dev-ai[bot] | Miss | Did not flag overlay wheel/trackpad viewport navigation gap |
| #222 | greptile-apps[bot] | Accept | Escape/pointercancel tests did not start an active Reference body drag |
| #222 | coderabbitai[bot] | Miss | Did not flag inactive Reference body drag cancel tests |
| #222 | cubic-dev-ai[bot] | Miss | Did not flag inactive Reference body drag cancel tests |
