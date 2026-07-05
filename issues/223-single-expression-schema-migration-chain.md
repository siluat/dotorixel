---
title: "Say the schema-migration chain once"
status: ready-for-agent
created: 2026-07-05
---

## Problem Statement

The per-record migration functions (`migrateDocumentToV2` … `migrateV6ToV7`)
are already shared, but their **orchestration** is written twice in
`src/lib/session/session-storage.ts`:

1. `normalizeToV7` (read path, :33–52) — nested-call dispatch per stored
   version, including the V5 quirk (V5 records re-enter `migrateV4ToV5` to
   re-normalize legacy Reference Layer order).
2. The IDB `upgrade` handler (:61–148) — seven ordered `if (oldVersion < n)`
   blocks, each opening a fresh cursor over the whole store (7 full scans),
   with the V5 quirk hand-mirrored at :120–123.

Every new schema version edits both in lockstep. The upgrade blocks also
disagree on error policy: V5→V6 and V6→V7 skip unmigratable records
(`console.warn`, "One unmigratable record must not abort the whole upgrade"),
but a corrupt V2–V4 record throws out of `upgrade` and fails the DB open
entirely.

A third duplication lives in `src/lib/session/session-persistence.ts`:
`getSavedDocumentSnapshot` (:213–230) and `restore` (:236–294) both map a
`DocumentRecord` to a `TabSnapshot` field-by-field (11 identical fields);
only the `viewport` source differs (DEFAULT_VIEWPORT vs the workspace
record's per-tab viewport with the onion-skin backfill).

## Solution

### 1. The upgrade handler reuses `normalizeToV7` in a single pass

`normalizeToV7` is pure and synchronous — it already *is* the chain's single
expression. The upgrade handler keeps only DDL per version and replaces the
seven cursor blocks with one pass:

```typescript
async upgrade(db, oldVersion, _newVersion, tx) {
    if (oldVersion < 1) {
        const docStore = db.createObjectStore('documents', { keyPath: 'id' });
        docStore.createIndex('updatedAt', 'updatedAt');
        db.createObjectStore('workspace', { keyPath: 'id' });
    }
    if (oldVersion >= 1 && oldVersion < DB_VERSION) {
        const store = tx.objectStore('documents');
        let cursor = await store.openCursor();
        while (cursor) {
            try {
                const record = normalizeToV7(cursor.value);
                if (record !== cursor.value) await cursor.update(record);
            } catch (error) {
                // An unmigratable record must not abort the upgrade — skip it,
                // leave it untouched, keep the DB open working.
                console.warn(`Skipping unmigratable document ${cursor.value.id}`, error);
            }
            cursor = await cursor.continue();
        }
    }
}
```

- The V5 re-normalization quirk is inherited automatically — same function.
- Store scans: 7 → 1. Net: ~80 lines → ~20.
- **Intended behaviour change**: the skip-on-error policy becomes uniform
  across all versions. A corrupt V2–V4 record no longer fails the DB open; it
  is skipped with a warning and left untouched, extending the policy the
  V5→V6 / V6→V7 blocks already established.
- Adding V8 later = one edit to `normalizeToV7`'s body (plus the new
  `migrateV7ToV8` and the `DB_VERSION` bump) — the upgrade handler is
  untouched unless V8 needs DDL.

### 2. One record→snapshot mapping in session-persistence

Both consumers live in the same file, so a module-private helper suffices —
no new module:

```typescript
async function recordToTabSnapshot(
    doc: DocumentRecord,
    viewport: TabViewportRecord
): Promise<TabSnapshot>
```

- `getSavedDocumentSnapshot` passes `DEFAULT_VIEWPORT` (current behaviour:
  opening a saved document resets the viewport).
- `restore` resolves the workspace viewport first (including the
  `showOnionSkin ?? false` backfill — viewport resolution stays at the call
  site; the mapping takes a fully-resolved viewport).

### Decisions that need no code change

- `normalizeToV7` keeps its version-suffixed name: every schema version
  already touches this file (new `migrateVnToVn+1`, normalize body,
  `DB_VERSION`), so a version-free name would not reduce the per-version
  edit count, and the suffix matches the `migrateV*` naming family.
- No CONTEXT.md change — no new domain concept is introduced.
- No Rust core / wasm / Apple changes. Independent of issues 221 and 222
  (no file overlap; any landing order works).

## Test plan

- Existing per-version upgrade tests are the behaviour pins — they seed a DB
  at version N via raw `openDB`, run `SessionStorage.open()`, and assert the
  resulting V7 record shape. They must pass unchanged.
- Existing "survives an unmigratable V5 record" test (session-storage.test.ts
  :703) passes unchanged — the skipped record stays untouched, same as today.
- New: an unmigratable early-version record (e.g. corrupt V2 or V3) no longer
  aborts the open — valid records upgrade, the bad one is skipped and left
  in place (pins the uniform policy).
- Read-path (`normalizeToV7`) tests unchanged.
- session-persistence tests unchanged (the mapping dedup is
  behaviour-preserving; both call paths are already covered).

## Acceptance criteria

- The version order V1→…→V7 is expressed exactly once (`normalizeToV7`);
  the upgrade handler contains no per-version record-migration blocks, only
  DDL plus the single normalize pass.
- Upgrade from a store containing records at every historical version
  produces byte-identical results to today (existing tests prove it).
- A corrupt record at any version is skipped with a warning; the DB open
  succeeds and other records still migrate.
- `restore` and `getSavedDocumentSnapshot` share one record→snapshot mapping;
  their observable outputs are unchanged.
- Unit suites and e2e session/persistence specs pass.

## Blocked by

None — independent of issues 221 and 222.

## Notes

- 2026-07-05: Produced by the `/improve-codebase-architecture` review
  (candidate #5 of 11) followed by a grilling pass. Decision tree resolved
  with the user: single-pass upgrade reusing `normalizeToV7` over a step-list
  data structure (the list would need an entry-point exception for the V5
  re-normalization quirk and would keep the cursor machinery alive); uniform
  skip-on-error confirmed as an intended behaviour change; mapping dedup as a
  module-private helper; `normalizeToV7` name kept.
