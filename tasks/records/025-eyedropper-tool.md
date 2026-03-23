# 025 — Eyedropper tool

## Plan

### Context

현재 DOTORIXEL에는 6개의 도구(pencil, eraser, line, rectangle, ellipse, floodfill)가 있다. Eyedropper tool은 캔버스에서 픽셀의 색상을 읽어 foreground color로 설정하는 도구이다. 기존 도구들은 모두 캔버스에 쓰기를 하지만, eyedropper는 순수한 읽기 전용 도구이다. 별도의 WASM tool 연산이 필요없고, 이미 존재하는 `WasmPixelCanvas.get_pixel(x, y)` 메서드로 충분하다.

### 구현 단계

#### 1. ToolType 확장

**파일:** `src/lib/canvas/tool-types.ts`

`'eyedropper'`를 ToolType union에 추가.

#### 2. EditorState에서 eyedropper 동작 구현

**파일:** `src/lib/canvas/editor-state.svelte.ts`

##### `handleDrawStart()` 수정

현재 `handleDrawStart()`는 세 가지 작업을 수행한다:
1. `#isDrawing = true` — draw flow 제어에 필요 → **유지**
2. `#history.push_snapshot()` + `#historyVersion++` — undo용 → eyedropper는 캔버스를 수정하지 않으므로 **skip** (불필요한 undo 항목 방지)
3. `recentColors` 업데이트 및 `#previewSnapshot` 생성 — 기존 조건문에 eyedropper가 포함되지 않으므로 **변경 불필요**

eyedropper guard를 `#isDrawing = true` 직후, `#history.push_snapshot()` 직전에 추가하여 early return.

##### `handleDraw()` 수정

flood fill 분기 뒤에 eyedropper 분기 추가. **반드시** `WASM_TOOL_MAP[this.activeTool]` 조회 (default 경로) 전에 위치해야 한다 — eyedropper는 `WASM_TOOL_MAP`에 없으므로 fallthrough 시 `undefined` 에러 발생.

동작:
- `previous !== null`이면 return (단일 클릭만 처리, flood fill과 동일 패턴)
- `pixelCanvas.get_pixel(current.x, current.y)` 호출
- 반환된 색상의 `a === 0`이면 무시 (현재 color system이 6자리 hex만 지원하므로, 투명을 pick하면 `#000000`으로 표시되지만 실제로는 eraser처럼 동작하게 되는 혼란 방지)
- `a > 0`이면: `foregroundColor` 설정, `recentColors` 업데이트 (`addRecentColor` 재사용)

#### 3. UI — Toolbar에 eyedropper 버튼 추가

**파일:** `src/lib/ui-pixel/Toolbar.svelte`

- `Pipette` 아이콘 (lucide-svelte) import 추가
- flood fill 버튼 뒤, separator 전에 위치

**파일:** `src/lib/ui-pebble/BottomToolsPanel.svelte`

- Pebble UI에도 동일하게 Pipette 아이콘으로 추가

#### 4. StatusBar — TOOL_LABELS에 eyedropper 추가

**파일:** `src/lib/ui-pixel/StatusBar.svelte`

- `TOOL_LABELS` Record에 `eyedropper: 'Eyedropper'` 추가

#### 5. 테스트

**파일:** `src/lib/canvas/editor-state.svelte.test.ts`

테스트 케이스:
- 색이 칠해진 픽셀을 eyedropper로 클릭 → foregroundColor가 해당 색으로 변경
- 투명 픽셀을 eyedropper로 클릭 → foregroundColor 변경 없음
- eyedropper 사용 시 undo history에 snapshot이 추가되지 않음 (canUndo가 false 유지)
- eyedropper로 색상을 읽은 후 recentColors에 해당 색상 추가

### 수정 파일 요약

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/canvas/tool-types.ts` | `'eyedropper'` 추가 |
| `src/lib/canvas/editor-state.svelte.ts` | handleDrawStart guard, handleDraw eyedropper 분기 |
| `src/lib/ui-pixel/Toolbar.svelte` | Pipette 버튼 추가 |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Pipette 버튼 추가 |
| `src/lib/ui-pixel/StatusBar.svelte` | TOOL_LABELS에 eyedropper 추가 |
| `src/lib/canvas/editor-state.svelte.test.ts` | eyedropper 테스트 |

### 검증

1. `bun run test` — 모든 테스트 통과 확인
2. `bun run check` — 타입 체크 통과 (ToolType 변경 시 exhaustive Record에서 컴파일 에러 → 누락 감지)
3. dev 서버에서 eyedropper 선택 → 색이 있는 픽셀 클릭 → color palette에 반영 확인 → 투명 픽셀 클릭 시 변경 없음 확인

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/tool-types.ts` | Added `'eyedropper'` to ToolType union |
| `src/lib/canvas/editor-state.svelte.ts` | handleDrawStart early return for eyedropper; handleDraw eyedropper branch |
| `src/lib/ui-pixel/Toolbar.svelte` | Pipette icon button after flood fill |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Pipette icon button after flood fill |
| `src/lib/ui-pixel/StatusBar.svelte` | `eyedropper: 'Eyedropper'` in TOOL_LABELS |
| `src/lib/canvas/editor-state.svelte.test.ts` | 4 tests: pick color, transparent ignore, no undo snapshot, recentColors |

### Key Decisions

- Transparent pixel clicks are ignored rather than setting foregroundColor to `#000000`. The current color system only supports 6-digit hex (no alpha), so picking RGBA(0,0,0,0) would display as `#000000` but behave like an eraser — confusing.
- recentColors is updated in `handleDraw()` (not `handleDrawStart()`) because the picked color is determined by the canvas pixel, not the pre-selected foreground color.
