import Foundation

/// Resolves the duration editor's draft-commit step (issue 287): the field
/// holds raw in-progress text while editing, and this decides what a commit
/// does with it. Web parity: `commitFrameDuration` in `TimelinePanel.svelte` —
/// except that the web forwards out-of-range integers for the WASM boundary to
/// clamp, while this resolves them here because a `UInt32` dispatch cannot
/// carry them. The range stays binding-owned either way: the bounds are read
/// from the 283 binding's exported constants, never restated in the shell.
enum FrameDurationDraft {
    /// The value a committed draft dispatches, or `nil` when the field should
    /// revert to the stored duration instead. Empty, non-numeric, and
    /// fractional entries never dispatch (duration is integer ms); an
    /// out-of-range integer dispatches the bound it clamps to; and an
    /// unchanged value — typed or reached by the clamp — never dispatches, so
    /// an unchanged commit records no history entry.
    static func resolveCommit(draft: String, current: UInt32) -> UInt32? {
        let trimmed = draft.trimmingCharacters(in: .whitespaces)
        guard isIntegerLiteral(trimmed) else { return nil }
        let clamped = clampToBindingRange(trimmed)
        return clamped == current ? nil : clamped
    }

    /// An optional minus sign followed by ASCII digits — the integer forms the
    /// web's `Number.isInteger` gate admits, minus the exponent/fraction forms
    /// it rejects. ASCII-only on purpose: it is exactly what `UInt32.init` can
    /// parse below.
    private static func isIntegerLiteral(_ text: String) -> Bool {
        let digits = text.hasPrefix("-") ? text.dropFirst() : Substring(text)
        return !digits.isEmpty && digits.allSatisfy { $0.isASCII && $0.isNumber }
    }

    /// Where an integer entry lands in the binding-owned range: negatives sit
    /// below it, and a digit run too long for `UInt32` itself is still just
    /// "above the range".
    private static func clampToBindingRange(_ literal: String) -> UInt32 {
        if literal.hasPrefix("-") { return frameMinDurationMs() }
        guard let value = UInt32(literal) else { return frameMaxDurationMs() }
        return min(max(value, frameMinDurationMs()), frameMaxDurationMs())
    }
}
