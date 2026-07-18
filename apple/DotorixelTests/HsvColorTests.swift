import Testing
@testable import Dotorixel

@Suite("HsvColor — RGB↔HSV conversion")
struct HsvColorTests {

    @Test("every default palette color survives an RGB→HSV→RGB round trip")
    func paletteRoundTrip() {
        for color in DefaultPalette.rows.flatMap({ $0 }) {
            let roundTripped = HsvColor(from: color).color
            #expect(roundTripped == color, "round trip failed for \(color.hexString)")
        }
    }

    @Test("achromatic colors convert with zero saturation and undefined hue as 0")
    func achromaticConversion() {
        let black = Color(r: 0, g: 0, b: 0, a: 0xFF)
        let gray = Color(r: 0x80, g: 0x80, b: 0x80, a: 0xFF)
        let white = Color(r: 0xFF, g: 0xFF, b: 0xFF, a: 0xFF)

        #expect(HsvColor(from: black) == HsvColor(h: 0, s: 0, v: 0))
        #expect(HsvColor(from: white) == HsvColor(h: 0, s: 0, v: 1))

        let grayHsv = HsvColor(from: gray)
        #expect(grayHsv.h == 0)
        #expect(grayHsv.s == 0)
        #expect(grayHsv.color == gray)
    }
}
