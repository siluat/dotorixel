import Foundation
import Testing
@testable import Dotorixel

/// The Onion Skin's pure ghost compositing (issue 291, web parity: the ghost
/// treatment in `renderer.ts`): ghost buffers tinted by kind and dimmed to
/// ghost alpha, layered farthest first beneath the Active Frame's pixels,
/// producing the single renderer-facing buffer. Expected values are worked
/// examples derived from the web 218 spec's blend rule (60 % kind tint over
/// the ghost's own color, blitted at 40 % alpha, straight-alpha source-over)
/// — not recomputed through the implementation.
@Suite("Onion skin — ghost render compositing")
struct OnionSkinRenderTests {

    private func ghost(
        _ kind: OnionSkinGhostKind, distance: Int = 1, pixels: [UInt8]
    ) -> OnionSkinGhostRead {
        OnionSkinGhostRead(
            frameId: "ghost-\(kind)-\(distance)",
            kind: kind,
            distance: distance,
            pixels: Data(pixels)
        )
    }

    @Test("a previous ghost renders warm-tinted at ghost alpha; its transparent pixels stay transparent")
    func previousGhostTintsWarmPreservingTransparency() {
        // 2×1 canvas: the ghost holds one opaque red pixel and one transparent
        // pixel; the Active Frame is empty.
        let result = onionSkinRenderPixels(
            activePixels: Data(count: 8),
            ghosts: [ghost(.previous, pixels: [255, 0, 0, 255, 0, 0, 0, 0])]
        )

        // 0.6·#E5484D + 0.4·red = (239.4, 43.2, 46.2) at α 0.4 → (239, 43, 46, 102).
        #expect(Array(result[0..<4]) == [239, 43, 46, 102])
        // The tint never fills where the ghost itself is transparent —
        // checkerboard and Reference stay visible there.
        #expect(Array(result[4..<8]) == [0, 0, 0, 0])
    }

    @Test("a next ghost renders cool-tinted")
    func nextGhostTintsCool() {
        let result = onionSkinRenderPixels(
            activePixels: Data(count: 4),
            ghosts: [ghost(.next, pixels: [0, 255, 0, 255])]
        )

        // 0.6·#3B82F6 + 0.4·green = (35.4, 180, 147.6) at α 0.4 → (35, 180, 148, 102).
        #expect(Array(result) == [35, 180, 148, 102])
    }

    @Test("the Active Frame's art draws over ghosts — opaque pixels win, transparent pixels show the ghost")
    func activeFrameDrawsOverGhosts() {
        // 2×1 canvas: the ghost covers both pixels; the Active Frame paints
        // only the first, fully opaque.
        let result = onionSkinRenderPixels(
            activePixels: Data([0, 0, 255, 255, 0, 0, 0, 0]),
            ghosts: [ghost(.previous, pixels: [255, 0, 0, 255, 255, 0, 0, 255])]
        )

        #expect(Array(result[0..<4]) == [0, 0, 255, 255])
        #expect(Array(result[4..<8]) == [239, 43, 46, 102])
    }

    @Test("a semi-transparent ghost pixel keeps its own alpha scaled by the ghost dim")
    func semiTransparentGhostScalesAlpha() {
        let result = onionSkinRenderPixels(
            activePixels: Data(count: 4),
            ghosts: [ghost(.previous, pixels: [255, 0, 0, 128])]
        )

        // α = 0.4 · 128/255 → 51 of 255; the tint applies to color only.
        #expect(Array(result) == [239, 43, 46, 51])
    }

    @Test("overlapping ghosts draw farthest first, so the nearest neighbor reads strongest")
    func overlappingGhostsDrawFarthestFirst() {
        // The projection arrives in axis order — the near next ghost before
        // the far one — but draw order re-sorts by distance, farthest first.
        let result = onionSkinRenderPixels(
            activePixels: Data(count: 4),
            ghosts: [
                ghost(.next, distance: 1, pixels: [0, 255, 0, 255]),
                ghost(.next, distance: 2, pixels: [255, 0, 0, 255])
            ]
        )

        // Far red-tinted (137.4, 78, 147.6) under near green-tinted
        // (35.4, 180, 147.6), each at α 0.4: 0.625·near + 0.375·far at α 0.64.
        #expect(Array(result) == [74, 142, 148, 163])
    }

    @Test("an empty projection returns the Active Frame's pixels unchanged")
    func emptyProjectionIsIdentity() {
        let active = Data([7, 8, 9, 10])

        #expect(onionSkinRenderPixels(activePixels: active, ghosts: []) == active)
    }
}
