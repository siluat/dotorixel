import Testing
@testable import Dotorixel

/// The transport strip's read model (issue 289): what the Play/Pause and Loop
/// controls and the position readout show for a given playback state. The
/// strip is a thin view over the 288 playback controller — this presentation
/// owns the only view-side decisions it makes.
@Suite("Transport strip — presentation")
struct TransportStripPresentationTests {

    @Test("a single-frame document disables both transport controls")
    func singleFrameDisablesControls() {
        let presentation = TransportStripPresentation.resolve(
            frameIds: ["f1"],
            activeFrameId: "f1",
            playheadFrameId: nil,
            isPlaying: false
        )

        #expect(!presentation.isEnabled)
    }

    @Test("a two-frame axis enables the transport controls")
    func twoFramesEnableControls() {
        let presentation = TransportStripPresentation.resolve(
            frameIds: ["f1", "f2"],
            activeFrameId: "f1",
            playheadFrameId: nil,
            isPlaying: false
        )

        #expect(presentation.isEnabled)
    }

    @Test("stopped, the position readout shows the Active Frame's 1-based ordinal")
    func stoppedReadoutFollowsTheActiveFrame() {
        let presentation = TransportStripPresentation.resolve(
            frameIds: ["f1", "f2", "f3"],
            activeFrameId: "f2",
            playheadFrameId: nil,
            isPlaying: false
        )

        #expect(presentation.positionOrdinal == 2)
        #expect(presentation.frameCount == 3)
    }

    @Test("playing, the position readout follows the Playhead, not the edit pointer")
    func playingReadoutFollowsThePlayhead() {
        let presentation = TransportStripPresentation.resolve(
            frameIds: ["f1", "f2", "f3"],
            activeFrameId: "f2",
            playheadFrameId: "f3",
            isPlaying: true
        )

        #expect(presentation.positionOrdinal == 3)
    }

    @Test("a playhead id missing from the axis falls back to the Active Frame ordinal")
    func stalePlayheadFallsBackToTheActiveFrame() {
        let presentation = TransportStripPresentation.resolve(
            frameIds: ["f1", "f2"],
            activeFrameId: "f1",
            playheadFrameId: "gone",
            isPlaying: true
        )

        #expect(presentation.positionOrdinal == 1)
    }
}
