import Foundation
@testable import Dotorixel

/// A fresh layer id in the core's canonical form — the core normalizes ids
/// to lowercase, so string comparisons against ids it returns hold.
func makeLayerId() -> String {
    UUID().uuidString.lowercased()
}

/// A fresh frame id in the core's canonical form — the frame-axis mirror of
/// `makeLayerId`.
func makeFrameId() -> String {
    UUID().uuidString.lowercased()
}

/// A single-layer document fixture mirroring the editor's own construction
/// (web-parity "Layer 1" naming) — for tests that need a drawing surface
/// without a full `Workspace`.
func makeSingleLayerDocument(width: UInt32, height: UInt32) -> AppleDocument {
    try! AppleDocument(
        width: width,
        height: height,
        firstLayerId: UUID().uuidString,
        firstLayerName: "Layer 1"
    )
}

/// Counts the non-transparent pixels in the tab's composite — the shared
/// "how much did the stroke paint" probe for session tests.
func paintedPixelCount(_ tab: TabState) -> Int {
    let pixels = tab.document.composite()
    return stride(from: 3, to: pixels.count, by: 4).count { pixels[$0] != 0 }
}

/// Prepares content before the workspace takes ownership. Only values cross
/// into the editor; later writes to the fixture cannot bypass its Edit rules.
func workspaceWithDocument(
    _ document: AppleDocument,
    shared: SharedState = SharedState(),
    notifier: DirtyNotifier = NoOpDirtyNotifier(),
    frameScheduler: FrameScheduler = DisplayLinkFrameScheduler(),
    clipboard: SelectionClipboard? = nil
) -> Workspace {
    let viewport = AppleViewport.forCanvas(canvasWidth: document.width(), canvasHeight: document.height())
    let fixtureNotifier = FixtureDirtyNotifier()
    let workspace = try! Workspace(restoring: WorkspaceSnapshot(
        tabs: [TabSnapshot(
            id: "doc-\(UUID().uuidString)", name: "Untitled 1",
            document: DocumentSnapshot.capture(document), timelinePanelCollapsed: false,
            viewport: TabViewportSnapshot(
                pixelSize: viewport.pixelSize(), zoom: viewport.zoom(),
                panX: viewport.panX(), panY: viewport.panY(), showGrid: true, showOnionSkin: false
            )
        )],
        activeTabIndex: 0,
        sharedState: SharedStateSnapshot(
            activeTool: shared.activeTool, foregroundColor: shared.foregroundColor,
            backgroundColor: shared.backgroundColor, recentColors: shared.recentColors,
            pixelPerfect: shared.pixelPerfect
        )
    ), notifier: fixtureNotifier, frameScheduler: frameScheduler)
    if let clipboard {
        let source = makeSingleLayerDocument(width: clipboard.width, height: clipboard.height)
        try! source.restoreActiveLayerPixels(data: clipboard.pixels)
        try! source.setMarquee(region: AppleMarqueeRegion(
            x: 0, y: 0, width: clipboard.width, height: clipboard.height
        ))
        let viewport = workspace.activeTab.toSnapshot().viewport
        try! workspace.openSnapshot(TabSnapshot(
            id: "clipboard-fixture", name: "Clipboard source",
            document: DocumentSnapshot.capture(source), timelinePanelCollapsed: false,
            viewport: viewport
        ))
        workspace.copySelection()
        workspace.closeTab(workspace.activeTabIndex)
    }
    fixtureNotifier.destination = notifier
    return workspace
}


/// A real Rust-backed Document with failure injection at the existing Floating
/// Selection document seam. Controls can reject I/O-like binding operations;
/// they never expose the owned document to the test.
final class EditBindingFaults {
    var refusesPixelRestore = false
    var refusesCommit = false

    func restore(_ snapshot: DocumentSnapshot) throws -> AppleDocument {
        let document = try snapshot.makeDocument()
        let faulted = FaultingEditDocument(unsafeFromHandle: document.uniffiCloneHandle())
        faulted.faults = self
        return faulted
    }
}

private enum EditBindingFailure: Error { case injected }

private final class FaultingEditDocument: AppleDocument, @unchecked Sendable {
    var faults: EditBindingFaults?

    override func restoreActiveLayerPixels(data: Data) throws {
        if faults?.refusesPixelRestore == true { throw EditBindingFailure.injected }
        try super.restoreActiveLayerPixels(data: data)
    }

    override func compositeBufferAt(buffer: Data, region: AppleMarqueeRegion) throws {
        if faults?.refusesCommit == true { throw EditBindingFailure.injected }
        try super.compositeBufferAt(buffer: buffer, region: region)
    }
}

func makeRecoveryEdit(effects: @escaping (EditEffect) -> Void = { _ in }) throws
    -> (edit: EditLifecycle, faults: EditBindingFaults) {
    let document = makeSingleLayerDocument(width: 4, height: 4)
    try document.setPixel(x: 1, y: 1, color: Color(r: 255, g: 0, b: 0, a: 255))
    try document.setMarquee(region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1))
    let faults = EditBindingFaults()
    let edit = try EditLifecycle(
        shared: SharedState(), snapshot: DocumentSnapshot.capture(document), effects: effects,
        restoreDocument: faults.restore
    )
    edit.nudgeMarquee(by: FloatingSelectionOffset(dx: 1, dy: 0))
    faults.refusesPixelRestore = true
    return (edit, faults)
}

/// Fixture construction is silent; only operations after handoff reach the recorder.
private final class FixtureDirtyNotifier: DirtyNotifier {
    var destination: (any DirtyNotifier)?

    func markDirty(documentId: String) { destination?.markDirty(documentId: documentId) }
    func markWorkspaceDirty() { destination?.markWorkspaceDirty() }
    func notifyTabRemoved(documentId: String) { destination?.notifyTabRemoved(documentId: documentId) }
}
