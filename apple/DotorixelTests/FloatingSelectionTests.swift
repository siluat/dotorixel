import Foundation
import Testing
@testable import Dotorixel

private func pixel(in pixels: Data, width: Int, x: Int, y: Int) -> Color {
    let offset = (y * width + x) * 4
    return Color(
        r: pixels[offset],
        g: pixels[offset + 1],
        b: pixels[offset + 2],
        a: pixels[offset + 3]
    )
}

@Suite("Selection Clipboard — Workspace commands")
struct SelectionClipboardWorkspaceTests {

    @Test("Copy stores the active Marquee pixels without mutating the document")
    func copyStoresMarqueePixelsWithoutDocumentMutation() throws {
        let preparedDocument = makeSingleLayerDocument(width: 3, height: 2)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let green = Color(r: 0, g: 0xFF, b: 0, a: 0xFF)
        let marquee = AppleMarqueeRegion(x: 1, y: 0, width: 2, height: 1)

        try preparedDocument.setPixel(x: 1, y: 0, color: red)
        try preparedDocument.setPixel(x: 2, y: 0, color: green)
        try preparedDocument.setMarquee(region: marquee)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab

        workspace.copySelection()

        #expect(
            workspace.selectionClipboard
                == SelectionClipboard(
                    pixels: Data([0xFF, 0, 0, 0xFF, 0, 0xFF, 0, 0xFF]),
                    width: 2,
                    height: 1
                )
        )
        #expect(try tab.document.getPixel(x: 1, y: 0) == red)
        #expect(try tab.document.getPixel(x: 2, y: 0) == green)
        #expect(tab.document.marquee() == marquee)
        #expect(!tab.canUndo)
    }

    @Test("Copy reads a live Floating Selection without committing it")
    func copyReadsLiveFloatingSelectionWithoutCommit() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let green = Color(r: 0, g: 0xFF, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setPixel(x: 2, y: 1, color: green)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 2, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
        tab.nudgeMarquee(by: FloatingSelectionOffset(dx: 1, dy: 1))

        workspace.copySelection()

        #expect(
            workspace.selectionClipboard
                == SelectionClipboard(
                    pixels: Data([0xFF, 0, 0, 0xFF, 0, 0xFF, 0, 0xFF]),
                    width: 2,
                    height: 1
                )
        )
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 1))
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(!tab.hasUndoableEdit)
    }

    @Test("Cut copies and clears the Marquee as one undoable edit")
    func cutCopiesAndClearsAsOneUndoableEdit() throws {
        let preparedDocument = makeSingleLayerDocument(width: 3, height: 2)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let green = Color(r: 0, g: 0xFF, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let marquee = AppleMarqueeRegion(x: 1, y: 0, width: 2, height: 1)

        try preparedDocument.setPixel(x: 1, y: 0, color: red)
        try preparedDocument.setPixel(x: 2, y: 0, color: green)
        try preparedDocument.setMarquee(region: marquee)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab

        workspace.cutSelection()

        #expect(
            workspace.selectionClipboard
                == SelectionClipboard(
                    pixels: Data([0xFF, 0, 0, 0xFF, 0, 0xFF, 0, 0xFF]),
                    width: 2,
                    height: 1
                )
        )
        #expect(try tab.document.getPixel(x: 1, y: 0) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 0) == transparent)
        #expect(tab.document.marquee() == marquee)
        #expect(tab.canUndo)

        tab.handleUndo()

        #expect(try tab.document.getPixel(x: 1, y: 0) == red)
        #expect(try tab.document.getPixel(x: 2, y: 0) == green)
        #expect(workspace.selectionClipboard?.pixels == Data([
            0xFF, 0, 0, 0xFF, 0, 0xFF, 0, 0xFF,
        ]))
        #expect(!tab.canUndo)
    }

    @Test("Cut then Paste round-trips the exact pixels through a Floating Selection")
    func cutThenPasteRoundTripsPixels() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let green = Color(r: 0, g: 0xFF, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try preparedDocument.setPixel(x: 0, y: 0, color: red)
        try preparedDocument.setPixel(x: 1, y: 0, color: green)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 2, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab

        workspace.cutSelection()
        workspace.pasteSelectionClipboard()

        #expect(try tab.document.getPixel(x: 0, y: 0) == transparent)
        #expect(try tab.document.getPixel(x: 1, y: 0) == transparent)
        #expect(pixel(in: try tab.renderPixels(), width: 4, x: 1, y: 1) == red)
        #expect(pixel(in: try tab.renderPixels(), width: 4, x: 2, y: 1) == green)

        #expect(tab.commitFloatingSelection())
        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 2, y: 1) == green)
    }

    @Test("Paste centers a Floating Selection in the visible canvas area")
    func pasteCentersFloatingSelectionInVisibleCanvasArea() throws {
        let preparedDocument = makeSingleLayerDocument(width: 8, height: 8)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let green = Color(r: 0, g: 0xFF, b: 0, a: 0xFF)
        let blue = Color(r: 0, g: 0, b: 0xFF, a: 0xFF)
        let yellow = Color(r: 0xFF, g: 0xFF, b: 0, a: 0xFF)

        try preparedDocument.setPixel(x: 0, y: 0, color: red)
        try preparedDocument.setPixel(x: 1, y: 0, color: green)
        try preparedDocument.setPixel(x: 0, y: 1, color: blue)
        try preparedDocument.setPixel(x: 1, y: 1, color: yellow)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 2, height: 2)
        )
        let sourceMarquee = try #require(preparedDocument.marquee())
        let clipboard = try #require(SelectionClipboard(
            pixels: preparedDocument.liftMarqueePixels(),
            width: sourceMarquee.width, height: sourceMarquee.height
        ))
        preparedDocument.clear()
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 7, y: 7, width: 1, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared, clipboard: clipboard)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 40, height: 40)
        tab.viewport = AppleViewport(
            pixelSize: 10,
            zoom: 1,
            panX: -20,
            panY: -10
        )

        workspace.pasteSelectionClipboard()

        #expect(tab.floatingSelectionOffset == .zero)
        #expect(tab.marquee == AppleMarqueeRegion(x: 3, y: 2, width: 2, height: 2))
        #expect(try tab.document.getPixel(x: 3, y: 2).a == 0)
        #expect(pixel(in: try tab.renderPixels(), width: 8, x: 3, y: 2) == red)
        #expect(pixel(in: try tab.renderPixels(), width: 8, x: 4, y: 2) == green)
        #expect(pixel(in: try tab.renderPixels(), width: 8, x: 3, y: 3) == blue)
        #expect(pixel(in: try tab.renderPixels(), width: 8, x: 4, y: 3) == yellow)
        #expect(!tab.hasUndoableEdit)
    }

    @Test("Paste falls back to the canvas center when none of it is visible")
    func pasteFallsBackToCanvasCenter() throws {
        let preparedDocument = makeSingleLayerDocument(width: 8, height: 8)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try preparedDocument.setPixel(x: 0, y: 0, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 2, height: 2)
        )
        let sourceMarquee = try #require(preparedDocument.marquee())
        let clipboard = try #require(SelectionClipboard(
            pixels: preparedDocument.liftMarqueePixels(),
            width: sourceMarquee.width, height: sourceMarquee.height
        ))
        preparedDocument.clear()
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared, clipboard: clipboard)
        let tab = workspace.activeTab
        tab.viewportSize = ViewportSize(width: 40, height: 40)
        tab.viewport = AppleViewport(
            pixelSize: 10,
            zoom: 1,
            panX: 1_000,
            panY: 1_000
        )

        workspace.pasteSelectionClipboard()

        #expect(tab.floatingSelectionOffset == .zero)
        #expect(tab.marquee == AppleMarqueeRegion(x: 3, y: 3, width: 2, height: 2))
        #expect(pixel(in: try tab.renderPixels(), width: 8, x: 3, y: 3) == red)
        #expect(!tab.hasUndoableEdit)
    }

    @Test("Committing a Paste is one undo step that restores the previous Marquee")
    func committingPasteIsOneUndoStep() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let green = Color(r: 0, g: 0xFF, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let previousMarquee = AppleMarqueeRegion(x: 3, y: 3, width: 1, height: 1)

        try preparedDocument.setPixel(x: 0, y: 0, color: red)
        try preparedDocument.setPixel(x: 1, y: 0, color: green)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 2, height: 1)
        )
        let sourceMarquee = try #require(preparedDocument.marquee())
        let clipboard = try #require(SelectionClipboard(
            pixels: preparedDocument.liftMarqueePixels(),
            width: sourceMarquee.width, height: sourceMarquee.height
        ))
        preparedDocument.clear()
        try preparedDocument.setMarquee(region: previousMarquee)

        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared, clipboard: clipboard)
        let tab = workspace.activeTab
        workspace.pasteSelectionClipboard()
        #expect(tab.commitFloatingSelection())

        let destination = AppleMarqueeRegion(x: 1, y: 1, width: 2, height: 1)
        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 2, y: 1) == green)
        #expect(tab.document.marquee() == destination)
        #expect(tab.hasUndoableEdit)

        tab.handleUndo()

        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 1) == transparent)
        #expect(tab.document.marquee() == previousMarquee)
        #expect(workspace.selectionClipboard?.pixels == Data([
            0xFF, 0, 0, 0xFF, 0, 0xFF, 0, 0xFF,
        ]))
        #expect(!tab.canUndo)
    }

    @Test("Paste commits an existing Floating Selection before starting a new one")
    func pasteCommitsExistingFloatingSelectionFirst() throws {
        let preparedDocument = makeSingleLayerDocument(width: 6, height: 6)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let blue = Color(r: 0, g: 0, b: 0xFF, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try preparedDocument.setPixel(x: 0, y: 0, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1)
        )
        let sourceMarquee = try #require(preparedDocument.marquee())
        let clipboard = try #require(SelectionClipboard(
            pixels: preparedDocument.liftMarqueePixels(),
            width: sourceMarquee.width, height: sourceMarquee.height
        ))
        preparedDocument.clear()

        try preparedDocument.setPixel(x: 4, y: 4, color: blue)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 4, y: 4, width: 1, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared, clipboard: clipboard)
        let tab = workspace.activeTab
        tab.nudgeMarquee(by: FloatingSelectionOffset(dx: 1, dy: 0))

        workspace.pasteSelectionClipboard()

        #expect(try tab.document.getPixel(x: 4, y: 4) == transparent)
        #expect(try tab.document.getPixel(x: 5, y: 4) == blue)
        #expect(tab.marquee == AppleMarqueeRegion(x: 2, y: 2, width: 1, height: 1))
        #expect(try tab.document.getPixel(x: 2, y: 2) == transparent)
        #expect(pixel(in: try tab.renderPixels(), width: 6, x: 2, y: 2) == red)
        #expect(tab.hasUndoableEdit)

        tab.handleUndo()

        #expect(tab.marquee == AppleMarqueeRegion(x: 5, y: 4, width: 1, height: 1))
        #expect(try tab.document.getPixel(x: 5, y: 4) == blue)
        #expect(tab.hasUndoableEdit)

        tab.handleUndo()

        #expect(try tab.document.getPixel(x: 4, y: 4) == blue)
        #expect(try tab.document.getPixel(x: 5, y: 4) == transparent)
        #expect(!tab.canUndo)
    }

    @Test("Escape cancels a pasted Floating Selection without entering History")
    func escapeCancelsPastedFloatingSelectionExactly() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let previousMarquee = AppleMarqueeRegion(x: 3, y: 3, width: 1, height: 1)

        try preparedDocument.setPixel(x: 0, y: 0, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1)
        )
        let sourceMarquee = try #require(preparedDocument.marquee())
        let clipboard = try #require(SelectionClipboard(
            pixels: preparedDocument.liftMarqueePixels(),
            width: sourceMarquee.width, height: sourceMarquee.height
        ))
        preparedDocument.clear()
        try preparedDocument.setMarquee(region: previousMarquee)

        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared, clipboard: clipboard)
        let tab = workspace.activeTab
        workspace.pasteSelectionClipboard()
        tab.clearMarqueeOrFloating()

        #expect(tab.floatingSelectionOffset == nil)
        #expect(tab.document.marquee() == previousMarquee)
        #expect(try tab.document.activeLayerPixels().allSatisfy { $0 == 0 })
        #expect(!tab.canUndo)
    }

    @Test("Selection Clipboard is shared across tabs in one Workspace")
    func selectionClipboardIsSharedAcrossTabs() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let sourceTab = workspace.activeTab
        workspace.copySelection()

        let destinationTab = workspace.addTab()
        workspace.pasteSelectionClipboard()

        #expect(workspace.activeTab === destinationTab)
        #expect(destinationTab.marquee == AppleMarqueeRegion(x: 7, y: 7, width: 1, height: 1))
        #expect(
            pixel(
                in: try destinationTab.renderPixels(),
                width: Int(Workspace.defaultCanvasDimension),
                x: 7,
                y: 7
            ) == red
        )
        #expect(try sourceTab.document.getPixel(x: 1, y: 1) == red)
    }

    @Test("Empty clipboard and missing Marquee commands are silent no-ops")
    func invalidClipboardCommandsAreNoOps() throws {
        let emptyWorkspace = Workspace(width: 3, height: 3)
        let emptyTab = emptyWorkspace.activeTab

        emptyWorkspace.copySelection()
        emptyWorkspace.cutSelection()
        emptyWorkspace.pasteSelectionClipboard()

        #expect(emptyWorkspace.selectionClipboard == nil)
        #expect(emptyTab.floatingSelectionOffset == nil)
        #expect(!emptyTab.canUndo)

        let preparedDocument = makeSingleLayerDocument(width: 3, height: 3)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        try preparedDocument.setPixel(x: 0, y: 0, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1)
        )
        let clipboard = try #require(SelectionClipboard(pixels: preparedDocument.liftMarqueePixels(), width: 1, height: 1))
        try preparedDocument.setMarquee(region: nil)
        let seededWorkspace = workspaceWithDocument(preparedDocument, shared: preparedShared, clipboard: clipboard)
        let seededTab = seededWorkspace.activeTab
        let clipboardBeforeNoOps = seededWorkspace.selectionClipboard

        seededWorkspace.copySelection()
        seededWorkspace.cutSelection()

        #expect(seededWorkspace.selectionClipboard == clipboardBeforeNoOps)
        #expect(try seededTab.document.getPixel(x: 0, y: 0) == red)
        #expect(!seededTab.canUndo)
    }

    @Test("Copy supplies no replacement clipboard while Floating recovery is pending")
    func copyNoOpsWhileFloatingRecoveryIsPending() throws {
        let (edit, _) = try makeRecoveryEdit()
        #expect(!edit.cancelFloatingSelection())
        #expect(edit.selectionClipboardSnapshot() == nil)
        #expect(!edit.hasUndoableEdit)
    }

    @Test("Cut supplies no replacement clipboard when Floating recovery fails")
    func cutNoOpsWhenFloatingRecoveryFails() throws {
        let (edit, _) = try makeRecoveryEdit()
        #expect(!edit.cancelFloatingSelection())
        let pixelsBefore = try edit.content.activeLayerPixels()
        #expect(edit.cutSelection() == nil)
        #expect(try edit.content.activeLayerPixels() == pixelsBefore)
        #expect(!edit.hasUndoableEdit)
    }

    @Test("Reference-active tabs reject Copy, Cut, and Paste without side effects")
    func referenceActiveTabRejectsClipboardCommands() throws {
        let document = makeSingleLayerDocument(width: 4, height: 4)
        try document.addReferenceLayer(newId: makeLayerId(), name: "Reference",
                                       sourceRgba: Data([0, 255, 0, 255]), sourceWidth: 1, sourceHeight: 1)
        let tab = TabState(
            shared: SharedState(),
            documentId: "reference-clipboard",
            name: "Reference Clipboard",
            isConstrainHeld: { false },
            consumePendingToolRestore: { nil },
            document: document,
            viewport: AppleViewport.forCanvas(canvasWidth: 4, canvasHeight: 4)
        )
        let clipboard = try #require(SelectionClipboard(
            pixels: Data([0xFF, 0, 0, 0xFF]),
            width: 1,
            height: 1
        ))

        #expect(tab.selectionClipboardSnapshot() == nil)
        #expect(tab.cutSelection() == nil)
        tab.pasteSelectionClipboard(clipboard)

        #expect(tab.document.composite().allSatisfy { $0 == 0 })
        #expect(tab.document.marquee() == nil)
        #expect(!tab.isActiveLayerEditable)
        #expect(tab.floatingSelectionOffset == nil)
        #expect(!tab.canUndo)
    }

}



@Suite("Floating Selection — lift, preview, and release")
struct FloatingSelectionTests {

    @Test("dragging inside the Marquee lifts pixels into a persistent non-mutating preview")
    func insideDragLiftsIntoPersistentPreview() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(region: source)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
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
        #expect(!tab.hasUndoableEdit)

        tab.endStroke()

        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0))
        #expect(pixel(in: try tab.renderPixels(), width: 4, x: 2, y: 1) == red)
        #expect(tab.canUndo)
        #expect(!tab.hasUndoableEdit)
    }

    @Test("a pointer-down outside the Floating Selection commits it immediately")
    func outsidePointerDownCommitsFloatingSelection() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
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
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        let destination = AppleMarqueeRegion(x: 2, y: 1, width: 1, height: 1)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(region: source)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
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
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(region: source)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared, notifier: notifier)
        let tab = workspace.activeTab

        tab.addLayer()
        tab.handleUndo()
        #expect(tab.layersInPanelOrder.count == 1)
        #expect(tab.canRedo)

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
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let transparentRed = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0x00)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)

        try preparedDocument.setPixel(x: 1, y: 1, color: transparentRed)
        try preparedDocument.setMarquee(region: source)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared, notifier: notifier)
        let tab = workspace.activeTab

        tab.addLayer()
        tab.handleUndo()
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
        #expect(!tab.hasUndoableEdit)
        #expect(tab.canRedo)
        #expect(notifier.marked.isEmpty)
    }

    @Test("cancelling the active lift restores the pre-lift document")
    func cancelDuringLiftRestoresSource() throws {
        let notifier = FloatingSelectionDirtyRecorder()
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(region: source)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared, notifier: notifier)
        let tab = workspace.activeTab
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
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
        let sourceLayerId = tab.activeLayerId
        tab.addLayer()
        #expect(tab.layersInPanelOrder.count == 2)
        tab.setActiveLayer(id: sourceLayerId)
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
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab

        tab.addLayer()
        tab.handleUndo()
        #expect(tab.layersInPanelOrder.count == 1)
        #expect(tab.canRedo)
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
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let blue = Color(r: 0, g: 0, b: 0xFF, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try preparedDocument.setPixel(x: 0, y: 1, color: red)
        try preparedDocument.setPixel(x: 1, y: 1, color: blue)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 1, width: 2, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
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
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let blue = Color(r: 0, g: 0, b: 0xFF, a: 0xFF)

        try preparedDocument.setPixel(x: 0, y: 1, color: red)
        try preparedDocument.setPixel(x: 1, y: 1, color: blue)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 1, width: 2, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
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
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        #expect(tab.floatingSelectionOffset != nil)
        #expect(!tab.isDocumentBlank())
    }

    @Test("switching tools commits the Floating Selection first")
    func toolSwitchCommitsFloatingSelection() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
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
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
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
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))

        workspace.activateTool(.pencil)

        try #require(workspace.shared.activeTool == .selection)
        tab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 1))
        tab.endStroke()
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 2, dy: 0))
        #expect(pixel(in: try tab.renderPixels(), width: 4, x: 3, y: 1) == red)
        #expect(!tab.hasUndoableEdit)
    }

    @Test("Clear commits the Floating Selection before its own edit")
    func clearCommitsFloatingSelectionFirst() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        let destination = AppleMarqueeRegion(x: 2, y: 1, width: 1, height: 1)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(region: source)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
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
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let bottomId = preparedDocument.activeLayerId()
        let requestedSourceLayerId = UUID().uuidString
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)

        try preparedDocument.addLayer(newId: requestedSourceLayerId, name: "Source")
        let sourceLayerId = preparedDocument.activeLayerId()
        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
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
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let requestedSourceLayerId = UUID().uuidString
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try preparedDocument.addLayer(newId: requestedSourceLayerId, name: "Source")
        let sourceLayerId = preparedDocument.activeLayerId()
        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
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
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try preparedDocument.setPixel(x: 0, y: 1, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 1, width: 1, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
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

}

@Suite("Selection keyboard operations — TabState commands")
struct SelectionKeyboardOperationTests {

    @Test("repeated nudges accumulate in one Floating Selection and commit as one undo step")
    func repeatedNudgesCommitAsOneUndoStep() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(region: source)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab

        tab.nudgeMarquee(by: FloatingSelectionOffset(dx: 1, dy: 0))
        tab.nudgeMarquee(by: FloatingSelectionOffset(dx: 0, dy: 1))

        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 1))
        #expect(!tab.hasUndoableEdit)
        #expect(tab.commitFloatingSelection())
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 2) == red)

        tab.handleUndo()

        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 2, y: 2) == transparent)
        #expect(tab.document.marquee() == source)
        #expect(!tab.canUndo)
    }

    @Test("Delete clears Marquee pixels as one undoable edit")
    func deleteClearsMarqueePixelsAndUndoes() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let marquee = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(region: marquee)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab

        tab.clearMarqueePixels()

        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(tab.document.marquee() == marquee)
        #expect(tab.canUndo)

        tab.handleUndo()

        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(tab.document.marquee() == marquee)
        #expect(!tab.canUndo)
    }

    @Test("Delete commits a Floating nudge before clearing it as a distinct edit")
    func deleteCommitsFloatingSelectionBeforeClear() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        let destination = AppleMarqueeRegion(x: 2, y: 1, width: 1, height: 1)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(region: source)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
        tab.nudgeMarquee(by: FloatingSelectionOffset(dx: 1, dy: 0))

        tab.clearMarqueePixels()

        #expect(tab.floatingSelectionOffset == nil)
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 1) == transparent)
        #expect(tab.document.marquee() == destination)

        tab.handleUndo()

        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 1) == red)
        #expect(tab.document.marquee() == destination)
        #expect(tab.canUndo)

        tab.handleUndo()

        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 2, y: 1) == transparent)
        #expect(tab.document.marquee() == source)
        #expect(!tab.canUndo)
    }

    @Test("Escape cancels a Floating Selection without recording History")
    func escapeCancelsFloatingSelection() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)

        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setMarquee(region: source)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
        tab.nudgeMarquee(by: FloatingSelectionOffset(dx: 1, dy: 0))

        tab.clearMarqueeOrFloating()

        #expect(tab.floatingSelectionOffset == nil)
        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 2, y: 1) == transparent)
        #expect(tab.document.marquee() == source)
        #expect(!tab.canUndo)
    }

    @Test("Escape deselects an idle Marquee and Undo restores it")
    func escapeDeselectsIdleMarquee() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let marquee = AppleMarqueeRegion(x: 1, y: 1, width: 2, height: 2)
        try preparedDocument.setMarquee(region: marquee)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab

        tab.clearMarqueeOrFloating()

        #expect(tab.document.marquee() == nil)
        #expect(tab.canUndo)

        tab.handleUndo()

        #expect(tab.document.marquee() == marquee)
        #expect(!tab.canUndo)
    }
}

@Suite("Floating Selection lifecycle — Edit Baseline contract")
struct FloatingSelectionEditBaselineTests {

    @Test("an empty lift restores the original Marquee")
    func emptyLiftRestoresOriginalMarquee() {
        let originalMarquee = AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1)
        let attemptedRegion = AppleMarqueeRegion(x: 1, y: 0, width: 1, height: 1)
        let document = FloatingSelectionDocumentFake(
            pixels: Data(),
            marquee: originalMarquee
        )
        let lifecycle = FloatingSelectionLifecycle()

        #expect(!lifecycle.liftFromMarquee(attemptedRegion, in: document))

        #expect(document.currentMarquee == originalMarquee)
        #expect(document.setMarqueeCallCount == 2)
    }

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

    @Test("cancel never overwrites a different active Layer")
    func cancelWithActiveLayerMismatchUsesDegradedRecovery() throws {
        let sourcePixels = Data([0xFF, 0, 0, 0xFF])
        let originalMarquee = AppleMarqueeRegion(
            x: 0, y: 0, width: 1, height: 1
        )
        let source = AppleMarqueeRegion(x: 1, y: 0, width: 1, height: 1)
        let document = FloatingSelectionDocumentFake(
            pixels: sourcePixels,
            marquee: originalMarquee
        )
        let lifecycle = FloatingSelectionLifecycle()

        #expect(lifecycle.liftFromMarquee(source, in: document))
        let otherLayerPixels = Data([0, 0, 0xFF, 0xFF])
        document.activeLayerIdentifier = "other-layer"
        document.pixels = otherLayerPixels

        let outcome = lifecycle.cancel(in: document)

        guard case let .degraded(
            didRestoreSourcePixels,
            didRestoreMarquee,
            _
        ) = outcome else {
            Issue.record("A Layer mismatch must report degraded cancellation")
            return
        }
        #expect(!didRestoreSourcePixels)
        #expect(didRestoreMarquee)
        #expect(document.pixelRestoreCallCount == 0)
        #expect(document.pixels == otherLayerPixels)
        #expect(document.currentMarquee == originalMarquee)
        #expect(!lifecycle.isActive)
        #expect(lifecycle.hasPendingRecovery)

        let liveSourceHole = try #require(document.pixels(for: document.sourceLayerId))
        #expect(
            lifecycle.snapshotPixels(
                for: document.sourceLayerId,
                currentPixels: liveSourceHole
            ) == sourcePixels
        )
        // Recovery projection survives repeated snapshots until source repair
        // actually succeeds; taking a snapshot is not a save acknowledgement.
        #expect(
            lifecycle.snapshotPixels(
                for: document.sourceLayerId,
                currentPixels: liveSourceHole
            ) == sourcePixels
        )
        #expect(
            lifecycle.snapshotPixels(
                for: "other-layer",
                currentPixels: otherLayerPixels
            ) == otherLayerPixels
        )
        #expect(!lifecycle.liftFromMarquee(source, in: document))
    }

    @Test("cancel still restores the Marquee when pixel restoration fails")
    func pixelRestoreFailureDoesNotSkipMarqueeRestore() throws {
        let originalMarquee = AppleMarqueeRegion(
            x: 0, y: 0, width: 1, height: 1
        )
        let source = AppleMarqueeRegion(x: 1, y: 0, width: 1, height: 1)
        let document = FloatingSelectionDocumentFake(marquee: originalMarquee)
        let lifecycle = FloatingSelectionLifecycle()

        #expect(lifecycle.liftFromMarquee(source, in: document))
        document.pixelRestoreError = FloatingSelectionFakeError.pixelRestoreFailed

        let outcome = lifecycle.cancel(in: document)

        guard case let .degraded(
            didRestoreSourcePixels,
            didRestoreMarquee,
            _
        ) = outcome else {
            Issue.record("A pixel restore error must report degraded cancellation")
            return
        }
        #expect(!didRestoreSourcePixels)
        #expect(didRestoreMarquee)
        #expect(document.pixelRestoreCallCount == 1)
        #expect(document.setMarqueeCallCount == 2)
        #expect(document.pixels == Data(repeating: 0, count: 4))
        #expect(document.currentMarquee == originalMarquee)
        #expect(!lifecycle.isActive)
        #expect(lifecycle.hasPendingRecovery)
    }

    @Test("cancel still restores pixels when Marquee restoration fails")
    func marqueeRestoreFailureDoesNotSkipPixelRestore() throws {
        let sourcePixels = Data([0xFF, 0, 0, 0xFF])
        let originalMarquee = AppleMarqueeRegion(
            x: 0, y: 0, width: 1, height: 1
        )
        let source = AppleMarqueeRegion(x: 1, y: 0, width: 1, height: 1)
        let document = FloatingSelectionDocumentFake(
            pixels: sourcePixels,
            marquee: originalMarquee
        )
        let lifecycle = FloatingSelectionLifecycle()

        #expect(lifecycle.liftFromMarquee(source, in: document))
        document.marqueeRestoreError = FloatingSelectionFakeError.marqueeRestoreFailed

        let outcome = lifecycle.cancel(in: document)

        guard case let .degraded(
            didRestoreSourcePixels,
            didRestoreMarquee,
            _
        ) = outcome else {
            Issue.record("A Marquee restore error must report degraded cancellation")
            return
        }
        #expect(didRestoreSourcePixels)
        #expect(!didRestoreMarquee)
        #expect(document.pixelRestoreCallCount == 1)
        #expect(document.setMarqueeCallCount == 2)
        #expect(document.pixels == sourcePixels)
        #expect(document.currentMarquee == source)
        #expect(!lifecycle.isActive)
        #expect(!lifecycle.hasPendingRecovery)

        let currentPixels = Data([0, 0xFF, 0, 0xFF])
        #expect(
            lifecycle.snapshotPixels(
                for: document.sourceLayerId,
                currentPixels: currentPixels
            ) == currentPixels
        )
        guard case .noRecovery = lifecycle.retryPendingRecovery(in: document) else {
            Issue.record("A Marquee-only failure must not create pixel recovery")
            return
        }
    }

    @Test("retry restores only the source Layer and reinstates the active Layer")
    func retryPendingRecoveryPreservesOtherLayer() throws {
        let sourcePixels = Data([0xFF, 0, 0, 0xFF])
        let otherLayerPixels = Data([0, 0, 0xFF, 0xFF])
        let source = AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1)
        let document = FloatingSelectionDocumentFake(pixels: sourcePixels)
        let lifecycle = FloatingSelectionLifecycle()

        #expect(lifecycle.liftFromMarquee(source, in: document))
        document.activeLayerIdentifier = "other-layer"
        document.pixels = otherLayerPixels
        guard case .degraded = lifecycle.cancel(in: document) else {
            Issue.record("A Layer mismatch must leave pixel recovery pending")
            return
        }

        guard case .restored = lifecycle.retryPendingRecovery(in: document) else {
            Issue.record("A valid retry must restore the pending source pixels")
            return
        }

        #expect(!lifecycle.hasPendingRecovery)
        #expect(document.activeLayerIdentifier == "other-layer")
        #expect(document.setActiveLayerCallIds == [document.sourceLayerId, "other-layer"])
        #expect(document.pixels(for: document.sourceLayerId) == sourcePixels)
        #expect(document.pixels(for: "other-layer") == otherLayerPixels)
    }

    @Test("retry returns to the original active Layer after pixel restoration fails")
    func failedRetryPreservesRecoveryAndOtherLayer() throws {
        let sourcePixels = Data([0xFF, 0, 0, 0xFF])
        let otherLayerPixels = Data([0, 0, 0xFF, 0xFF])
        let source = AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1)
        let document = FloatingSelectionDocumentFake(pixels: sourcePixels)
        let lifecycle = FloatingSelectionLifecycle()

        #expect(lifecycle.liftFromMarquee(source, in: document))
        document.activeLayerIdentifier = "other-layer"
        document.pixels = otherLayerPixels
        _ = lifecycle.cancel(in: document)
        document.pixelRestoreError = FloatingSelectionFakeError.pixelRestoreFailed

        guard case .failed = lifecycle.retryPendingRecovery(in: document) else {
            Issue.record("A throwing pixel retry must report failure")
            return
        }

        #expect(lifecycle.hasPendingRecovery)
        #expect(document.activeLayerIdentifier == "other-layer")
        #expect(document.setActiveLayerCallIds == [document.sourceLayerId, "other-layer"])
        #expect(document.pixels(for: document.sourceLayerId) == Data(repeating: 0, count: 4))
        #expect(document.pixels(for: "other-layer") == otherLayerPixels)
        #expect(
            lifecycle.snapshotPixels(
                for: document.sourceLayerId,
                currentPixels: Data(repeating: 0, count: 4)
            ) == sourcePixels
        )
    }

    @Test("an active-Layer restore failure keeps recovery and its original target")
    func activeLayerRestoreFailureRetainsOriginalTargetForNextRetry() throws {
        let sourcePixels = Data([0xFF, 0, 0, 0xFF])
        let otherLayerPixels = Data([0, 0, 0xFF, 0xFF])
        let source = AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1)
        let document = FloatingSelectionDocumentFake(pixels: sourcePixels)
        let lifecycle = FloatingSelectionLifecycle()

        #expect(lifecycle.liftFromMarquee(source, in: document))
        document.activeLayerIdentifier = "other-layer"
        document.pixels = otherLayerPixels
        _ = lifecycle.cancel(in: document)
        document.activeLayerSetFailuresRemaining["other-layer"] = 1

        guard case let .failed(didMutateDocument, _) = lifecycle.retryPendingRecovery(
            in: document
        ) else {
            Issue.record("A failed active-Layer restore must report failure")
            return
        }
        #expect(didMutateDocument)
        #expect(lifecycle.hasPendingRecovery)
        #expect(document.activeLayerIdentifier == document.sourceLayerId)
        #expect(
            lifecycle.snapshotActiveLayerId(
                currentActiveLayerId: document.activeLayerIdentifier
            ) == "other-layer"
        )
        #expect(document.pixels(for: "other-layer") == otherLayerPixels)

        guard case .restored = lifecycle.retryPendingRecovery(in: document) else {
            Issue.record("The next retry must retain and restore the original active Layer")
            return
        }
        #expect(!lifecycle.hasPendingRecovery)
        #expect(document.activeLayerIdentifier == "other-layer")
        #expect(document.pixels(for: document.sourceLayerId) == sourcePixels)
        #expect(document.pixels(for: "other-layer") == otherLayerPixels)
        #expect(
            document.setActiveLayerCallIds
                == [document.sourceLayerId, "other-layer", "other-layer"]
        )
    }
}

private enum FloatingSelectionFakeError: Error {
    case compositeFailed
    case pixelRestoreFailed
    case marqueeRestoreFailed
    case activeLayerSetFailed
    case unknownLayer
}

/// Lifecycle-orchestration fake that treats pixels as opaque whole-Layer
/// tokens. Its lift, clear, and composite operations intentionally do not
/// emulate region geometry; geometry-sensitive coverage belongs to the real
/// `AppleDocument`, the Rust core, and `SelectionBindingsTests`.
private final class FloatingSelectionDocumentFake: FloatingSelectionDocument {
    struct State: Equatable {
        let pixels: Data
        let marquee: AppleMarqueeRegion?
    }

    let sourceLayerId = "source-layer"
    var activeLayerIdentifier: String
    private var layerPixels: [String: Data]
    var pixels: Data {
        get { layerPixels[activeLayerIdentifier] ?? Data() }
        set { layerPixels[activeLayerIdentifier] = newValue }
    }
    var currentMarquee: AppleMarqueeRegion?
    var compositeError: Error?
    var pixelRestoreError: Error?
    var marqueeRestoreError: Error?
    var activeLayerSetFailuresRemaining: [String: Int] = [:]
    private(set) var pixelRestoreCallCount = 0
    private(set) var setMarqueeCallCount = 0
    private(set) var setActiveLayerCallIds: [String] = []

    init(
        pixels: Data = Data([0xFF, 0, 0, 0xFF]),
        marquee: AppleMarqueeRegion? = AppleMarqueeRegion(
            x: 0, y: 0, width: 1, height: 1
        )
    ) {
        activeLayerIdentifier = sourceLayerId
        layerPixels = [sourceLayerId: pixels]
        currentMarquee = marquee
    }

    var state: State {
        State(pixels: pixels, marquee: currentMarquee)
    }

    func activeLayerId() -> String { activeLayerIdentifier }
    func setActiveLayer(id: String) throws {
        setActiveLayerCallIds.append(id)
        let failuresRemaining = activeLayerSetFailuresRemaining[id, default: 0]
        if failuresRemaining > 0 {
            activeLayerSetFailuresRemaining[id] = failuresRemaining - 1
            throw FloatingSelectionFakeError.activeLayerSetFailed
        }
        guard layerPixels[id] != nil else { throw FloatingSelectionFakeError.unknownLayer }
        activeLayerIdentifier = id
    }
    func activeLayerPixels() throws -> Data { pixels }
    func restoreActiveLayerPixels(data: Data) throws {
        pixelRestoreCallCount += 1
        if let pixelRestoreError { throw pixelRestoreError }
        pixels = data
    }
    func marquee() -> AppleMarqueeRegion? { currentMarquee }
    func setMarquee(region: AppleMarqueeRegion?) throws {
        setMarqueeCallCount += 1
        if let marqueeRestoreError { throw marqueeRestoreError }
        currentMarquee = region
    }
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

    func pixels(for layerId: String) -> Data? {
        layerPixels[layerId]
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
