import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// Decoded source payload admitted at the native file boundary and passed to
/// the shared Document as a Reference Layer.
struct ReferenceImageSource: Equatable {
    let name: String
    let rgba: Data
    let width: UInt32
    let height: UInt32
}

/// Actionable failures produced before a Reference import can mutate a tab.
enum ReferenceImageImportError: Error, Equatable, LocalizedError {
    case unsupportedFormat(name: String)
    case tooLarge(name: String, maximumBytes: Int)
    case decodedImageTooLarge(name: String, maximumPixels: Int)
    case decodeFailed(name: String)
    case fileReadFailed(name: String)

    var message: LocalizedStringResource {
        switch self {
        case let .unsupportedFormat(name):
            return "\(name) is not a supported image. Choose a PNG, JPEG, WebP, or GIF file."
        case let .tooLarge(name, maximumBytes):
            let maximumMiB = maximumBytes / 1_048_576
            return "\(name) is too large. Choose an image no larger than \(maximumMiB) MiB."
        case let .decodedImageTooLarge(name, maximumPixels):
            return "\(name) has too many pixels. Choose an image with no more than \(maximumPixels) pixels."
        case let .decodeFailed(name):
            return "\(name) could not be decoded. Choose a valid PNG, JPEG, WebP, or GIF file."
        case let .fileReadFailed(name):
            return "\(name) could not be read. Check the file permission and try again."
        }
    }

    var errorDescription: String? {
        String(localized: message)
    }
}

/// Native Reference-image boundary. Validation mirrors the web importer, then
/// ImageIO decodes the source once into the tightly packed RGBA buffer the
/// core, Metal renderer, and later sampling slice share.
enum ReferenceImageImporter {
    static let maximumFileSizeBytes = 10 * 1024 * 1024
    /// A decoded Reference may use at most 64 MiB of tightly packed RGBA.
    /// The compressed-file limit alone cannot bound attacker-controlled image
    /// dimensions because formats such as PNG can encode huge uniform images.
    static let maximumDecodedPixelCount = 64 * 1024 * 1024 / 4
    static let supportedContentTypes: [UTType] = [.png, .jpeg, .webP, .gif]

    struct DecodedBufferLayout: Equatable {
        let bytesPerRow: Int
        let byteCount: Int
    }

    static func validate(
        contentType: UTType?,
        fileSize: Int,
        name: String = "Reference image"
    ) throws {
        guard let contentType, supportedContentTypes.contains(contentType) else {
            throw ReferenceImageImportError.unsupportedFormat(name: name)
        }
        guard fileSize <= maximumFileSizeBytes else {
            throw ReferenceImageImportError.tooLarge(
                name: name,
                maximumBytes: maximumFileSizeBytes
            )
        }
    }

    static func importFile(at url: URL) throws -> ReferenceImageSource {
        let fallbackName = String(localized: "Reference")
        let name = url.lastPathComponent.trimmingCharacters(in: .whitespacesAndNewlines)
        let displayName = name.isEmpty ? fallbackName : name
        let hasSecurityScope = url.startAccessingSecurityScopedResource()
        defer {
            if hasSecurityScope {
                url.stopAccessingSecurityScopedResource()
            }
        }

        let values: URLResourceValues
        do {
            values = try url.resourceValues(forKeys: [.contentTypeKey, .fileSizeKey])
        } catch {
            throw ReferenceImageImportError.fileReadFailed(name: displayName)
        }
        let contentType = values.contentType ?? UTType(filenameExtension: url.pathExtension)
        if let fileSize = values.fileSize {
            try validate(contentType: contentType, fileSize: fileSize, name: displayName)
        } else {
            // Format still fails before opening a file whose metadata omitted
            // the byte count. The Data-size check below owns the size fallback.
            try validate(contentType: contentType, fileSize: 0, name: displayName)
        }

        let data: Data
        do {
            data = try Data(contentsOf: url, options: .mappedIfSafe)
        } catch {
            throw ReferenceImageImportError.fileReadFailed(name: displayName)
        }
        return try decode(data, contentType: contentType, name: displayName)
    }

    static func decode(
        _ data: Data,
        contentType: UTType?,
        name: String
    ) throws -> ReferenceImageSource {
        try validate(contentType: contentType, fileSize: data.count, name: name)
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let encodedWidth = (properties[kCGImagePropertyPixelWidth] as? NSNumber)?.intValue,
              let encodedHeight = (properties[kCGImagePropertyPixelHeight] as? NSNumber)?.intValue else {
            throw ReferenceImageImportError.decodeFailed(name: name)
        }
        // Reject hostile dimensions before asking ImageIO to materialize the
        // decoded image. Validate the transformed output again below because
        // EXIF orientation may swap its axes.
        _ = try decodedBufferLayout(width: encodedWidth, height: encodedHeight, name: name)

        let thumbnailOptions: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: max(encodedWidth, encodedHeight),
            kCGImageSourceShouldCacheImmediately: true,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(
            source,
            0,
            thumbnailOptions as CFDictionary
        ),
              let width = UInt32(exactly: image.width), width > 0,
              let height = UInt32(exactly: image.height), height > 0 else {
            throw ReferenceImageImportError.decodeFailed(name: name)
        }

        let bufferLayout = try decodedBufferLayout(
            width: image.width,
            height: image.height,
            name: name
        )
        var rgba = Data(count: bufferLayout.byteCount)
        let drewImage = rgba.withUnsafeMutableBytes { bytes -> Bool in
            guard let baseAddress = bytes.baseAddress,
                  let context = CGContext(
                    data: baseAddress,
                    width: image.width,
                    height: image.height,
                    bitsPerComponent: 8,
                    bytesPerRow: bufferLayout.bytesPerRow,
                    space: CGColorSpaceCreateDeviceRGB(),
                    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                  ) else {
                return false
            }
            // A bitmap context's first memory row receives the CGImage's top
            // source row. Leave its transform untouched so row zero matches
            // the core and browser ImageData top-left RGBA convention.
            context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
            return true
        }
        guard drewImage else {
            throw ReferenceImageImportError.decodeFailed(name: name)
        }

        unpremultiplyAlpha(in: &rgba)
        return ReferenceImageSource(name: name, rgba: rgba, width: width, height: height)
    }

    /// Validates decoded dimensions and returns an overflow-safe RGBA layout.
    /// Kept separate from ImageIO so the allocation boundary can be tested
    /// without first constructing a dangerously large raster.
    static func decodedBufferLayout(
        width: Int,
        height: Int,
        name: String
    ) throws -> DecodedBufferLayout {
        guard width > 0, height > 0 else {
            throw ReferenceImageImportError.decodeFailed(name: name)
        }
        let (pixelCount, pixelCountOverflowed) = width.multipliedReportingOverflow(by: height)
        guard !pixelCountOverflowed, pixelCount <= maximumDecodedPixelCount else {
            throw ReferenceImageImportError.decodedImageTooLarge(
                name: name,
                maximumPixels: maximumDecodedPixelCount
            )
        }
        let (bytesPerRow, rowOverflowed) = width.multipliedReportingOverflow(by: 4)
        let (byteCount, byteCountOverflowed) = bytesPerRow.multipliedReportingOverflow(by: height)
        guard !rowOverflowed, !byteCountOverflowed else {
            throw ReferenceImageImportError.decodedImageTooLarge(
                name: name,
                maximumPixels: maximumDecodedPixelCount
            )
        }
        return DecodedBufferLayout(bytesPerRow: bytesPerRow, byteCount: byteCount)
    }

    /// ImageIO renders through a premultiplied-alpha CGContext. The core's
    /// source contract is ordinary RGBA, the same bytes browser ImageData
    /// exposes, so restore straight color channels before crossing the seam.
    private static func unpremultiplyAlpha(in rgba: inout Data) {
        rgba.withUnsafeMutableBytes { bytes in
            let channels = bytes.bindMemory(to: UInt8.self)
            for offset in stride(from: 0, to: channels.count, by: 4) {
                let alpha = Int(channels[offset + 3])
                guard alpha > 0, alpha < 255 else {
                    if alpha == 0 {
                        channels[offset] = 0
                        channels[offset + 1] = 0
                        channels[offset + 2] = 0
                    }
                    continue
                }
                for channel in offset..<(offset + 3) {
                    channels[channel] = UInt8(min(255, (Int(channels[channel]) * 255 + alpha / 2) / alpha))
                }
            }
        }
    }
}
