import SwiftUI

/// Native HSV picker mirroring the web `HsvPicker.svelte`: a saturation/value
/// square (x = saturation, y = value, top = bright) beside a vertical hue
/// strip. Drives the foreground color; alpha is always fully opaque.
struct HsvPickerView: View {
    /// The externally selected color the picker reflects (palette tap,
    /// eyedropper commit, swap reposition the thumb via this).
    let selectedColor: Color
    /// Called continuously while dragging with the newly picked color.
    let onColorChange: (Color) -> Void

    @State private var model: HsvPickerModel

    /// Picker height — web `RightPanel.svelte` passes `height={140}`.
    private let pickerHeight: CGFloat = 140

    /// Hue strip visual width — web `HsvPicker.svelte` `hueStripWidth = 20`.
    private let hueStripWidth: CGFloat = 20

    /// Column gap — web `HsvPicker.svelte` `gap = 8`.
    private let columnGap: CGFloat = 8

    /// SV thumb diameter — web `.sv-indicator`: 12px.
    private let thumbSize: CGFloat = 12

    /// Hue indicator bar height — web `.hue-indicator`: 4px + 2px border.
    private let hueIndicatorHeight: CGFloat = 8

    /// Hue indicator side overhang — web `.hue-indicator`: `left/right: -2px`.
    private let hueIndicatorOverhang: CGFloat = 2

    init(selectedColor: Color, onColorChange: @escaping (Color) -> Void) {
        self.selectedColor = selectedColor
        self.onColorChange = onColorChange
        _model = State(initialValue: HsvPickerModel(color: selectedColor))
    }

    var body: some View {
        HStack(spacing: columnGap) {
            svSquare
            hueStrip
        }
        .frame(height: pickerHeight)
        .onChange(of: selectedColor) { _, newColor in
            model.sync(to: newColor)
        }
    }

    // MARK: - SV square

    private var svSquare: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                LinearGradient(
                    colors: [.white, HsvColor(h: model.hsv.h, s: 1, v: 1).color.swiftUIColor],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                LinearGradient(
                    colors: [.clear, .black],
                    startPoint: .top,
                    endPoint: .bottom
                )
                svThumb
                    .position(
                        x: model.hsv.s * geo.size.width,
                        y: (1 - model.hsv.v) * geo.size.height
                    )
            }
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let s = clampUnit(value.location.x / geo.size.width)
                        let v = 1 - clampUnit(value.location.y / geo.size.height)
                        model.setSaturationValue(s: s, v: v)
                        onColorChange(model.color)
                    }
            )
        }
        .accessibilityLabel("Saturation and brightness")
        .accessibilityValue(
            "Saturation \(Int((model.hsv.s * 100).rounded())), brightness \(Int((model.hsv.v * 100).rounded()))"
        )
    }

    private var svThumb: some View {
        Circle()
            .stroke(.white, lineWidth: 2)
            .frame(width: thumbSize, height: thumbSize)
            .shadow(color: .black.opacity(0.6), radius: 1)
    }

    // MARK: - Hue strip

    private var hueStrip: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                LinearGradient(
                    stops: hueGradientStops(),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(width: hueStripWidth)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                hueIndicator
                    .offset(y: model.hsv.h / 360 * geo.size.height - hueIndicatorHeight / 2)
            }
            .frame(maxWidth: .infinity)
            // The strip's visual is 20pt wide; the tappable area spans the
            // full 44pt container (HIG minimum) for iPad touch.
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        model.setHue(clampUnit(value.location.y / geo.size.height) * 360)
                        onColorChange(model.color)
                    }
            )
        }
        .frame(width: DesignTokens.btnSize)
        .accessibilityLabel("Hue")
        .accessibilityValue("\(Int(model.hsv.h.rounded())) degrees")
    }

    private var hueIndicator: some View {
        RoundedRectangle(cornerRadius: 2)
            .stroke(.white, lineWidth: 2)
            .frame(width: hueStripWidth + hueIndicatorOverhang * 2, height: hueIndicatorHeight)
            .shadow(color: .black.opacity(0.6), radius: 1)
    }

    /// Web `renderHueCanvas`: stops every 60° through the full hue circle.
    private func hueGradientStops() -> [Gradient.Stop] {
        stride(from: 0, through: 360, by: 60).map { degrees in
            Gradient.Stop(
                color: HsvColor(h: Double(degrees % 360), s: 1, v: 1).color.swiftUIColor,
                location: Double(degrees) / 360
            )
        }
    }

    private func clampUnit(_ value: CGFloat) -> Double {
        Double(max(0, min(1, value)))
    }
}
