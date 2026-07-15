import SwiftUI
import UniformTypeIdentifiers

/// Pre-encoded PNG bytes of the canvas, ready for the platform save flow.
///
/// `FileDocument` conformance lets SwiftUI's `.fileExporter` write the bytes
/// through one implementation on both macOS (save panel) and iPadOS (Files
/// document picker).
struct PngExportDocument: FileDocument {
    static let readableContentTypes: [UTType] = [.png]

    let data: Data

    init(data: Data) {
        self.data = data
    }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }
        self.data = data
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}
