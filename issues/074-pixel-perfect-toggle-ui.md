---
title: Pixel Perfect — StatusBar toggle and preference persistence
status: open
created: 2026-04-18
parent: 069-pixel-perfect-drawing.md
---

## What to build

Editor preference 에 `pixelPerfect` 필드 추가 (기본 `true`, 기존 영속성 메커니즘 재사용). 070 디자인 기반으로 StatusBar 에 토글 버튼 구현. tool-runner 가 preference 를 조회해 **조건부** PP 래핑으로 전환 (072/073 의 hardcoded ON 을 교체). 스트로크 중 preference 변경은 현재 스트로크 무시, 다음 스트로크부터 반영. 토글 상태는 세션 간 유지.

Parent PRD 의 "설정 / 영속성", "UI" 섹션 및 Scenario 2, 7, 8, 9, 11 참조.

## Acceptance criteria

- Editor preference 에 `pixelPerfect: boolean` 필드 (기본값 `true`) 추가, 기존 영속성 패턴 재사용
- StatusBar 에 PP 토글 버튼 구현 (070 의 `.pen` 디자인 기반)
  - 커스텀 아이콘, ON/OFF/hover/active 상태 반영
  - `aria-label` 과 툴팁에 현재 상태 표현
- i18n 문자열 추가 (en, ko, ja) — 토글 레이블 / aria / 툴팁용
- tool-runner 가 `drawStart` 시 preference 를 조회하여 조건부 PP 래퍼 적용 (기존 hardcoded ON 로직 대체)
  - PP OFF 인 경우 또는 활성 도구가 pencil/eraser 가 아닌 경우 기본 `ops` 사용
- 스트로크 시작 시점의 값으로 스트로크 내내 고정 (드래그 중 토글 변경은 다음 스트로크부터)
- E2E cases (Playwright):
  - PP OFF 상태로 Pencil L-shape → 중간 픽셀 있음 (072 의 ON 케이스와 비교)
  - StatusBar 토글 클릭 → 상태 표시 변화 + 다음 스트로크에서 동작 전환
  - 앱 재진입 (reload) 후 토글 상태 유지
  - PP ON 상태에서 Line 도구로 L-corner 를 유발하는 대각선 → 중간 픽셀 있음 (PP 래핑 스코프 경계 방어)
- `cargo test`, Vitest, Playwright 전부 통과

## Blocked by

- [070 — StatusBar PP toggle design](070-pixel-perfect-toggle-design.md)
- [072 — Pixel Perfect Pencil integration](072-pixel-perfect-pencil-integration.md)

## Scenarios addressed

- Scenario 2 (Pencil PP OFF Bresenham 원본 보존)
- Scenario 7 (토글 클릭 → 다음 스트로크 반영)
- Scenario 8 (스트로크 중 토글 변경 무시)
- Scenario 9 (세션 간 영속)
- Scenario 11 (Shape 도구 영향 없음 — PP 래핑 스코프 경계 확인)
