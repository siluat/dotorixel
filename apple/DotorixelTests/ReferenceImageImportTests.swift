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

    @Test("decoded RGBA dimensions are capped with overflow-safe arithmetic")
    func decodedDimensionsAreBounded() throws {
        let exactLimit = try ReferenceImageImporter.decodedBufferLayout(
            width: 4_096,
            height: 4_096,
            name: "limit.png"
        )
        #expect(exactLimit.byteCount == 64 * 1024 * 1024)

        #expect(throws: ReferenceImageImportError.decodedImageTooLarge(
            name: "wide.png",
            maximumPixels: ReferenceImageImporter.maximumDecodedPixelCount
        )) {
            try ReferenceImageImporter.decodedBufferLayout(
                width: 4_097,
                height: 4_096,
                name: "wide.png"
            )
        }
        #expect(throws: ReferenceImageImportError.decodedImageTooLarge(
            name: "overflow.png",
            maximumPixels: ReferenceImageImporter.maximumDecodedPixelCount
        )) {
            try ReferenceImageImporter.decodedBufferLayout(
                width: .max,
                height: 2,
                name: "overflow.png"
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

    @Test("semi-transparent pixels decode to straight RGBA")
    func semiTransparentImageDecodesToStraightRgba() throws {
        // CGImage's premultiplied-last contract stores half-alpha channels at
        // half their straight values. The importer must restore them exactly.
        let premultipliedRgba = Data([64, 32, 16, 128])
        let png = try pngData(rgba: premultipliedRgba, width: 1, height: 1)

        let source = try ReferenceImageImporter.decode(
            png,
            contentType: .png,
            name: "alpha.png"
        )

        #expect(source.rgba == Data([128, 64, 32, 128]))
    }

    @Test("JPEG EXIF orientation is applied before RGBA extraction")
    func jpegExifOrientationIsApplied() throws {
        let encodedWidth = 40
        let encodedHeight = 20
        let rgba = Data((0..<(encodedWidth * encodedHeight)).flatMap { index in
            let x = index % encodedWidth
            return x < encodedWidth / 2
                ? [UInt8(0xFF), 0, 0, 0xFF]
                : [UInt8(0), 0, 0xFF, 0xFF]
        })
        let jpeg = try imageData(
            rgba: rgba,
            width: encodedWidth,
            height: encodedHeight,
            contentType: .jpeg,
            properties: [
                kCGImageDestinationLossyCompressionQuality: 1.0,
                kCGImagePropertyOrientation: 6,
            ]
        )

        let source = try ReferenceImageImporter.decode(
            jpeg,
            contentType: .jpeg,
            name: "oriented.jpg"
        )

        #expect(source.width == UInt32(encodedHeight))
        #expect(source.height == UInt32(encodedWidth))
        let top = rgbaPixel(source.rgba, x: 10, y: 5, width: Int(source.width))
        let bottom = rgbaPixel(source.rgba, x: 10, y: 35, width: Int(source.width))
        #expect(top[0] > top[2] + 100)
        #expect(bottom[2] > bottom[0] + 100)
    }

    @Test("actionable import errors resolve in every supported locale")
    func importErrorsAreLocalized() {
        let formatError = ReferenceImageImportError.unsupportedFormat(name: "notes.txt")
        let sizeError = ReferenceImageImportError.tooLarge(
            name: "huge.png",
            maximumBytes: ReferenceImageImporter.maximumFileSizeBytes
        )
        let decodedSizeError = ReferenceImageImportError.decodedImageTooLarge(
            name: "huge.png",
            maximumPixels: ReferenceImageImporter.maximumDecodedPixelCount
        )

        #expect(resolve(formatError.message, in: "ko").contains("notes.txt"))
        #expect(resolve(formatError.message, in: "ja").contains("notes.txt"))
        #expect(resolve(sizeError.message, in: "en") ==
            "huge.png is too large. Choose an image no larger than 10 MiB.")
        #expect(resolve(sizeError.message, in: "ko") ==
            "huge.png 파일이 너무 큽니다. 10 MiB 이하의 이미지를 선택하세요.")
        #expect(resolve(sizeError.message, in: "ja") ==
            "huge.png は大きすぎます。10 MiB以下の画像を選択してください。")
        #expect(resolve(decodedSizeError.message, in: "en") ==
            "huge.png has too many pixels. Choose an image with no more than 16,777,216 pixels.")
        #expect(resolve(decodedSizeError.message, in: "ko").contains("16,777,216"))
        #expect(resolve(decodedSizeError.message, in: "ja").contains("16,777,216"))
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
        try imageData(
            rgba: rgba,
            width: width,
            height: height,
            contentType: .png
        )
    }

    private func imageData(
        rgba: Data,
        width: Int,
        height: Int,
        contentType: UTType,
        properties: [CFString: Any]? = nil
    ) throws -> Data {
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
        let encodedData = NSMutableData()
        let destination = try #require(CGImageDestinationCreateWithData(
            encodedData,
            contentType.identifier as CFString,
            1,
            nil
        ))
        CGImageDestinationAddImage(destination, image, properties as CFDictionary?)
        try #require(CGImageDestinationFinalize(destination))
        return encodedData as Data
    }

    private func rgbaPixel(_ rgba: Data, x: Int, y: Int, width: Int) -> [UInt8] {
        let offset = (y * width + x) * 4
        return Array(rgba[offset..<(offset + 4)])
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
