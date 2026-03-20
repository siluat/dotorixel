# UniFFI Object 래퍼의 Interior Mutability

## 상태

채택됨 (2026-03-21)

## 맥락

DOTORIXEL의 Apple 네이티브 셸은 UniFFI를 통해 Rust 코어를 Swift에 노출한다. UniFFI Object 타입은 `Arc<T>`로 감싸지며, `Arc<T>`는 `&T`(불변 참조)만 제공한다.

그런데 `PixelCanvas`와 `HistoryManager`의 핵심 기능은 `&mut self` 메서드다:

- `PixelCanvas::set_pixel(&mut self, ...)` — 픽셀 그리기
- `PixelCanvas::clear(&mut self)` — 캔버스 초기화
- `PixelCanvas::restore_pixels(&mut self, ...)` — 실행 취소 시 복원
- `HistoryManager::push_snapshot(&mut self, ...)` — 스냅샷 저장
- `HistoryManager::undo(&mut self, ...)` / `redo(&mut self, ...)` — 실행 취소/다시 실행

`Arc<T>` 안에서 이 메서드들을 호출하려면 `&self`에서 내부 상태를 변경할 수 있는 메커니즘이 필요하다.

참고: WASM 바인딩(`wasm/`)은 `&mut self`를 직접 노출한다. JavaScript가 싱글스레드이므로 배타적 가변 참조가 안전하기 때문이다. UniFFI는 Swift/Kotlin의 멀티스레드 환경을 전제하므로 같은 방식을 사용할 수 없다.

## 결정

래퍼 내부에서 `Mutex<T>`로 코어 타입을 감싸고, `&self` 메서드에서 잠금을 획득하여 내부 데이터를 변경한다.

```rust
pub struct ApplePixelCanvas {
    inner: Mutex<PixelCanvas>,
}

impl ApplePixelCanvas {
    fn set_pixel(&self, x: u32, y: u32, color: Color) -> Result<(), AppleError> {
        self.inner.lock().unwrap().set_pixel(x, y, color)?;
        Ok(())
    }
}
```

적용 대상:

| 래퍼 타입 | Interior Mutability | 이유 |
|---|---|---|
| `ApplePixelCanvas` | `Mutex<PixelCanvas>` | `set_pixel`, `clear`, `restore_pixels` 등 가변 메서드 |
| `AppleHistoryManager` | `Mutex<HistoryManager>` | `push_snapshot`, `undo`, `redo`, `clear` 등 가변 메서드 |
| `AppleViewport` | 불필요 | 모든 메서드가 `&self` → `Self` (불변, 새 인스턴스 반환) |

## 검토한 대안

### 대안 A: 불변 패턴 (새 인스턴스 반환)

`Viewport`처럼 `&self` → `Self`로 전환하여 매 호출마다 새 인스턴스를 반환.

```rust
fn with_pixel(&self, x: u32, y: u32, color: Color) -> Self // 전체 버퍼 복사
```

**기각 사유**: `PixelCanvas`의 픽셀 버퍼(`Vec<u8>`)는 32×32 캔버스에서 4KB, 128×128에서 64KB다. 스트로크 하나에 `set_pixel`이 수십 번 호출되므로 매번 버퍼를 복사하면 수십~수백 KB의 불필요한 할당이 발생한다. `HistoryManager`는 최대 100개 스냅샷(수 MB)을 담고 있어 더 심각하다. `Viewport`에서 이 패턴이 동작하는 이유는 데이터가 4개 숫자 필드(32바이트)로 극히 작기 때문이다.

### 대안 B: 상태 없는 함수 방식

Object를 사용하지 않고, Swift에서 바이트 배열을 보유하며 Rust를 순수 함수로만 호출.

```swift
var pixels: [UInt8] = createCanvas(width: 32, height: 32)
pixels = setPixel(pixels, x: 3, y: 4, color: red)
```

**기각 사유**: 매 호출마다 전체 픽셀 버퍼가 FFI 경계를 왕복 복사된다. 대안 A의 복사 비용에 FFI 마샬링 오버헤드까지 추가되어 가장 비효율적이다.

### 비교

| 기준 | 대안 A (불변) | 대안 B (함수) | **Mutex (채택)** |
|---|---|---|---|
| set_pixel 1회 비용 | ~4KB 복사 | ~8KB 복사 (왕복) | **~50ns 잠금** |
| 스트로크 20px 비용 | ~80KB | ~160KB | **~1μs** |
| 버퍼 복사 | 매 호출 | 매 호출 × 2 | **없음** |
| 코어 변경 필요 | 예 (API 전체 재설계) | 예 (API 전체 재설계) | **아니오** |
| UniFFI 공식 권장 | 아니오 | 아니오 | **예** |

## 결과

### 이점

- 코어 타입(`PixelCanvas`, `HistoryManager`)을 수정하지 않고 바인딩 레이어에서만 동시성을 처리한다. WASM 바인딩과 코어 테스트는 영향을 받지 않는다.
- UniFFI 공식 예제(`sprites`, `todolist`)와 실전 프로젝트(Mozilla fxa-client, Bitwarden)가 동일한 패턴을 사용한다.
- Mutex 잠금 비용(~50ns)은 대상 캔버스 크기(최대 128×128)에서 무시할 수 있는 수준이다.

### 트레이드오프

- 모든 가변 메서드 호출에 잠금 오버헤드가 추가된다. 현재 캔버스 크기에서는 무시할 수 있으나, 캔버스 크기가 크게 증가하거나 고빈도 동시 접근이 발생하면 재검토가 필요하다.
- `Mutex` 대신 `RwLock`을 사용하면 동시 읽기(렌더링)를 허용할 수 있다. 프로파일링에서 잠금 경합이 확인될 때 전환한다.
