import SwiftUI

/// Close-tab save dialog (web parity: `SaveDialog.svelte`) — the three-way
/// keep/discard choice for an unsaved document: save under a name, delete,
/// or cancel. Purely presentational; the `SaveFlow` owner wires the
/// callbacks and presents this in a sheet.
struct SaveDialog: View {
    let documentName: String
    let onSave: (String) -> Void
    let onDelete: () -> Void
    let onCancel: () -> Void

    @State private var name: String
    @FocusState private var isNameFocused: Bool

    /// Web `.save-dialog` sizes (raw CSS values, not tokens).
    private let dialogWidth: CGFloat = 360
    private let fieldHeight: CGFloat = 36
    private let buttonHeight: CGFloat = 36
    /// Web `.btn-delete` destructive tint.
    private let destructive = SwiftUI.Color(red: 0xC0 / 255.0, green: 0x39 / 255.0, blue: 0x2B / 255.0)

    init(
        documentName: String,
        onSave: @escaping (String) -> Void,
        onDelete: @escaping () -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.documentName = documentName
        self.onSave = onSave
        self.onDelete = onDelete
        self.onCancel = onCancel
        // One-time copy for user editing (web parity: the dialog owns the
        // name field's draft; the tab keeps its own name until save).
        _name = State(initialValue: documentName)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Save your work?")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(DesignTokens.textPrimary)

            VStack(alignment: .leading, spacing: 6) {
                Text("Name")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(DesignTokens.textSecondary)
                TextField("", text: $name)
                    .textFieldStyle(.plain)
                    .font(.system(size: 14))
                    .foregroundStyle(DesignTokens.textPrimary)
                    .padding(.horizontal, DesignTokens.space4)
                    .frame(height: fieldHeight)
                    .background(DesignTokens.bgSurface)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
                    .overlay {
                        RoundedRectangle(cornerRadius: DesignTokens.radiusSm)
                            .strokeBorder(
                                isNameFocused ? DesignTokens.accent : DesignTokens.border
                            )
                    }
                    .focused($isNameFocused)
                    .onSubmit { onSave(name) }
            }

            HStack(spacing: DesignTokens.space3) {
                Spacer()
                actionButton("Cancel", foreground: DesignTokens.textSecondary, action: onCancel)
                actionButton("Delete", foreground: destructive, action: onDelete)
                Button {
                    onSave(name)
                } label: {
                    Text("Save")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, DesignTokens.space5)
                        .frame(height: buttonHeight)
                        .background(DesignTokens.accent)
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
                }
                .buttonStyle(.plain)
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(24)
        .frame(width: dialogWidth)
        .background(DesignTokens.bgElevated)
        .onAppear { isNameFocused = true }
    }

    /// A borderless text button (web `.btn-cancel` / `.btn-delete` shape).
    private func actionButton(
        _ title: LocalizedStringKey,
        foreground: SwiftUI.Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(foreground)
                .padding(.horizontal, DesignTokens.space5)
                .frame(height: buttonHeight)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
