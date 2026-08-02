import Testing
@testable import Dotorixel

@Suite("SharedState — recent colors")
struct RecentColorsTests {

    @Test("a pencil stroke records its draw color as most-recent")
    func pencilStrokeRecordsDrawColor() {
        let state = Workspace(width: 16, height: 16)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        state.activeTab.endStroke()

        #expect(state.shared.recentColors == [state.shared.foregroundColor])
    }

    @Test("a secondary-button stroke records the background color it drew with")
    func secondaryButtonStrokeRecordsBackground() {
        let state = Workspace(width: 16, height: 16)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4), button: .secondary)
        state.activeTab.endStroke()

        #expect(state.shared.recentColors == [state.shared.backgroundColor])
    }

    @Test("an eraser stroke records nothing")
    func eraserStrokeRecordsNothing() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .eraser

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        state.activeTab.endStroke()

        #expect(state.shared.recentColors.isEmpty)
    }

    @Test("an eyedropper commit records the sampled color")
    func eyedropperCommitRecordsSampledColor() throws {
        let state = Workspace(width: 16, height: 16)
        let sampled = Color(r: 0xB0, g: 0x7A, b: 0x30, a: 0xFF)
        try state.activeTab.document.setPixel(x: 5, y: 5, color: sampled)
        state.shared.activeTool = .eyedropper

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        state.activeTab.endStroke()

        #expect(state.shared.recentColors == [sampled])
    }

    @Test("an eyedropper release over a transparent pixel records nothing")
    func eyedropperTransparentReleaseRecordsNothing() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .eyedropper

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        state.activeTab.endStroke()

        #expect(state.shared.recentColors.isEmpty)
    }

    @Test("selecting a color without drawing records nothing")
    func selectingColorRecordsNothing() {
        let state = Workspace(width: 16, height: 16)

        state.shared.foregroundColor = Color(r: 0xB0, g: 0x7A, b: 0x30, a: 0xFF)

        #expect(state.shared.recentColors.isEmpty)
    }

    @Test("re-recording a listed color moves it to the front without duplicating")
    func reusedColorMovesToFront() {
        let state = Workspace(width: 16, height: 16)
        let older = Color(r: 0x11, g: 0x22, b: 0x33, a: 0xFF)
        let newer = Color(r: 0x44, g: 0x55, b: 0x66, a: 0xFF)

        state.shared.recordRecentColor(older)
        state.shared.recordRecentColor(newer)
        state.shared.recordRecentColor(older)

        #expect(state.shared.recentColors == [older, newer])
    }

    @Test("the list caps at 12, dropping the oldest")
    func listCapsAtTwelve() {
        let state = Workspace(width: 16, height: 16)

        for value in 1...13 {
            state.shared.recordRecentColor(Color(r: UInt8(value), g: 0, b: 0, a: 0xFF))
        }

        #expect(state.shared.recentColors.count == 12)
        #expect(state.shared.recentColors.first == Color(r: 13, g: 0, b: 0, a: 0xFF))
        #expect(state.shared.recentColors.last == Color(r: 2, g: 0, b: 0, a: 0xFF))
    }
}
