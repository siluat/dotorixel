import Testing
@testable import Dotorixel

@Suite("ToolType — displayName")
struct ToolTypeDisplayNameTests {

    @Test(
        "every tool case has a capitalized English label",
        arguments: [
            (ToolType.pencil, "Pencil"),
            (ToolType.eraser, "Eraser"),
            (ToolType.line, "Line"),
            (ToolType.rectangle, "Rectangle"),
            (ToolType.ellipse, "Ellipse"),
        ]
    )
    func toolDisplayName(tool: ToolType, expected: String) {
        #expect(tool.displayName == expected)
    }
}
