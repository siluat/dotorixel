import CoreGraphics
import Testing
@testable import Dotorixel

/// Regression tests for the canvas coordinator's originating-tab capture
/// (`strokeTab`, wired in issue 262 review — first exercisable with the tab
/// lifecycle from issue 264): the full begin → move → end/cancel sequence
/// must land on the tab that owned the begin, even when the active tab
/// changes while pointer events are still in flight.
///
/// The workspace's own activation policy (commit the outgoing stroke) sits
/// above this; these tests pin the defense beneath it.
@Suite("PixelCanvasView.Coordinator — originating-tab capture")
@MainActor
struct CanvasCoordinatorStrokeTabTests {

    /// A coordinator wired to `workspace`, plus the input view its delegate
    /// methods require. The view never joins a window — the drawing paths
    /// only read its bounds and content scale. Point (0.5, 0.5) always maps
    /// to canvas cell (0, 0): a fresh 16×16 viewport renders 32-device-pixel
    /// cells at pan zero, far above any display scale.
    private func makeCoordinator(
        for workspace: Workspace
    ) -> (coordinator: PixelCanvasView.Coordinator, view: InputMTKView) {
        let coordinator = PixelCanvasView.Coordinator()
        coordinator.workspace = workspace
        let view = InputMTKView(frame: CGRect(x: 0, y: 0, width: 512, height: 512))
        return (coordinator, view)
    }

    private let originCell = CGPoint(x: 0.5, y: 0.5)

    @Test("pointer events already in flight when a switch lands still route to the originating tab")
    func inFlightEventsRouteToOriginatingTab() throws {
        let workspace = Workspace()
        let tabA = workspace.activeTab
        let tabB = workspace.addTab()
        workspace.setActiveTab(0)
        let (coordinator, view) = makeCoordinator(for: workspace)

        coordinator.drawingBegan(at: originCell, button: .primary, inputSource: .mouse, in: view)
        #expect(tabA.isDrawing)

        // The switch lands mid-stroke; the tail of the pointer sequence is
        // still in flight and must resolve on A, never on B.
        workspace.setActiveTab(1)
        coordinator.drawingMoved(to: originCell, in: view)
        coordinator.drawingEnded(in: view)

        #expect(try tabA.document.getPixel(x: 0, y: 0) == workspace.shared.foregroundColor)
        #expect(!tabA.isDrawing)
        #expect(!tabB.isDrawing)
        #expect(!tabB.canUndo)
        #expect(tabB.document.composite().allSatisfy { $0 == 0 })
    }

    @Test("a begin on the new active tab first cancels a stroke stranded on a closed tab")
    func beginCancelsStrokeStrandedOnClosedTab() {
        let workspace = Workspace()
        let tabA = workspace.activeTab
        let tabB = workspace.addTab()
        let (coordinator, view) = makeCoordinator(for: workspace)

        coordinator.drawingBegan(at: originCell, button: .primary, inputSource: .mouse, in: view)
        #expect(tabB.isDrawing)

        // Closing the stroke's own tab bypasses the activation policy — the
        // coordinator stays captured on the removed tab, mid-stroke.
        workspace.closeTab(1)
        #expect(workspace.activeTab === tabA)
        #expect(tabB.isDrawing)

        // The next begin must close the stranded stroke through B's own
        // cancel path before capturing A.
        coordinator.drawingBegan(at: originCell, button: .primary, inputSource: .mouse, in: view)
        #expect(!tabB.isDrawing)
        #expect(tabA.isDrawing)

        coordinator.drawingEnded(in: view)
        #expect(tabA.canUndo)
    }
}
