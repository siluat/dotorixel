import Foundation

/// HSV representation of an opaque color, mirroring the web shell's
/// `HsvColor` (`src/lib/canvas/color.ts`) for cross-shell parity.
///
/// Kept shell-side per Core Placement: the conversion is simple, stable math,
/// so the binding overhead of a shared core implementation isn't warranted.
struct HsvColor: Equatable {
    /// Hue in degrees, 0–360. 0 when the color is achromatic (hue undefined).
    var h: Double
    /// Saturation, 0–1.
    var s: Double
    /// Value (brightness), 0–1.
    var v: Double

    /// Converts a UniFFI `Color` (sRGB UInt8) to HSV. Alpha is ignored.
    init(from color: Color) {
        let r = Double(color.r) / 255.0
        let g = Double(color.g) / 255.0
        let b = Double(color.b) / 255.0

        let maxComponent = max(r, g, b)
        let minComponent = min(r, g, b)
        let delta = maxComponent - minComponent

        var hue = 0.0
        if delta != 0 {
            if maxComponent == r {
                hue = 60 * ((g - b) / delta).truncatingRemainder(dividingBy: 6)
            } else if maxComponent == g {
                hue = 60 * ((b - r) / delta + 2)
            } else {
                hue = 60 * ((r - g) / delta + 4)
            }
        }
        if hue < 0 { hue += 360 }

        h = hue
        s = maxComponent == 0 ? 0 : delta / maxComponent
        v = maxComponent
    }

    init(h: Double, s: Double, v: Double) {
        self.h = h
        self.s = s
        self.v = v
    }

    /// The fully opaque UniFFI `Color` this HSV value represents.
    var color: Color {
        let c = v * s
        let x = c * (1 - abs((h / 60).truncatingRemainder(dividingBy: 2) - 1))
        let m = v - c

        let (r1, g1, b1): (Double, Double, Double)
        switch h {
        case ..<60: (r1, g1, b1) = (c, x, 0)
        case ..<120: (r1, g1, b1) = (x, c, 0)
        case ..<180: (r1, g1, b1) = (0, c, x)
        case ..<240: (r1, g1, b1) = (0, x, c)
        case ..<300: (r1, g1, b1) = (x, 0, c)
        default: (r1, g1, b1) = (c, 0, x)
        }

        return Color(
            r: UInt8(clamping: Int(((r1 + m) * 255).rounded())),
            g: UInt8(clamping: Int(((g1 + m) * 255).rounded())),
            b: UInt8(clamping: Int(((b1 + m) * 255).rounded())),
            a: 0xFF
        )
    }
}
