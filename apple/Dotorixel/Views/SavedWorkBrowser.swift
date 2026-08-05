import SwiftUI

/// Saved-work browser (web parity: `SavedWorkBrowser.svelte` +
/// `SavedWorkCardGrid.svelte`): saved documents as thumbnail cards — name,
/// dimensions, last-updated — each openable or deletable, with an empty
/// state when nothing is saved. Purely presentational; the `SaveFlow`
/// owner wires the callbacks and presents this in a sheet.
struct SavedWorkBrowser: View {
    let documents: [SavedDocumentSummary]
    let onSelect: (String) -> Void
    let onDelete: (String) -> Void
    let onClose: () -> Void

    /// The card whose delete is awaiting confirmation (web parity: the
    /// card grid's per-card confirm dialog, as a native alert).
    @State private var deleteTarget: SavedDocumentSummary?

    /// The meta line's relative time must follow the view's locale like
    /// every catalog string (web parity: `formatRelativeTime` resolves
    /// through `getLocale()`).
    @Environment(\.locale) private var locale

    /// Web `.browser-modal` / card sizes (raw CSS values, not tokens).
    private let browserWidth: CGFloat = 640
    private let browserHeight: CGFloat = 480
    private let cardMinWidth: CGFloat = 160
    private let thumbnailHeight: CGFloat = 120
    private let closeButtonSize: CGFloat = 28
    /// Web `.card-delete:hover` destructive tint.
    private let destructive = SwiftUI.Color(red: 0xC0 / 255.0, green: 0x39 / 255.0, blue: 0x2B / 255.0)

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            if documents.isEmpty {
                emptyState
            } else {
                cardGrid
            }
        }
        .padding(24)
        // Max, not fixed: a sheet narrower than the desktop size (iPad
        // split view) proposes less, and a fixed frame would overflow it.
        .frame(maxWidth: browserWidth, maxHeight: browserHeight, alignment: .top)
        .background(DesignTokens.bgElevated)
        .alert(
            Text("Delete \"\(deleteTarget?.name ?? "")\"?"),
            isPresented: isDeleteConfirmationPresented
        ) {
            Button("Delete", role: .destructive) {
                if let target = deleteTarget { onDelete(target.id) }
                deleteTarget = nil
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This action cannot be undone. The saved work will be permanently removed.")
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Text("My Works")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(DesignTokens.textPrimary)
            Spacer()
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 14))
                    .foregroundStyle(DesignTokens.textSecondary)
                    .frame(width: closeButtonSize, height: closeButtonSize)
                    // Outset to a 44pt touch target without moving layout.
                    .contentShape(Rectangle().inset(by: (closeButtonSize - 44) / 2))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: DesignTokens.space3) {
            Image(systemName: "photo")
                .font(.system(size: 40))
                .foregroundStyle(DesignTokens.textTertiary)
            Text("No saved works yet")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(DesignTokens.textPrimary)
            Text("Your work is saved automatically as you draw.")
                .font(.system(size: 12))
                .foregroundStyle(DesignTokens.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Card grid

    private var cardGrid: some View {
        ScrollView {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: cardMinWidth), spacing: DesignTokens.space4)],
                spacing: DesignTokens.space4
            ) {
                ForEach(documents, id: \.id) { document in
                    card(document)
                }
            }
        }
    }

    private func card(_ document: SavedDocumentSummary) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                onSelect(document.id)
            } label: {
                VStack(alignment: .leading, spacing: 0) {
                    thumbnail(document)
                    VStack(alignment: .leading, spacing: DesignTokens.space1) {
                        Text(verbatim: document.name)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(DesignTokens.textPrimary)
                            .lineLimit(1)
                        Text(verbatim: metaLine(document))
                            .font(.system(size: DesignTokens.fontSizeSm))
                            .foregroundStyle(DesignTokens.textTertiary)
                            .lineLimit(1)
                    }
                    .padding(.horizontal, 10)
                    .padding(.top, DesignTokens.space3)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(Text(verbatim: document.name))

            HStack {
                Spacer()
                Button {
                    deleteTarget = document
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 12))
                        .foregroundStyle(DesignTokens.textTertiary)
                        .frame(width: 24, height: 24)
                        // Outset to a 44pt touch target without moving layout.
                        .contentShape(Rectangle().inset(by: (24 - 44) / 2))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Delete \(document.name)")
            }
            .padding(.horizontal, 10)
            .padding(.bottom, DesignTokens.space3)
        }
        .background(DesignTokens.bgElevated)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(DesignTokens.borderSubtle)
        }
    }

    /// "16 × 16 · 3 minutes ago" — dimensions with the localized update
    /// time: relative within 30 days, an absolute month/day beyond (web
    /// parity: `formatRelativeTime`'s cutoff — "2 months ago" reads vaguer
    /// than a date).
    private func metaLine(_ document: SavedDocumentSummary) -> String {
        "\(document.width) × \(document.height) · \(updatedText(document.updatedAt))"
    }

    /// Web `formatRelativeTime`'s 30-day window.
    private static let relativeTimeWindow: TimeInterval = 30 * 24 * 60 * 60

    private func updatedText(_ updatedAt: Date) -> String {
        guard Date().timeIntervalSince(updatedAt) < Self.relativeTimeWindow else {
            return updatedAt.formatted(.dateTime.month(.abbreviated).day().locale(locale))
        }
        let formatter = RelativeDateTimeFormatter()
        formatter.locale = locale
        return formatter.localizedString(for: updatedAt, relativeTo: Date())
    }

    // MARK: - Thumbnail

    private func thumbnail(_ document: SavedDocumentSummary) -> some View {
        ZStack {
            DesignTokens.bgSurface
            if let image = Self.thumbnailImage(document) {
                Image(decorative: image, scale: 1)
                    .resizable()
                    .interpolation(.none)
                    .scaledToFit()
            }
        }
        .frame(height: thumbnailHeight)
        .frame(maxWidth: .infinity)
        .clipped()
    }

    /// The summary's RGBA composite as a `CGImage`, pre-upscaled with
    /// nearest-neighbor so cells stay crisp however SwiftUI scales it
    /// afterwards (web parity: `imageSmoothingEnabled = false`) —
    /// `Image.interpolation(.none)` alone does not survive every render
    /// path (offscreen snapshots interpolate regardless).
    private static func thumbnailImage(_ document: SavedDocumentSummary) -> CGImage? {
        let width = Int(document.width)
        let height = Int(document.height)
        guard width > 0, height > 0,
              document.pixels.count == width * height * 4,
              let provider = CGDataProvider(data: document.pixels as CFData),
              let base = CGImage(
                  width: width,
                  height: height,
                  bitsPerComponent: 8,
                  bitsPerPixel: 32,
                  bytesPerRow: width * 4,
                  space: CGColorSpaceCreateDeviceRGB(),
                  bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue),
                  provider: provider,
                  decode: nil,
                  shouldInterpolate: false,
                  intent: .defaultIntent
              ) else {
            return nil
        }
        // Enough resolution to cover the thumbnail area at @2x; canvases
        // already larger than the target draw 1:1.
        let scale = max(1, Int(thumbnailResolution) / max(width, height))
        guard scale > 1 else { return base }
        guard let context = CGContext(
            data: nil,
            width: width * scale,
            height: height * scale,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return base
        }
        context.interpolationQuality = .none
        context.draw(base, in: CGRect(
            x: 0, y: 0, width: width * scale, height: height * scale
        ))
        return context.makeImage()
    }

    /// Upscale target for `thumbnailImage` — the 120pt thumbnail height
    /// at @2x.
    private static let thumbnailResolution: CGFloat = 240

    // MARK: - Delete confirmation

    private var isDeleteConfirmationPresented: Binding<Bool> {
        Binding(
            get: { deleteTarget != nil },
            set: { if !$0 { deleteTarget = nil } }
        )
    }
}
