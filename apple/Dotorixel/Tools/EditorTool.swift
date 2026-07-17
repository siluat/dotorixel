/// Shell-owned tool identity for the Apple editor.
///
/// Distinct from the core `ToolType`, which exists for per-pixel `apply` and
/// only covers pixel-stamping tools. `EditorTool` is what the active-tool
/// state, toolbar, and status bar speak; it grows one case per tool slice
/// (fill, eyedropper, move, …) and maps down to core `ToolType` only inside
/// `makeSession`, the single FFI drawing call site.
/// Case order is the toolbar display order (web parity).
enum EditorTool: CaseIterable {
    case pencil
    case eraser
    case line
    case rectangle
    case ellipse
    case floodFill

    /// User-visible label for the tool.
    var displayName: String {
        switch self {
        case .pencil: return "Pencil"
        case .eraser: return "Eraser"
        case .line: return "Line"
        case .rectangle: return "Rectangle"
        case .ellipse: return "Ellipse"
        case .floodFill: return "Flood Fill"
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
        case .floodFill: return "drop.fill"
        }
    }

    /// Opens the per-stroke session for this tool. Per-stroke inputs are
    /// fixed at creation: `drawColor` is the stroke's color for its whole
    /// lifetime, already resolved from the pointer button.
    ///
    /// This switch is also where shell tools map down to the core `ToolType`
    /// for per-pixel apply — pixel-stamping cases hand it to their session;
    /// tools without a core counterpart (flood fill) never touch it.
    func makeSession(host: StrokeSessionHost, drawColor: Color) -> StrokeSession {
        switch self {
        case .pencil:
            return FreehandStrokeSession(host: host, coreToolType: .pencil, drawColor: drawColor)
        case .eraser:
            return FreehandStrokeSession(host: host, coreToolType: .eraser, drawColor: drawColor)
        case .line:
            return ShapeStrokeSession(host: host, coreToolType: .line, drawColor: drawColor) {
                appleInterpolatePixels(x0: $0.x, y0: $0.y, x1: $1.x, y1: $1.y)
            }
        case .rectangle:
            return ShapeStrokeSession(host: host, coreToolType: .rectangle, drawColor: drawColor) {
                appleRectangleOutline(x0: $0.x, y0: $0.y, x1: $1.x, y1: $1.y)
            }
        case .ellipse:
            return ShapeStrokeSession(host: host, coreToolType: .ellipse, drawColor: drawColor) {
                appleEllipseOutline(x0: $0.x, y0: $0.y, x1: $1.x, y1: $1.y)
            }
        case .floodFill:
            return OneShotStrokeSession(host: host) { host, coords in
                host.pixelCanvas.floodFill(x: coords.x, y: coords.y, fillColor: drawColor)
            }
        }
    }
}
