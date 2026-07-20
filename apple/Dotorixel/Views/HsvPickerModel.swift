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

    /// Direction of a VoiceOver adjustable-action edit, mirroring SwiftUI's
    /// `AccessibilityAdjustmentDirection` without importing SwiftUI here.
    enum AdjustmentDirection {
        case increment
        case decrement
    }

    /// VoiceOver adjustable-action step for saturation and brightness (5%).
    /// Coarser than the web's arrow-key step because VoiceOver has no
    /// Shift-like modifier to accelerate traversal.
    static let svAdjustmentStep = 0.05

    /// VoiceOver adjustable-action step for hue (10°), matching the same
    /// coarser-than-web rationale as `svAdjustmentStep`.
    static let hueAdjustmentStep: Double = 10

    /// Adjusts saturation one step in the given direction, clamped to 0–1.
    mutating func adjustSaturation(_ direction: AdjustmentDirection) {
        let delta = direction == .increment ? Self.svAdjustmentStep : -Self.svAdjustmentStep
        setSaturationValue(s: min(1, max(0, hsv.s + delta)), v: hsv.v)
    }

    /// Adjusts brightness (value) one step in the given direction, clamped to 0–1.
    mutating func adjustBrightness(_ direction: AdjustmentDirection) {
        let delta = direction == .increment ? Self.svAdjustmentStep : -Self.svAdjustmentStep
        setSaturationValue(s: hsv.s, v: min(1, max(0, hsv.v + delta)))
    }

    /// Adjusts hue one step in the given direction, clamped to 0–360 (no wrap).
    mutating func adjustHue(_ direction: AdjustmentDirection) {
        let delta = direction == .increment ? Self.hueAdjustmentStep : -Self.hueAdjustmentStep
        setHue(min(360, max(0, hsv.h + delta)))
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
