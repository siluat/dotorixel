import Testing
@testable import Dotorixel

@Suite("EditorTool — displayName")
struct EditorToolDisplayNameTests {

    @Test("every tool case has a capitalized English label", arguments: EditorTool.allCases)
    func toolDisplayName(tool: EditorTool) {
        // Keyed by case so a newly added tool fails here until it gets an
        // expected label — mirrors the web's exhaustive Record<ToolType, …>.
        let expected: [EditorTool: String] = [
            .pencil: "Pencil",
            .eraser: "Eraser",
            .line: "Line",
            .rectangle: "Rectangle",
            .ellipse: "Ellipse",
            .floodFill: "Flood Fill",
            .eyedropper: "Eyedropper",
            .move: "Move",
        ]
        #expect(tool.displayName == expected[tool])
    }
}
