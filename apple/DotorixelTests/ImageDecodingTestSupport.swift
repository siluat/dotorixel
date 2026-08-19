import Foundation
import ImageIO
import Testing

/// Decodes a PNG into a flat RGBA8 buffer (row-major, top-left origin),
/// asserting the decoded dimensions. Lossless for the fully opaque / fully
/// transparent pixels these tests draw (premultiplication cannot distort
/// alpha 255 or 0).
func decodedRgbaPixels(png data: Data, width: Int, height: Int) throws -> [UInt8] {
    let source = try #require(CGImageSourceCreateWithData(data as CFData, nil))
    let image = try #require(CGImageSourceCreateImageAtIndex(source, 0, nil))
    #expect(image.width == width)
    #expect(image.height == height)
    return try rgbaPixels(image: image, width: width, height: height)
}

/// Renders a decoded CGImage into a flat RGBA8 buffer (row-major,
/// top-left origin).
func rgbaPixels(image: CGImage, width: Int, height: Int) throws -> [UInt8] {
    var buffer = [UInt8](repeating: 0, count: width * height * 4)
    try buffer.withUnsafeMutableBytes { bytes in
        let context = try #require(CGContext(
            data: bytes.baseAddress,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ))
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    }
    return buffer
}

/// Byte offset of pixel (x, y) in a row-major RGBA8 buffer.
func rgbaByteOffset(x: Int, y: Int, width: Int) -> Int {
    (y * width + x) * 4
}

/// Extracts tile `index`'s pixels (tileWidth × height) from a decoded
/// horizontal-strip sheet buffer.
func tilePixels(
    sheet: [UInt8], sheetWidth: Int, tileWidth: Int, height: Int, index: Int
) -> [UInt8] {
    (0..<height).flatMap { y in
        let rowStart = (y * sheetWidth + index * tileWidth) * 4
        return sheet[rowStart..<rowStart + tileWidth * 4]
    }
}

/// Reads a GIF frame's raw (unclamped) delay in seconds — the on-wire
/// centisecond field, unlike the clamped variant viewers substitute for
/// tiny delays.
func gifUnclampedDelaySeconds(source: CGImageSource, frame: Int) throws -> Double {
    let properties = try #require(
        CGImageSourceCopyPropertiesAtIndex(source, frame, nil) as? [CFString: Any]
    )
    let gif = try #require(properties[kCGImagePropertyGIFDictionary] as? [CFString: Any])
    return try #require(gif[kCGImagePropertyGIFUnclampedDelayTime] as? Double)
}

/// Reads a GIF's file-level loop count — 0 means loop forever (the
/// NETSCAPE looping extension's infinite value).
func gifLoopCount(source: CGImageSource) throws -> Int {
    let properties = try #require(
        CGImageSourceCopyProperties(source, nil) as? [CFString: Any]
    )
    let gif = try #require(properties[kCGImagePropertyGIFDictionary] as? [CFString: Any])
    return try #require(gif[kCGImagePropertyGIFLoopCount] as? Int)
}
