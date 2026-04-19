---
title: Pixel Perfect — topBar/mAppBar toggle and preference persistence
status: done
created: 2026-04-18
parent: 069-pixel-perfect-drawing.md
---

## What to build

Editor preference 에 `pixelPerfect` 필드 추가 (기본 `true`, 기존 영속성 메커니즘 재사용). 070 디자인 기반으로 topBar/mAppBar 에 토글 버튼 구현. tool-runner 가 preference 를 조회해 **조건부** PP 래핑으로 전환 (072/073 의 hardcoded ON 을 교체). 스트로크 중 preference 변경은 현재 스트로크 무시, 다음 스트로크부터 반영. 토글 상태는 세션 간 유지.

Parent PRD 의 "설정 / 영속성", "UI" 섹션 및 Scenario 2, 7, 8, 9, 11 참조.

## Acceptance criteria

- Editor preference 에 `pixelPerfect: boolean` 필드 (기본값 `true`) 추가, 기존 영속성 패턴 재사용
- topBar/mAppBar 에 PP 토글 버튼 구현 (070 의 `.pen` 디자인 기반)
  - 커스텀 아이콘, ON/OFF/hover/active/disabled 상태 반영
  - 활성 도구가 Pencil/Eraser 가 아닐 때 토글은 **disabled** 시각화 (opacity 0.4 + `aria-disabled="true"`, hover/press 무반응, tooltip 은 "Pencil/Eraser only" 문맥 안내로 교체)
  - `aria-label` 과 툴팁에 현재 상태 표현
- i18n 문자열 추가 (en, ko, ja) — 토글 레이블 / aria / 툴팁용
- tool-runner 가 `drawStart` 시 preference 를 조회하여 조건부 PP 래퍼 적용 (기존 hardcoded ON 로직 대체)
  - PP OFF 인 경우 또는 활성 도구가 pencil/eraser 가 아닌 경우 기본 `ops` 사용
- 스트로크 시작 시점의 값으로 스트로크 내내 고정 (드래그 중 토글 변경은 다음 스트로크부터)
- E2E cases (Playwright):
  - PP OFF 상태로 Pencil L-shape → 중간 픽셀 있음 (072 의 ON 케이스와 비교)
  - topBar/mAppBar 토글 클릭 → 상태 표시 변화 + 다음 스트로크에서 동작 전환
  - 앱 재진입 (reload) 후 토글 상태 유지
  - PP ON 상태에서 Line 도구로 L-corner 를 유발하는 대각선 → 중간 픽셀 있음 (PP 래핑 스코프 경계 방어)
- `cargo test`, Vitest, Playwright 전부 통과

## Blocked by

- [070 — topBar/mAppBar PP toggle design](070-pixel-perfect-toggle-design.md)
- [072 — Pixel Perfect Pencil integration](072-pixel-perfect-pencil-integration.md)

## Scenarios addressed

- Scenario 2 (Pencil PP OFF Bresenham 원본 보존)
- Scenario 7 (토글 클릭 → 다음 스트로크 반영)
- Scenario 8 (스트로크 중 토글 변경 무시)
- Scenario 9 (세션 간 영속)
- Scenario 11 (Shape 도구 영향 없음 — PP 래핑 스코프 경계 확인)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/shared-state.svelte.ts` | `pixelPerfect = $state<boolean>(true)` 필드 추가 (기본 ON) |
| `src/lib/canvas/editor-state.svelte.ts` | PP getter/setter + `handlePixelPerfectToggle()` 메서드 |
| `src/lib/canvas/tool-runner.svelte.ts` | `drawStart` 시점에 preference 조회 → 조건부 `createPixelPerfectOps` 래핑 (hardcoded ON 제거). Pencil/Eraser 외 도구는 preference 무관하게 기본 ops |
| `src/lib/canvas/workspace-snapshot.ts` | `SharedStateSnapshot.pixelPerfect?: boolean` (레거시 스냅샷은 `?? true` 로 복원) |
| `src/lib/canvas/workspace.svelte.ts` | `#hydrate` 에서 `pixelPerfect` 복원, `toSnapshot` 에서 포함 |
| `src/lib/session/session-storage-types.ts` | `SharedStateRecord.pixelPerfect?: boolean` 추가 (스키마 확장) |
| `src/lib/session/session-persistence.ts` | save 시 `pixelPerfect` 매핑 |
| `src/routes/editor/+page.svelte` | PP 토글 핸들러 (disabled 가드 + `markDirty`), TopBar/AppBar 프롭 전달, `pixelPerfectDisabled` derived |
| `src/lib/ui-editor/TopBar.svelte` | PP 버튼 (커스텀 아이콘, ON/OFF/disabled 상태, `aria-pressed`/`aria-disabled`, 상태별 i18n 툴팁) |
| `src/lib/ui-editor/AppBar.svelte` | 동일한 PP 버튼 (compact 뷰포트용) |
| `src/lib/ui-editor/PixelPerfectIcon.svelte` | 계단형 PP 아이콘 (신규) |
| `src/lib/ui-editor/TopBar.stories.svelte`, `AppBar.stories.svelte` | PP 프롭 추가 |
| `src/lib/ui-editor/AppBar.svelte.test.ts` | PP 프롭 defaults 추가 |
| `src/lib/canvas/shared-state.svelte.test.ts`, `workspace.svelte.test.ts` | PP 기본값 + 스냅샷 round-trip (레거시 absence → `true`) unit coverage |
| `messages/en.json`, `messages/ko.json`, `messages/ja.json` | `action_pixelPerfectOn` / `Off` / `Disabled` i18n 3종 (3개 로케일) |
| `e2e/editor/pixel-perfect.test.ts` | 5 개 E2E 시나리오 추가: PP OFF L-shape 보존 · 재로드 영속 · 비호환 도구 disabled · AppBar(compact) 토글 · Line L-corner scope 경계 |

### Key Decisions

- **Disabled 상태는 버튼을 제거하지 않고 시각/의미적으로 억제** — `aria-disabled="true"` + opacity 0.4 + hover 억제 + `(Pencil/Eraser only)` 문맥 툴팁. 버튼을 숨기지 않음으로써 도구 전환 시 레이아웃 이동이 없고, 왜 회색인지를 스크린리더/툴팁으로 직접 안내.
- **Preference 스냅샷은 stroke 시작 시점에 고정** — tool-runner 의 `drawStart` 가 `shared.pixelPerfect` 를 읽어 래퍼를 결정. 스트로크 중 토글 변경은 다음 스트로크부터 반영 (Scenario 8).
- **레거시 스냅샷 호환** — `SharedStateSnapshot.pixelPerfect?: boolean` 로 optional 선언, hydrate 시 `?? true` 기본값 적용. 기존 사용자는 ON 상태로 복원되어 이전 동작(PR #156/#157)과 일관.
- **Shape 도구 scope 경계 이중 방어** — tool-runner 는 `pencil`/`eraser` 에만 PP 래퍼를 적용하고, 추가로 `createPixelPerfectOps` 는 `applyStroke` 만 감싸고 `applyTool` 은 그대로 포워드. Line/Rect/Ellipse 는 `applyTool` 경로이므로 설계상 PP 에 영향받지 않음 (Cycle 6 E2E 에서 회귀 방어).
- **재로드 영속 테스트 안정화** — `page.reload()` 는 `beforeunload` 의 async flush 를 기다리지 않으므로, 테스트는 reload 직전에 `page.waitForFunction` 으로 IDB 에 `pixelPerfect === false` 가 실제로 반영됐는지를 폴링하고 200ms 세틀 pad 후 reload. 3s debounce 와 reload 간 경쟁을 제거.

### Notes

- 이 이슈는 parent PRD 069 (Pixel-perfect drawing) 의 마지막 sub-issue. 070/071/072/073 완료 후 074 가 마감되면서 PRD 전체가 done 으로 이동.
- Apple 쉘은 아직 PP 미탑재 — `platform-status.md` 의 Pixel-perfect filter 행에서 Web ✅, Apple ⬜ 유지.
