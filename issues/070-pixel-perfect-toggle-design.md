---
title: Pixel Perfect toggle — visual design (topBar / mAppBar)
status: done
created: 2026-04-18
parent: 069-pixel-perfect-drawing.md
---

## What to build

Pixel Perfect 토글 버튼 시각 디자인을 `.pen` 스펙으로 확정. 배치 (상단 바 — topBar / mAppBar), ON/OFF/hover/active/disabled 상태, PP 개념을 시각적으로 대변하는 **전용 커스텀 아이콘**, 4 tier 대응까지 포함 (parent PRD 의 수준 B).

Parent PRD 의 "UI" 섹션 및 Scenario 7, 9, 11 의 UI 기반을 정의하는 HITL 디자인 단계.

## Acceptance criteria

- `.pen` 파일에 PP 토글 컴포넌트의 ON / OFF / hover / active / disabled 상태가 명시됨
- PP 개념을 대변하는 커스텀 아이콘 디자인 (예: L 모서리 정리 / 계단 정돈 메타포)
- 4 tier (x-wide · wide · medium · compact) 배치 위치와 주변 요소 정렬 명시
- 디자인 토큰 일관성 유지 (기존 topBar / mAppBar 요소들과 동일 스타일 언어)
- ko / en / ja 레이블 길이 검토 (aria-label / 툴팁용) — 아이콘 전용이면 skip 가능
- 사용자 리뷰 후 승인

## Blocked by

None — can start immediately

## Scenarios addressed

- Scenario 7 (토글 클릭 → 다음 스트로크 반영) 의 UI 기반
- Scenario 9 (세션 간 영속 시 표시되는 상태) 의 시각 기반
- Scenario 11 (Shape 도구 영향 없음) — disabled state 로 시각적 경계 전달

## Design outcome

### 배치

**통일된 배치 원칙**: 모든 tier 에서 상단 바 (`topBar` on docked / `mAppBar` on compact) 의 `zoomControls` 와 `gridBtn` 사이. 두 컨테이너는 실질적으로 같은 "앱 상단 바" 구조이며 (logoSpacer · zoomControls · gridBtn · exportBtn), PP 는 **표시/모드 토글 그룹** 안에 위치.

| Tier | Container | 컨테이너 높이 | 위치 | 버튼 크기 | cornerRadius |
|---|---|---|---|---|---|
| x-wide (≥1440) | topBar | 48 | `zoomControls` 와 `gridBtn` 사이 | 32×32 | 6 |
| wide (≥1024) — iPad Landscape | topBar | 44 | 동일 | 36×36 | 6 |
| medium (≥600) | mAppBar | 48 | 동일 | 36×36 | 6 |
| compact (<600) | mAppBar | 44 | 동일 | 36×36 | 8 |

**Rationale**:
- StatusBar 배치안 (초안) 은 touch tier 의 mAppBar 배치와 비대칭이어서 mental model 이 분리됨. "PP 는 항상 상단 바" 로 통일하면 tier 간 학습 전이 (learnability) 가 높아짐.
- 상단 바 내부 순서 `[logoSpacer][zoomControls][pp][gridBtn][exportBtn]` — PP 는 `gridBtn` (격자 표시 토글) 과 같은 "drawing-mode toggles" 그룹에 속함. `exportBtn` (action) 은 끝에 고립.
- 버튼 크기는 각 tier 의 주변 버튼 (zoomControls, gridBtn, exportBtn) 과 일치시켜 시각 리듬 유지 (desktop 32px / 그 외 36px).

Touch tiers (wide iPad / medium / compact) 는 버튼 크기 36×36 이 기존 상단 바 버튼과 일치, 주변 여백 포함 시 `Touch targets: ≥44×44px` 만족.

### 아이콘

**"Clean staircase" (V2)** — 12×12 아이콘 영역 안에 4 개의 3×3 픽셀이 좌상단부터 우하단까지 대각선으로 배치. PP 적용 **후 결과** (깔끔한 계단) 를 보여주는 result-oriented 메타포.

탐색한 대안 (reference frame `PP Icon — Variant Exploration (HITL)` 에 보존):
- V1 Ghost corner — L 모양 + outline 모서리 (제거될 픽셀을 "빈 칸" 으로 표현). 1× 크기에서 outline 가독성 떨어짐.
- V3 Faded corner — L 모양 + opacity 0.35 모서리 (흐려짐으로 제거 암시). V1 보다 낫지만 V2 만큼 명확하진 않음.

### 크기

**x-wide (desktop, topBar h:48)**
- Visible: **32×32**, cornerRadius 6 — 주변 `zoomControls` / `gridBtn` / `exportBtn` (모두 32px) 와 일치
- Icon area: 16×16 (버튼 중앙, 8px 내부 padding)
- 픽셀: 4×4, 4 개, `(8,8) (12,12) (16,16) (20,20)` 대각선

**wide iPad Landscape · medium · compact (topBar/mAppBar, h:44~48)**
- Visible: **36×36**, cornerRadius 6 (iPad/medium) / 8 (compact)
- Icon area: 16×16 (버튼 중앙, 10px 내부 padding)
- 픽셀: 4×4, 4 개, `(10,10) (14,14) (18,18) (22,22)` 대각선

**공통**: 아이콘 메타포 (대각선 staircase) 와 색 토큰은 모든 tier 동일. 16×16 icon area 는 모든 production 사이즈 공통 — 버튼 크기가 커져도 icon 자체는 일정. Touch tiers 는 36×36 자체로 `Touch targets: ≥44×44px` 기준에 근접, 주변 여백 포함 시 충족.

### 상태 (Option C — Accent-fill ON)

| 상태 | Background | Icon color |
|---|---|---|
| ON (default) | `$--accent-subtle` | `$--accent` |
| ON + hover | unchanged (`$--accent-subtle`) | unchanged |
| ON + press | `color-mix($--accent-subtle, $--accent 10%)` | unchanged |
| OFF | transparent | `$--text-secondary` |
| OFF + hover | `$--bg-hover` | unchanged |
| OFF + press | `$--bg-active` | unchanged |
| ON / OFF + **disabled** | base state 유지 + `opacity: 0.4` | base state 유지 + `opacity: 0.4` |

Transition: **120ms ease-out** on `background-color` 와 `color`.

ON-state hover 무변화 는 기존 `.export-btn--active:hover` 패턴과 일관. OFF-state hover→press 는 기존 `.icon-btn` 패턴과 일관.

**Disabled 상태 — 활성 도구가 Pencil / Eraser 가 아닐 때**
- PP 는 Pencil / Eraser 에만 영향 (Line / Rectangle / Circle / Bucket / Eyedropper / Select 등은 무관 — Scenario 11)
- 관계 없는 도구 선택 시 토글을 숨기거나 제거하지 않고 **위치 유지 + opacity 0.4** 로 disabled 시각화
- Hover / press 반응 없음 (`pointer-events: none` 또는 `cursor: not-allowed`)
- `aria-disabled="true"` 부여
- Tooltip: `"Pixel Perfect (Pencil/Eraser only)"` 같은 문맥 안내로 교체
- Preference 값 (`pixelPerfect`) 은 그대로 유지되어 Pencil / Eraser 로 돌아오면 즉시 복귀

탐색한 대안 (reference frame `Q4 — ON/OFF state variants (HITL)` 에 보존):
- A. TopBar match — bg 항상 `$--bg-hover`, icon 색만 변화. StatusBar 에 버튼 chrome 이 항상 떠 있어 혼잡.
- B. StatusBar minimal — bg 없음, icon 색만 변화. 너무 조용해서 "모드 토글" 의 중요성 약화.
- C. (선택됨) Accent-fill ON — OFF transparent + ON accent-subtle bg. PP 가 **드로잉 로직을 바꾸는 모드** 라는 무게감을 반영.

Disabled 처리 대안:
- A. 항상 동일 표시 — 간단하지만 "지금 효과 있나?" 사용자가 헷갈림 (특히 Line 의 대각선 케이스)
- B. (선택됨) Dimmed (opacity 0.4) — 위치 유지 + 효과성까지 정직하게 전달
- C. Hidden — 버튼 제거 시 레이아웃 점프, 복귀 시 놀람 유발

### 레이블 / 접근성

- Icon-only (보이는 텍스트 없음)
- `aria-label`: 현재 상태를 포함 — 예: `"Pixel Perfect: On"` / `"Pixel Perfect: Off"` / disabled 시 `"Pixel Perfect (Pencil/Eraser only)"`
- Tooltip: `aria-label` 과 동일 문자열 노출
- `aria-disabled="true"` 부여 (disabled 상태)
- i18n: en / ko / ja 는 074 구현 단계에서 추가

### `.pen` 결과물

- 최종 스펙: **`PP Toggle — Final Design Spec`** (상태 matrix + disabled states + tier placements + spec summary)
- Tier 별 통합 mockup (모두 `zoomControls` ↔ `gridBtn` 사이, ON state):
  - **Desktop Dark / Light** → `topBar` (32×32, r6)
  - **iPad Landscape** → `topBar` (36×36, r6)
  - **Medium Tablet** → `mAppBar` (36×36, r6)
  - **Mobile Draw** → `mAppBar` (36×36, r8)
- 디자인 과정 참고 frames (보존, `(HITL)` 태그):
  - `PP Icon — Variant Exploration (HITL)` — 아이콘 3 변형 비교
  - `Q4 — ON/OFF state variants (HITL)` — 상태 구분 3 옵션 비교

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | `PP Toggle — Final Design Spec` 프레임 (spec summary + state matrix + disabled states + tier placements), 3 개 production 상단 바 (Desktop Dark/Light topBar, iPad Landscape topBar) + 2 개 mAppBar (Medium Tablet, Mobile Draw) 에 PP 토글 통합, HITL 탐색 프레임 2 개 보존 |
| `issues/070-pixel-perfect-toggle-design.md` | 디자인 결정 문서 — 배치/아이콘/크기/상태/disabled/레이블 전부 확정, 탐색한 대안 근거 기록 |
| `issues/074-pixel-perfect-toggle-ui.md` | 배치 컨테이너 명칭 StatusBar → topBar/mAppBar 로 갱신, disabled state 구현 요건 추가 |
| `tasks/todo.md` | 070 entry 라벨을 "PP toggle design (topBar/mAppBar)" 로 갱신 |

### Key Decisions

- **배치: StatusBar → topBar / mAppBar 로 재조정** (HITL 중반에 변경). 처음엔 StatusBar 를 제안했으나, touch tier 는 StatusBar 가 없어 mAppBar 에 놓일 수밖에 없었고, 이로 인해 "데스크톱 = StatusBar / 터치 = 상단 바" 라는 비대칭 mental model 이 발생. 사용자 제안으로 **모든 tier 에서 상단 바** 로 통일, `zoomControls` ↔ `gridBtn` 사이 = drawing-mode toggles 그룹.
- **아이콘: V2 Clean staircase** — L-corner 정리 결과 (깔끔한 계단) 를 result-oriented 메타포로 표현. 대안 V1 Ghost corner / V3 Faded corner 는 1× 크기 가독성 부족.
- **상태: Option C — Accent-fill ON** — OFF transparent + ON `$--accent-subtle` bg. PP 가 "드로잉 로직을 바꾸는 모드" 라는 무게감을 반영 (단순 TopBar-style 토글 A/B 탈락).
- **Disabled state: opacity 0.4 + aria-disabled** — 활성 도구가 Pencil/Eraser 가 아닐 때. 숨기거나 제거하지 않고 위치 유지, preference 도 유지. 대안 A (항상 동일) / C (hidden) 탈락.
- **아이콘 크기 전략**: 16×16 icon area 는 모든 production 사이즈 (32×32, 36×36) 공통 — 버튼이 커져도 아이콘 자체는 일정. Abstract demo 만 12×12 유지.

### Notes

- State matrix 의 cell 들은 20×20 (abstract size) 로 렌더링. Production tier 마다 버튼 크기가 다르므로 matrix 는 상태 semantics 전용 레퍼런스이며, 실제 크기는 "Tier placements" 섹션에서 확인.
- Light OFF-disabled 는 대비가 매우 낮아 거의 보이지 않음 — 이는 의도적 (클릭 유도 방지). 필요 시 074 구현에서 opacity 값 (0.4 → 0.5) 조정 가능.
- Disabled tooltip 문자열 `"Pixel Perfect (Pencil/Eraser only)"` 은 영문 기준 — 074 에서 ko/ja 번역 추가 예정.
- HITL exploration frames (`PP Icon — Variant Exploration`, `Q4 — ON/OFF state variants`) 는 디자인 의사결정 근거로 .pen 내 보존.
