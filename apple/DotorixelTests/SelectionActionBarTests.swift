import CoreGraphics
import Testing
@testable import Dotorixel

private final class RecordingSelectionActionBarHost: SelectionActionBarHost {
    private(set) var events: [String] = []

    func copySelection() { events.append("copy") }
    func cutSelection() { events.append("cut") }
    func pasteSelectionClipboard() { events.append("paste") }
    func flipMarqueeHorizontal() { events.append("flip-horizontal") }
    func flipMarqueeVertical() { events.append("flip-vertical") }
    func rotateMarqueeCw() { events.append("rotate-cw") }
    func rotateMarqueeCcw() { events.append("rotate-ccw") }
    func clearMarqueePixels() { events.append("delete") }
    func clearMarqueeOrFloating() { events.append("clear") }
    func commitFloatingSelection() { events.append("commit") }
}

@Suite("Selection action bar — presentation")
struct SelectionActionBarPresentationTests {

    @Test("an editable idle Marquee exposes every idle action with Paste enabled")
    func idleMarqueeActions() {
        let presentation = SelectionActionBarPresentation.resolve(
            hasMarquee: true,
            hasFloatingSelection: false,
            canPaste: true,
            isActiveLayerEditable: true,
            isEditingAvailable: true
        )

        #expect(presentation?.items == [
            SelectionActionBarItem(action: .copy, isEnabled: true),
            SelectionActionBarItem(action: .cut, isEnabled: true),
            SelectionActionBarItem(action: .paste, isEnabled: true),
            SelectionActionBarItem(action: .flipHorizontal, isEnabled: true),
            SelectionActionBarItem(action: .flipVertical, isEnabled: true),
            SelectionActionBarItem(action: .rotateCw, isEnabled: true),
            SelectionActionBarItem(action: .rotateCcw, isEnabled: true),
            SelectionActionBarItem(action: .delete, isEnabled: true),
            SelectionActionBarItem(action: .deselect, isEnabled: true),
        ])
    }

    @Test("a Floating Selection replaces idle actions with Commit and Cancel")
    func floatingSelectionActions() {
        let presentation = SelectionActionBarPresentation.resolve(
            hasMarquee: true,
            hasFloatingSelection: true,
            canPaste: true,
            isActiveLayerEditable: true,
            isEditingAvailable: true
        )

        #expect(presentation?.items == [
            SelectionActionBarItem(action: .commit, isEnabled: true),
            SelectionActionBarItem(action: .cancel, isEnabled: true),
        ])
    }

    @Test("Paste alone is disabled when the Selection Clipboard is empty")
    func pasteDisabledWithEmptyClipboard() {
        let presentation = SelectionActionBarPresentation.resolve(
            hasMarquee: true,
            hasFloatingSelection: false,
            canPaste: false,
            isActiveLayerEditable: true,
            isEditingAvailable: true
        )

        #expect(presentation?.items.first(where: { $0.action == .paste })?.isEnabled == false)
        #expect(
            presentation?.items
                .filter { $0.action != .paste }
                .allSatisfy(\.isEnabled) == true
        )
    }

    @Test("the bar is hidden without a Marquee, on a Reference Layer, and during a stroke")
    func hiddenStates() {
        #expect(SelectionActionBarPresentation.resolve(
            hasMarquee: false,
            hasFloatingSelection: false,
            canPaste: true,
            isActiveLayerEditable: true,
            isEditingAvailable: true
        ) == nil)
        #expect(SelectionActionBarPresentation.resolve(
            hasMarquee: true,
            hasFloatingSelection: false,
            canPaste: true,
            isActiveLayerEditable: false,
            isEditingAvailable: true
        ) == nil)
        #expect(SelectionActionBarPresentation.resolve(
            hasMarquee: true,
            hasFloatingSelection: false,
            canPaste: true,
            isActiveLayerEditable: true,
            isEditingAvailable: false
        ) == nil)
    }
}

@Suite("Selection action bar — command dispatch")
struct SelectionActionBarDispatchTests {

    @Test("every action delegates to its existing editor command path")
    func everyActionDelegates() {
        let host = RecordingSelectionActionBarHost()
        let actions: [SelectionActionBarAction] = [
            .copy, .cut, .paste,
            .flipHorizontal, .flipVertical, .rotateCw, .rotateCcw,
            .delete, .deselect, .commit, .cancel,
        ]

        for action in actions {
            action.perform(on: host)
        }

        #expect(host.events == [
            "copy", "cut", "paste",
            "flip-horizontal", "flip-vertical", "rotate-cw", "rotate-ccw",
            "delete", "clear", "commit", "clear",
        ])
    }
}

@Suite("Selection action bar — placement")
struct SelectionActionBarPlacementTests {

    @Test("every action receives a 44pt target and wide bars fit the viewport")
    func touchTargetAndBarSizing() {
        #expect(selectionActionBarSize(
            actionCount: 2,
            viewportWidth: 320
        ) == CGSize(width: 98, height: 44))
        #expect(selectionActionBarSize(
            actionCount: 9,
            viewportWidth: 320
        ) == CGSize(width: 304, height: 44))
    }

    @Test("the bar is centered above the Marquee when there is room")
    func positionsAboveMarquee() {
        let position = selectionActionBarPosition(
            marqueeRect: CGRect(x: 100, y: 100, width: 40, height: 20),
            viewportSize: CGSize(width: 320, height: 240),
            barSize: CGSize(width: 200, height: 44)
        )

        #expect(position == CGPoint(x: 20, y: 48))
    }

    @Test("the bar falls below the Marquee when the top placement overflows")
    func fallsBelowMarquee() {
        let position = selectionActionBarPosition(
            marqueeRect: CGRect(x: 100, y: 10, width: 40, height: 20),
            viewportSize: CGSize(width: 320, height: 240),
            barSize: CGSize(width: 200, height: 44)
        )

        #expect(position == CGPoint(x: 20, y: 38))
    }

    @Test("the bar clamps to viewport edges when centered placement would overflow")
    func clampsToViewportEdges() {
        let viewport = CGSize(width: 320, height: 240)
        let bar = CGSize(width: 200, height: 44)

        #expect(selectionActionBarPosition(
            marqueeRect: CGRect(x: 0, y: 100, width: 10, height: 20),
            viewportSize: viewport,
            barSize: bar
        ) == CGPoint(x: 8, y: 48))
        #expect(selectionActionBarPosition(
            marqueeRect: CGRect(x: 310, y: 100, width: 10, height: 20),
            viewportSize: viewport,
            barSize: bar
        ) == CGPoint(x: 112, y: 48))
        #expect(selectionActionBarPosition(
            marqueeRect: CGRect(x: 100, y: 0, width: 40, height: 240),
            viewportSize: viewport,
            barSize: bar
        ) == CGPoint(x: 20, y: 0))
    }

    @Test("the bar sticks to the nearest vertical edge when the Marquee is off-screen")
    func clampsVerticallyForOffscreenMarquee() {
        let viewport = CGSize(width: 320, height: 240)
        let bar = CGSize(width: 200, height: 44)

        #expect(selectionActionBarPosition(
            marqueeRect: CGRect(x: 100, y: -100, width: 40, height: 20),
            viewportSize: viewport,
            barSize: bar
        ) == CGPoint(x: 20, y: 0))
        #expect(selectionActionBarPosition(
            marqueeRect: CGRect(x: 100, y: 400, width: 40, height: 20),
            viewportSize: viewport,
            barSize: bar
        ) == CGPoint(x: 20, y: 196))
    }

    @Test("a fully off-canvas Floating Selection keeps an unclipped action anchor")
    func floatingSelectionUsesUnclippedAnchor() {
        let marquee = AppleMarqueeRegion(x: -20, y: -10, width: 4, height: 2)
        let viewport = AppleViewport(pixelSize: 10, zoom: 1, panX: 0, panY: 0)

        #expect(selectionActionBarAnchorRect(
            marquee: marquee,
            hasFloatingSelection: false,
            canvasWidth: 16,
            canvasHeight: 16,
            viewport: viewport,
            displayScale: 1
        ) == nil)
        #expect(selectionActionBarAnchorRect(
            marquee: marquee,
            hasFloatingSelection: true,
            canvasWidth: 16,
            canvasHeight: 16,
            viewport: viewport,
            displayScale: 1
        ) == CGRect(x: -200, y: -100, width: 40, height: 20))
    }
}
