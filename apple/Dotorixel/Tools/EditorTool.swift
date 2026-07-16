/// Shell-owned tool identity for the Apple editor.
///
/// Distinct from the core `ToolType`, which exists for per-pixel `apply` and
/// only covers pixel-stamping tools. `EditorTool` is what the active-tool
/// state, toolbar, and status bar speak; it grows one case per tool slice
/// (fill, eyedropper, move, …) and maps down to core `ToolType` only at the
/// FFI drawing call sites.
/// Case order is the toolbar display order (web parity).
enum EditorTool: CaseIterable {
    case pencil
    case eraser
    case line
    case rectangle
    case ellipse

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

    /// SF Symbol shown on the tool's toolbar button.
    var symbolName: String {
        switch self {
        case .pencil: return "pencil"
        case .eraser: return "eraser"
        case .line: return "line.diagonal"
        case .rectangle: return "rectangle"
        case .ellipse: return "circle"
        }
    }

    /// Core `ToolType` for per-pixel apply. Reach for this only at FFI
    /// drawing call sites — everywhere else the shell speaks `EditorTool`.
    var coreToolType: ToolType {
        switch self {
        case .pencil: return .pencil
        case .eraser: return .eraser
        case .line: return .line
        case .rectangle: return .rectangle
        case .ellipse: return .ellipse
        }
    }

    /// Opens the per-stroke session for this tool. Per-stroke inputs
    /// (draw color) are captured by the session at creation.
    func makeSession(host: StrokeSessionHost) -> StrokeSession {
        switch self {
        case .pencil, .eraser:
            return FreehandStrokeSession(host: host, coreToolType: coreToolType)
        case .line:
            return ShapeStrokeSession(host: host, coreToolType: coreToolType) {
                appleInterpolatePixels(x0: $0.x, y0: $0.y, x1: $1.x, y1: $1.y)
            }
        case .rectangle:
            return ShapeStrokeSession(host: host, coreToolType: coreToolType) {
                appleRectangleOutline(x0: $0.x, y0: $0.y, x1: $1.x, y1: $1.y)
            }
        case .ellipse:
            return ShapeStrokeSession(host: host, coreToolType: coreToolType) {
                appleEllipseOutline(x0: $0.x, y0: $0.y, x1: $1.x, y1: $1.y)
            }
        }
    }
}
