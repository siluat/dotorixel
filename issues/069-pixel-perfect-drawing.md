---
title: Pixel Perfect drawing — remove double-pixels at stroke joints
status: done
created: 2026-04-18
---

## Problem Statement

자유곡선으로 대각선이나 곡선을 그리면, 인접한 샘플 간의 Bresenham 보간이 이어지는 지점에서 계단의 꼭짓점에 군더더기 픽셀이 맺힙니다. 세 연속 픽셀이 L자 모서리를 이룰 때 가운데 픽셀이 그 군더더기입니다. 이 "double-pixel" 은 픽셀아트 특유의 정돈된 계단 느낌을 해치고, 사용자가 선을 정리하려면 스트로크를 그린 뒤 수동으로 한 픽셀씩 지워야 합니다.

픽셀아트 전용 에디터에서 이는 기본 기대치입니다. Aseprite, Pixquare, Pixelorama 등 대부분의 현대 픽셀아트 툴이 "Pixel Perfect" 또는 동등한 이름의 기능으로 이 문제를 해결합니다. DOTORIXEL 에는 현재 이 기능이 없어, 사용자는 모든 자유곡선을 수동으로 정리해야 합니다.

## Solution

Pencil 과 Eraser 도구로 자유곡선을 그릴 때, 스트로크 경로에서 L자 모서리를 이루는 중간 픽셀을 자동으로 제거합니다.

기본값은 ON 입니다. 사용자는 StatusBar 의 토글로 켜고 끌 수 있으며, 설정은 세션 간 영속됩니다. Pixel Perfect 가 OFF 일 때는 현재의 Bresenham 출력이 그대로 유지됩니다.

필터링은 스트로크 진행 중 라이브로 일어납니다. 즉, L자 중간 픽셀은 일단 그려진 뒤, 다음 픽셀이 L자 모서리 조건을 확정짓는 시점에 즉시 스트로크 시작 직전의 색으로 되돌려집니다. Aseprite 가 사용하는 패턴과 동일한 UX 입니다.

## Key Scenarios

1. PP 가 ON 인 상태에서 사용자가 Pencil 로 완만한 대각 곡선을 그림 → 스트로크가 끝난 캔버스에는 L자 꼭짓점의 중간 픽셀이 존재하지 않는다
2. PP 가 OFF 인 상태에서 동일한 곡선을 그림 → 모든 Bresenham 출력 픽셀이 보존된다 (L자 중간 포함)
3. PP 가 ON 인 상태에서 사용자가 Eraser 로 대각 경로를 지움 → 지워진 경로 역시 L자 중간이 남지 않는다 (지우다 만 픽셀 없음)
4. PP 가 ON 인 상태에서 사용자가 수평/수직 직선을 그림 → 모든 픽셀이 보존된다 (L자 판정 조건 미충족)
5. 사용자가 단일 탭으로 한 점을 찍음 → 그대로 한 픽셀이 찍힌다, 필터 동작 없음
6. 사용자가 PP ON 상태로 스트로크를 그린 뒤 Undo → 캔버스가 스트로크 이전 상태로 돌아간다 (PP 가 없던 것과 동일한 단일 undo 엔트리)
7. 사용자가 StatusBar PP 토글을 클릭해 상태를 바꿈 → 다음 스트로크부터 새 상태가 적용된다
8. 사용자가 스트로크를 그리는 도중 PP 토글을 변경 → 현재 진행 중인 스트로크는 시작 시점 값 그대로 동작하고, 다음 스트로크에서 변경값 반영
9. 앱을 다시 연 뒤 PP 토글 상태가 직전 세션과 동일하게 복원된다
10. 사용자가 자기 교차 경로로 스트로크를 그려 같은 좌표가 두 번 방문됨 → 첫 방문에서 기록된 pre-paint 색이 유지되고, 이후 L자 판정이 발생하면 그 좌표는 pre-paint 색으로 되돌려진다 (업계 표준 한계 — 스트로크 자신의 이전 잉크도 이 때 함께 사라질 수 있음)
11. Line / Rectangle / Ellipse 등 shape 도구 사용 시 → PP 가 ON 이어도 필터가 적용되지 않고 Bresenham 출력 그대로 찍힌다
12. 사용자가 Apple Pencil / 터치 / 마우스 어느 입력으로 그려도 → 동일한 PP 거동을 보인다

## Implementation Decisions

### 아키텍처 원칙

- **타이밍**: 라이브 (Aseprite 방식). 들어오는 픽셀을 즉시 canvas 에 커밋하고, 3점 창으로 L자 판정이 확정되면 가운데 픽셀을 pre-paint 색으로 되돌린다.
- **로직 배치**: L자 판정 알고리즘은 Rust core 에 순수 함수로 배치. 스트로크 상태와 pre-paint 캐시는 각 쉘 (TS / Swift) 에 배치. CLAUDE.md 의 Core Placement 원칙 — "복잡도는 낮지만 cross-platform 동일성이 중요한 핵심 판정 로직은 core 에".
- **Deep module 식별**: Rust 필터 함수와 TS 의 PP wrapper 가 각각 deep module. 인터페이스는 단순하고 (좌표 입출력 / DrawingOps 계약), 내부에 상태·캐시·판정을 응축. 교체/리팩터에 강함.

### Rust Core 모듈

- **신규 순수 함수** `pixel_perfect_filter(points, prev_tail) -> (actions, new_tail)`
  - 입력: 한 `pointermove` 에 해당하는 Bresenham 출력 좌표 리스트 + 이전 세그먼트에서 남겨진 꼬리 2점 (옵션)
  - 출력: `Action` 리스트 (`Paint(x,y)` 또는 `Revert(x,y)`) + 다음 호출을 위한 새 꼬리 2점
- **내부 helper** `is_l_corner(prev, cur, next) -> bool` — 3-window L자 판정 규칙
  - 조건: prev 와 cur 가 x 또는 y 를 공유, next 와 cur 도 x 또는 y 를 공유, 그리고 prev 와 next 는 x, y 모두 다름
- 의존성 없음. 순수 정수 계산. WASM + UniFFI 로 자동 노출.

### Web Shell: DrawingOps 확장

- **계약 확장**: 기존 `DrawingOps` 인터페이스에 `applyStroke(pixels, kind, color)` 배치 메서드 추가. 기본 구현은 단순 루프 + `applyTool`.
- **저수준 픽셀 쓰기**: Revert 액션이 임의 색으로 픽셀을 원복해야 하므로 tool-kind 와 무관한 저수준 쓰기 메서드 (`setPixel(x, y, color)` 등) 가 `DrawingOps` 에 필요. 기존에 없으면 이 PRD 범위에서 신설.
- **pencil / eraser 도구 수정**: 세그먼트 `for` 루프 대신 `ops.applyStroke(pixels, kind, color)` 한 호출로 교체. PP 와 무관하게도 유효한 소폭 리팩터.

### Web Shell: Pixel Perfect Wrapper

- **신규 factory** `createPixelPerfectOps(baseOps): DrawingOps`
  - 내부 상태: 현재까지 확정된 꼬리 2점, pre-paint 캐시 `Map<PackedCoord, Color>` (first-touch wins)
  - `applyStroke(pixels, kind, color)`: Rust `pixel_perfect_filter` 호출 → 액션 리스트 받아 순서대로 실행
    - `Paint(x,y)`: 캐시에 없으면 현재 canvas 색을 캐시에 저장, 그 뒤 `baseOps.applyTool`
    - `Revert(x,y)`: 캐시에서 원색 읽어 `baseOps.setPixel` 로 복원
  - 꼬리 상태를 갱신하며 다음 호출에 전달
  - 비-스트로크 호출 (`applyTool` 직접) 은 그대로 forward

### Web Shell: Tool Runner 통합

- `drawStart()` 에서 PP 옵션이 ON 이고 활성 도구가 pencil 또는 eraser 인 경우 `strokeOps = createPixelPerfectOps(ops)`, 아니면 `strokeOps = ops`.
- 이 스트로크 동안 tool 의 `apply()` 에 전달되는 `ops` 는 `strokeOps` 로 고정.
- `drawEnd()` 에서 `strokeOps` drop (GC).
- **PP 값 스냅샷**: 스트로크 중 토글 변경은 무시. `drawStart` 시점 값으로 스트로크 내내 고정.

### 설정 / 영속성

- **Editor preference**: 기존 preference 저장 메커니즘에 `pixelPerfect: boolean` 필드 추가. 기본값 `true`.
- 영속성: 기존 패턴 따름 (localStorage / IndexedDB / Svelte store 영속 어댑터 중 프로젝트 관행).

### UI

- **StatusBar PP 토글 버튼**: 아이콘 버튼, 클릭으로 ON/OFF 토글. 현재 상태를 aria-label 과 툴팁에 반영. i18n 문자열 3개 (`en`, `ko`, `ja`).
- **키보드 단축키**: 이 PRD 범위 밖. 향후 단축키 시스템 정비 시점에 같이 다룸.

### 플랫폼 스코프

- **Web 은 전부**: Rust 필터 함수 + WASM 바인딩 + DrawingOps 확장 + PP wrapper + tool-runner 통합 + StatusBar 토글 + preference 영속성 + 테스트.
- **Apple 은 후속**: Rust 필터 함수는 UniFFI 로 자동 노출되어 준비 상태. Apple shell 의 실제 통합은 Phase 1 docked layout 의 StatusBar (issue 019) 완료 이후 별도 task 로 진행.

## Testing Decisions

### 테스트 원칙

- **외부 behavior 만 테스트**: 3점 창 판정 결과, 스트로크 결과 canvas 상태, 사용자 조작 → 화면 변화. 내부 캐시 자료구조 세부나 함수 호출 횟수는 테스트하지 않음.
- **회귀 방어 우선**: MVP 이후 단계에서 회귀 방어 테스트 확충이 프로젝트 방향 (CLAUDE.md "Project Stage"). 이 기능도 그 기조를 따름.

### Rust Core 단위 테스트 (MUST)

- `pixel_perfect_filter` 에 대한 표 기반 테스트
- 커버 케이스:
  - 빈 입력 / 단일 점 / 2점
  - 3점 수평·수직·대각 직선 (필터링 없음)
  - 3점 L자 모서리 8방향 대칭 (가운데 revert)
  - 연속 계단 (여러 L자 연속) — 각 중간이 차례로 revert
  - 세그먼트 경계 케이스 — `prev_tail` 을 통한 이전 호출과의 연결 지점에서 L자 발생 시 올바른 revert
  - 자기 교차 재방문 — 같은 좌표가 두 번 등장해도 규칙 그대로 적용
- `is_l_corner` 3-point truth table (helper 가 분리 구현되는 경우)

### Web 단위 테스트 (SHOULD)

- `createPixelPerfectOps` / PP wrapper 의 baseline 캐시 거동
- 커버 케이스:
  - `applyStroke` 호출 시 pre-paint 캐시가 first-touch wins 로 저장
  - L 판정 시 올바른 좌표에 캐시된 색이 복원되는지
  - 동일 좌표 재방문 시 캐시 덮어쓰기 되지 않음
- 프레임워크: Vitest + happy-dom. Prior art: `src/lib/wasm/wasm-tool.test.ts`.

### E2E 테스트 (MUST)

- Playwright. 파일: `e2e/editor/pixel-perfect.test.ts`.
- 커버 시나리오:
  - Pencil 로 L 모양 드래그 — PP ON 일 때 중간 픽셀 없음, PP OFF 일 때 있음 (ON/OFF 비교)
  - Eraser 로 동일 — 선택적
  - StatusBar 토글 클릭 → 상태 변화 후 다음 스트로크에 반영
- Prior art: `e2e/editor/drawing.test.ts`.

### 제외

- 스토리북 스토리 (StatusBar 단일 토글)
- 성능 벤치
- WASM 바인딩 단위 테스트 (Rust + E2E 로 커버됨)

## Rejected Alternatives

### 커밋 시 (pointerup) 일괄 처리 방식

스트로크 중에는 평소 Bresenham 그대로 보이다가 손을 뗄 때 전체 재래스터화. 구현 단순하나, 드래그 중 "지저분한" 선이 보이는 UX 가 픽셀아트 드로잉의 핵심 피드백을 해침. 거부.

### 버퍼 지연 방식 (1px 지연, un-paint 없음)

픽셀을 즉시 찍지 않고 1개 버퍼에 담았다가 L 판정 후 커밋. 구현은 더 단순하지만, 느리게 그릴 때 커서가 잉크를 앞서는 1px 지연이 발생. iPad + Apple Pencil 환경에서 체감 크며, DOTORIXEL 의 casual hobby tool 방향성과 상충. 거부.

### Rust core 에 stateful stroke 객체 배치

`PixelPerfectStroke` 를 WASM / UniFFI 로 상태 있는 객체로 노출. 거동 100% 일치는 보장되나, 현재 Rust core 는 stateless 순수 함수 기조이고 stateful FFI 객체는 라이프사이클 / 핸들 관리 / WASM 래핑의 첫 사례가 됨 — YAGNI. 거부.

### 각 쉘에 독립 구현 (Rust core 개입 없음)

L-corner 규칙이 단순하니 TS / Swift 각자 구현. 두 쉘 사이의 거동 동일성 보장이 사람에게 위임되어, 미세 어긋남이 사용자에게 즉시 감지되는 종류의 버그 리스크. Core Placement 원칙에 역행. 거부.

### 전체 tool API 리팩터 (데이터/쓰기 분리)

`ContinuousTool` 을 `pixelsForSegment() + writeKind` 로 전면 재설계. 구조적으로 깔끔하지만 pencil+eraser 두 도구만을 위한 과투자. 향후 더 많은 도구가 유사 pipeline 을 요구하면 그때 승격. 지금은 `DrawingOps.applyStroke` 배치 메서드 추가로 충분. 거부.

### 도구별 개별 PP 토글

Pencil 과 Eraser 가 독립 PP 상태 보유. 유연성은 높지만 실제 사용자 멘탈 모델은 "PP 모드로 그린다" 라는 전체성 개념. UI / 설정 복잡도 증가 대비 이득 불분명. 필요성이 실제 제기되면 단일 bool → 도구별 bool 확장 마이그레이션 간단. 거부 (MVP 에서는).

### Baseline 을 history snapshot 에서 읽기

History snapshot 이 이미 스트로크 시작 시점을 담고 있으니 재사용. 그러나 tool system ↔ history system 간 신규 커플링 (read API 노출) 발생. Pre-paint 캐시 방식은 self-contained 하고 메모리도 스트로크 규모에 비례 (수 KB). 거부.

### 단축키만 (UI 토글 없음)

가장 미니멀. 발견성이 제로라 초심자 (learning aid 방향성) 에게 부적합. 거부.

### OFF 기본값

"surprise 최소화" 원칙. 그러나 픽셀아트 전용 에디터의 기본 기대치는 PP 가 켜진 상태. 초심자가 별도 설정 없이 깔끔한 선을 얻도록 ON 기본. 거부.

## Out of Scope

- **브러시 크기 > 1px 과의 상호작용**: 브러시 크기 기능이 도입될 때 그 PRD 에서 PP 와의 관계 정의 (자동 비활성 / 변형 규칙 등).
- **키보드 단축키**: 프로젝트 단축키 시스템 정비 시점에 함께 다룸.
- **Apple shell 통합 및 토글 UI**: Apple StatusBar (issue 019) 완료 후 별도 task. Rust 필터 함수는 이 PRD 에서 UniFFI 로 노출되어 준비 상태.
- **Shape 도구 (Line / Rect / Ellipse) PP 적용**: 알고리즘적으로 의미 없음 — 결정론적 Bresenham / 도형 래스터가 이미 최선.
- **자기 교차 스트로크의 고급 처리**: first-touch wins 캐시로 인한 한계 수용 (업계 표준).
- **스토리북 스토리 / 성능 벤치**: 이번 범위에서 가치 낮음.
- **토글의 고급 배치 (도구별 옵션 패널, Context Bar 등)**: StatusBar 단일 토글이 MVP. 향후 도구 옵션이 늘면 그때 승격.

## Further Notes

### L-corner 판정 규칙 (레퍼런스)

세 연속 픽셀 `(p_prev, p_cur, p_next)` 에 대해 가운데 `p_cur` 가 다음 모두를 만족하면 L-corner 로 판정:

- `p_prev` 와 `p_cur` 의 x 또는 y 가 같음 (직교 이웃)
- `p_next` 와 `p_cur` 의 x 또는 y 가 같음 (직교 이웃)
- `p_prev` 와 `p_next` 는 x 도 y 도 다름 (대각 관계)

Aseprite 의 `IntertwineAsPixelPerfect` 와 동일 규칙.

### 참고 자료

- [Ricky Han — Pixel Art Algorithm: Pixel Perfect](https://rickyhan.com/jekyll/update/2018/11/22/pixel-art-algorithm-pixel-perfect.html)
- [Deepnight — Pixel perfect drawing](https://deepnight.net/blog/tools/pixel-perfect-drawing/)
- [Aseprite `intertwiners.h` — `IntertwineAsPixelPerfect`](https://github.com/aseprite/aseprite/blob/main/src/app/tools/intertwiners.h)
- [Aseprite `freehand_algorithm.h` — FreehandAlgorithm enum](https://github.com/aseprite/aseprite/blob/main/src/app/tools/freehand_algorithm.h)
- [Pixelorama — Drawing tools user manual](https://pixelorama.org/user_manual/drawing/)
- [Pixquare — Features](https://www.pixquare.art/)
- [Krita MR!2158 — Pixel Art Line Algorithm](https://invent.kde.org/graphics/krita/-/merge_requests/2158)
