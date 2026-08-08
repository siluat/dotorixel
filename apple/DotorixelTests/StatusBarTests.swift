import Foundation
import Testing
@testable import Dotorixel

/// The StatusBar's Marquee readout projection (issue 270, web parity:
/// `status_marquee` in `StatusBar.svelte`): dimensions + origin when a
/// Marquee exists, nothing when none does, localized via the String Catalog
/// with the web's message-key vocabulary.
@Suite("StatusBar — Marquee readout")
struct StatusBarMarqueeReadoutTests {

    /// Resolves the readout resource under a fixed locale, so assertions
    /// don't depend on the test host's language.
    private func resolved(_ region: AppleMarqueeRegion?, locale: String) -> String? {
        guard var resource = marqueeStatusText(region: region) else { return nil }
        resource.locale = Locale(identifier: locale)
        return String(localized: resource)
    }

    @Test("no Marquee hides the readout")
    func noMarqueeHidesReadout() {
        #expect(marqueeStatusText(region: nil) == nil)
    }

    @Test("an active Marquee reads out dimensions and origin")
    func readsOutDimensionsAndOrigin() {
        let region = AppleMarqueeRegion(x: 3, y: 5, width: 12, height: 8)
        #expect(resolved(region, locale: "en") == "Marquee: 12×8 at (3, 5)")
    }

    @Test("the readout resolves the Korean catalog entry (web message vocabulary)")
    func resolvesKoreanEntry() {
        let region = AppleMarqueeRegion(x: 3, y: 5, width: 12, height: 8)
        #expect(resolved(region, locale: "ko") == "선택 영역: 12×8 (3, 5)")
    }
}
