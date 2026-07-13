import Testing
import SwiftUI
@testable import Dotorixel

@Suite("LayoutTier — width / size-class → tier mapping (mirrors web layout-mode)")
struct LayoutTierTests {

    @Test("Compact horizontal size class yields .compact regardless of width")
    func compactSizeClassAlwaysCompact() {
        #expect(LayoutTier.resolve(availableWidth: 320, horizontalSizeClass: .compact) == .compact)
        #expect(LayoutTier.resolve(availableWidth: 2000, horizontalSizeClass: .compact) == .compact)
    }

    @Test("Regular size class below 1440pt is .wide (web 'wide')")
    func wideBelowBoundary() {
        #expect(LayoutTier.resolve(availableWidth: 1024, horizontalSizeClass: .regular) == .wide)
        #expect(LayoutTier.resolve(availableWidth: 1439, horizontalSizeClass: .regular) == .wide)
    }

    @Test("Width at or above 1440pt is .xWide (web 'x-wide')")
    func xWideAtBoundary() {
        #expect(LayoutTier.resolve(availableWidth: 1440, horizontalSizeClass: .regular) == .xWide)
        #expect(LayoutTier.resolve(availableWidth: 1920, horizontalSizeClass: .regular) == .xWide)
    }

    @Test("Unspecified size class (macOS) falls back to width-based tiers")
    func nilSizeClassIsWidthBased() {
        #expect(LayoutTier.resolve(availableWidth: 1200, horizontalSizeClass: nil) == .wide)
        #expect(LayoutTier.resolve(availableWidth: 1440, horizontalSizeClass: nil) == .xWide)
    }

    @Test("docked() selects the x-wide value only for .xWide; .compact reuses the wide value")
    func dockedVariantSelection() {
        #expect(LayoutTier.wide.docked(wide: 10, xWide: 20) == 10)
        #expect(LayoutTier.compact.docked(wide: 10, xWide: 20) == 10)
        #expect(LayoutTier.xWide.docked(wide: 10, xWide: 20) == 20)
    }
}
