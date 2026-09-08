import SwiftUI

/// Native input adapter for one tab's Frame Duration Draft. Its identity must
/// follow the tab, so removal resolves the old draft before its state can be
/// reused for a different Document.
struct FrameDurationField: View {
    @State private var draft: FrameDurationDraft
    @FocusState private var isFocused: Bool

    private let fieldWidth: CGFloat = 64

    init(tab: TabState, onFocusChange: @escaping (UUID, Bool) -> Void) {
        // Each mounted input owns a separate claim: delayed teardown must not
        // release the focus of another tab or a reopened input on this tab.
        let focusOwnerId = UUID()
        _draft = State(initialValue: FrameDurationDraft(tab: tab, onFocusChange: {
            onFocusChange(focusOwnerId, $0)
        }))
    }

    var body: some View {
        @Bindable var draft = draft
        TextField("", text: $draft.text)
            .textFieldStyle(.plain)
            .multilineTextAlignment(.center)
            .font(.system(size: DesignTokens.fontSizeSm))
            .foregroundStyle(DesignTokens.textPrimary)
            .frame(width: fieldWidth)
            .frame(maxHeight: .infinity)
            .background(DesignTokens.bgSurface)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
            .overlay {
                RoundedRectangle(cornerRadius: DesignTokens.radiusSm)
                    .strokeBorder(isFocused ? DesignTokens.accent : DesignTokens.borderSubtle)
            }
            .focused($isFocused)
            #if os(iOS)
            .keyboardType(.numberPad)
            #endif
            .accessibilityLabel(Text("Frame duration in milliseconds"))
            .onSubmit { draft.confirm() }
            .onKeyPress(.escape) {
                draft.cancel()
                return .handled
            }
            .onChange(of: isFocused) { _, isFocused in
                draft.focusChanged(isFocused: isFocused)
            }
            .onChange(of: draft.isFocused) { _, isFocused in
                self.isFocused = isFocused
            }
            .onChange(of: draft.storedValue) { draft.synchronize() }
            .onDisappear { draft.finish() }
    }
}
