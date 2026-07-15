/// Shell-owned tool identity for the Apple editor.
///
/// Distinct from the core `ToolType`, which exists for per-pixel `apply` and
/// only covers pixel-stamping tools. `EditorTool` is what the active-tool
/// state, toolbar, and status bar speak; it grows one case per tool slice
/// (fill, eyedropper, move, …) and maps down to core `ToolType` only at the
/// FFI drawing call sites.
enum EditorTool {
    case pencil
    case eraser

    /// User-visible label for the tool.
    var displayName: String {
        switch self {
        case .pencil: return "Pencil"
        case .eraser: return "Eraser"
        }
    }

    /// Core `ToolType` for per-pixel apply. Reach for this only at FFI
    /// drawing call sites — everywhere else the shell speaks `EditorTool`.
    var coreToolType: ToolType {
        switch self {
        case .pencil: return .pencil
        case .eraser: return .eraser
        }
    }

    /// Opens the per-stroke session for this tool. Per-stroke inputs
    /// (draw color) are captured by the session at creation.
    func makeSession(host: StrokeSessionHost) -> StrokeSession {
        switch self {
        case .pencil, .eraser:
            return FreehandStrokeSession(host: host, coreToolType: coreToolType)
        }
    }
}
