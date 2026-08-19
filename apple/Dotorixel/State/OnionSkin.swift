import Foundation

/// How many neighbors the Onion Skin projects on each side of the Active
/// Frame (web parity: `OnionSkinConfig` in `onion-skin.ts`). Counts flow as
/// data so a future range control adds only UI; v1 ships the fixed
/// `OnionSkinConfig.default`.
struct OnionSkinConfig: Equatable {
    let previousCount: Int
    let nextCount: Int

    /// The v1 fixed range: one ghost on each side of the Active Frame.
    static let `default` = OnionSkinConfig(previousCount: 1, nextCount: 1)
}

/// Which side of the Active Frame a ghost sits on.
enum OnionSkinGhostKind: Equatable {
    case previous
    case next
}

/// One ghost the Onion Skin should show: which frame, on which side of the
/// Active Frame, and how far along the axis (`distance` 1 is the immediate
/// neighbor).
struct OnionSkinGhostDescriptor: Equatable {
    let frameId: String
    let kind: OnionSkinGhostKind
    let distance: Int
}

/// One ghost projected for rendering — its descriptor plus the neighbor
/// frame's committed composite (`compositeAt`) pixels, with layer visibility
/// and opacity applied and the Reference Layer excluded (web parity:
/// `OnionSkinGhostRead`).
struct OnionSkinGhostRead: Equatable {
    let frameId: String
    let kind: OnionSkinGhostKind
    let distance: Int
    let pixels: Data
}

/// Pure neighbor selection for the Onion Skin — the only new algorithmic seam
/// in issue 290 (web parity: `onionSkinGhosts` in `onion-skin.ts`). Given the
/// frame ids in axis order, the Active Frame's id, and the range config, it
/// returns the ghost descriptors in axis order (previous ghosts farthest
/// first, then next ghosts nearest first). Sides clamp at the axis ends and
/// never wrap around, so a ghost always means an adjacent position on the
/// axis. `activeFrameId` must be present in `frameIds` — the Document
/// guarantees the Active Frame is always on the axis, and callers read both
/// from the same frame projection.
func onionSkinGhosts(
    frameIds: [String],
    activeFrameId: String,
    config: OnionSkinConfig
) -> [OnionSkinGhostDescriptor] {
    guard let activeIndex = frameIds.firstIndex(of: activeFrameId) else { return [] }
    // The axis-end clamp is the loop bound itself, so an oversized count does
    // O(ghosts) work rather than O(count) and the index arithmetic can never
    // overflow (raised by coderabbitai and cubic-dev-ai on PR #379).
    let previousCount = min(max(config.previousCount, 0), activeIndex)
    let nextCount = min(max(config.nextCount, 0), frameIds.count - 1 - activeIndex)
    var ghosts: [OnionSkinGhostDescriptor] = []
    for distance in stride(from: previousCount, through: 1, by: -1) {
        ghosts.append(OnionSkinGhostDescriptor(
            frameId: frameIds[activeIndex - distance], kind: .previous, distance: distance
        ))
    }
    for distance in stride(from: 1, through: nextCount, by: 1) {
        ghosts.append(OnionSkinGhostDescriptor(
            frameId: frameIds[activeIndex + distance], kind: .next, distance: distance
        ))
    }
    return ghosts
}
