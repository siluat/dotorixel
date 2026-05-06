extension ToolType {
    /// User-visible label for the tool.
    var displayName: String {
        switch self {
        case .pencil: return "Pencil"
        case .eraser: return "Eraser"
        case .line: return "Line"
        case .rectangle: return "Rectangle"
        case .ellipse: return "Ellipse"
        }
    }
}
