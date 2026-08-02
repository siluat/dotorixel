import Foundation
import Testing
@testable import Dotorixel

/// Eyedropper tool behavior, exercised through the `TabState` public
/// stroke API: drag to sample, commit on release (web parity, 234).
@Suite("Eyedropper strokes — drag to sample, commit on release")
struct EyedropperStrokeSessionTests {

    private let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

    @Test("releasing over an opaque pixel commits its color to the foreground")
    func releaseOverOpaquePixelCommitsForeground() throws {
        let state = Workspace(width: 8, height: 8)
        try state.activeTab.document.setPixel(x: 5, y: 5, color: red)
        state.shared.activeTool = .eyedropper

        // Press over an empty pixel, drag onto the red one, release there:
        // the committed color is the pixel under the pointer at release.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 5, y: 5))
        state.activeTab.endStroke()

        #expect(state.shared.foregroundColor == red)
    }

    @Test("sampling reads the composite — a lower layer's color shows through the active layer's transparent pixels")
    func samplesCompositeNotActiveLayer() throws {
        let state = Workspace(width: 8, height: 8)
        // Paint the base layer, then stack a transparent layer on top as the
        // active one: what the user sees at (5, 5) is still the base red.
        try state.activeTab.document.setPixel(x: 5, y: 5, color: red)
        try state.activeTab.document.addLayer(newId: UUID().uuidString, name: "Layer 2")
        state.shared.activeTool = .eyedropper

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        state.activeTab.endStroke()

        #expect(state.shared.foregroundColor == red)
    }

    @Test("releasing over a transparent pixel commits nothing")
    func releaseOverTransparentPixelCommitsNothing() {
        let state = Workspace(width: 8, height: 8)
        let initialForeground = state.shared.foregroundColor
        state.shared.activeTool = .eyedropper

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.endStroke()

        #expect(state.shared.foregroundColor == initialForeground)
    }

    @Test("a secondary-button release commits to the background color")
    func secondaryButtonCommitsBackground() throws {
        let state = Workspace(width: 8, height: 8)
        try state.activeTab.document.setPixel(x: 3, y: 3, color: red)
        state.shared.activeTool = .eyedropper
        let initialForeground = state.shared.foregroundColor

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3), button: .secondary)
        state.activeTab.endStroke()

        #expect(state.shared.backgroundColor == red)
        #expect(state.shared.foregroundColor == initialForeground)
    }

    @Test("releasing outside the canvas commits nothing")
    func releaseOutOfBoundsCommitsNothing() throws {
        let state = Workspace(width: 8, height: 8)
        // Pressed over an opaque pixel — only the release position matters.
        try state.activeTab.document.setPixel(x: 0, y: 0, color: red)
        state.shared.activeTool = .eyedropper
        let initialForeground = state.shared.foregroundColor

        // Both sides of the bounds: negative and beyond-dimension coordinates.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: -3, y: -3))
        state.activeTab.endStroke()
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 100, y: 100))
        state.activeTab.endStroke()

        #expect(state.shared.foregroundColor == initialForeground)
    }

    @Test("committing a sample records no undo entry")
    func commitRecordsNoUndoEntry() throws {
        let state = Workspace(width: 8, height: 8)
        // One undoable pencil dot, then an eyedropper pick over it.
        state.shared.activeTool = .pencil
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.endStroke()
        state.shared.activeTool = .eyedropper
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.endStroke()

        // The color pick added no entry: one undo reverts the pencil dot…
        state.activeTab.handleUndo()
        #expect(try state.activeTab.document.getPixel(x: 0, y: 0).a == 0)
        // …and nothing is left to undo.
        #expect(!state.activeTab.canUndo)
    }

    @Test("a canceled stroke discards the pending sample without committing")
    func cancelDiscardsPendingSample() throws {
        let state = Workspace(width: 8, height: 8)
        try state.activeTab.document.setPixel(x: 4, y: 4, color: red)
        state.shared.activeTool = .eyedropper
        let initialForeground = state.shared.foregroundColor

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 4, y: 4))
        state.activeTab.cancelStroke()

        #expect(state.shared.foregroundColor == initialForeground)
    }
}
