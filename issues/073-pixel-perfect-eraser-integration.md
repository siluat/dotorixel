---
title: Pixel Perfect — Eraser integration
status: open
created: 2026-04-18
parent: 069-pixel-perfect-drawing.md
---

## What to build

Eraser 도구도 PP 필터를 거치도록 확장. Eraser 드래그 시 지운 경로의 L-corner 중간이 "지우다 말고 남은 픽셀" 없이 깨끗이 지워짐. Pencil 과 대칭적인 처리.

Parent PRD 의 "Web Shell: Tool Runner 통합" 섹션 및 Scenario 3 참조.

## Acceptance criteria

- eraser-tool 이 세그먼트 `for` 루프 대신 `applyStroke` 로 전환
- tool-runner 가 eraser `drawStart` 에서도 PP 래퍼 적용 (pencil 과 동일 분기; 여전히 hardcoded ON)
- pre-paint 캐시가 eraser 의 "지우기 전 색" 을 기록하고, revert 시 그 색으로 복원 (즉, eraser 가 revert 된 픽셀은 "지워지지 않은 원래 상태" 로 돌아감)
- E2E 1 case (Playwright): 미리 칠해둔 영역에 Eraser 로 L-shape 드래그 → 중간 픽셀도 지워진 채 유지 (남아 있지 않음)
- `cargo test`, Vitest, Playwright 전부 통과

## Blocked by

- [072 — Pixel Perfect Pencil integration](072-pixel-perfect-pencil-integration.md)

## Scenarios addressed

- Scenario 3 (Eraser PP L 경로 깔끔)
