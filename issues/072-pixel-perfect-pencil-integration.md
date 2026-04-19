---
title: Pixel Perfect — Pencil integration (hardcoded ON)
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/drawing-ops.ts` | `applyStroke` / `setPixel` / `getPixel` 메서드 추가 (decorator 가능한 contract) |
| `src/lib/canvas/wasm-backend.ts` | 새 메서드들의 WASM 기반 기본 구현 (out-of-bounds 가드 포함) |
| `src/lib/canvas/pixel-perfect-ops.ts` | `createPixelPerfectOps` decorator factory — tail + first-touch 캐시 + seam dedup |
| `src/lib/canvas/pixel-perfect-ops.test.ts` | Vitest 4 케이스: L-corner revert, segment boundary, seam overlap, first-touch wins |
| `src/lib/canvas/draw-tool.ts` | `ToolContext.ops` 필드 추가 — stroke-scoped DrawingOps 주입 |
| `src/lib/canvas/tools/pencil-tool.ts` | `for` 루프 대신 `ctx.ops.applyStroke` 사용; pencil/eraser 모두 동일 factory |
| `src/lib/canvas/tool-registry.ts` | pencil/eraser 를 singleton 으로 변경 (factory 인자 불필요) |
| `src/lib/canvas/tool-runner.svelte.ts` | drawStart 에서 pencil/eraser 일 때 PP wrapper 생성, drawEnd 에서 drop |
| `e2e/editor/fixtures.ts` | `readArtGeometry` 를 export 가능한 helper 로 추출, `findArtCenter` 는 `artCenterFromGeometry` 로 분리 |
| `e2e/editor/pixel-perfect.test.ts` | E2E: Pencil L-shape 드래그 → 코너 픽셀이 초기 색으로 복원됨을 검증 |

### Key Decisions

- **Decorator pattern over filter pipeline**: `DrawingOps` 자체를 wrapping 하므로 tool 코드가 PP 인지 모르고도 동작. `tool-runner` 의 `drawStart` 에서 `strokeOps` 를 갈아끼우는 방식.
- **`ToolContext.ops` 주입**: tool 이 construction-time 에 `ops` 를 capture 하지 않고 매 호출마다 `ctx.ops` 를 읽음 → stroke-scoped wrapper 교체가 자연스럽게 작동.
- **Seam dedup at wrapper level**: WASM 필터 contract 는 "distinct stroke pixel stream". 하지만 pencil 의 Bresenham segment 가 양 끝점을 모두 포함하기 때문에 인접 batch 간 junction 픽셀이 중복됨. wrapper 의 `dedupAgainstTail` 이 이를 흡수해 WASM contract 보존.
- **Hardcoded ON for pencil AND eraser**: 074 의 toggle 도입 전까지 두 도구 모두 자동 적용. tool-runner 의 분기는 `activeTool === 'pencil' || activeTool === 'eraser'`.
- **First-touch-wins via `Map<string, Color>`**: 캐시 key 는 `"x,y"` 문자열. 같은 좌표 재방문 시 cache.has() 체크로 첫 색만 보존.

### Notes

- 부수 효과로 **073 (Eraser integration) 의 요구사항 대부분이 이미 구현됨**: pencil/eraser 가 동일 `createFreehandTool` factory 를 공유하고 tool-runner 가 두 도구 모두 라우팅. 073 에서는 eraser 전용 E2E 케이스 추가만 남음.
- WASM 필터의 `is_l_corner` 가 `prev != next` 를 양 축 모두 요구하므로 duplicate 가 끼면 L 검출이 silent 하게 실패함을 디버깅 중 발견. wrapper 의 dedup 로 해결했으나, 향후 Apple shell 통합 시 동일 dedup 책임이 그쪽에도 필요.
- pre-paint 캐시는 stroke 끝까지 유지되므로 매우 긴 stroke 에서 메모리 점유 가능. 현재로선 실용적 한계 내. 향후 시간 기반 expiration 검토 가능.
