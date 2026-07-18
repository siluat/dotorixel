import Testing
@testable import Dotorixel

@Suite("HsvPickerModel — picker state behaviors")
struct HsvPickerModelTests {

    @Test("dragging in the SV square updates the derived color at the current hue")
    func svEditUpdatesColor() {
        var model = HsvPickerModel(color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))

        model.setSaturationValue(s: 0.5, v: 0.5)

        // h=0 (red), s=0.5, v=0.5 → RGB(128, 64, 64)
        #expect(model.color == Color(r: 0x80, g: 0x40, b: 0x40, a: 0xFF))
    }

    @Test("changing hue preserves the thumb's saturation/value position")
    func hueEditPreservesSaturationValue() {
        var model = HsvPickerModel(color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        model.setSaturationValue(s: 0.5, v: 0.5)

        model.setHue(120)

        #expect(model.hsv == HsvColor(h: 120, s: 0.5, v: 0.5))
        // h=120 (green), s=0.5, v=0.5 → RGB(64, 128, 64)
        #expect(model.color == Color(r: 0x40, g: 0x80, b: 0x40, a: 0xFF))
    }

    @Test("an external foreground change repositions the picker to that color")
    func externalChangeRepositionsPicker() {
        var model = HsvPickerModel(color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))

        let blue = Color(r: 0x00, g: 0x00, b: 0xFF, a: 0xFF)
        model.sync(to: blue)

        #expect(model.hsv == HsvColor(h: 240, s: 1, v: 1))
        #expect(model.color == blue)
    }

    @Test("syncing to an achromatic color keeps the current hue")
    func achromaticSyncPreservesHue() {
        var model = HsvPickerModel(color: Color(r: 0x00, g: 0x00, b: 0xFF, a: 0xFF))

        model.sync(to: Color(r: 0x00, g: 0x00, b: 0x00, a: 0xFF))

        // Black has no defined hue — the square's gradient should stay blue.
        #expect(model.hsv == HsvColor(h: 240, s: 0, v: 0))
    }

    @Test("syncing back the picker's own emitted color does not move the thumb")
    func ownEmittedColorEchoIsIgnored() {
        var model = HsvPickerModel(color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        // Low saturation: the emitted RGB rounds so coarsely that re-deriving
        // HSV from it would snap hue 350 → 0 and jump the thumb.
        model.setHue(350)
        model.setSaturationValue(s: 0.01, v: 0.5)
        let edited = model.hsv

        model.sync(to: model.color)

        #expect(model.hsv == edited)
    }
}
