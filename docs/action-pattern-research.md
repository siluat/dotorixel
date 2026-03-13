# Action Pattern Research — Toolbar Abstraction

## Background

Toolbar button abstraction 작업 중 조사. 현재 ToolbarItem discriminated union이 Action 패턴의 축소판 역할을 하고 있으며, 메뉴/단축키/커맨드 팔레트 등 다중 진입점이 필요해질 때 Action 패턴으로 발전시키는 것을 검토.

## Core Concept

> **Action은 일급 객체다.** 실행 로직, 가용 상태, 시각적 표현(아이콘, 라벨)을 하나로 캡슐화한다.

현재 구조에서는 상태(`canUndo`)와 행동(`onUndo`)이 분리되어 페이지에 흩어져 있지만, Action 패턴에서는 하나의 객체 안에 응집된다.

```typescript
interface Action {
  id: string;
  icon: IconComponent;
  label: string;
  execute: () => void;
  isEnabled: () => boolean;
  isActive?: () => boolean;
}
```

## Key Principles

### 1. Action이 스스로의 상태를 안다

Toolbar가 `if (hasSelection && canUndo)` 같은 조건을 갖는 게 아니라, 각 Action이 자신의 가용 상태를 판단한다.

### 2. 동일 Action, 다중 진입점

하나의 Action이 toolbar 버튼, 메뉴 항목, 키보드 단축키, 커맨드 팔레트에서 동일하게 작동한다. Action을 한 번 정의하면 여러 UI에서 재사용.

### 3. Toolbar는 Action을 렌더링할 뿐

Toolbar는 Action 배열을 받아서 현재 스타일(BevelButton, FlatButton 등)로 렌더링하는 역할만 한다. 어떤 도구가 있는지, 언제 비활성화되는지 모른다.

## Framework Survey

| Framework | Abstraction | Key Mechanism |
|---|---|---|
| IntelliJ Platform | `AnAction` | `actionPerformed()` + `update()`. Presentation 객체가 UI 위치별로 별도 생성되어 같은 Action이 toolbar/menu에서 다른 모습 가능 |
| Eclipse RCP | Command + Handler | 선언적 명령(Command)과 행동 구현(Handler) 분리. plugin.xml로 toolbar 구성 선언 |
| WPF/MVVM | `ICommand` | `Execute()` + `CanExecute()`. RelayCommand/DelegateCommand로 ViewModel에서 정의 |
| Qt | `QAction` | 하나의 QAction 객체를 toolbar, menu, shortcut에 동시 등록. 상태 변경 시 모든 UI 자동 반영 |
| Excalidraw | Action system | 키보드, 툴바, 메뉴, 커맨드 팔레트 모두 동일 Action 사용. 선언적 Action 정의 |
| Fluent UI | `CommandBar` | CommandBarItem으로 선언적 구성. overflowBehavior로 그룹별 동작 제어 |
| Adobe Spectrum | ActionGroup/ActionBar | 합성 패턴으로 Action 그룹화 |

## IntelliJ Model (가장 정교한 구현)

```text
Action (behavior, id, name)
  ↓
Presentation (per UI location: icon, text, enabled, visible)
  ↓
Button UI component (renders the Presentation)
```

- 같은 Action이 toolbar에서는 아이콘만, menu에서는 아이콘+텍스트로 표시 가능
- `ActionGroup`으로 논리적 그룹핑, 중첩 가능
- ActionManager가 ActionToolbar를 action group으로부터 생성

## Common Patterns Across Frameworks

### Hierarchical Action Organization

복잡한 toolbar는 `ActionGroup`으로 관련 Action을 논리적으로 조직:
- Group이 Action 또는 다른 Group을 포함
- Group이 레이아웃과 overflow 동작을 정의
- Toolbar는 root group 하나만 렌더링

### Configuration Over Implementation

대부분의 엔터프라이즈 프레임워크는 선언적 설정(XML/JSON)으로 toolbar 구성:
- 코드 변경 없이 toolbar 구조 수정 가능
- 플러그인 시스템에서 toolbar에 Action 기여(contribute) 가능

### Presentation Abstraction

Action 메타데이터를 시각적 표현과 분리:
- 같은 Action, 다른 시각적 표현 (toolbar vs menu)
- Button 컴포넌트가 Action 로직을 모름

## DOTORIXEL Applicability

### 현재 (v0.1.0)

ToolbarItem discriminated union이 Action의 축소판:
- `kind: 'button'`이 icon, label, onclick, disabled, active를 포함
- Toolbar(ToolbarLayout)가 items를 렌더링
- 충분히 단순하고 현재 요구사항에 적합

### 도입 검토 시점

다음 중 하나가 필요해질 때:
- **메뉴바** 도입 시: 같은 Action을 toolbar과 menu에서 공유 필요
- **키보드 단축키 시스템** 도입 시: 현재 +page.svelte의 keydown 핸들러가 Action과 통합 가능
- **커맨드 팔레트** 도입 시: 모든 Action을 검색/실행하는 UI
- **플러그인/확장 시스템** 도입 시: 외부에서 Action을 등록하는 구조

### Migration Path

```text
현재: ToolbarItem[] → Toolbar
  ↓
1단계: Action 인터페이스 도입, ToolbarItem을 Action에서 파생
2단계: 키보드 단축키를 Action에 바인딩
3단계: 메뉴/커맨드 팔레트에서 동일 Action 재사용
```

## References

- [IntelliJ Platform Action System](https://plugins.jetbrains.com/docs/intellij/action-system.html)
- [IntelliJ Toolbar Documentation](https://plugins.jetbrains.com/docs/intellij/toolbar.html)
- [Eclipse Platform Command Framework](https://wiki.eclipse.org/Platform_Command_Framework/)
- [Eclipse Platform UI Command Design](https://wiki.eclipse.org/Platform_UI_Command_Design)
- [WPF Commanding in MVVM](https://riptutorial.com/wpf/example/32653/commanding-in-mvvm)
- [Fluent UI CommandBar](https://learn.microsoft.com/en-us/power-platform/guidance/creator-kit/commandbar)
- [Adobe Spectrum ActionBar](https://spectrum.adobe.com/page/action-bar/)
- [Command Pattern Overview](https://refactoring.guru/design-patterns/command)
- [W3C WAI Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [Excalidraw Action System](https://deepwiki.com/zsviczian/excalidraw/4.2-api-reference-and-integration-examples)
