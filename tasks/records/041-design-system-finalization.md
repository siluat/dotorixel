# 041 — Design System Finalization

## Plan

Pen file 변수와 CSS 토큰 간 5가지 갭을 해소하고, 최종 디자인 시스템 사양을 확정한다.

### Deliverables

1. `docs/design-system.md` — 토큰 사양서 (색상, spacing, typography, 컴포넌트 패턴, 테마 전환 전략, 마이그레이션 가이드)
2. Pen file 디자인 시스템 레퍼런스 시트 — 색상 팔레트, 타이포그래피, spacing, 컴포넌트 카탈로그 시각화

### Key Decisions

- `--ds-*` 프리픽스로 통일 (기존 `--pebble-*`, `--color-*` 점진 교체)
- `data-theme="dark"` attribute 기반 테마 전환
- Pen file 18개 색상 변수를 CSS 토큰으로 1:1 매핑
- pixel-tokens.css 8단계 spacing scale을 Pebble 시스템으로 통합

## Results

| File | Description |
|------|-------------|
| `docs/design-system.md` | Design system specification — 18 color tokens (dark/light), typography, 8-level spacing scale, sizing/shape, breakpoint tokens, component patterns (Button/Panel/Input/Swatch), migration guide |
| `docs/pencil-dotorixel.pen` | Design System Reference frame — visual reference sheet with color palette (dark + light swatches), typography scale, spacing scale bars, component pattern demos |

### Key Decisions

- Spec is based on both sources: pen file variables (color foundation) + current CSS code (spacing/typography/component patterns), unified under `--ds-*` namespace
- Reference sheet uses hardcoded hex values to show both dark and light variants side-by-side in a single frame
- Light mode used as the default base for the reference sheet
