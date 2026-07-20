import Foundation
import Testing
@testable import Dotorixel

/// Localization contract for the Apple shell (issue 242).
///
/// The shell localizes the same three locales as the web (Paraglide): en, ko, ja.
/// These tests pin the build-level wiring — the String Catalog must compile into
/// the app bundle so every user-facing lookup can resolve per locale.
@Suite("Localization — supported locales")
struct LocalizationTests {

    @Test("App bundle declares en, ko, and ja localizations")
    func bundleDeclaresSupportedLocalizations() {
        let localizations = Set(Bundle.main.localizations)
        #expect(localizations.isSuperset(of: ["en", "ko", "ja"]))
    }
}

/// Regression gate for translation coverage: adding a user-facing string
/// without ko/ja translations fails here, not at runtime in a shipped locale.
///
/// Reads the String Catalog source (JSON) from the repo checkout — the
/// compiled bundle no longer carries per-entry translation state.
@Suite("Localization — catalog completeness")
struct StringCatalogCompletenessTests {

    private struct Catalog: Decodable {
        let sourceLanguage: String
        let strings: [String: Entry]
    }
    private struct Entry: Decodable {
        let localizations: [String: Localization]?
        let shouldTranslate: Bool?
    }
    private struct Localization: Decodable {
        let stringUnit: StringUnit?
    }
    private struct StringUnit: Decodable {
        let state: String
        let value: String
    }

    private func loadCatalog() throws -> Catalog {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()    // DotorixelTests/
            .deletingLastPathComponent()    // apple/
            .appendingPathComponent("Dotorixel/Localizable.xcstrings")
        return try JSONDecoder().decode(Catalog.self, from: Data(contentsOf: url))
    }

    @Test("Catalog source language is en")
    func sourceLanguageIsEnglish() throws {
        #expect(try loadCatalog().sourceLanguage == "en")
    }

    @Test("Every translatable entry has translated ko and ja values")
    func everyEntryIsTranslated() throws {
        let catalog = try loadCatalog()
        for (key, entry) in catalog.strings where entry.shouldTranslate != false {
            for locale in ["ko", "ja"] {
                let unit = entry.localizations?[locale]?.stringUnit
                #expect(
                    unit?.state == "translated" && unit?.value.isEmpty == false,
                    "\"\(key)\" is missing a translated \(locale) value"
                )
            }
        }
    }
}

/// The interpolated accessibility strings ("\(h) degrees", …) are inline
/// literals at their call sites, so they hit the LocalizedStringKey overload
/// and generate format keys ("%lld degrees"). These pin that the catalog
/// entries match the call-site-generated keys — a mismatch falls back to
/// English silently, with no compile- or test-time signal otherwise.
@Suite("Localization — interpolated format entries")
struct FormatEntryLocalizationTests {

    // Interpolated resources, shaped exactly like the view call sites.
    // NOTE: String(localized:locale:) can't be used here — its locale
    // parameter only formats interpolated arguments; localization lookup is
    // switched via LocalizedStringResource.locale (see resolve(_:in:)).
    @Test("Format entries resolve in ko via call-site-shaped keys")
    func formatEntriesResolveInKorean() {
        #expect(resolve("\(30) degrees", in: "ko") == "30도")
        // Split SV elements' percent values are symbol-only and stay untranslated.
        #expect(resolve("\(50)%", in: "ko") == "50%")
        #expect(resolve("Recent color \("#FF0000")", in: "ko") == "최근 색상 #FF0000")
        #expect(resolve("Palette color \("#FF0000")", in: "ko") == "팔레트 색상 #FF0000")
        #expect(resolve("\(16) by \(16)", in: "ko") == "16 × 16")
    }
}

/// Resolves a localized resource in an explicit locale, independent of the
/// test host's system language.
func resolve(_ resource: LocalizedStringResource, in localeIdentifier: String) -> String {
    var resource = resource
    resource.locale = Locale(identifier: localeIdentifier)
    return String(localized: resource)
}

/// Cross-shell terminology: tool names must match the web's message catalogs
/// (`messages/ko.json`, `messages/ja.json`) wherever the same concept appears.
@Suite("Localization — tool display names (web terminology parity)")
struct ToolDisplayNameLocalizationTests {

    static let expectations: [(tool: EditorTool, en: String, ko: String, ja: String)] = [
        (.pencil, "Pencil", "연필", "鉛筆"),
        (.eraser, "Eraser", "지우개", "消しゴム"),
        (.line, "Line", "직선", "直線"),
        (.rectangle, "Rectangle", "사각형", "四角形"),
        (.ellipse, "Ellipse", "타원", "楕円"),
        (.floodFill, "Flood Fill", "채우기", "塗りつぶし"),
        (.eyedropper, "Eyedropper", "스포이트", "スポイト"),
        (.move, "Move", "이동", "移動"),
    ]

    @Test("Every tool has a display-name expectation")
    func expectationsCoverAllTools() {
        #expect(Self.expectations.map(\.tool) == EditorTool.allCases)
    }

    @Test("Tool display names resolve per locale", arguments: expectations)
    func displayNameResolvesPerLocale(_ expected: (tool: EditorTool, en: String, ko: String, ja: String)) {
        #expect(resolve(expected.tool.displayName, in: "en") == expected.en)
        #expect(resolve(expected.tool.displayName, in: "ko") == expected.ko)
        #expect(resolve(expected.tool.displayName, in: "ja") == expected.ja)
    }
}
