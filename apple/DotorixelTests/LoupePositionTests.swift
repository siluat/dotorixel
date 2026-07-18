import Testing
import CoreGraphics
@testable import Dotorixel

/// Loupe overlay positioning (235): offset from the pointer, flipped and
/// clamped to stay inside the canvas area. Mirrors the web's
/// `loupe-position.ts` rules — mouse defaults to the top-right quadrant;
/// touch centers horizontally with a larger vertical offset.
@Suite("Loupe position — pointer offset, flipping, clamping")
struct LoupePositionTests {

    /// Baseline geometry: a 200×250 loupe in an 800×600 canvas area.
    private func input(
        pointer: CGPoint,
        inputSource: LoupeInputSource = .mouse
    ) -> LoupePositionInput {
        LoupePositionInput(
            pointer: pointer,
            viewport: CGSize(width: 800, height: 600),
            loupe: CGSize(width: 200, height: 250),
            mouseOffset: 20,
            touchOffset: 80,
            inputSource: inputSource
        )
    }

    @Test("mouse default: loupe sits in the top-right quadrant of the pointer")
    func mouseDefaultTopRight() {
        let p = computeLoupePosition(input(pointer: CGPoint(x: 300, y: 400)))

        // x: pointer + offset; y: pointer - height - offset.
        #expect(p == LoupePosition(x: 320, y: 130, quadrant: .tr))
    }

    @Test("mouse near the right edge flips to the left of the pointer")
    func mouseFlipsHorizontalNearRightEdge() {
        // 700 + 20 + 200 > 800 — the default tr position would clip the right edge.
        let p = computeLoupePosition(input(pointer: CGPoint(x: 700, y: 400)))

        #expect(p == LoupePosition(x: 700 - 200 - 20, y: 130, quadrant: .tl))
    }

    @Test("mouse near the top edge flips below the pointer")
    func mouseFlipsVerticalNearTopEdge() {
        // 100 - 250 - 20 < 0 — the default tr position would clip the top edge.
        let p = computeLoupePosition(input(pointer: CGPoint(x: 300, y: 100)))

        #expect(p == LoupePosition(x: 320, y: 100 + 20, quadrant: .br))
    }

    @Test("mouse in a viewport too narrow for even the flipped position clamps inward")
    func mouseClampsInDegenerateViewport() {
        // Flipped x would be 100 - 200 - 20 = -120; clamp keeps the loupe on-screen.
        let p = computeLoupePosition(LoupePositionInput(
            pointer: CGPoint(x: 100, y: 400),
            viewport: CGSize(width: 210, height: 600),
            loupe: CGSize(width: 200, height: 250),
            mouseOffset: 20,
            touchOffset: 80,
            inputSource: .mouse
        ))

        #expect(p == LoupePosition(x: 0, y: 130, quadrant: .tl))
    }

    @Test("touch centers horizontally with the larger vertical offset")
    func touchCentersWithTouchOffset() {
        let p = computeLoupePosition(input(pointer: CGPoint(x: 300, y: 500), inputSource: .touch))

        // x: centered on the pointer; y: pointer - height - touch offset.
        #expect(p == LoupePosition(x: 300 - 100, y: 500 - 250 - 80, quadrant: .tr))
    }

    @Test("touch near the top edge flips below the pointer")
    func touchFlipsVerticalNearTopEdge() {
        // 200 - 250 - 80 < 0 — the loupe flips below the finger.
        let p = computeLoupePosition(input(pointer: CGPoint(x: 300, y: 200), inputSource: .touch))

        #expect(p == LoupePosition(x: 200, y: 200 + 80, quadrant: .br))
    }

    @Test("touch near a side edge clamps inward instead of flipping horizontally")
    func touchClampsHorizontally() {
        // Centered x would be 750 - 100 = 650; 650 + 200 > 800, so clamp to 600.
        let p = computeLoupePosition(input(pointer: CGPoint(x: 750, y: 500), inputSource: .touch))

        #expect(p == LoupePosition(x: 800 - 200, y: 170, quadrant: .tr))
    }
}
