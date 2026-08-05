import Foundation
import Testing
import SwiftUI
import SnapshotTesting
@testable import Dotorixel

/// Rendered-layout snapshots for the issue-266 save surfaces — the close-tab
/// save dialog and the saved-work browser — in the docked-region suite's
/// technique and on its pinned host (see `apple/DotorixelTests/README.md`).
/// The views are purely presentational, so each renders directly with
/// fixture data; ko variants pin the String Catalog resolution path.
@Suite("Save surfaces — rendered layout snapshots (issue 266)")
@MainActor
struct SaveSurfacesSnapshotTests {

    /// A deterministic saved-document summary: a 4×4 checker of opaque
    /// accent-ish pixels over transparency, updated a fixed hour ago so the
    /// relative time renders stably within a test run.
    private func summary(id: String, name: String) -> SavedDocumentSummary {
        var pixels = Data(count: 4 * 4 * 4)
        for y in 0..<4 {
            for x in 0..<4 where (x + y) % 2 == 0 {
                let base = (y * 4 + x) * 4
                pixels[base] = 0xB0; pixels[base + 1] = 0x7A
                pixels[base + 2] = 0x30; pixels[base + 3] = 0xFF
            }
        }
        return SavedDocumentSummary(
            id: id, name: name, width: 4, height: 4,
            pixels: pixels, updatedAt: Date(timeIntervalSinceNow: -3600)
        )
    }

    // MARK: - SaveDialog

    @Test("SaveDialog renders the prefilled name field and the three-way actions")
    func saveDialog() {
        assertSnapshot(
            of: SaveDialog(
                documentName: "Untitled 1", onSave: { _ in }, onDelete: {}, onCancel: {}
            ),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("SaveDialog renders Korean chrome")
    func saveDialogKoreanLocale() {
        assertSnapshot(
            of: SaveDialog(
                documentName: "Untitled 1", onSave: { _ in }, onDelete: {}, onCancel: {}
            )
            .environment(\.locale, Locale(identifier: "ko")),
            as: .image(layout: .sizeThatFits)
        )
    }

    // MARK: - SavedWorkBrowser

    @Test("SavedWorkBrowser renders saved-document cards: thumbnail, name, dimensions, updated time")
    func savedWorkBrowserPopulated() {
        assertSnapshot(
            of: SavedWorkBrowser(
                documents: [summary(id: "a", name: "Hero Sprite"), summary(id: "b", name: "Tile Set")],
                onSelect: { _ in }, onDelete: { _ in }, onClose: {}
            )
            .frame(width: 640, height: 480),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("SavedWorkBrowser renders the empty state when nothing is saved")
    func savedWorkBrowserEmpty() {
        assertSnapshot(
            of: SavedWorkBrowser(
                documents: [], onSelect: { _ in }, onDelete: { _ in }, onClose: {}
            )
            .frame(width: 640, height: 480),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("SavedWorkBrowser renders Korean chrome")
    func savedWorkBrowserKoreanLocale() {
        assertSnapshot(
            of: SavedWorkBrowser(
                documents: [summary(id: "a", name: "Hero Sprite")],
                onSelect: { _ in }, onDelete: { _ in }, onClose: {}
            )
            .frame(width: 640, height: 480)
            .environment(\.locale, Locale(identifier: "ko")),
            as: .image(layout: .sizeThatFits)
        )
    }
}
