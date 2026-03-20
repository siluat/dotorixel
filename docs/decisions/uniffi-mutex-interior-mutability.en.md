# Interior Mutability for UniFFI Object Wrappers

## Status

Accepted (2026-03-21)

## Context

DOTORIXEL's Apple native shell exposes the Rust core to Swift via UniFFI. UniFFI Object types are wrapped in `Arc<T>`, which only provides `&T` (immutable references).

However, the core operations of `PixelCanvas` and `HistoryManager` require `&mut self`:

- `PixelCanvas::set_pixel(&mut self, ...)` — draw a pixel
- `PixelCanvas::clear(&mut self)` — reset the canvas
- `PixelCanvas::restore_pixels(&mut self, ...)` — restore from undo snapshot
- `HistoryManager::push_snapshot(&mut self, ...)` — save a snapshot
- `HistoryManager::undo(&mut self, ...)` / `redo(&mut self, ...)` — undo/redo

Calling these methods through `Arc<T>` requires a mechanism to mutate internal state from `&self`.

Note: The WASM bindings (`wasm/`) expose `&mut self` directly because JavaScript is single-threaded, making exclusive mutable references safe. UniFFI targets multi-threaded environments (Swift/Kotlin), so the same approach cannot be used.

## Decision

Wrap core types in `Mutex<T>` inside the binding wrappers, acquiring the lock in `&self` methods to mutate internal data.

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

Scope of application:

| Wrapper Type | Interior Mutability | Reason |
|---|---|---|
| `ApplePixelCanvas` | `Mutex<PixelCanvas>` | Mutable methods: `set_pixel`, `clear`, `restore_pixels`, etc. |
| `AppleHistoryManager` | `Mutex<HistoryManager>` | Mutable methods: `push_snapshot`, `undo`, `redo`, `clear`, etc. |
| `AppleViewport` | Not needed | All methods are `&self` → `Self` (immutable, returns new instance) |

## Alternatives Considered

### Alternative A: Immutable Pattern (Return New Instances)

Convert to `&self` → `Self` like `Viewport`, returning a new instance on every call.

```rust
fn with_pixel(&self, x: u32, y: u32, color: Color) -> Self // full buffer copy
```

**Rejected**: `PixelCanvas` holds a pixel buffer (`Vec<u8>`) of 4KB at 32×32 and 64KB at 128×128. A single stroke calls `set_pixel` dozens of times, so copying the entire buffer each time would cause tens to hundreds of KB of unnecessary allocation. `HistoryManager` holds up to 100 snapshots (several MB), making it even worse. This pattern works for `Viewport` only because its data is 4 numeric fields (32 bytes).

### Alternative B: Stateless Function Approach

Do not use Objects. Swift holds the byte array and calls Rust as pure functions.

```swift
var pixels: [UInt8] = createCanvas(width: 32, height: 32)
pixels = setPixel(pixels, x: 3, y: 4, color: red)
```

**Rejected**: The entire pixel buffer is copied across the FFI boundary on every call (round-trip). This adds FFI marshalling overhead on top of Alternative A's copy cost, making it the least efficient option.

### Comparison

| Criterion | Alt A (Immutable) | Alt B (Functions) | **Mutex (Adopted)** |
|---|---|---|---|
| Cost per set_pixel | ~4KB copy | ~8KB copy (round-trip) | **~50ns lock** |
| Cost per 20px stroke | ~80KB | ~160KB | **~1μs** |
| Buffer copies | Every call | Every call × 2 | **None** |
| Core changes required | Yes (full API redesign) | Yes (full API redesign) | **No** |
| UniFFI officially recommended | No | No | **Yes** |

## Consequences

### Benefits

- Core types (`PixelCanvas`, `HistoryManager`) remain unmodified; concurrency is handled entirely in the binding layer. WASM bindings and core tests are unaffected.
- Follows the same pattern used by UniFFI's official examples (`sprites`, `todolist`) and production projects (Mozilla fxa-client, Bitwarden).
- Mutex lock overhead (~50ns) is negligible for the target canvas sizes (up to 128×128).

### Trade-offs

- Every mutable method call incurs lock overhead. Negligible at current canvas sizes, but needs re-evaluation if canvas sizes grow significantly or high-frequency concurrent access occurs.
- `RwLock` could be used instead of `Mutex` to allow concurrent reads (e.g., rendering while drawing). Switch when profiling confirms lock contention.
