---
title: StatusBar Pixel Perfect toggle — visual design
status: open
created: 2026-04-18
parent: 069-pixel-perfect-drawing.md
---

## What to build

StatusBar 의 Pixel Perfect 토글 버튼 시각 디자인을 `.pen` 스펙으로 확정. 버튼 배치, ON/OFF/hover/active 상태, 그리고 PP 개념을 시각적으로 대변하는 **전용 커스텀 아이콘** 까지 포함 (parent PRD 의 수준 B).

Parent PRD 의 "UI" 섹션 및 Scenario 7, 9 의 UI 기반을 정의하는 HITL 디자인 단계.

## Acceptance criteria

- `.pen` 파일에 PP 토글 컴포넌트의 ON / OFF / hover / active 네 가지 상태가 명시됨
- PP 개념을 대변하는 커스텀 아이콘 디자인 (예: L 모서리 정리 / 계단 정돈 메타포)
- StatusBar 내 배치 위치와 주변 요소와의 간격·정렬 명시
- 디자인 토큰 일관성 유지 (기존 StatusBar 요소들과 동일 스타일 언어)
- ko / en / ja 레이블 길이 검토 (aria-label / 툴팁용) — 아이콘 전용이면 skip 가능
- 사용자 리뷰 후 승인

## Blocked by

None — can start immediately

## Scenarios addressed

- Scenario 7 (토글 클릭 → 다음 스트로크 반영) 의 UI 기반
- Scenario 9 (세션 간 영속 시 표시되는 상태) 의 시각 기반
