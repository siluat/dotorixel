# 043 — Editor UI Design: Layer/Animation Expansion

## Plan

Task 042에서 완성한 에디터 UI 7개 스크린을 기반으로, Milestone 3(레이어)과 Milestone 4(애니메이션) UI를 추가 설계한다. Aseprite/Pixquare 스타일의 통합 타임라인(레이어×프레임 그리드)을 채택하여 레이어와 애니메이션을 하나의 UI로 통합.

### 신규 스크린 (5개)

| # | 스크린명 | 크기 | 테마 | 노드 ID |
|---|---------|------|------|---------|
| 1 | Editor — Desktop Anim Light | 1440×900 | light | TkZDS |
| 2 | Editor — Desktop Anim Dark | 1440×900 | dark | PnPPg |
| 3 | Editor — iPad Anim | 1024×768 | light | l83g3 |
| 4 | Editor — Tablet Timeline Tab | 768×1024 | light | ezl8n |
| 5 | Editor — Mobile Timeline Tab | 390×844 | light | wbAke |

### 핵심 설계 결정

**Aseprite 스타일 통합 타임라인:**
- 레이어 사이드바(이름 + 눈 아이콘) + 프레임 그리드(셀 = 레이어×프레임 교차점)
- 별도의 Layers/Animate 탭 대신 하나의 Timeline으로 통합 → 탭 4개(Draw/Colors/Timeline/Settings)

**Desktop/iPad (≥1024px, 도킹 레이아웃):**
- 캔버스 하단에 타임라인 패널 (Desktop 180px, iPad 150px)
- 레이어 사이드바(140px/120px) + 프레임 그리드 영역
- Right Panel에서 Layers 섹션 제거(타임라인으로 이동)

**Tablet/Mobile (<1024px, 탭 네비게이션):**
- Timeline 탭 선택 시 캔버스를 유지하면서 하단에 컴팩트 타임라인 패널 배치 (Pixquare 방식)
- Tablet: 176px 패널 (44px 플레이백 바 + 132px 레이어/프레임 그리드)
- Mobile: 146px 패널 (38px 플레이백 바 + 108px 레이어/프레임 그리드)
- 캔버스가 전체 화면을 차지하지 않아 그리기 작업과 타임라인 조작을 동시에 할 수 있음

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | 5개 애니메이션 에디터 스크린 + pill 탭바 적용 + 타임라인 패널 레이아웃 수정 + 캔버스 정리 |

### Key Decisions

- Tablet/Mobile 타임라인은 캔버스를 가리지 않는 Pixquare 스타일 컴팩트 하단 패널 채택 (사용자 피드백 반영)
- 탭바를 pill 스타일로 변경 — cornerRadius 36 컨테이너 + accent 배경 활성 탭 + 4탭 구성 (Draw/Colors/Layers/Settings)
- DOTORIXEL acorn 아이콘을 모든 스크린 앱바에 추가 (favicon 이미지 fill)
- 타임라인 패널 frameArea를 고정 너비에서 fill_container flexbox로 전환 (오른쪽 빈 공간 제거)
- 초기 컨셉 화면 15개에 [Ref] 접두사 부여하여 활성 디자인과 구분
- 전체 22개 프레임을 섹션별로 재배치 (Design System → Current Features → Animation → Reference)

### Notes

- WCAG AA 대비율 감사 수행: --text-tertiary 토큰이 양쪽 모드 모두 기준 미달 (light 2.2~3.0:1, dark 2.2~3.2:1). 개선 권장사항 문서화했으나 토큰 값 변경은 미적용
- Task 042 기록파일이 누락되어 있어 이번 커밋에서 함께 생성
