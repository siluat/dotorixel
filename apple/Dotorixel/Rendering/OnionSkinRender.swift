import Foundation

// Onion Skin ghost treatment (218 spec, web parity: `renderer.ts`): 60 % of
// the kind tint blended over the ghost's own colors, blitted at 40 % alpha.
// The tints mirror the web `--ds-onion-prev` / `--ds-onion-next` tokens —
// single values, not theme-paired, because the canvas checkerboard they
// render on is theme-independent.
private let onionSkinTintBlend: Float = 0.6
private let onionSkinGhostAlpha: Float = 0.4

private func onionSkinTint(for kind: OnionSkinGhostKind) -> SIMD3<Float> {
    switch kind {
    case .previous: SIMD3(229, 72, 77) // #E5484D
    case .next: SIMD3(59, 130, 246) // #3B82F6
    }
}

/// Renderer-facing Onion Skin composite (issue 291): layers the ghosts'
/// tinted, dimmed buffers beneath the Active Frame's pixels and returns the
/// single straight-alpha RGBA buffer the canvas texture uploads. Ghost
/// transparency is preserved — where both ghosts and the Active Frame are
/// transparent the result stays transparent, so checkerboard and Reference
/// show through. An empty projection returns `activePixels` unchanged, which
/// keeps Playback, exports, and thumbnails ghost-free by construction.
/// All buffers must share the canvas dimensions — the projection and the
/// render pixels come from the same document read.
func onionSkinRenderPixels(activePixels: Data, ghosts: [OnionSkinGhostRead]) -> Data {
    guard !ghosts.isEmpty else { return activePixels }

    // Premultiplied accumulation (color on the 0–255 scale, alpha on 0–1)
    // keeps intermediate source-over math exact until the single final
    // rounding to bytes.
    var accumulated = [SIMD4<Float>](repeating: .zero, count: activePixels.count / 4)

    func blit(_ pixels: Data, alphaScale: Float, tint: SIMD3<Float>?) {
        pixels.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
            for index in accumulated.indices {
                let base = index * 4
                let alpha = Float(raw[base + 3]) / 255 * alphaScale
                guard alpha > 0 else { continue }
                var color = SIMD3<Float>(
                    Float(raw[base]), Float(raw[base + 1]), Float(raw[base + 2])
                )
                if let tint {
                    color = onionSkinTintBlend * tint + (1 - onionSkinTintBlend) * color
                }
                let backdrop = accumulated[index]
                accumulated[index] = SIMD4(
                    color * alpha + SIMD3(backdrop.x, backdrop.y, backdrop.z) * (1 - alpha),
                    backdrop.w * (1 - alpha) + alpha
                )
            }
        }
    }

    // Farthest first, nearest last, so nearer neighbors read stronger where
    // ghosts overlap (web parity: the draw-order sort in `renderer.ts`). The
    // projection arrives in axis order; the index tiebreak keeps that order
    // for equal distances, since Swift's sort is not guaranteed stable.
    let drawOrder = ghosts.enumerated().sorted { lhs, rhs in
        if lhs.element.distance != rhs.element.distance {
            return lhs.element.distance > rhs.element.distance
        }
        return lhs.offset < rhs.offset
    }
    for (_, ghost) in drawOrder {
        blit(ghost.pixels, alphaScale: onionSkinGhostAlpha, tint: onionSkinTint(for: ghost.kind))
    }
    blit(activePixels, alphaScale: 1, tint: nil)

    var result = Data(count: activePixels.count)
    for (index, pixel) in accumulated.enumerated() {
        guard pixel.w > 0 else { continue }
        let base = index * 4
        result[base] = UInt8((pixel.x / pixel.w).rounded())
        result[base + 1] = UInt8((pixel.y / pixel.w).rounded())
        result[base + 2] = UInt8((pixel.z / pixel.w).rounded())
        result[base + 3] = UInt8((pixel.w * 255).rounded())
    }
    return result
}
