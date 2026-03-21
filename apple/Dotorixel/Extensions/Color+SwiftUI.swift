import SwiftUI

extension Color {
    /// Uppercase hex string representation, e.g. `#FF8A65`.
    var hexString: String {
        String(format: "#%02X%02X%02X", r, g, b)
    }

    /// Converts UniFFI `Color` (sRGB UInt8) to `SwiftUI.Color`.
    var swiftUIColor: SwiftUI.Color {
        SwiftUI.Color(
            red: Double(r) / 255.0,
            green: Double(g) / 255.0,
            blue: Double(b) / 255.0,
            opacity: Double(a) / 255.0
        )
    }

    /// Creates a UniFFI `Color` from a resolved SwiftUI color.
    /// Components are in extended linear sRGB; values outside 0–1 are clamped
    /// to guard against HDR color spaces.
    init(resolved: SwiftUI.Color.Resolved) {
        self.init(
            r: Self.clampToUInt8(resolved.red),
            g: Self.clampToUInt8(resolved.green),
            b: Self.clampToUInt8(resolved.blue),
            a: Self.clampToUInt8(resolved.opacity)
        )
    }

    private static func clampToUInt8(_ value: Float) -> UInt8 {
        UInt8(clamping: Int(round(max(0, min(1, value)) * 255)))
    }
}
