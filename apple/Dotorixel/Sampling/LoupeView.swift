import SwiftUI

/// The sampling loupe overlay: a 9×9 magnified neighborhood of the
/// eyedropper's target pixel with a hex chip below. Mirrors the web's
/// `Loupe.svelte`; every dimension comes from `LoupeGeometry` so the rendered
/// box and the position math share one source.
struct LoupeView: View {
    /// Row-major 9×9 grid of sampled colors (81 entries). Cells whose canvas
    /// coordinates fall outside the canvas are `nil`; transparent pixels are
    /// a `Color` with `a == 0`.
    let grid: [Color?]

    /// The chip reflects the CURRENT center cell, not a preserved last-opaque
    /// color, so the em-dash + patterned swatch stay honest when a drag
    /// drifts onto nil/transparent pixels.
    private var centerCell: Color? {
        let index = LoupeGeometry.centerIndex
        return index < grid.count ? grid[index] : nil
    }

    private var centerHex: String? {
        guard let cell = centerCell, cell.a > 0 else { return nil }
        return cell.hexString
    }

    var body: some View {
        VStack(spacing: LoupeGeometry.gridChipGap) {
            gridView
            chip
        }
        .padding(LoupeGeometry.padding + LoupeGeometry.borderWidth)
        .frame(width: LoupeGeometry.width, height: LoupeGeometry.height)
        .background(DesignTokens.bgElevated)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusMd))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.radiusMd)
                .strokeBorder(DesignTokens.border, lineWidth: LoupeGeometry.borderWidth)
        )
        // --ds-shadow-md: 0 2px 16px rgba(0, 0, 0, 0.07)
        .shadow(color: .black.opacity(0.07), radius: 8, x: 0, y: 2)
    }

    // MARK: - Grid

    private var gridView: some View {
        VStack(spacing: LoupeGeometry.cellGap) {
            ForEach(0..<LoupeGeometry.gridSize, id: \.self) { row in
                HStack(spacing: LoupeGeometry.cellGap) {
                    ForEach(0..<LoupeGeometry.gridSize, id: \.self) { column in
                        let index = row * LoupeGeometry.gridSize + column
                        cellView(index < grid.count ? grid[index] : nil)
                    }
                }
            }
        }
        // Gridlines are rendered by the gaps showing through this background.
        .background(DesignTokens.border)
        // The grid's center coincides with the center cell's center, so the
        // highlight rings overlay the grid rather than the cell — they extend
        // past the cell edge into its neighbors, which a per-cell overlay
        // would z-fight over.
        .overlay { centerRings }
    }

    @ViewBuilder
    private func cellView(_ color: Color?) -> some View {
        Group {
            if let color {
                if color.a > 0 {
                    color.opaqueSwiftUIColor
                } else {
                    CheckerboardFill()
                }
            } else {
                DiagonalHatchFill()
            }
        }
        .frame(width: LoupeGeometry.cellSize, height: LoupeGeometry.cellSize)
    }

    /// White inner + black outer ring around the center cell. Literal
    /// black/white (not theme tokens) so contrast holds against any sampled
    /// cell color. Matches the web's `::before`/`::after` ring geometry:
    /// black covers 4..2pt outside the cell edge, white 2..0pt.
    private var centerRings: some View {
        ZStack {
            Rectangle()
                .strokeBorder(SwiftUI.Color.black, lineWidth: 2)
                .frame(width: LoupeGeometry.cellSize + 8, height: LoupeGeometry.cellSize + 8)
            Rectangle()
                .strokeBorder(SwiftUI.Color.white, lineWidth: 2)
                .frame(width: LoupeGeometry.cellSize + 4, height: LoupeGeometry.cellSize + 4)
        }
    }

    // MARK: - Hex chip

    private var chip: some View {
        HStack(spacing: 6) {
            swatch
            Text(centerHex ?? "—")
                .font(.system(size: DesignTokens.fontSizeSm, design: .monospaced))
                .foregroundStyle(centerHex == nil ? DesignTokens.textTertiary : DesignTokens.textPrimary)
                // Locked to the swatch height so the chip row stays exactly
                // `chipHeight` — a free line height would drift the box off
                // the positioning math.
                .frame(height: LoupeGeometry.swatchSize)
        }
        .padding(.vertical, LoupeGeometry.chipPaddingY)
        .padding(.horizontal, DesignTokens.space3)
        .background(DesignTokens.bgSurface)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
    }

    /// Swatch patterns mirror the corresponding cell states so the chip tells
    /// the user which kind of "no color" the center is in.
    private var swatch: some View {
        Group {
            if let cell = centerCell {
                if cell.a > 0 {
                    cell.opaqueSwiftUIColor
                } else {
                    CheckerboardFill()
                }
            } else {
                DiagonalHatchFill()
            }
        }
        .frame(width: LoupeGeometry.swatchSize, height: LoupeGeometry.swatchSize)
        .clipShape(RoundedRectangle(cornerRadius: 3))
        .overlay(
            RoundedRectangle(cornerRadius: 3)
                .strokeBorder(DesignTokens.border, lineWidth: 1)
        )
    }
}

private extension Color {
    /// The sampled RGB at full opacity. The loupe treats every `a > 0` sample
    /// as opaque (web parity: `rgb(r, g, b)` in `Loupe.svelte`) — a cell shows
    /// the stored color values, not a blend against whatever sits behind the
    /// overlay. The hex chip already reads RGB only, so this keeps the cell,
    /// swatch, and hex text telling the same story.
    var opaqueSwiftUIColor: SwiftUI.Color {
        SwiftUI.Color(
            red: Double(r) / 255.0,
            green: Double(g) / 255.0,
            blue: Double(b) / 255.0
        )
    }
}

// MARK: - Fills

/// 2×2 checkerboard marking a transparent pixel. Colors and orientation
/// (top-left and bottom-right light) match the canvas renderer's
/// high-zoom sub-checkerboard (`Shaders.metal`) so the transparency signal
/// is consistent across the app.
private struct CheckerboardFill: View {
    private let light = SwiftUI.Color.white
    private let dark = SwiftUI.Color(red: 0xE0 / 255.0, green: 0xE0 / 255.0, blue: 0xE0 / 255.0)

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) { light; dark }
            HStack(spacing: 0) { dark; light }
        }
    }
}

/// Diagonal hatch (45°) over surface tone marking "no pixel here" — a cell
/// outside the canvas bounds — as distinct from a transparent pixel.
private struct DiagonalHatchFill: View {
    var body: some View {
        Canvas { context, size in
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(DesignTokens.bgSurface))
            // 45° stripes: 2pt of tertiary text tone every 6pt, mirroring the
            // web's repeating-linear-gradient. Stripe spacing is measured
            // perpendicular to the stripes; along x that is spacing × √2.
            let period: CGFloat = 6 * 2.0.squareRoot()
            var x = -size.height
            while x < size.width {
                var stripe = Path()
                stripe.move(to: CGPoint(x: x, y: size.height))
                stripe.addLine(to: CGPoint(x: x + size.height, y: 0))
                context.stroke(
                    stripe,
                    with: .color(DesignTokens.textTertiary),
                    lineWidth: 2
                )
                x += period
            }
        }
    }
}
