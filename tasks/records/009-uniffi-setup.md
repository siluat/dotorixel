# 009 — UniFFI setup — generate Swift bindings from `crates/core/`

## Results

| File | Description |
|------|-------------|
| `apple/Cargo.toml` | New crate for UniFFI Swift bindings (cdylib + staticlib + lib) |
| `apple/src/lib.rs` | Object wrappers (ApplePixelCanvas, AppleHistoryManager, AppleViewport), AppleError, free functions |
| `apple/src/bin/uniffi-bindgen.rs` | CLI binary for generating Swift bindings |
| `crates/core/Cargo.toml` | Added optional `uniffi` dependency and feature flag |
| `crates/core/src/lib.rs` | Added conditional `setup_scaffolding!()` behind uniffi feature |
| `crates/core/src/color.rs` | `cfg_attr` Record derive on `Color` |
| `crates/core/src/canvas.rs` | `cfg_attr` Record derive on `CanvasCoords` |
| `crates/core/src/viewport.rs` | `cfg_attr` Record derive on `ScreenCanvasCoords`, `ViewportSize` |
| `crates/core/src/tool.rs` | `cfg_attr` Enum derive on `ToolType` |
| `Cargo.toml` | Added `apple` to workspace members |
| `.gitignore` | Added `apple/generated/` |
| `docs/decisions/uniffi-mutex-interior-mutability.{ko,en}.md` | ADR: Mutex interior mutability for UniFFI Object wrappers |
| `tasks/progress.md` | Task tracking |

### Key Decisions

- Feature flag (`cfg_attr`) on core types for Records/Enums; wrapper Objects in `apple/` crate — follows Bitwarden pattern
- `Mutex<T>` for `ApplePixelCanvas` and `AppleHistoryManager` interior mutability (see `docs/decisions/uniffi-mutex-interior-mutability.ko.md`)
- Unified `AppleError` flat error in apple crate instead of annotating core errors (avoids `usize`/`char` incompatibility)
- `uniffi_reexport_scaffolding!()` in apple crate for robust multi-crate symbol export

### Notes

- Generated Swift files (`apple/generated/`) are gitignored; regenerate with `cargo run -p dotorixel-apple --bin uniffi-bindgen -- generate --library target/debug/libdotorixel_apple.dylib --language swift --out-dir apple/generated`
- UniFFI Objects don't support associated functions (static methods) — constants/utilities exposed as free functions
- This does not produce a runnable macOS/iPadOS app; Xcode project integration is the next task
