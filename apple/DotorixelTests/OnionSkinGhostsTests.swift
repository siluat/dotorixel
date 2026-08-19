import Testing
@testable import Dotorixel

/// The Onion Skin's pure neighbor selection (issue 290, web parity:
/// `onionSkinGhosts` in `onion-skin.ts`): frame ids in axis order + the
/// Active Frame + a range config → ghost descriptors in axis order, clamped
/// at the axis ends, never wrapping.
@Suite("Onion skin — neighbor selection")
struct OnionSkinGhostsTests {

    @Test("a middle frame projects one ghost on each side in axis order")
    func middleFrameProjectsBothSides() {
        let ghosts = onionSkinGhosts(
            frameIds: ["a", "b", "c"],
            activeFrameId: "b",
            config: OnionSkinConfig(previousCount: 1, nextCount: 1)
        )

        #expect(ghosts == [
            OnionSkinGhostDescriptor(frameId: "a", kind: .previous, distance: 1),
            OnionSkinGhostDescriptor(frameId: "c", kind: .next, distance: 1)
        ])
    }

    @Test("the first frame projects a next ghost only — no wrap to the axis end")
    func firstFrameProjectsNextOnly() {
        let ghosts = onionSkinGhosts(
            frameIds: ["a", "b", "c"],
            activeFrameId: "a",
            config: .default
        )

        #expect(ghosts == [
            OnionSkinGhostDescriptor(frameId: "b", kind: .next, distance: 1)
        ])
    }

    @Test("the last frame projects a previous ghost only — no wrap to the axis start")
    func lastFrameProjectsPreviousOnly() {
        let ghosts = onionSkinGhosts(
            frameIds: ["a", "b", "c"],
            activeFrameId: "c",
            config: .default
        )

        #expect(ghosts == [
            OnionSkinGhostDescriptor(frameId: "b", kind: .previous, distance: 1)
        ])
    }

    @Test("a single-frame axis projects no ghosts")
    func singleFrameProjectsNothing() {
        let ghosts = onionSkinGhosts(
            frameIds: ["a"],
            activeFrameId: "a",
            config: .default
        )

        #expect(ghosts.isEmpty)
    }

    @Test("a larger config clamps at both axis ends without wrapping")
    func largerConfigClampsAtBothEnds() {
        // previous 3 / next 3 around index 1 of five frames: only one frame
        // exists before the active one, and three after — the previous side
        // clamps to the axis start while the next side runs to the axis end.
        let ghosts = onionSkinGhosts(
            frameIds: ["a", "b", "c", "d", "e"],
            activeFrameId: "b",
            config: OnionSkinConfig(previousCount: 3, nextCount: 3)
        )

        #expect(ghosts == [
            OnionSkinGhostDescriptor(frameId: "a", kind: .previous, distance: 1),
            OnionSkinGhostDescriptor(frameId: "c", kind: .next, distance: 1),
            OnionSkinGhostDescriptor(frameId: "d", kind: .next, distance: 2),
            OnionSkinGhostDescriptor(frameId: "e", kind: .next, distance: 3)
        ])
    }

    @Test("an extreme config clamps to the axis — terminating, no overflow")
    func extremeConfigClampsToTheAxis() {
        // Int.max counts must degrade to the same result as any
        // larger-than-axis config: the clamp is the loop bound, so the
        // selection neither iterates past the axis nor overflows the
        // index arithmetic.
        let ghosts = onionSkinGhosts(
            frameIds: ["a", "b", "c"],
            activeFrameId: "b",
            config: OnionSkinConfig(previousCount: Int.max, nextCount: Int.max)
        )

        #expect(ghosts == [
            OnionSkinGhostDescriptor(frameId: "a", kind: .previous, distance: 1),
            OnionSkinGhostDescriptor(frameId: "c", kind: .next, distance: 1)
        ])
    }
}
