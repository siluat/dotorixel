---
title: Pixel Perfect — Pencil integration (hardcoded ON)
status: open
created: 2026-04-18
parent: 069-pixel-perfect-drawing.md
---

## What to build

Web shell 이 Rust 필터를 사용하도록 `DrawingOps` 를 확장하고, PP wrapper factory 를 구현. tool-runner 가 Pencil 스트로크에 **hardcoded ON** 으로 PP 래퍼를 적용. 이 슬라이스가 끝나면 사용자는 Pencil 로 그린 L-shape 에서 중간 픽셀이 자동으로 제거됨을 육안 및 E2E 로 확인 가능. 토글 UI 와 preference 는 아직 없음 (다음 단계에서 도입).

Parent PRD 의 "Web Shell: DrawingOps 확장", "Web Shell: Pixel Perfect Wrapper", "Web Shell: Tool Runner 통합" 섹션 참조.

## Acceptance criteria

- `DrawingOps.applyStroke(pixels: Int32Array, kind: ToolKind, color: Color)` 계약 추가, 기본 구현 (단순 loop + `applyTool`)
- `DrawingOps.setPixel(x, y, color)` 저수준 쓰기 메서드 추가 (revert 용, tool-kind 무관)
- pencil-tool 이 세그먼트 `for` 루프 대신 `applyStroke` 로 전환
- `createPixelPerfectOps(baseOps): DrawingOps` factory 신규 모듈
  - 내부 상태: 꼬리 2점 + pre-paint 캐시 `Map<PackedCoord, Color>`
  - `applyStroke` 구현: Rust `pixel_perfect_filter` 호출 → 액션 순차 실행
    - `Paint`: 캐시에 없으면 현재 canvas 색을 캐시에 기록 (first-touch wins), 이후 `baseOps.applyTool`
    - `Revert`: 캐시에서 읽어 `baseOps.setPixel` 로 복원
  - `applyTool` 등 비-스트로크 호출은 forward
- tool-runner 가 pencil `drawStart` 시 **무조건** PP 래퍼 적용 (preference 조회 없음)
- `drawEnd()` 에서 스트로크 래퍼 drop
- TS 단위 테스트 (Vitest + happy-dom):
  - first-touch wins: 같은 좌표 재방문 시 캐시 덮어쓰지 않음
  - Revert 시 올바른 pre-paint 색으로 복원
- E2E 1 case (Playwright): Pencil 로 L-shape 드래그 → 중간 픽셀 없음
- `cargo test`, Vitest, Playwright 전부 통과

## Blocked by

- [071 — Pixel Perfect filter Rust core function](071-pixel-perfect-rust-filter.md)

## Scenarios addressed

- Scenario 1 (Pencil PP ON L-shape 중간 없음)
- Scenario 4 (수평/수직 직선 보존)
- Scenario 5 (단일 탭)
- Scenario 6 (Undo 단일 엔트리)
- Scenario 8 (시작시점 값 고정 기틀 — 여기서는 hardcoded ON 이라 값 변경 자체 없음)
- Scenario 10 (자기 교차 first-touch wins 의 쉘 처리)
- Scenario 12 (입력 장치 무관)
