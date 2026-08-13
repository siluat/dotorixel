import CoreGraphics
import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers
@testable import Dotorixel

@Suite("Reference image import — validation and decode boundary")
struct ReferenceImageImportTests {
    @Test("the web-parity image formats are accepted through the 10 MiB limit")
    func supportedFormatsAndSizeLimitAreAccepted() throws {
        for contentType in [UTType.png, .jpeg, .webP, .gif] {
            try ReferenceImageImporter.validate(
                contentType: contentType,
                fileSize: ReferenceImageImporter.maximumFileSizeBytes
            )
        }
    }

    @Test("an unsupported format reports the file name and leaves decoding unopened")
    func unsupportedFormatIsActionable() {
        #expect(throws: ReferenceImageImportError.unsupportedFormat(name: "notes.txt")) {
            try ReferenceImageImporter.validate(
                contentType: .plainText,
                fileSize: 12,
                name: "notes.txt"
            )
        }
    }

    @Test("a file over 10 MiB reports the limit and file name")
    func oversizedFileIsActionable() {
        #expect(throws: ReferenceImageImportError.tooLarge(
            name: "huge.png",
            maximumBytes: ReferenceImageImporter.maximumFileSizeBytes
        )) {
            try ReferenceImageImporter.validate(
                contentType: .png,
                fileSize: ReferenceImageImporter.maximumFileSizeBytes + 1,
                name: "huge.png"
            )
        }
    }

    @Test("a corrupt image reports a decode failure without producing source pixels")
    func corruptImageIsActionable() {
        #expect(throws: ReferenceImageImportError.decodeFailed(name: "broken.png")) {
            try ReferenceImageImporter.decode(
                Data("not an image".utf8),
                contentType: .png,
                name: "broken.png"
            )
        }
    }

    @Test("a valid image decodes once into tightly packed RGBA source data")
    func validImageDecodesToRgba() throws {
        // Opaque colors keep source bytes independent from alpha
        // premultiplication while pinning RGBA channel and top-row order.
        let expectedRgba = Data([
            0xFF, 0, 0, 0xFF, 0, 0xFF, 0, 0xFF,
            0, 0, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        ])
        let png = try pngData(rgba: expectedRgba, width: 2, height: 2)

        let source = try ReferenceImageImporter.decode(
            png,
            contentType: .png,
            name: "pixel.png"
        )

        #expect(source.name == "pixel.png")
        #expect(source.width == 2)
        #expect(source.height == 2)
        #expect(Array(source.rgba) == Array(expectedRgba))
    }

    @Test("actionable import errors resolve in every supported locale")
    func importErrorsAreLocalized() {
        let formatError = ReferenceImageImportError.unsupportedFormat(name: "notes.txt")
        let sizeError = ReferenceImageImportError.tooLarge(
            name: "huge.png",
            maximumBytes: ReferenceImageImporter.maximumFileSizeBytes
        )

        #expect(resolve(formatError.message, in: "ko").contains("notes.txt"))
        #expect(resolve(formatError.message, in: "ja").contains("notes.txt"))
        #expect(resolve(sizeError.message, in: "en") ==
            "huge.png is too large. Choose an image no larger than 10 MiB.")
        #expect(resolve(sizeError.message, in: "ko") ==
            "huge.png 파일이 너무 큽니다. 10 MiB 이하의 이미지를 선택하세요.")
        #expect(resolve(sizeError.message, in: "ja") ==
            "huge.png は大きすぎます。10 MiB以下の画像を選択してください。")
    }

    @Test("unsupported, oversized, and corrupt files leave the tab unchanged")
    func rejectedFilesDoNotMutateTheDocument() throws {
        try assertRejectedImport(
            data: Data("not an image".utf8),
            pathExtension: "txt",
            expectedError: { .unsupportedFormat(name: $0) }
        )
        try assertRejectedImport(
            data: Data(repeating: 0, count: ReferenceImageImporter.maximumFileSizeBytes + 1),
            pathExtension: "png",
            expectedError: {
                .tooLarge(
                    name: $0,
                    maximumBytes: ReferenceImageImporter.maximumFileSizeBytes
                )
            }
        )
        try assertRejectedImport(
            data: Data("not an image".utf8),
            pathExtension: "png",
            expectedError: { .decodeFailed(name: $0) }
        )
    }

    private func pngData(rgba: Data, width: Int, height: Int) throws -> Data {
        let provider = try #require(CGDataProvider(data: rgba as CFData))
        let bitmapInfo = CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue)
        let image = try #require(CGImage(
            width: width,
            height: height,
            bitsPerComponent: 8,
            bitsPerPixel: 32,
            bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: bitmapInfo,
            provider: provider,
            decode: nil,
            shouldInterpolate: false,
            intent: .defaultIntent
        ))
        let png = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(
            png,
            UTType.png.identifier as CFString,
            1,
            nil
        ))
        CGImageDestinationAddImage(destination, image, nil)
        try #require(CGImageDestinationFinalize(destination))
        return png as Data
    }

    private func assertRejectedImport(
        data: Data,
        pathExtension: String,
        expectedError: (String) -> ReferenceImageImportError
    ) throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension(pathExtension)
        try data.write(to: url, options: .atomic)
        defer { try? FileManager.default.removeItem(at: url) }

        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let layersBefore = tab.document.layers()
        let activeLayerBefore = tab.document.activeLayerId()
        let pixelsBefore = tab.document.composite()

        #expect(throws: expectedError(url.lastPathComponent)) {
            try tab.importReference(at: url)
        }
        #expect(tab.document.layers() == layersBefore)
        #expect(tab.document.activeLayerId() == activeLayerBefore)
        #expect(tab.document.composite() == pixelsBefore)
        #expect(!tab.canUndo)
    }
}
