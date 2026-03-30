# 042 — Editor UI Design: Current Features

## Plan

Task 040(Screen Inventory & Breakpoint Matrix)과 Task 041(Design System Finalization)에서 정의한 브레이크포인트 매트릭스와 디자인 토큰을 기반으로, 현재 구현된 에디터 기능의 UI를 모든 브레이크포인트에 대해 설계한다.

### 스크린 (7개)

| # | 스크린명 | 크기 | 테마 | 노드 ID |
|---|---------|------|------|---------|
| 1 | Editor — Desktop Light | 1440×900 | light | atTXy |
| 2 | Editor — Desktop Dark | 1440×900 | dark | NyOgp |
| 3 | Editor — iPad Landscape | 1024×768 | light | J7plO |
| 4 | Editor — Medium Tablet | 768×1024 | light | zOegy |
| 5 | Editor — Mobile Draw | 390×844 | light | A9dne |
| 6 | Editor — Mobile Colors | 390×844 | light | Pe53N |
| 7 | Editor — Mobile Settings | 390×844 | light | yxcOL |

### 레이아웃 패러다임

- **≥1024px (Desktop/iPad):** 도킹 패널 레이아웃 — 좌측 툴바 + 캔버스 + 우측 설정 패널
- **<1024px (Tablet/Mobile):** 탭 네비게이션 — Draw/Colors/Settings 탭 전환

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | 7개 에디터 스크린 — 4개 브레이크포인트, 라이트/다크 테마 |

### Key Decisions

- Desktop/iPad는 도킹 패널(좌측 툴바 44px, 우측 설정 패널 220px), Tablet/Mobile은 탭 네비게이션으로 분리
- 모바일은 기능별 탭 분리 (Draw, Colors, Settings 각각 별도 스크린)
- Design System Reference 시트의 토큰을 직접 활용 ($--bg-surface, $--text-primary 등 변수 바인딩)
