---
title: Pixel Perfect filter — Rust core function
status: open
created: 2026-04-18
parent: 069-pixel-perfect-drawing.md
---

## What to build

L-corner 판정 알고리즘을 Rust core 에 순수 함수로 구현. WASM + UniFFI 바인딩으로 양 쉘에 자동 노출. 이 슬라이스에서는 Rust 테스트로 correctness 를 독립적으로 고정하며, 쉘 쪽 통합은 아직 없음 (다음 슬라이스에서 호출).

Parent PRD 의 "Rust Core 모듈" 섹션 및 L-corner 판정 규칙 참조.

## Acceptance criteria

- `pixel_perfect_filter(points: &[(i32, i32)], prev_tail: Option<[(i32, i32); 2]>) -> FilterResult` 순수 함수 구현
  - `FilterResult = { actions: Vec<Action>, new_tail: [(i32, i32); 2] }`
  - `Action::Paint(x, y)` / `Action::Revert(x, y)` variants
- `is_l_corner(prev, cur, next) -> bool` helper 함수 (3-window 규칙)
- 의존성 없음, 순수 정수 계산
- 표 기반 단위 테스트 (최소 10 cases):
  - 빈 입력 / 단일 점 / 2점
  - 3점 수평·수직·대각 직선 (필터링 없음)
  - 3점 L자 모서리 8방향 대칭 (가운데 revert)
  - 연속 계단 (여러 L 연속) — 각 중간이 차례로 revert
  - 세그먼트 경계 — `prev_tail` 로 이어지는 L 발생 시 올바른 revert
  - 자기 교차 재방문 — 같은 좌표 재등장해도 규칙 그대로
- WASM 바인딩 export (TS 에서 import 가능, 실제 호출은 다음 슬라이스)
- UniFFI 바인딩 자동 생성
- `cargo test` 통과

## Blocked by

None — can start immediately (can run in parallel with 070)

## Scenarios addressed

Algorithmic foundation for:
- Scenario 1 (Pencil PP ON L-shape 중간 없음)
- Scenario 4 (수평/수직 직선 보존)
- Scenario 5 (단일 탭)
- Scenario 10 (자기 교차 first-touch wins 의 알고리즘 부분)
- Scenario 12 (입력 장치 무관 — 필터는 좌표만 다룸)
