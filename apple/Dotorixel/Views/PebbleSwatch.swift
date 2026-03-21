import SwiftUI

/// Color swatch matching the web's `PebbleSwatch` component.
/// Rounded square with hover scale and selected outline.
struct PebbleSwatch: View {
    let color: Color
    var isSelected: Bool = false
    var size: Size = .sm
    var action: (() -> Void)?

    enum Size {
        case sm // 22×22
        case lg // 32×32
    }

    private var dimension: CGFloat {
        switch size {
        case .sm: 22
        case .lg: 32
        }
    }

    private var radius: CGFloat {
        switch size {
        case .sm: 6
        case .lg: 8
        }
    }

    private var isWhite: Bool {
        color.r == 255 && color.g == 255 && color.b == 255
    }

    var body: some View {
        if let action {
            Button(action: action) { swatchContent }
                .buttonStyle(.plain)
        } else {
            swatchContent
        }
    }

    private var swatchContent: some View {
        RoundedRectangle(cornerRadius: radius)
            .fill(color.swiftUIColor)
            .frame(width: dimension, height: dimension)
            .overlay {
                if isWhite {
                    RoundedRectangle(cornerRadius: radius)
                        .stroke(PebbleTokens.panelBorder, lineWidth: 1)
                }
            }
            .overlay {
                if isSelected {
                    RoundedRectangle(cornerRadius: radius)
                        .stroke(PebbleTokens.accentDark, lineWidth: 2.5)
                        .padding(-2)
                }
            }
    }

}
