import Foundation
import Testing
@testable import Dotorixel

/// Resolution guard for the Timeline frame labels (issues 284, 285).
///
/// `StringCatalogCompletenessTests` proves every catalog entry carries ko and
/// ja values; it cannot prove the code asks for the key those values are filed
/// under. An entry whose format specifiers differ from the ones Swift generates
/// for its interpolation — positional `%1$@` where the compiler emits `%@` — is
/// a complete, fully translated entry that no lookup ever reaches, so it falls
/// back to English in every locale. Silent, and invisible to a JSON check.
///
/// Lookups go through the `ko.lproj` bundle explicitly: `String(localized:)`
/// picks its table from the process's preferred localizations, and its `locale`
/// argument only drives number and date formatting.
@Suite("Localization — Timeline frame labels resolve per locale")
struct TimelineLabelLocalizationTests {

    private let locale = Locale(identifier: "ko")

    private func koreanBundle() throws -> Bundle {
        let path = try #require(
            Bundle.main.path(forResource: "ko", ofType: "lproj"),
            "The app bundle must carry a compiled ko table"
        )
        return try #require(Bundle(path: path))
    }

    @Test("the frame ruler header label resolves its Korean translation")
    func rulerHeaderLabelResolves() throws {
        let ko = try koreanBundle()
        #expect(String(localized: "Select frame \(1)", bundle: ko, locale: locale) == "1번 프레임 선택")
    }

    @Test("the cel indicator label resolves its Korean translation")
    func celLabelResolves() throws {
        let ko = try koreanBundle()
        #expect(
            String(localized: "\("Layer 1"), frame \(2)", bundle: ko, locale: locale)
                == "Layer 1, 2번 프레임"
        )
    }

    @Test("the cel occupancy values and the Reference band caption resolve their Korean translations")
    func celValuesAndCaptionResolve() throws {
        let ko = try koreanBundle()
        #expect(String(localized: "Has content", bundle: ko, locale: locale) == "내용 있음")
        #expect(String(localized: "Empty", bundle: ko, locale: locale) == "비어 있음")
        #expect(
            String(localized: "underlay — same under every frame", bundle: ko, locale: locale)
                == "언더레이 — 모든 프레임에서 동일"
        )
    }

    @Test("the duration editor's field label resolves its Korean translation")
    func durationEditorLabelResolves() throws {
        let ko = try koreanBundle()
        #expect(
            String(localized: "Frame duration in milliseconds", bundle: ko, locale: locale)
                == "프레임 지속 시간 (밀리초)"
        )
    }

    @Test("the frame action group's labels resolve their Korean translations")
    func frameActionLabelsResolve() throws {
        let ko = try koreanBundle()
        #expect(String(localized: "Frames", bundle: ko, locale: locale) == "프레임")
        #expect(String(localized: "Add frame", bundle: ko, locale: locale) == "프레임 추가")
        #expect(String(localized: "Duplicate frame", bundle: ko, locale: locale) == "프레임 복제")
        #expect(String(localized: "Delete frame", bundle: ko, locale: locale) == "프레임 삭제")
    }
}
