import Foundation

/// State model for the HSV picker, mirroring the web `HsvPicker.svelte`
/// behaviors: continuous SV/hue edits and external-color sync. UI-independent
/// so the behaviors are unit-testable without rendering.
struct HsvPickerModel {
    private(set) var hsv: HsvColor

    /// The last color that passed through the model (emitted by an edit or
    /// accepted by a sync). Mirrors the web picker's `lastSyncedHex`: when the
    /// picker's own emitted color echoes back through `sync(to:)`, HSV must
    /// not be re-derived from the quantized RGB, or the thumb would drift.
    private var lastSyncedColor: Color

    init(color: Color) {
        hsv = HsvColor(from: color)
        lastSyncedColor = color
    }

    /// The fully opaque color the picker currently represents.
    var color: Color { hsv.color }

    /// Updates saturation (x axis) and value (y axis, top = bright) from an
    /// SV-square drag, keeping the current hue.
    mutating func setSaturationValue(s: Double, v: Double) {
        hsv = HsvColor(h: hsv.h, s: s, v: v)
        lastSyncedColor = hsv.color
    }

    /// Updates hue (0–360) from a hue-strip drag, keeping the current S/V.
    mutating func setHue(_ h: Double) {
        hsv = HsvColor(h: h, s: hsv.s, v: hsv.v)
        lastSyncedColor = hsv.color
    }

    /// Repositions the picker to an externally selected color (palette tap,
    /// eyedropper commit, swap). The picker's own emitted color echoing back
    /// is ignored. Achromatic colors (s=0 or v=0) have no defined hue, so the
    /// current hue is kept — the SV square's gradient stays put instead of
    /// snapping to red.
    mutating func sync(to color: Color) {
        guard color != lastSyncedColor else { return }
        let synced = HsvColor(from: color)
        let isAchromatic = synced.s == 0 || synced.v == 0
        hsv = HsvColor(h: isAchromatic ? hsv.h : synced.h, s: synced.s, v: synced.v)
        lastSyncedColor = color
    }
}
