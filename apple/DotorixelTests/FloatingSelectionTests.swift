import Foundation
import Testing
@testable import Dotorixel

@Suite("Floating Selection — lift, preview, and release")
struct FloatingSelectionTests {

    @Test("dragging inside the Marquee lifts pixels into a persistent non-mutating preview")
    func insideDragLiftsIntoPersistentPreview() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(region: source)
        workspace.shared.activeTool = .selection

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))

        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 1) == transparent)
        #expect(pixel(in: try tab.renderPixels(), width: 4, x: 2, y: 1) == red)
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0))
        #expect(tab.document.marquee() == source)
        #expect(tab.marquee == AppleMarqueeRegion(x: 2, y: 1, width: 1, height: 1))
        #expect(tab.canUndo)
        #expect(!tab.documentHistory.canUndo())

        tab.endStroke()

        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0))
        #expect(pixel(in: try tab.renderPixels(), width: 4, x: 2, y: 1) == red)
        #expect(tab.canUndo)
        #expect(!tab.documentHistory.canUndo())
    }

    @Test("a pointer-down outside the Floating Selection commits it immediately")
    func outsidePointerDownCommitsFloatingSelection() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        workspace.shared.activeTool = .selection
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        tab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))

        #expect(tab.floatingSelectionOffset == nil)
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 1) == red)
        #expect(
            tab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 1, width: 1, height: 1)
        )
        #expect(tab.canUndo)

        // Close only the newly-started outside gesture; its pointer-down has
        // not defined a second Marquee edit.
        tab.cancelStroke()
    }

    @Test("commit is one undoable edit for source, destination, and Marquee")
    func commitIsOneUndoableEdit() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        let destination = AppleMarqueeRegion(x: 2, y: 1, width: 1, height: 1)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(region: source)
        workspace.shared.activeTool = .selection
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        #expect(tab.commitFloatingSelection())
        #expect(tab.canUndo)
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 1) == red)
        #expect(tab.document.marquee() == destination)

        tab.handleUndo()

        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 2, y: 1) == transparent)
        #expect(tab.document.marquee() == source)
        #expect(!tab.canUndo)
        #expect(tab.canRedo)

        tab.handleRedo()

        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 1) == red)
        #expect(tab.document.marquee() == destination)
        #expect(tab.canUndo)
        #expect(!tab.canRedo)
    }

    @Test("returning to the source discards the edit and preserves redo")
    func netZeroCommitPreservesRedoAndDoesNotMarkDirty() throws {
        let notifier = FloatingSelectionDirtyRecorder()
        let workspace = Workspace(width: 4, height: 4, notifier: notifier)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)

        tab.addLayer()
        tab.handleUndo()
        #expect(tab.layersInPanelOrder.count == 1)
        #expect(tab.canRedo)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(region: source)
        workspace.shared.activeTool = .selection
        notifier.reset()

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()

        #expect(tab.floatingSelectionOffset == .zero)
        #expect(notifier.marked.isEmpty)
        #expect(tab.commitFloatingSelection())
        #expect(tab.floatingSelectionOffset == nil)
        #expect(!tab.canUndo)
        #expect(tab.canRedo)
        #expect(notifier.marked.isEmpty)
        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(tab.document.marquee() == source)

        tab.handleRedo()
        #expect(tab.layersInPanelOrder.count == 2)
    }

    @Test("net-zero commit preserves transparent RGB bytes exactly")
    func netZeroCommitPreservesTransparentRgb() throws {
        let notifier = FloatingSelectionDirtyRecorder()
        let workspace = Workspace(width: 4, height: 4, notifier: notifier)
        let tab = workspace.activeTab
        let transparentRed = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0x00)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)

        tab.addLayer()
        tab.handleUndo()
        try tab.document.setPixel(x: 1, y: 1, color: transparentRed)
        try tab.document.setMarquee(region: source)
        workspace.activateTool(.selection)
        notifier.reset()

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()

        #expect(tab.commitFloatingSelection())
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparentRed)
        #expect(!tab.documentHistory.canUndo())
        #expect(tab.canRedo)
        #expect(notifier.marked.isEmpty)
    }

    @Test("cancelling the active lift restores the pre-lift document")
    func cancelDuringLiftRestoresSource() throws {
        let notifier = FloatingSelectionDirtyRecorder()
        let workspace = Workspace(width: 4, height: 4, notifier: notifier)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(region: source)
        workspace.shared.activeTool = .selection
        notifier.reset()

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.cancelStroke()

        #expect(tab.floatingSelectionOffset == nil)
        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 2, y: 1) == transparent)
        #expect(tab.document.marquee() == source)
        #expect(!tab.canUndo)
        #expect(notifier.marked.isEmpty)
    }

    @Test("Undo cancels a live Floating Selection before moving History")
    func undoCancelsFloatingSelectionFirst() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        tab.addLayer()
        #expect(tab.layersInPanelOrder.count == 2)
        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        tab.handleUndo()

        #expect(tab.floatingSelectionOffset == nil)
        #expect(tab.layersInPanelOrder.count == 2)
        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(tab.canUndo)

        tab.handleUndo()
        #expect(tab.layersInPanelOrder.count == 1)
    }

    @Test("Redo is ignored while a Floating Selection is live")
    func redoIsIgnoredDuringFloatingSelection() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        tab.addLayer()
        tab.handleUndo()
        #expect(tab.layersInPanelOrder.count == 1)
        #expect(tab.canRedo)
        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        tab.handleRedo()

        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0))
        #expect(tab.layersInPanelOrder.count == 1)
        #expect(pixel(in: try tab.renderPixels(), width: 4, x: 2, y: 1) == red)
        #expect(!tab.canRedo)

        #expect(tab.cancelFloatingSelection())
        #expect(tab.canRedo)
        tab.handleRedo()
        #expect(tab.layersInPanelOrder.count == 2)
    }

    @Test("off-canvas commit clips pixels but keeps the translated Marquee")
    func offCanvasCommitClipsPixels() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let blue = Color(r: 0, g: 0, b: 0xFF, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try tab.document.setPixel(x: 0, y: 1, color: red)
        try tab.document.setPixel(x: 1, y: 1, color: blue)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 1, width: 2, height: 1)
        )
        workspace.shared.activeTool = .selection
        tab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: -1, y: 1))
        tab.endStroke()

        #expect(tab.commitFloatingSelection())
        #expect(try tab.document.getPixel(x: 0, y: 1) == blue)
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(
            tab.document.marquee()
                == AppleMarqueeRegion(x: -1, y: 1, width: 2, height: 1)
        )
    }

    @Test("an invalid extreme drag preserves the last valid Floating destination")
    func extremeDragPreservesLastValidDestination() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let blue = Color(r: 0, g: 0, b: 0xFF, a: 0xFF)

        try tab.document.setPixel(x: 0, y: 1, color: red)
        try tab.document.setPixel(x: 1, y: 1, color: blue)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 1, width: 2, height: 1)
        )
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: .max, y: 1))
        tab.endStroke()

        try #require(
            tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0)
        )
        #expect(tab.commitFloatingSelection())
        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 2, y: 1) == blue)
        #expect(tab.canUndo)
    }

    @Test("a live Floating Selection still counts as document content")
    func liveFloatingSelectionIsNotBlank() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        #expect(tab.floatingSelectionOffset != nil)
        #expect(!tab.isDocumentBlank())
    }

    @Test("switching tools commits the Floating Selection first")
    func toolSwitchCommitsFloatingSelection() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        workspace.activateTool(.pencil)

        #expect(workspace.shared.activeTool == .pencil)
        #expect(tab.floatingSelectionOffset == nil)
        #expect(try tab.document.getPixel(x: 2, y: 1) == red)
        #expect(tab.canUndo)
    }

    @Test("a keyboard tool shortcut commits the Floating Selection first")
    func keyboardToolSwitchCommitsFloatingSelection() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        workspace.keyboardShortcuts.handleKeyDown("p")

        #expect(workspace.shared.activeTool == .pencil)
        #expect(tab.floatingSelectionOffset == nil)
        #expect(try tab.document.getPixel(x: 2, y: 1) == red)
        #expect(tab.canUndo)
    }

    @Test("toolbar tool changes are ignored during a Floating drag")
    func toolbarToolChangeIsIgnoredDuringFloatingDrag() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))

        workspace.activateTool(.pencil)

        try #require(workspace.shared.activeTool == .selection)
        tab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 1))
        tab.endStroke()
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 2, dy: 0))
        #expect(pixel(in: try tab.renderPixels(), width: 4, x: 3, y: 1) == red)
        #expect(!tab.documentHistory.canUndo())
    }

    @Test("Clear commits the Floating Selection before its own edit")
    func clearCommitsFloatingSelectionFirst() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        let destination = AppleMarqueeRegion(x: 2, y: 1, width: 1, height: 1)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(region: source)
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        tab.handleClearCanvas()

        #expect(tab.floatingSelectionOffset == nil)
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 1) == transparent)

        tab.handleUndo()
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 1) == red)
        #expect(tab.document.marquee() == destination)

        tab.handleUndo()
        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 2, y: 1) == transparent)
        #expect(tab.document.marquee() == source)
        #expect(!tab.canUndo)
    }

    @Test("switching the active Layer commits against the source Layer first")
    func activeLayerSwitchCommitsSourceLayerFirst() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let bottomId = tab.document.activeLayerId()
        let requestedSourceLayerId = UUID().uuidString
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try tab.document.addLayer(newId: requestedSourceLayerId, name: "Source")
        let sourceLayerId = tab.document.activeLayerId()
        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        tab.setActiveLayer(id: bottomId)

        #expect(tab.activeLayerId == bottomId)
        #expect(tab.floatingSelectionOffset == nil)
        let sourceLayer = try #require(
            tab.document.layerSnapshots().first { $0.id == sourceLayerId }
        )
        #expect(pixel(in: sourceLayer.pixels, width: 4, x: 2, y: 1) == red)
        #expect(tab.canUndo)
    }

    @Test("removing the source Layer commits it before removal")
    func sourceLayerRemovalCommitsFirst() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let requestedSourceLayerId = UUID().uuidString
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try tab.document.addLayer(newId: requestedSourceLayerId, name: "Source")
        let sourceLayerId = tab.document.activeLayerId()
        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        tab.removeLayer(id: sourceLayerId)

        #expect(tab.floatingSelectionOffset == nil)
        #expect(!tab.document.layers().contains { $0.id == sourceLayerId })

        tab.handleUndo()
        var sourceLayer = try #require(
            tab.document.layerSnapshots().first { $0.id == sourceLayerId }
        )
        #expect(pixel(in: sourceLayer.pixels, width: 4, x: 1, y: 1) == transparent)
        #expect(pixel(in: sourceLayer.pixels, width: 4, x: 2, y: 1) == red)

        tab.handleUndo()
        sourceLayer = try #require(
            tab.document.layerSnapshots().first { $0.id == sourceLayerId }
        )
        #expect(pixel(in: sourceLayer.pixels, width: 4, x: 1, y: 1) == red)
        #expect(pixel(in: sourceLayer.pixels, width: 4, x: 2, y: 1) == transparent)
        #expect(!tab.canUndo)
    }

    @Test("a canvas transform commits the Floating Selection before transforming")
    func canvasTransformCommitsFirst() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try tab.document.setPixel(x: 0, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 1, width: 1, height: 1)
        )
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()

        tab.flipCanvasHorizontal()

        #expect(tab.floatingSelectionOffset == nil)
        #expect(try tab.document.getPixel(x: 2, y: 1) == red)
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)

        tab.handleUndo()
        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 2, y: 1) == transparent)

        tab.handleUndo()
        #expect(try tab.document.getPixel(x: 0, y: 1) == red)
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(!tab.canUndo)
    }

    private func pixel(in pixels: Data, width: Int, x: Int, y: Int) -> Color {
        let offset = (y * width + x) * 4
        return Color(
            r: pixels[offset],
            g: pixels[offset + 1],
            b: pixels[offset + 2],
            a: pixels[offset + 3]
        )
    }
}

@Suite("Floating Selection lifecycle — Edit Baseline contract")
struct FloatingSelectionEditBaselineTests {

    @Test("a failed apply resolves its Edit Baseline and classifies partial mutation as committed")
    func failedApplyResolvesEditBaseline() throws {
        let document = FloatingSelectionDocumentFake()
        let history = FloatingSelectionHistoryFake()
        let lifecycle = FloatingSelectionLifecycle()
        let source = AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1)

        #expect(lifecycle.liftFromMarquee(source, in: document))
        #expect(lifecycle.moveTo(FloatingSelectionOffset(dx: 1, dy: 0)))
        document.compositeError = FloatingSelectionFakeError.compositeFailed

        let outcome = lifecycle.commit(in: document, history: history)

        guard case let .failed(didCommit, _) = outcome else {
            Issue.record("A throwing apply must report a resolved commit failure")
            return
        }
        #expect(didCommit)
        #expect(history.beginCount == 1)
        #expect(history.endCount == 1)
        #expect(!history.hasPendingBaseline)
        #expect(!lifecycle.isActive)

        history.beginEdit(document: document)
        #expect(!history.endEdit(current: document))
        #expect(history.beginCount == 2)
        #expect(history.endCount == 2)
    }

    @Test("a zero-offset commit is classified by Document History")
    func zeroOffsetUsesHistoryVerdict() throws {
        let hiddenRed = Data([0xFF, 0, 0, 0])
        let document = FloatingSelectionDocumentFake(pixels: hiddenRed)
        let history = FloatingSelectionHistoryFake()
        let lifecycle = FloatingSelectionLifecycle()
        let source = AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1)

        #expect(lifecycle.liftFromMarquee(source, in: document))
        #expect(lifecycle.moveTo(FloatingSelectionOffset(dx: 1, dy: 0)))
        #expect(lifecycle.moveTo(.zero))

        let outcome = lifecycle.commit(in: document, history: history)

        guard case .unchanged = outcome else {
            Issue.record("Document History must discard an exact zero-offset restore")
            return
        }
        #expect(history.beginCount == 1)
        #expect(history.endCount == 1)
        #expect(!history.hasPendingBaseline)
        #expect(document.pixels == hiddenRed)
    }
}

private enum FloatingSelectionFakeError: Error {
    case compositeFailed
}

private final class FloatingSelectionDocumentFake: FloatingSelectionDocument {
    struct State: Equatable {
        let pixels: Data
        let marquee: AppleMarqueeRegion?
    }

    let sourceLayerId = "source-layer"
    var pixels: Data
    var currentMarquee: AppleMarqueeRegion?
    var compositeError: Error?

    init(
        pixels: Data = Data([0xFF, 0, 0, 0xFF]),
        marquee: AppleMarqueeRegion? = AppleMarqueeRegion(
            x: 0, y: 0, width: 1, height: 1
        )
    ) {
        self.pixels = pixels
        currentMarquee = marquee
    }

    var state: State {
        State(pixels: pixels, marquee: currentMarquee)
    }

    func activeLayerId() -> String { sourceLayerId }
    func activeLayerPixels() throws -> Data { pixels }
    func restoreActiveLayerPixels(data: Data) throws { pixels = data }
    func marquee() -> AppleMarqueeRegion? { currentMarquee }
    func setMarquee(region: AppleMarqueeRegion?) throws { currentMarquee = region }
    func liftMarqueePixels() -> Data { pixels }
    func clearMarqueePixels() { pixels = Data(repeating: 0, count: pixels.count) }
    func composite() -> Data { pixels }

    func compositeWithLayerPatch(
        layerId: String,
        patch: Data,
        patchWidth: UInt32,
        patchHeight: UInt32,
        destX: Int32,
        destY: Int32
    ) throws -> Data {
        patch
    }

    func compositeBufferAt(buffer: Data, region: AppleMarqueeRegion) throws {
        if let compositeError { throw compositeError }
        pixels = buffer
    }
}

private final class FloatingSelectionHistoryFake:
    FloatingSelectionHistory
{
    typealias Document = FloatingSelectionDocumentFake

    private var baseline: FloatingSelectionDocumentFake.State?
    private(set) var beginCount = 0
    private(set) var endCount = 0

    var hasPendingBaseline: Bool { baseline != nil }

    func beginEdit(document: FloatingSelectionDocumentFake) {
        beginCount += 1
        baseline = document.state
    }

    func endEdit(current: FloatingSelectionDocumentFake) -> Bool {
        endCount += 1
        guard let baseline else { return false }
        self.baseline = nil
        return baseline != current.state
    }
}

private final class FloatingSelectionDirtyRecorder: DirtyNotifier {
    private(set) var marked: [String] = []

    func markDirty(documentId: String) { marked.append(documentId) }
    func markWorkspaceDirty() {}
    func notifyTabRemoved(documentId: String) {}

    func reset() {
        marked = []
    }
}
