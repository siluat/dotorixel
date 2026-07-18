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
}
