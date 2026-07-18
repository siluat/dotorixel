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

@Suite("EditorTool — supportsPixelPerfect")
struct EditorToolSupportsPixelPerfectTests {

    @Test("only freehand tools support pixel-perfect filtering", arguments: EditorTool.allCases)
    func supportsPixelPerfect(tool: EditorTool) {
        // Keyed by case so a newly added tool fails here until it decides
        // whether its strokes run through the L-corner filter (web parity:
        // only pencil and eraser do).
        let expected: [EditorTool: Bool] = [
            .pencil: true,
            .eraser: true,
            .line: false,
            .rectangle: false,
            .ellipse: false,
            .floodFill: false,
            .eyedropper: false,
            .move: false,
        ]
        #expect(tool.supportsPixelPerfect == expected[tool])
    }
}

@Suite("EditorTool — shortcutKey")
struct EditorToolShortcutKeyTests {

    @Test("every tool case has its web-parity shortcut letter", arguments: EditorTool.allCases)
    func shortcutKey(tool: EditorTool) {
        // Keyed by case so a newly added tool fails here until it gets a
        // shortcut assignment (web parity: TOOL_SHORTCUTS in tool-registry;
        // rationale in docs/decisions/keyboard-shortcut-review.md).
        let expected: [EditorTool: Character] = [
            .pencil: "p",
            .eraser: "e",
            .line: "l",
            .rectangle: "u",
            .ellipse: "o",
            .floodFill: "f",
            .eyedropper: "i",
            .move: "v",
        ]
        #expect(tool.shortcutKey == expected[tool])
    }
}

@Suite("EditorTool — isConstrainable")
struct EditorToolIsConstrainableTests {

    @Test("only shape tools respond to the Shift constraint", arguments: EditorTool.allCases)
    func isConstrainable(tool: EditorTool) {
        // Keyed by case so a newly added tool fails here until it decides
        // whether its stroke responds to Shift/latch (web parity: line 45°,
        // rectangle/ellipse square).
        let expected: [EditorTool: Bool] = [
            .pencil: false,
            .eraser: false,
            .line: true,
            .rectangle: true,
            .ellipse: true,
            .floodFill: false,
            .eyedropper: false,
            .move: false,
        ]
        #expect(tool.isConstrainable == expected[tool])
    }
}
