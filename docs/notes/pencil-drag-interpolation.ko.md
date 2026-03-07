# Pencil 드래그 시 픽셀 간격 문제와 직선 보간

## Problem

마우스를 빠르게 드래그하면 경로상의 모든 픽셀이 칠해지지 않고 중간에 빈 픽셀이 생긴다.

```text
느린 드래그 (의도한 결과):     빠른 드래그 (실제 결과):
■ ■ ■ ■ ■ ■ ■                ■ · · ■ · · ■
```

## Why

`mousemove` 이벤트는 매 화면 픽셀마다 발생하지 않는다. 브라우저는 이벤트를 일정 간격으로만 디스패치하며, 마우스가 한 이벤트 사이에 여러 캔버스 픽셀을 건너뛸 수 있다.

```text
시간 →
이벤트 1        이벤트 2        이벤트 3
(3, 3)          (7, 7)          (10, 9)
  ■               ■               ■
     · · ·           · · ·
     건너뜀           건너뜀
```

현재 구현은 각 `mousemove` 이벤트에서 단일 좌표에만 `applyTool()`을 호출하므로, 이벤트 사이의 중간 픽셀이 누락된다.

## Solution: Bresenham 직선 보간

이전 좌표 `(x0, y0)`와 현재 좌표 `(x1, y1)` 사이의 모든 픽셀을 Bresenham's line algorithm으로 계산하여 채운다.

```typescript
// Bresenham's line algorithm
function interpolatePixels(x0: number, y0: number, x1: number, y1: number): {x: number, y: number}[] {
  const pixels = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    pixels.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx)  { err += dx; y0 += sy; }
  }
  return pixels;
}
```

```text
보간 적용 후:
이벤트 1 → 이벤트 2 → 이벤트 3
(3,3)       (7,7)       (10,9)
  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■
  연속된 선
```

### 적용 위치

변경이 필요한 부분:

- **`canvas.ts`**: `CanvasCoords` 타입 정의 추가, `clearCanvas()` 유틸 추가
- **`renderer.ts`**: 화면 좌표를 캔버스 좌표로 변환하는 `screenToCanvas()` 추가
- **`tool.ts`**: `interpolatePixels()` 순수 함수 추가
- **`PixelCanvasView.svelte`**: `drawAt()`에서 이전 좌표와 현재 좌표를 함께 전달
- **`+page.svelte`**: `handleDraw`에서 보간된 좌표들에 `applyTool()` 반복 호출

## Alternatives

### 1. DDA (Digital Differential Analyzer)

Bresenham과 동일한 목적이지만 부동소수점 연산을 사용한다.

```typescript
function interpolateDDA(x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const xInc = dx / steps;
  const yInc = dy / steps;
  // steps만큼 반복하며 Math.round로 정수 좌표 산출
}
```

| 항목 | Bresenham | DDA |
|------|-----------|-----|
| 연산 | 정수만 | 부동소수점 |
| 결과 | 결정론적 | 누적 오차 가능 |
| 구현 복잡도 | 비슷 | 비슷 |

32x32 스케일에서 실질적 차이는 없지만, Bresenham이 결정론적이고 픽셀 아트 도구의 업계 표준이다.

### 2. `getCoalescedEvents()` (브라우저 API)

브라우저가 성능상 합쳐버린(coalesced) 중간 마우스 이벤트를 복원하는 API.

```typescript
canvas.addEventListener('pointermove', (e) => {
  for (const coalesced of e.getCoalescedEvents()) {
    // 생략된 중간 좌표 사용
  }
});
```

- **한계**: 매우 빠른 드래그에서는 하드웨어 폴링 레이트 한계로 여전히 간격 발생. Safari 미지원.
- **결론**: 간격 문제를 근본적으로 해결하지 못한다. 보간 알고리즘의 보조 수단으로만 유효.

### 3. `pointerrawupdate` (실험적 API)

OS 레벨의 원시 포인터 데이터를 받아 이벤트 빈도를 최대화.

- **한계**: 실험적 API. 빈도를 높여도 한 프레임에 2픽셀 이상 이동하면 간격 발생.
- **결론**: 2번과 동일하게 근본적 해결이 아님.

### 이 프로젝트의 선택: Bresenham

| 방식 | 간격 해결 보장 | 재사용성 |
|------|:-:|:-:|
| Bresenham | 완전 | Phase 2 Line tool에 재사용 |
| DDA | 완전 | Phase 2 Line tool에 재사용 |
| `getCoalescedEvents()` | 부분적 | 없음 |
| `pointerrawupdate` | 부분적 | 없음 |

이벤트 기반 접근(2, 3번)은 이벤트 빈도를 아무리 높여도 마우스가 한 프레임에 2픽셀 이상 이동하면 간격이 생긴다. 보간 알고리즘이 필수이며, Phase 2 로드맵의 "Line tool (Bresenham)"과 코드를 공유할 수 있으므로 Bresenham을 선택한다.

## Open Source Case Studies

### Aseprite (C++)

가장 인기 있는 픽셀 에디터. 두 가지 Bresenham 변형을 상황에 따라 선택한다.

- **`algo_line_continuous`**: 기본 pencil 드래그. Alois Zingl의 Bresenham 변형으로 `e2 = 2 * err` 방식의 x/y 독립 스텝 판단.
- **`algo_line_perfect`**: Snap to Grid 등 특수 상황. 전통적 error 누적 방식.
- 대각선 전환 시 브러시 간격 방지를 위한 `_with_fix_for_line_brush` 변형도 제공.

소스: `src/doc/algo.cpp`, `src/app/tools/intertwine.cpp`

### Piskel (JavaScript)

웹 기반 픽셀 에디터. 현재 dotorixel 구조와 가장 유사한 사례.

- `SimplePen.js`에서 이전/현재 좌표 차이가 1 초과인지 검사하여 빠른 드래그를 감지.
- `PixelUtils.getLinePixels()`로 Bresenham 보간 실행.
- 보간된 모든 좌표에 `applyToolAt()` 반복 호출.

소스: `src/js/tools/drawing/SimplePen.js`, `src/js/utils/PixelUtils.js`

### LibreSprite (C++, Aseprite 포크)

- Allegro 그래픽 라이브러리 유래의 Bresenham 기반 `algo_line()` 사용.
- 매크로로 8방향 케이스를 처리하는 최적화 구현.

소스: `src/doc/algo.cpp`

**검토한 세 프로젝트 모두 Bresenham을 사용한다.** 이번 사례 조사 범위에서는 DDA나 이벤트 기반 접근 사례를 확인하지 못했다.

## Reference

- [Wikipedia: Bresenham's line algorithm](https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm)
- [Zingl, A. - A Rasterizing Algorithm for Drawing Curves](https://zingl.github.io/bresenham.html)
- [MDN: PointerEvent.getCoalescedEvents()](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents)
