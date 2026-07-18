import Testing
@testable import Dotorixel

@Suite("EditorState — recent colors")
struct RecentColorsTests {

    @Test("a pencil stroke records its draw color as most-recent")
    func pencilStrokeRecordsDrawColor() {
        let state = EditorState(width: 16, height: 16)

        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        state.endStroke()

        #expect(state.recentColors == [state.foregroundColor])
    }

    @Test("a secondary-button stroke records the background color it drew with")
    func secondaryButtonStrokeRecordsBackground() {
        let state = EditorState(width: 16, height: 16)

        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4), button: .secondary)
        state.endStroke()

        #expect(state.recentColors == [state.backgroundColor])
    }

    @Test("an eraser stroke records nothing")
    func eraserStrokeRecordsNothing() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .eraser

        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        state.endStroke()

        #expect(state.recentColors.isEmpty)
    }

    @Test("an eyedropper commit records the sampled color")
    func eyedropperCommitRecordsSampledColor() throws {
        let state = EditorState(width: 16, height: 16)
        let sampled = Color(r: 0xB0, g: 0x7A, b: 0x30, a: 0xFF)
        try state.pixelCanvas.setPixel(x: 5, y: 5, color: sampled)
        state.activeTool = .eyedropper

        state.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        state.endStroke()

        #expect(state.recentColors == [sampled])
    }

    @Test("an eyedropper release over a transparent pixel records nothing")
    func eyedropperTransparentReleaseRecordsNothing() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .eyedropper

        state.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        state.endStroke()

        #expect(state.recentColors.isEmpty)
    }

    @Test("selecting a color without drawing records nothing")
    func selectingColorRecordsNothing() {
        let state = EditorState(width: 16, height: 16)

        state.foregroundColor = Color(r: 0xB0, g: 0x7A, b: 0x30, a: 0xFF)

        #expect(state.recentColors.isEmpty)
    }

    @Test("re-recording a listed color moves it to the front without duplicating")
    func reusedColorMovesToFront() {
        let state = EditorState(width: 16, height: 16)
        let older = Color(r: 0x11, g: 0x22, b: 0x33, a: 0xFF)
        let newer = Color(r: 0x44, g: 0x55, b: 0x66, a: 0xFF)

        state.recordRecentColor(older)
        state.recordRecentColor(newer)
        state.recordRecentColor(older)

        #expect(state.recentColors == [older, newer])
    }

    @Test("the list caps at 12, dropping the oldest")
    func listCapsAtTwelve() {
        let state = EditorState(width: 16, height: 16)

        for value in 1...13 {
            state.recordRecentColor(Color(r: UInt8(value), g: 0, b: 0, a: 0xFF))
        }

        #expect(state.recentColors.count == 12)
        #expect(state.recentColors.first == Color(r: 13, g: 0, b: 0, a: 0xFF))
        #expect(state.recentColors.last == Color(r: 2, g: 0, b: 0, a: 0xFF))
    }
}
