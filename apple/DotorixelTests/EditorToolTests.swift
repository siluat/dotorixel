import Testing
@testable import Dotorixel

@Suite("EditorTool — displayName")
struct EditorToolDisplayNameTests {

    @Test(
        "every tool case has a capitalized English label",
        arguments: [
            (EditorTool.pencil, "Pencil"),
            (EditorTool.eraser, "Eraser"),
        ]
    )
    func toolDisplayName(tool: EditorTool, expected: String) {
        #expect(tool.displayName == expected)
    }
}
