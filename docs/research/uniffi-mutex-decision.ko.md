# UniFFI Object 래퍼의 Interior Mutability 결정

## 요약

UniFFI Object 래퍼(`ApplePixelCanvas`, `AppleHistoryManager`)에서 코어 타입의 가변 메서드를 호출하기 위해 `Mutex`를 사용한다.

## 제약 조건

UniFFI는 Object 타입을 `Arc<T>`로 감싼다. `Arc<T>`는 공유 소유권을 위한 스마트 포인터로, `&T`(불변 참조)만 제공한다. `&mut T`를 직접 얻을 수 없다.

그런데 `PixelCanvas`와 `HistoryManager`는 핵심 기능이 `&mut self` 메서드다:

- `PixelCanvas::set_pixel(&mut self, ...)` — 픽셀 그리기
- `PixelCanvas::clear(&mut self)` — 캔버스 초기화
- `PixelCanvas::restore_pixels(&mut self, ...)` — 실행 취소 시 복원
- `HistoryManager::push_snapshot(&mut self, ...)` — 스냅샷 저장
- `HistoryManager::undo(&mut self, ...)` / `redo(&mut self, ...)` — 실행 취소/다시 실행

## 검토한 대안

### 대안 A: 불변 패턴 (새 인스턴스 반환)

`Viewport`처럼 `&self` → `Self`로 전환하여 매 호출마다 새 인스턴스를 반환하는 방식.

```rust
fn with_pixel(&self, x: u32, y: u32, color: Color) -> Self // 전체 버퍼 복사
```

**기각 사유**: `PixelCanvas`의 픽셀 버퍼(`Vec<u8>`)는 32×32 캔버스에서 4KB, 128×128에서 64KB다. 스트로크 하나에 `set_pixel`이 수십 번 호출되므로 매번 버퍼를 복사하면 수십~수백 KB의 불필요한 할당이 발생한다. `HistoryManager`는 최대 100개 스냅샷(수 MB)을 담고 있어 더 심각하다.

`Viewport`에서 이 패턴이 동작하는 이유는 데이터가 4개 숫자 필드(32바이트)로 극히 작기 때문이다.

### 대안 B: 상태 없는 함수 방식

Object를 사용하지 않고, Swift에서 바이트 배열을 보유하며 Rust를 순수 함수로만 호출.

```swift
var pixels: [UInt8] = createCanvas(width: 32, height: 32)
pixels = setPixel(pixels, x: 3, y: 4, color: red)
```

**기각 사유**: 매 호출마다 전체 픽셀 버퍼가 FFI 경계를 왕복 복사된다. 대안 A의 복사 비용에 FFI 마샬링 오버헤드까지 추가되어 가장 비효율적이다.

### 대안 C: Mutex (채택)

래퍼 내부에서 `Mutex<T>`로 코어 타입을 감싸고, `&self` 메서드에서 잠금을 획득하여 내부 데이터를 변경.

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

## 채택 근거

| 기준 | 대안 A (불변) | 대안 B (함수) | **대안 C (Mutex)** |
|---|---|---|---|
| set_pixel 1회 비용 | ~4KB 복사 | ~8KB 복사 (왕복) | **~50ns 잠금** |
| 스트로크 20px 비용 | ~80KB | ~160KB | **~1μs** |
| 버퍼 복사 | 매 호출 | 매 호출 × 2 | **없음** |
| 코어 변경 필요 | 예 (API 전체 재설계) | 예 (API 전체 재설계) | **아니오** |
| UniFFI 공식 권장 | 아니오 | 아니오 | **예** |

Mutex 잠금 비용(~50ns)은 `set_pixel` 실제 연산(배열 인덱스 + 4바이트 쓰기)과 같은 규모이며, 스트로크 전체를 처리해도 1 마이크로초 미만이다.

## 적용 범위

| 래퍼 타입 | Interior Mutability | 이유 |
|---|---|---|
| `ApplePixelCanvas` | `Mutex<PixelCanvas>` | `set_pixel`, `clear`, `restore_pixels` 등 가변 메서드 |
| `AppleHistoryManager` | `Mutex<HistoryManager>` | `push_snapshot`, `undo`, `redo`, `clear` 등 가변 메서드 |
| `AppleViewport` | 불필요 | 모든 메서드가 `&self` → `Self` (불변, 새 인스턴스 반환) |

## Mutex vs RwLock

`Mutex`로 시작한다. `RwLock`은 동시 읽기를 허용하여 렌더링(읽기)과 그리기(쓰기)가 동시에 일어나는 경우에 유리하지만, DOTORIXEL의 대상 캔버스 크기(최대 128×128, 64KB)에서 잠금 경합이 병목이 될 가능성은 매우 낮다. 프로파일링에서 경합이 확인될 때 `RwLock`으로 전환한다.

## 참고: wasm-bindgen과의 차이

WASM 바인딩(`wasm/`)은 `&mut self`를 직접 노출한다. JavaScript가 싱글스레드이므로 배타적 가변 참조가 안전하기 때문이다. UniFFI는 Swift/Kotlin의 멀티스레드 환경을 전제하므로 `Arc` + interior mutability가 필수다. 같은 코어를 감싸도 플랫폼의 동시성 모델에 따라 바인딩 설계가 달라진다.
