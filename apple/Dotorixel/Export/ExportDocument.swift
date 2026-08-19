import SwiftUI
import UniformTypeIdentifiers

/// Pre-encoded export bytes of one format's output, ready for the platform
/// save flow.
///
/// `FileDocument` conformance lets SwiftUI's `.fileExporter` write the bytes
/// through one implementation on both macOS (save panel) and iPadOS (Files
/// document picker). The concrete type of the write is the `contentType` the
/// exporter is presented with, so one document type serves every format.
struct ExportDocument: FileDocument {
    static let readableContentTypes: [UTType] = ExportFormat.allCases.map(\.contentType)

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
