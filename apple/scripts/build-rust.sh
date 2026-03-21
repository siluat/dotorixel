#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────
# build-rust.sh — Xcode "Run Script" build phase
# Compiles the dotorixel-apple Rust crate for the active Xcode platform
# and copies the static library to apple/build/lib/.
# ─────────────────────────────────────────────

# Cargo may not be on PATH inside Xcode's sandboxed environment.
if [[ -f "$HOME/.cargo/env" ]]; then
    # shellcheck source=/dev/null
    source "$HOME/.cargo/env"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APPLE_DIR/.." && pwd)"
GENERATED_DIR="$APPLE_DIR/generated"
OUTPUT_DIR="$APPLE_DIR/build/lib"

# ─────────────────────────────────────────────
# Bootstrap: generate Swift/C bindings if missing
# ─────────────────────────────────────────────

SWIFT_COUNT=$(find "$GENERATED_DIR" -name "*.swift" 2>/dev/null | wc -l | tr -d ' ')

if [[ "$SWIFT_COUNT" -eq 0 ]]; then
    echo "note: No generated Swift bindings found — bootstrapping with host build"

    cargo build -p dotorixel-apple --manifest-path "$REPO_ROOT/Cargo.toml"

    HOST_TARGET=$(rustc -vV | awk '/^host:/ { print $2 }')
    BINDGEN="$REPO_ROOT/target/debug/uniffi-bindgen"

    "$BINDGEN" generate \
        --library "$REPO_ROOT/target/debug/libdotorixel_apple.dylib" \
        --language swift \
        --out-dir "$GENERATED_DIR"

    echo "note: Bindings generated at $GENERATED_DIR"
fi

# ─────────────────────────────────────────────
# Map Xcode env vars → Rust target triple
# ─────────────────────────────────────────────

PLATFORM_NAME="${PLATFORM_NAME:-macosx}"
ARCHS="${ARCHS:-arm64}"

case "${PLATFORM_NAME}" in
    macosx)
        case "${ARCHS}" in
            arm64)  RUST_TARGET="aarch64-apple-darwin" ;;
            x86_64) RUST_TARGET="x86_64-apple-darwin" ;;
            *)      echo "error: Unsupported macOS arch: ${ARCHS}" >&2; exit 1 ;;
        esac
        ;;
    iphoneos)
        RUST_TARGET="aarch64-apple-ios"
        ;;
    iphonesimulator)
        case "${ARCHS}" in
            arm64)  RUST_TARGET="aarch64-apple-ios-sim" ;;
            x86_64) RUST_TARGET="x86_64-apple-ios" ;;
            *)      echo "error: Unsupported simulator arch: ${ARCHS}" >&2; exit 1 ;;
        esac
        ;;
    *)
        echo "error: Unsupported platform: ${PLATFORM_NAME}" >&2
        exit 1
        ;;
esac

# ─────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────

echo "note: Building dotorixel-apple for ${RUST_TARGET}"

cargo build \
    -p dotorixel-apple \
    --manifest-path "$REPO_ROOT/Cargo.toml" \
    --target "$RUST_TARGET" \
    --release

# ─────────────────────────────────────────────
# Copy static library to fixed output path
# ─────────────────────────────────────────────

mkdir -p "$OUTPUT_DIR"

LIB_SRC="$REPO_ROOT/target/${RUST_TARGET}/release/libdotorixel_apple.a"

if [[ ! -f "$LIB_SRC" ]]; then
    echo "error: Static library not found at $LIB_SRC" >&2
    exit 1
fi

cp "$LIB_SRC" "$OUTPUT_DIR/libdotorixel_apple.a"
echo "note: Copied libdotorixel_apple.a to $OUTPUT_DIR"
