import UniformTypeIdentifiers

/// An export format the TopBar's export surface offers — the Apple
/// counterpart of the web's `availableFormats` registry
/// (`src/lib/canvas/export.ts`). Case order is menu order; the spritesheet
/// (295) and GIF (296) formats slot in as new cases.
enum ExportFormat: CaseIterable {
    case png
    case svg

    /// Menu display name — format acronyms, untranslated like the web
    /// registry's labels.
    var label: String {
        switch self {
        case .png: "PNG"
        case .svg: "SVG"
        }
    }

    /// Extension appended to the default export filename.
    var fileExtension: String {
        switch self {
        case .png: "png"
        case .svg: "svg"
        }
    }

    /// Content type handed to the platform file-export flow.
    var contentType: UTType {
        switch self {
        case .png: .png
        case .svg: .svg
        }
    }
}
