import UniformTypeIdentifiers

/// An export format the TopBar's export surface offers — the Apple
/// counterpart of the web's `availableFormats` registry
/// (`src/lib/canvas/export.ts`). Case order is menu order, mirroring the
/// web registry.
enum ExportFormat: CaseIterable {
    case png
    case svg
    case gif
    case spritesheet

    /// Menu display name — format acronyms stay untranslated like the web
    /// registry's labels; "Spritesheet" is a word and localizes (web
    /// `format_spritesheet`).
    var label: String {
        switch self {
        case .png: "PNG"
        case .svg: "SVG"
        case .gif: "GIF"
        case .spritesheet:
            String(
                localized: "Spritesheet",
                comment: "Export menu label for the all-frames horizontal-strip PNG format. web: format_spritesheet"
            )
        }
    }

    /// Suffix on the default filename stem, keeping formats that share an
    /// extension distinguishable (web parity: `spritesheetDefaultStem` in
    /// `src/lib/canvas/export.ts` marks the sheet vs the still PNG).
    var stemSuffix: String {
        switch self {
        case .png, .svg, .gif: ""
        case .spritesheet: "-sheet"
        }
    }

    /// Extension appended to the default export filename.
    var fileExtension: String {
        switch self {
        case .png, .spritesheet: "png"
        case .svg: "svg"
        case .gif: "gif"
        }
    }

    /// Content type handed to the platform file-export flow.
    var contentType: UTType {
        switch self {
        case .png, .spritesheet: .png
        case .svg: .svg
        case .gif: .gif
        }
    }
}
