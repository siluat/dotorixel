import CoreGraphics

/// Loupe geometry — the single source of truth shared by the position math
/// (`computeLoupePosition` inputs), the grid extraction (`sampleGrid`), and
/// the visual component (`LoupeView`). Mirrors the web's `loupe-config.ts`;
/// change a value there and here together so the shells stay in parity.
enum LoupeGeometry {
    /// Cells per side in the sampled grid (also passed to `sampleGrid`).
    static let gridSize = 9

    /// Index of the center cell in the sampled grid — the color a release commits.
    static let centerIndex = (gridSize * gridSize - 1) / 2

    /// Side length of each grid cell in points.
    static let cellSize: CGFloat = 24

    /// Gap between adjacent grid cells — the rendered gridlines.
    static let cellGap: CGFloat = 1

    /// Outer border width on the loupe.
    static let borderWidth: CGFloat = 1

    /// Inner padding around grid + chip.
    static let padding: CGFloat = 8

    /// Gap between the grid and the hex chip below it.
    static let gridChipGap: CGFloat = 8

    /// Side length of the chip's color swatch.
    static let swatchSize: CGFloat = 16

    /// Vertical padding above and below the chip's swatch/text row.
    static let chipPaddingY: CGFloat = 4

    /// Chip row total height (swatch + vertical padding), folded into `height`.
    static let chipHeight: CGFloat = swatchSize + chipPaddingY * 2

    private static let gridPixels: CGFloat =
        cellSize * CGFloat(gridSize) + cellGap * CGFloat(gridSize - 1)

    /// Outer (border-box) loupe width in points.
    static let width: CGFloat = gridPixels + padding * 2 + borderWidth * 2

    /// Outer (border-box) loupe height in points.
    static let height: CGFloat =
        gridPixels + gridChipGap + chipHeight + padding * 2 + borderWidth * 2

    /// Pointer-to-loupe gap for mouse/pencil input (applied symmetrically on x and y).
    static let mouseOffset: CGFloat = 20

    /// Pointer-to-loupe vertical gap for touch input.
    static let touchOffset: CGFloat = 80
}
