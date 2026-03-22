# 010 — Xcode project — macOS + iPadOS targets, Rust library linked

## Results

| File | Description |
|------|-------------|
| `apple/project.yml` | XcodeGen project definition — single multi-destination target (macOS + iOS) |
| `apple/scripts/build-rust.sh` | Xcode pre-build script — maps platform/arch to Rust target triple, builds and copies static library |
| `apple/Dotorixel/Dotorixel-Bridging-Header.h` | Bridges two UniFFI FFI headers, resolves shared type duplication via `UNIFFI_SHARED_H` guard |
| `apple/Dotorixel/DotorixelApp.swift` | SwiftUI `@main` app entry point |
| `apple/Dotorixel/ContentView.swift` | Calls `coreVersion()` to verify Rust linking |
| `apple/Dotorixel/Assets.xcassets/` | Minimal asset catalog with AppIcon (empty placeholders) and AccentColor |
| `.gitignore` | Added `apple/Dotorixel.xcodeproj/` and `apple/build/` |

### Key Decisions

- XcodeGen over checked-in `.xcodeproj` — reproducible YAML definition, `.xcodeproj` gitignored
- Bridging header over Clang modules — two UniFFI headers share `RustBuffer`/`ForeignBytes` types via `UNIFFI_SHARED_H` guard; separate modules would create distinct types causing compile errors
- Direct static library linking over SPM/XCFramework — sufficient for app target, avoids multi-architecture packaging complexity
- `GENERATE_INFOPLIST_FILE: YES` — Xcode auto-generates Info.plist, no manual plist management needed

### Notes

- `xcodegen generate` must be run from `apple/` directory before opening in Xcode
- CLI builds require `CODE_SIGN_IDENTITY="-" CODE_SIGNING_ALLOWED=NO` (no development team configured yet)
- Build script bootstraps Swift bindings if `apple/generated/` is empty
