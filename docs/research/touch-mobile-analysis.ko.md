# 터치 & 모바일 분석

> 조사 일자: 2026-03-29
> 범위: 웹 셸만 해당 (네이티브 셸은 보류)
> 주요 UI: Pebble 에디터
> 코드베이스 스냅샷: 커밋 83769df

이 문서는 DOTORIXEL 웹 에디터의 터치 및 모바일 기기 지원에 대한 체계적 분석 결과를 기록한다. **읽기 전용 스냅샷**으로 취급하며, 구현 중 발견된 내용은 각 작업의 record 파일에 기록한다. 이 문서의 내용이 잘못된 것으로 밝혀지면 재작성하지 않고 하단에 Addendum을 추가한다.

## 식별된 이슈

### HIGH — 이슈 1: 멀티터치 핀치 줌 미작동

**근본 원인:** `wheel-input.ts`는 핀치 줌을 `ctrlKey`로 분류한다 (9행: `if (ctrlKey) return 'pinchZoom'`). 이는 브라우저가 `Ctrl+wheel` 이벤트로 합성하는 트랙패드 핀치 제스처에는 동작한다. 그러나 실제 터치스크린 핀치는 서로 다른 `pointerId`를 가진 별도의 Pointer Events로 발생하며, wheel 이벤트가 아니다. 멀티 포인터 제스처를 처리하는 코드 경로가 없다.

**영향 파일:**
- `src/lib/canvas/PixelCanvasView.svelte` — 포인터 핸들러 (131–153행)
- `src/lib/canvas/wheel-input.ts` — 휠 분류 (9행)

**현재 동작:** `touch-action: none` (PixelCanvasView 222행)이 브라우저 기본 핀치 줌을 막지만, 커스텀 핀치 제스처가 구현되어 있지 않다. 터치 기기에서 줌이 불가능하다.

**수정 전략:** `PixelCanvasView.svelte`에서 활성 포인터를 추적한다. 두 개의 포인터가 활성 상태일 때 포인터 간 거리 변화로 줌을, 중점 변화로 패닝을 계산한다. 기존 `WasmViewport.compute_pinch_zoom()`과 `viewport.pan()`을 사용한다.

---

### HIGH — 이슈 2: 물리 키보드 없이 패닝 불가

**근본 원인:** 패닝은 마우스 중간 버튼 (`event.button === 1`, 134행) 또는 Space+좌클릭 (PixelCanvasView.svelte 145–147행)으로만 트리거된다. 물리 키보드나 마우스 없는 터치 기기에서는 두 방법 모두 사용할 수 없다.

**영향 파일:**
- `src/lib/canvas/PixelCanvasView.svelte` — `handlePointerDown` (131–153행)
- `src/lib/canvas/editor-state.svelte.ts` — Space 키 추적 (353–359행)

**현재 동작:** 터치 전용 기기에서 캔버스를 패닝할 방법이 없다. 캔버스를 줌인한 상태에서 화면 밖 영역으로 이동할 수 없다.

**수정 전략:** 두 손가락 드래그로 패닝 (이슈 1의 멀티터치 제스처 시스템의 일부). 툴바에 전용 "패닝 모드" 토글 버튼을 통한 한 손가락 패닝도 지원 가능.

---

### HIGH — 이슈 3: 작은 화면에서 레이아웃 깨짐

**근본 원인:** 전체 코드베이스에 CSS `@media` 쿼리가 전혀 없다. Pebble 에디터는 고정 간격(`--pebble-edge-gap: 16px`)의 절대 위치를 사용한다. Pixel 에디터는 3열 CSS 그리드(`grid-template-columns: auto auto auto`)를 사용한다. 어느 쪽도 뷰포트 크기에 적응하지 않는다.

**영향 파일:**
- `src/routes/pebble/+page.svelte` — 절대 위치 레이아웃 (133–159행)
- `src/routes/pixel/+page.svelte` — 3열 그리드 레이아웃
- `src/lib/ui-pebble/pebble-tokens.css` — `--pebble-edge-gap: 16px`

**현재 동작:** 320–430px 너비 화면(iPhone)에서 플로팅 패널들이 서로 겹치고 캔버스를 가린다. 하단 도구 패널, 색상 팔레트, 상단 컨트롤이 모두 같은 작은 뷰포트에서 경쟁한다.

**수정 전략:** 반응형 브레이크포인트 추가. 작은 화면용 패널 레이아웃 재구성 — 탭/토글 메커니즘으로 패널을 수직 스택하거나, 아이콘으로 접기. Pebble 에디터가 대상이며 Pixel 에디터 레이아웃은 데스크톱 전용으로 유지 가능.

---

### HIGH (모바일) / MEDIUM (태블릿) — 이슈 4: 터치 타겟이 44px 최소 기준 미달

**근본 원인:** UI 컴포넌트가 마우스 정밀도 기준으로 설계됨, 손가락 터치 기준이 아님.

**영향 컴포넌트와 크기:**
- `PebbleButton` — 40x40px (PebbleButton.svelte 37–38행) — 최소 기준보다 4px 부족
- `BevelButton` 아이콘 변형 — 36x36px
- `PebbleSwatch` 소 — 22x22px (PebbleSwatch.svelte 36–39행) — 최소 기준보다 22px 부족
- `PebbleSwatch` 대 — 32x32px (41–45행) — 최소 기준보다 12px 부족
- FgBg 스왑 버튼 — 18–20px

**현재 동작:** 작은 타겟에 대한 손가락 탭이 인접 요소를 자주 누르게 된다. 색상 스와치 선택이 특히 어렵다.

**수정 전략:** 컴포넌트 크기를 44px 최소 기준에 맞게 증가. 시각적 크기가 작아야 하는 스와치의 경우, 투명 패딩으로 히트 영역을 확장하면서 보이는 스와치는 작게 유지.

---

### MEDIUM-HIGH — 이슈 5: Shift와 Alt 수정자 키의 터치 UI 없음

**근본 원인:** 도형 제약(Shift)과 임시 스포이트(Alt)가 `editor-state.svelte.ts`의 키보드 수정자 감지로만 구현됨.

**영향 코드:**
- Shift 처리: 361–368행 (keydown), 412–417행 (keyup)
- Alt 처리: 343–350행 (keydown), 419–426행 (keyup)

**현재 동작:** 물리 키보드 없는 터치 기기에서 도형을 정사각형/원으로 제약하거나(Shift) 임시로 스포이트로 전환(Alt)할 수 없다. 이 기능들은 완전히 접근 불가능하다.

**수정 전략:** 이 수정자들에 대한 토글 버튼을 툴바에 추가. 키보드 수정자 동작을 미러링하는 "제약" 토글과 스포이트 모드 토글. UI 설계 결정이 필요하므로 마일스톤 2 작업.

---

### MEDIUM-HIGH — 이슈 6: Safe area 미처리

**근본 원인:** `app.html`의 뷰포트 메타 태그(5행)가 `width=device-width, initial-scale=1`을 사용하지만 `viewport-fit=cover`를 포함하지 않는다. CSS에서 `env(safe-area-inset-*)` 값을 사용하는 곳이 없다.

**영향 파일:**
- `src/app.html` — 뷰포트 메타 태그 (5행)
- `src/routes/pebble/+page.svelte` — 하단 패널이 고정 `--pebble-edge-gap: 16px` 사용

**현재 동작:** 노치/다이나믹 아일랜드가 있는 iPhone에서 콘텐츠가 잘릴 수 있다. 하단 도구 패널(`bottom: 16px`)이 홈 인디케이터와 겹칠 수 있다.

**수정 전략:** 메타 태그에 `viewport-fit=cover` 추가. 패널 위치에 `env(safe-area-inset-*)` 사용, 특히 하단 패널: `bottom: max(var(--pebble-edge-gap), env(safe-area-inset-bottom))`.

---

### MEDIUM-HIGH — 이슈 7: 가상 키보드가 레이아웃을 밀어냄

**근본 원인:** 숫자 입력 필드(캔버스 너비/높이)와 hex 색상 입력에 `inputmode` 속성이 없다. 코드베이스 전체에 `inputmode` 속성이 없다. 가상 키보드가 나타나면 뷰포트가 리사이즈되어 고정/절대 위치 요소를 밀어낼 수 있다.

**영향 인터랙션:**
- `TopControlsRight.svelte` (Pebble) / `CanvasSettings.svelte` (Pixel)의 캔버스 크기 입력
- `HsvPicker.svelte`의 Hex 색상 입력

**현재 동작:** 입력 필드를 탭하면 숫자 키패드 대신 전체 알파벳 키보드가 열린다. 뷰포트 리사이즈로 절대 위치 패널에서 레이아웃 밀림이 발생할 수 있다.

**수정 전략:** 치수 입력에 `inputmode="numeric"`, hex 입력에 `inputmode="text"` (+ `pattern`) 추가. `visualViewport` API로 키보드 존재를 감지하여 레이아웃 조정 검토.

---

### LOW — 이슈 8: iOS Safari 내보내기 동작

**근본 원인:** `export.ts`(11–24행)의 PNG 내보내기가 `document.createElement('a')` + 프로그래밍 방식 `click()`을 Blob URL과 함께 사용한다. iOS Safari에서 이 패턴은 다운로드를 트리거하는 대신 새 탭에서 이미지를 열 수 있다.

**영향 파일:** `src/lib/canvas/export.ts` — `exportAsPng` 함수

**수정 전략:** iOS Safari를 감지하고 가능한 경우 `navigator.share()` API를 대안으로 사용하거나, blob URL을 열고 길게 눌러 저장하도록 안내하는 방식으로 폴백.

---

### LOW — 이슈 9: 숫자 입력에 inputmode 없음

위의 이슈 7에 병합됨. `inputmode` 속성 수정은 사소하며 키보드 타입과 가상 키보드 UX를 모두 해결한다.

---

## 작업 분해

10개 이슈를 7개 구현 작업으로 그룹화:

| 작업 | 이슈 | 마일스톤 | 그룹화 근거 |
|------|------|----------|-------------|
| T1: 터치 핀치 줌 + 두 손가락 패닝 | 1, 2 | M1 | 동일 코드 경로(PixelCanvasView 포인터 핸들러), 동일 제스처 시스템 |
| T2: 반응형 레이아웃 | 3, 4의 일부(패널 겹침) | M1 | 둘 다 "작은 화면에서 레이아웃이 동작하지 않음" — 미디어 쿼리 + 패널 재구성을 함께 해결 |
| T3: 터치 타겟 크기 — 44px 최소 확보 | 4 | M1 | CSS 중심, 다른 변경과 독립적 |
| T4: 터치 수정자 대안 | 5 | M2 | UI 설계 결정 필요, T1의 터치 인프라 위에 구축 |
| T5: Safe area + 가상 키보드 대응 | 6, 7 | M1 | 둘 다 모바일 브라우저 크롬과 레이아웃의 상호작용 |
| T6: iOS Safari 내보내기 수정 | 8 | M1 | export.ts 단독 변경 |
| T7: 숫자 입력 모바일 최적화 | 9 (7에 병합) | M1 | 사소한 수정 |

### 실행 순서

```text
T7 → T3 → T1 → T5 → T2 → T6 → T4
```

근거: T7과 T3은 즉각적 효과가 있는 빠른 개선. T1은 가장 높은 영향도의 핵심 변경. T5는 T2의 대규모 레이아웃 작업 전에 safe area 기반을 확보. T6은 독립적이고 낮은 우선순위. T4는 마일스톤 2 항목.

## 공유 설계 결정

여러 작업에 걸쳐 적용되며, 구현 시 참조해야 하는 결정:

- **Pointer Events API 전면 사용** — 작업 012에서 이미 마이그레이션됨. 멀티터치 제스처 감지에도 Touch Events가 아닌 Pointer Events를 계속 사용 (여러 `pointerId` 추적).
- **캔버스의 `touch-action: none` 유지** — 캔버스가 이미 기본 브라우저 터치 처리를 막고 있다. 커스텀 제스처가 이를 완전히 대체해야 한다.
- **Pebble 에디터가 주요 대상** — Pixel 에디터는 당분간 데스크톱 전용으로 유지 가능. 반응형 및 터치 개선은 Pebble 레이아웃에 집중.
- **브레이크포인트 전략** — 구체적 값은 T2 계획 시 결정. 예상 구분: 모바일 (<640px), 태블릿 (640–1024px), 데스크톱 (>1024px).
- **반응형 값에 CSS 커스텀 프로퍼티 활용** — 미디어 쿼리 값을 하드코딩하지 않고 기존 토큰 시스템(`pebble-tokens.css`)을 활용.

## 기존 항목과의 관계

- **M2 "iPad + Apple Pencil optimization (hover preview, palm rejection)"** — 일반 터치 지원과 구분하기 위해 **"Apple Pencil: hover preview + palm rejection"**으로 이름 변경. 해당 항목은 Apple 전용 API(호버 감지, 팜 리젝션)를 다루며, 여기의 작업들은 모든 기기에서 동작하는 일반 터치/모바일 지원을 다룬다.
- **보류 "Responsive layout — extract SwiftUI size class transitions, adapt to web CSS breakpoints"** — T2에 흡수됨. 원래 항목은 Dual Shell PoC(네이티브 + 웹 비교)에 묶여 있었다. 네이티브 개발이 보류되었으므로, T2가 웹 셸에 대해 독립적으로 반응형 레이아웃을 다룬다.
