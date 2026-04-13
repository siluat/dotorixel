import Testing
import SwiftUI
@testable import Dotorixel

@Suite("EditorState — canvas resize")
struct EditorStateResizeTests {

    @Test("Resize changes canvas dimensions")
    func resizeChangesCanvasDimensions() {
        let state = EditorState(width: 16, height: 16)

        state.handleResize(width: 32, height: 32)

        #expect(state.pixelCanvas.width() == 32)
        #expect(state.pixelCanvas.height() == 32)
    }

    @Test("Resize pushes history snapshot — undo restores original size")
    func resizePushesHistory() {
        let state = EditorState(width: 16, height: 16)

        state.handleResize(width: 32, height: 32)

        #expect(state.canUndo)
        state.handleUndo()
        #expect(state.pixelCanvas.width() == 16)
        #expect(state.pixelCanvas.height() == 16)
    }

    @Test("Invalid dimension is rejected — canvas unchanged")
    func invalidDimensionRejected() {
        let state = EditorState(width: 16, height: 16)

        state.handleResize(width: 0, height: 16)
        #expect(state.pixelCanvas.width() == 16)
        #expect(!state.canUndo)

        state.handleResize(width: 16, height: 999)
        #expect(state.pixelCanvas.height() == 16)
        #expect(!state.canUndo)
    }

    @Test("Same dimensions are no-op — no history entry")
    func sameDimensionsNoOp() {
        let state = EditorState(width: 16, height: 16)

        state.handleResize(width: 16, height: 16)

        #expect(!state.canUndo)
    }
}

@Suite("EditorState — color selection")
struct EditorStateColorTests {

    @Test("Selecting a palette color updates foreground color")
    func selectPaletteColor() {
        let state = EditorState(width: 16, height: 16)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

        state.handleSelectColor(red)

        #expect(state.foregroundColor.r == 0xFF)
        #expect(state.foregroundColor.g == 0x00)
        #expect(state.foregroundColor.b == 0x00)
    }

    @Test("Selecting color from SwiftUI ColorPicker converts correctly")
    func colorPickerConversion() {
        let state = EditorState(width: 16, height: 16)
        let swiftUIBlue = SwiftUI.Color(red: 0.0, green: 0.0, blue: 1.0)

        state.handleSelectSwiftUIColor(swiftUIBlue)

        #expect(state.foregroundColor.r == 0x00)
        #expect(state.foregroundColor.b == 0xFF)
        #expect(state.foregroundColor.a == 0xFF)
    }
}
