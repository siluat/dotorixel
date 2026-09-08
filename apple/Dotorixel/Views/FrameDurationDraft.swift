import Foundation
import Observation

/// A Frame Duration Draft belongs to one tab for its entire input lifetime.
/// Owns confirmation targeting and stored-value reconciliation; the existing
/// Edit module owns mutation admission and History. Native input forwards
/// events through this interface and calls `finish` when its surface leaves.
@Observable
final class FrameDurationDraft {
    private let tab: TabState
    private let onFocusChange: (Bool) -> Void
    private var synchronizedValue: StoredValue
    private var hasFinished = false
    /// Raw input only; writing it never opens an Edit or changes a Document.
    var text: String
    private(set) var isFocused = false

    /// Observed as one value so Frame switching and same-Frame retiming do
    /// not depend on the order of separate native observation callbacks.
    struct StoredValue: Equatable {
        let frameId: String
        let durationMs: UInt32
    }

    /// The active Frame's live stored value, used by the native observation
    /// adapter. The Document guarantees that its Active Frame is present.
    var storedValue: StoredValue {
        let frame = tab.frameColumns.first(where: { $0.id == tab.activeFrameId })!
        return StoredValue(frameId: frame.id, durationMs: frame.durationMs)
    }

    /// Starts from the tab's Active Frame. The focus callback publishes this
    /// input's own shortcut claim; it must not replace other inputs' claims.
    init(tab: TabState, onFocusChange: @escaping (Bool) -> Void = { _ in }) {
        self.tab = tab
        self.onFocusChange = onFocusChange
        let frame = tab.frameColumns.first(where: { $0.id == tab.activeFrameId })!
        self.synchronizedValue = StoredValue(frameId: frame.id, durationMs: frame.durationMs)
        self.text = String(frame.durationMs)
    }

    /// Receives native focus changes; losing focus confirms the current
    /// draft. Events arriving after `finish` are ignored.
    func focusChanged(isFocused: Bool) {
        guard !hasFinished else { return }
        self.isFocused = isFocused
        if !isFocused { confirm() }
        onFocusChange(isFocused)
    }

    /// Reconciles a stored-value notification. A Frame switch confirms the
    /// focused draft against its old target; a same-Frame retime replaces it.
    /// An echo of an already reconciled confirmation leaves new input alone.
    func synchronize() {
        guard !hasFinished, storedValue != synchronizedValue else { return }
        if synchronizedValue.frameId != tab.activeFrameId && isFocused {
            confirm()
        } else {
            restoreStoredValue()
        }
    }

    /// Requests one retime against the originating Frame and reads back the
    /// stored result, including rejection or clamping. Does not request blur.
    func confirm() {
        guard !hasFinished else { return }
        // Undo/Redo can precede focus loss while SwiftUI's observation is
        // still queued. A stored change wins over stale text on that Frame.
        if storedValue.frameId == synchronizedValue.frameId && storedValue != synchronizedValue {
            restoreStoredValue()
            return
        }
        let frameId = synchronizedValue.frameId
        if let stored = tab.frameColumns.first(where: { $0.id == frameId })?.durationMs,
           let value = Self.resolveCommit(draft: text, current: stored) {
            tab.setFrameDuration(id: frameId, durationMs: value)
        }
        restoreStoredValue()
    }

    /// Discards raw input and releases focus before a following blur can
    /// confirm it. The input remains available for a later editing session.
    func cancel() {
        guard !hasFinished else { return }
        restoreStoredValue()
        isFocused = false
        onFocusChange(false)
    }

    /// Confirms and permanently closes this mounted input, releasing its
    /// focus claim once. Reopening requires a new draft from stored state.
    func finish() {
        guard !hasFinished else { return }
        confirm()
        isFocused = false
        hasFinished = true
        onFocusChange(false)
    }

    private func restoreStoredValue() {
        synchronizedValue = storedValue
        text = String(synchronizedValue.durationMs)
    }

    /// The value a committed draft dispatches, or `nil` when the field should
    /// revert to the stored duration instead. Empty, non-numeric, and
    /// fractional entries never dispatch (duration is integer ms); an
    /// out-of-range integer dispatches the bound it clamps to; and an
    /// unchanged value — typed or reached by the clamp — never dispatches, so
    /// an unchanged commit records no history entry.
    private static func resolveCommit(draft: String, current: UInt32) -> UInt32? {
        // `.whitespacesAndNewlines` mirrors the web's `trim()`: a pasted
        // value can carry a line break, which must not invalidate the entry.
        let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
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
