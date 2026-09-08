#if os(iOS)
import SwiftUI
import Testing
@testable import Dotorixel

@Suite("Frame duration — native Timeline input", .serialized)
@MainActor
struct FrameDurationInputTests {
    private struct TimelineHost: View {
        let workspace: Workspace

        var body: some View {
            TimelinePanel(tab: workspace.activeTab, onTextInputFocusChange: { ownerId, isFocused in
                workspace.setTextInputFocus(owner: .frameDurationEditor(ownerId), isFocused: isFocused)
            })
        }
    }

    @Test("switching tabs confirms native input on its originating Document, even with the same Frame ID", arguments: [UInt32(100), UInt32(500)])
    func nativeTabSwitch(destinationDuration: UInt32) async throws {
        let workspace = Workspace(width: 8, height: 8)
        let origin = workspace.activeTab
        let snapshot = origin.toSnapshot()
        let destination = try workspace.openSnapshot(TabSnapshot(
            id: "other-document", name: "Other", document: snapshot.document,
            timelinePanelCollapsed: false, viewport: snapshot.viewport
        ))
        destination.setFrameDuration(id: destination.activeFrameId, durationMs: destinationDuration)
        workspace.setActiveTab(0)

        try await withTimeline(workspace) { view in
            let field = try await focusField(in: view, workspace: workspace)
            enter("250", into: field)
            await Task.yield()

            workspace.setActiveTab(1)
            try await waitUntil { findTextField(in: view)?.text == String(destinationDuration) }
            #expect(origin.frameColumns[0].durationMs == 250)
            #expect(destination.frameColumns[0].durationMs == destinationDuration)
            try await waitUntil { !workspace.isTextInputFocused }
            origin.handleUndo()
            #expect(origin.frameColumns[0].durationMs == 100)
            #expect(!origin.canUndo)
        }
    }

    @Test("native Frame switching and Timeline collapse confirm their own drafts and release focus")
    func nativeFrameSwitchAndCollapse() async throws {
        let workspace = Workspace(width: 8, height: 8)
        let tab = workspace.activeTab
        let first = tab.activeFrameId
        tab.addFrame()
        let second = tab.activeFrameId
        tab.setFrameDuration(id: second, durationMs: 500)
        tab.setActiveFrame(id: first)

        try await withTimeline(workspace) { view in
            let field = try await focusField(in: view, workspace: workspace)
            enter("250", into: field)
            await Task.yield()
            tab.setActiveFrame(id: second)
            try await waitUntil { field.text == "500" }
            #expect(tab.frameColumns.first(where: { $0.id == first })?.durationMs == 250)
            #expect(field.isFirstResponder)

            enter("350", into: field)
            await Task.yield()
            tab.toggleTimelinePanel()
            try await waitUntil { findTextField(in: view) == nil && !workspace.isTextInputFocused }
            #expect(tab.frameColumns.first(where: { $0.id == second })?.durationMs == 350)

            tab.toggleTimelinePanel()
            try await waitUntil { findTextField(in: view)?.text == "350" }
            #expect(findTextField(in: view)?.isFirstResponder == false)
            tab.handleUndo()
            try await waitUntil { findTextField(in: view)?.text == "500" }
            tab.handleRedo()
            try await waitUntil { findTextField(in: view)?.text == "350" }
        }
    }

    @Test("native completion followed by focus loss creates only one Edit")
    func nativeCompletionAndBlur() async throws {
        let workspace = Workspace(width: 8, height: 8)
        let tab = workspace.activeTab
        try await withTimeline(workspace) { view in
            let field = try await focusField(in: view, workspace: workspace)
            enter("250", into: field)
            field.sendActions(for: .editingDidEndOnExit)
            try await waitUntil { tab.frameColumns[0].durationMs == 250 }
            field.resignFirstResponder()
            try await waitUntil { !workspace.isTextInputFocused }
            tab.handleUndo()
            #expect(tab.frameColumns[0].durationMs == 100)
            #expect(!tab.canUndo)
        }
    }

    private func withTimeline(
        _ workspace: Workspace,
        perform: (UIView) async throws -> Void
    ) async throws {
        let scene = try #require(UIApplication.shared.connectedScenes.first as? UIWindowScene)
        let previousWindow = scene.windows.first(where: \.isKeyWindow)
        let window = UIWindow(windowScene: scene)
        let host = UIHostingController(rootView: TimelineHost(workspace: workspace))
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer {
            host.view.endEditing(true)
            window.isHidden = true
            window.rootViewController = nil
            previousWindow?.makeKeyAndVisible()
        }
        try await waitUntil { findTextField(in: host.view) != nil }
        try await perform(host.view)
    }

    private func focusField(in view: UIView, workspace: Workspace) async throws -> UITextField {
        let field = try #require(findTextField(in: view))
        #expect(field.becomeFirstResponder())
        try await waitUntil { workspace.isTextInputFocused }
        return field
    }

    private func enter(_ text: String, into field: UITextField) {
        field.text = text
        field.sendActions(for: .editingChanged)
    }

    private func findTextField(in view: UIView) -> UITextField? {
        if let field = view as? UITextField { return field }
        return view.subviews.lazy.compactMap { findTextField(in: $0) }.first
    }

    private func waitUntil(_ condition: () -> Bool) async throws {
        for _ in 0..<100 {
            if condition() { return }
            try await Task.sleep(for: .milliseconds(20))
        }
        try #require(condition(), "Native input did not settle within two seconds")
    }
}
#endif
