# Canvas2D 0.5px Offset for Crisp Lines

## Problem

Canvas2D에서 정수 좌표에 1px 선을 그리면 흐릿하게 보인다.

![0.5px 오프셋 적용 전후 비교](images/canvas2d-half-pixel-offset-comparison.png)

```typescript
// blurry
ctx.moveTo(10, 0);
ctx.lineTo(10, 100);
ctx.stroke(); // lineWidth = 1
```

## Why

Canvas2D는 벡터 그래픽 좌표계를 사용한다. 정수 좌표는 픽셀의 중심이 아니라 **픽셀 사이의 경계**에 위치한다.

```text
좌표:   x=0       x=1       x=2
         |         |         |
     +---+---+---+---+---+---+---
     |       |       |       |
     | px 0  | px 1  | px 2  |
     |       |       |       |
     +---+---+---+---+---+---+---
```

`stroke`는 좌표를 중심으로 `lineWidth` 만큼 양쪽으로 균등 확장한다. `lineWidth=1`이면 좌표 양쪽 0.5px씩 확장된다.

```text
x=1에 lineWidth=1:

  x=0.5     x=1     x=1.5
    |        |        |
    v        v        v
  +---------+---------+
  |  50%    |  50%    |
  |  alpha  |  alpha  |
  +---------+---------+
   pixel 0    pixel 1

-> 두 픽셀에 걸쳐 반투명 렌더링 = 흐릿한 2px 선
```

## Solution

좌표에 0.5를 더해서 픽셀 중심에 정렬한다.

```text
x=1.5에 lineWidth=1:

  x=1      x=1.5     x=2
    |        |        |
    v        v        v
  +---------+---------+
  |  100%   |         |
  |  fill   |         |
  +---------+---------+
   pixel 1    pixel 2

-> 정확히 1개 픽셀에 100% 채움 = 선명한 1px 선
```

```typescript
// crisp
ctx.moveTo(10 + 0.5, 0);
ctx.lineTo(10 + 0.5, 100);
ctx.stroke();
```

## Alternatives

### `ctx.translate(0.5, 0.5)`

좌표계 자체를 한 번 이동시켜서, 이후 모든 stroke를 정수 좌표로 작성한다.

```typescript
ctx.translate(0.5, 0.5);
ctx.moveTo(10, 0);   // 0.5 없이 선명
ctx.lineTo(10, 100);
ctx.stroke();
```

단, **fill 연산이 0.5px 어긋나는 부작용**이 생긴다. `fillRect(0, 0, 10, 10)`이 `(0.5, 0.5)`에서 시작된다. fill과 stroke를 같은 캔버스에서 혼용하는 경우에는 부적합하다.

### `fillRect`로 선 그리기

stroke를 아예 쓰지 않고, 1px 사각형을 fill로 그린다.

```typescript
for (let x = 1; x < canvasWidth; x++) {
    ctx.fillRect(x * pixelSize, 0, 1, displayHeight);
}
```

fill은 경계 좌표계에서 정확히 동작하므로 보정이 불필요하다. 다만 선 하나당 `fillRect` 호출이 필요해서 `beginPath` + `stroke` 한 번보다 호출 횟수가 많다.

### 이 프로젝트의 선택: 좌표별 `+ 0.5`

| 방식 | 장점 | 이 프로젝트에서의 문제 |
|---|---|---|
| `+ 0.5` | fill/stroke 각각 정확히 제어 | 그리드 함수에서만 적용하면 됨 |
| `translate(0.5, 0.5)` | 코드 깔끔 | fill 기반 렌더링(체커보드, 픽셀)이 어긋남 |
| `fillRect`로 선 | 보정 불필요 | 호출 횟수 증가, lineWidth 제어 불가 |

이 프로젝트는 체커보드와 픽셀 렌더링(fill)과 그리드(stroke)를 같은 캔버스에서 혼용하므로, 그리드 렌더링에서만 `+ 0.5`를 적용하는 방식이 가장 부작용이 적다.

## Scope

- **홀수 lineWidth에서만 필요하다.** `lineWidth=2`이면 양쪽 1px씩 확장되어 정수 좌표에서도 정확히 2개 픽셀에 채워진다.
- **stroke 계열 API에만 해당한다.** `fillRect` 등 fill 계열은 좌표에서 시작해서 한 방향으로만 채우므로 경계에 걸치지 않는다.

## Background: Why Canvas2D Uses Boundary Coordinates

Canvas2D는 SVG, PDF, PostScript와 동일한 벡터 그래픽 좌표 모델을 채택했다. 이 좌표계에서는 좌표 간 거리가 곧 픽셀 수가 되어 `fillRect(0, 0, 2, 2)`가 정확히 2x2 픽셀을 채운다. 만약 좌표가 픽셀 중심에 있었다면 같은 호출이 3x3 픽셀을 차지하거나, 내부적으로 보정이 필요했을 것이다.

이 설계는 **fill 연산에 최적화**되어 있다. fill이 stroke보다 훨씬 자주 쓰이므로 합리적인 트레이드오프지만, 픽셀 아트 에디터처럼 정수 정렬이 중요한 경우에는 0.5px 보정 비용이 발생한다.

## Reference

- [MDN: Applying styles and colors - A lineWidth example](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Applying_styles_and_colors#a_linewidth_example)
