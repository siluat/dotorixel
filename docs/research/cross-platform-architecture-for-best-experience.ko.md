# Cross-Platform Architecture for Best Pixel Art Editor Experience

> 모든 플랫폼에서 최고의 픽셀 아트 에디터 환경을 제공하기 위한 기술 전략 리서치.

## 핵심 원칙: Shared Core + Platform-Native Shell

"모든 플랫폼에서 최고"를 달성한 앱들은 거의 예외 없이 이 패턴을 따른다.

```text
┌───────────────────────────────────────────────────────────┐
│            Platform Shell (각 플랫폼 네이티브)            │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │   Apple   │ │  Android  │ │  Desktop  │ │    Web    │  │
│  │  SwiftUI  │ │  Compose  │ │ OS-native │ │ Svelte 등 │  │
│  │  +Metal   │ │  +Vulkan  │ │  +Vulkan  │ │  +WebGPU  │  │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘  │
│        │             │             │             │        │
│  ┌─────┴─────────────┴─────────────┴─────────────┴─────┐  │
│  │                 Shared Core (Rust)                  │  │
│  │  픽셀 버퍼 · 도구 알고리즘 · Undo/Redo · 파일 포맷  │  │
│  │  컬러 연산 · 레이어 합성 · 선택 영역 · 좌표 변환    │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

## 이 패턴을 쓰는 실제 사례들

| 앱 | Shared Core | Platform Shell |
|---|---|---|
| **Figma** | C++ 렌더링 엔진 | Web(WASM) + 데스크톱(Electron) + 모바일(네이티브) |
| **1Password** | Rust core | SwiftUI / Kotlin / Electron |
| **Signal** | Rust (libsignal) | Swift / Kotlin / Electron |
| **Zed Editor** | Rust (GPUI) | Metal(macOS), Vulkan(Linux) |

## 픽셀 아트 에디터에 적용

### Layer 1: Shared Core — Rust

플랫폼과 무관한 모든 비즈니스 로직을 Rust로 작성한다.

```text
core/
├── pixel_buffer.rs    # RGBA 버퍼, 레이어 합성, 블렌드 모드
├── tools/             # 연필, 지우개, 채우기, 선, 도형, 선택
├── history.rs         # Undo/Redo (커맨드 패턴 or 스냅샷)
├── color.rs           # HSV/RGB 변환, 팔레트 관리
├── viewport.rs        # 좌표 변환, 줌/팬
├── format/            # .aseprite, .png, .ase, 커스텀 포맷
└── tilemap.rs         # 타일셋/타일맵 시스템
```

**왜 Rust인가 (이 시나리오에서):**

- C++급 성능 + 메모리 안전성
- wasm-pack으로 웹 타겟 컴파일 가능
- iOS/Android에 .a/.so 라이브러리로 직접 링크
- 데스크톱에서 네이티브 실행

### Layer 2: 렌더링 — 두 가지 전략

#### 전략 A: wgpu (Rust 크로스플랫폼 GPU)

```text
wgpu backends:
├── Metal     → iOS, macOS
├── Vulkan    → Android, Windows, Linux
├── DX12      → Windows
└── WebGPU    → 브라우저
```

- Rust로 렌더링 파이프라인을 한 번 작성하면 모든 플랫폼에서 GPU 가속
- Firefox의 WebGPU 구현체로 사용될 만큼 성숙
- **단점:** UI까지 직접 그려야 하는 부담

#### 전략 B: 플랫폼별 네이티브 렌더링

| 플랫폼 | 렌더러 | 장점 |
|---|---|---|
| iOS/macOS | MetalKit | Apple Pencil 저지연, ProMotion 120Hz |
| Android | Vulkan / OpenGL ES | 스타일러스 최적화 |
| Desktop | Vulkan / DX12 | 대형 캔버스 성능 |
| Web | WebGPU / WebGL2 | 제로 인스톨 |

- 각 플랫폼의 GPU API를 직접 사용해서 최고 성능
- **단점:** 렌더러를 4번 작성 (가장 비싼 부분)

**현실적 선택:** 전략 A(wgpu)로 시작하되, 플랫폼별 최적화가 필요한 부분만 네이티브로 교체. 예를 들어 Apple Pencil 입력 처리는 Metal + UIKit으로 직접 해야 저지연을 달성할 수 있다.

### Layer 3: UI Shell — 플랫폼 네이티브

"최고의 경험"을 결정짓는 층.

| 플랫폼 | UI 기술 | 플랫폼 고유 UX |
|---|---|---|
| iOS/iPadOS | SwiftUI + UIKit | Apple Pencil, 멀티태스킹, Stage Manager |
| macOS | SwiftUI + AppKit | 메뉴바, 키보드 중심 워크플로우, 다중 윈도우 |
| Android | Jetpack Compose | 스타일러스, Material You |
| Windows/Linux | egui (Rust) 또는 Qt | 키보드 단축키, 대형 모니터 |
| Web | Svelte/React | 제로 인스톨, 공유, 협업 |

### 각 플랫폼으로의 Core 바인딩

```text
Rust Core
  ├─→ iOS/macOS:   Swift ↔ Rust (UniFFI 또는 C FFI)
  ├─→ Android:     Kotlin ↔ Rust (JNI via UniFFI)
  ├─→ Desktop:     직접 Rust 실행
  └─→ Web:         WASM (wasm-bindgen)
```

[UniFFI](https://mozilla.github.io/uniffi-rs/) (Mozilla 개발)가 핵심이다. Rust 코드에서 Swift/Kotlin 바인딩을 자동 생성해주므로 인터페이스 유지 비용이 크게 줄어든다.

## 비용 현실

| 요소 | 개발량 |
|---|---|
| Rust Core | 1× (한 번 작성, 모든 플랫폼 공유) |
| 렌더링 (wgpu) | 1× + 플랫폼별 튜닝 |
| iOS UI | 1× |
| macOS UI | 0.5× (iOS와 공유 가능한 부분 있음) |
| Android UI | 1× |
| Desktop UI | 1× |
| Web UI | 1× |
| 바인딩/글루 코드 | 0.5× per platform |

대략 **5~6배의 개발 비용** vs 단일 크로스플랫폼 프레임워크. 하지만:

- Core가 전체 코드의 60~70%를 차지 → 실제 중복은 UI 30~40%뿐
- 각 플랫폼 UI는 해당 플랫폼 전문 개발자 1명이면 충분
- 점진적 확장이 가능 — 한 플랫폼씩 추가

## 현실적 실행 순서

```text
Phase 1: Rust Core + Web (WASM + Svelte)
         → 가장 빠른 검증, 가장 넓은 도달

Phase 2: + iOS/iPadOS (SwiftUI + Metal)
         → 태블릿 시장, Apple Pencil 경험

Phase 3: + macOS / Windows / Linux 데스크톱
         → 전문가 시장

Phase 4: + Android
         → 나머지 모바일 커버
```

## 참고: Pixquare 사례

Pixquare(iOS/iPadOS 픽셀 아트 에디터)는 Apple MetalKit으로 렌더링하는 네이티브 앱이다. Apple 생태계 전용으로 플랫폼을 좁히고 성능을 극대화한 전략. 1인 개발자(Son Nguyen)가 Aseprite에서 영감을 받아 개발했으며, App Store 평점 4.86/5.

## 관련 논의 요약

이 문서 작성에 앞서 다음 주제들에 대한 분석이 진행되었다:

1. **Rust/WASM 필요성 분석** — 현재 프로젝트 스코프(8~32px 캔버스)에서는 TypeScript만으로 충분. 타일맵/레벨 디자인까지 확장해도 성능 병목은 CPU가 아니라 렌더링(GPU)
2. **Tauri 모바일 현황** — 데스크톱은 검증된 사례 있음(Cap, Aptabase 등). 모바일 스토어 출시 사례는 사실상 전무
3. **Capacitor vs Flutter** — Capacitor는 "웹을 모바일로", Flutter는 "모바일을 웹으로". 웹 우선이면 Capacitor, 모바일 품질 우선이면 Flutter
4. **최고 품질 전략** — 크로스플랫폼 프레임워크로는 "모든 곳에서 최고"를 달성할 수 없음. Shared Core + Platform-Native Shell 패턴이 유일한 경로
