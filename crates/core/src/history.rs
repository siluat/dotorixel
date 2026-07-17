use std::collections::VecDeque;

use crate::document::Document;

/// Asserts a pixel buffer's length matches `width * height * 4` (RGBA).
fn debug_assert_rgba_len(width: u32, height: u32, pixels: &[u8]) {
    debug_assert_eq!(
        pixels.len(),
        (width as usize) * (height as usize) * 4,
        "snapshot pixel buffer length must match width * height * 4"
    );
}

/// A canvas snapshot that captures both pixel data and dimensions.
///
/// Pairing dimensions with the pixel buffer allows the history system
/// to restore canvas state across resize operations, not just pixel edits.
#[derive(Debug, Clone)]
#[cfg_attr(feature = "uniffi", derive(uniffi::Record))]
pub struct Snapshot {
    pub width: u32,
    pub height: u32,
    pub pixels: Vec<u8>,
}

/// A bounded, branch-discarding LIFO ring that owns the undo/redo invariant
/// for a single value type.
///
/// `push` clears the redo future and evicts the oldest past entry once `max`
/// is exceeded; `undo`/`redo` swap the caller's current value across the two
/// stacks. Holding the invariant in one generic place lets each history
/// species (Document, PixelCanvas) reuse it without re-deriving the rules or
/// risking divergence between them.
#[derive(Debug, Clone)]
struct History<T> {
    undo: VecDeque<T>,
    redo: VecDeque<T>,
    max: usize,
    /// The pending Edit Baseline — the pre-edit value held between
    /// `begin_edit` and `end_edit`, absent outside an edit.
    pending: Option<T>,
}

impl<T> History<T> {
    fn new(max: usize) -> Self {
        assert!(max > 0, "History max must be > 0");
        Self {
            undo: VecDeque::new(),
            redo: VecDeque::new(),
            max,
            pending: None,
        }
    }

    fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }

    fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }

    /// Pushes `value` as the new top of the undo stack, evicting the oldest
    /// entry once `max` is exceeded and discarding the redo future.
    fn push(&mut self, value: T) {
        self.undo.push_back(value);
        if self.undo.len() > self.max {
            self.undo.pop_front();
        }
        self.redo.clear();
    }

    /// Pops the most recent undo entry and pushes `current` onto the redo
    /// stack, returning the popped value (or `None` when nothing to undo).
    ///
    /// Calling while an Edit Baseline is pending is a caller error — shells
    /// seal undo behind their `isDrawing` guards. Debug-asserted.
    fn undo(&mut self, current: T) -> Option<T> {
        debug_assert!(
            self.pending.is_none(),
            "undo called while an Edit Baseline is pending — shells must seal undo while drawing"
        );
        let entry = self.undo.pop_back()?;
        self.redo.push_back(current);
        Some(entry)
    }

    /// Pops the most recent redo entry and pushes `current` onto the undo
    /// stack, returning the popped value (or `None` when nothing to redo).
    ///
    /// Calling while an Edit Baseline is pending is a caller error — shells
    /// seal redo behind their `isDrawing` guards. Debug-asserted.
    fn redo(&mut self, current: T) -> Option<T> {
        debug_assert!(
            self.pending.is_none(),
            "redo called while an Edit Baseline is pending — shells must seal redo while drawing"
        );
        let entry = self.redo.pop_back()?;
        self.undo.push_back(current);
        Some(entry)
    }

    /// Holds `baseline` as the pending Edit Baseline. Nothing is pushed and
    /// the redo future stays untouched until `end_edit` resolves it.
    ///
    /// Beginning an edit while another baseline is pending is a caller error
    /// (edits are driven one at a time) — debug-asserted.
    fn begin_edit(&mut self, baseline: T) {
        debug_assert!(
            self.pending.is_none(),
            "begin_edit called while an Edit Baseline is already pending"
        );
        self.pending = Some(baseline);
    }

    /// Resolves the pending Edit Baseline: pushes it as the new undo top
    /// unless `is_unchanged` reports the edit was a no-op — a no-op discards
    /// the baseline and leaves both stacks (including the redo future)
    /// untouched. No-op when no baseline is pending, so callers that never
    /// open a baseline need no end-side guard.
    fn end_edit(&mut self, is_unchanged: impl FnOnce(&T) -> bool) {
        let Some(baseline) = self.pending.take() else {
            return;
        };
        if !is_unchanged(&baseline) {
            self.push(baseline);
        }
    }

    fn clear(&mut self) {
        self.undo.clear();
        self.redo.clear();
        self.pending = None;
    }
}

/// The single-canvas undo/redo species — a LIFO of dimension-aware
/// [`Snapshot`]s (width, height, pixel buffer) so pixels restore across resize.
/// The Apple shell's history, wrapped by the UniFFI binding.
#[derive(Debug, Clone)]
pub struct PixelCanvasHistory {
    inner: History<Snapshot>,
}

impl PixelCanvasHistory {
    pub const DEFAULT_MAX_SNAPSHOTS: usize = 100;

    /// # Panics
    ///
    /// Panics if `max_snapshots` is 0 — a history that retains nothing is a
    /// caller error, not a runtime condition to handle.
    pub fn new(max_snapshots: usize) -> Self {
        Self {
            inner: History::new(max_snapshots),
        }
    }

    pub fn can_undo(&self) -> bool {
        self.inner.can_undo()
    }

    pub fn can_redo(&self) -> bool {
        self.inner.can_redo()
    }

    /// Captures pixel data as the new top of the undo stack, clearing the redo
    /// future and evicting the oldest snapshot once the cap is exceeded.
    pub fn push_snapshot(&mut self, width: u32, height: u32, pixels: &[u8]) {
        debug_assert_rgba_len(width, height, pixels);
        self.inner.push(Snapshot {
            width,
            height,
            pixels: pixels.to_vec(),
        });
    }

    /// Holds the current pixel state as the pending Edit Baseline — see
    /// [`PixelCanvasHistory::end_edit`] for how it resolves. Nothing is
    /// pushed and the redo future stays untouched until then.
    pub fn begin_edit(&mut self, width: u32, height: u32, pixels: &[u8]) {
        debug_assert_rgba_len(width, height, pixels);
        self.inner.begin_edit(Snapshot {
            width,
            height,
            pixels: pixels.to_vec(),
        });
    }

    /// Resolves the pending Edit Baseline against the caller's current pixel
    /// state: pushes it as the new undo top (clearing the redo future) only
    /// when the edit actually changed the canvas; a no-op edit discards the
    /// baseline and leaves both stacks untouched. No-op when no baseline is
    /// pending.
    pub fn end_edit(&mut self, current_width: u32, current_height: u32, current_pixels: &[u8]) {
        debug_assert_rgba_len(current_width, current_height, current_pixels);
        self.inner.end_edit(|baseline| {
            baseline.width == current_width
                && baseline.height == current_height
                && baseline.pixels == current_pixels
        });
    }

    /// Pops the most recent snapshot from the undo stack and pushes the
    /// caller's current pixel state onto the redo stack, or returns `None` when
    /// the undo stack is empty.
    pub fn undo(
        &mut self,
        current_width: u32,
        current_height: u32,
        current_pixels: &[u8],
    ) -> Option<Snapshot> {
        debug_assert_rgba_len(current_width, current_height, current_pixels);
        self.inner.undo(Snapshot {
            width: current_width,
            height: current_height,
            pixels: current_pixels.to_vec(),
        })
    }

    /// Pops the most recent snapshot from the redo stack and pushes the
    /// caller's current pixel state onto the undo stack, or returns `None` when
    /// the redo stack is empty.
    pub fn redo(
        &mut self,
        current_width: u32,
        current_height: u32,
        current_pixels: &[u8],
    ) -> Option<Snapshot> {
        debug_assert_rgba_len(current_width, current_height, current_pixels);
        self.inner.redo(Snapshot {
            width: current_width,
            height: current_height,
            pixels: current_pixels.to_vec(),
        })
    }

    pub fn clear(&mut self) {
        self.inner.clear();
    }
}

impl Default for PixelCanvasHistory {
    fn default() -> Self {
        Self::new(Self::DEFAULT_MAX_SNAPSHOTS)
    }
}

/// The layer-aware undo/redo species — a LIFO of whole-[`Document`] snapshots
/// (layer stack, active-layer pointer, Marquee, counters). The web shell's
/// history, wrapped by the WASM binding.
#[derive(Debug, Clone)]
pub struct DocumentHistory {
    inner: History<Document>,
}

impl DocumentHistory {
    pub const DEFAULT_MAX_SNAPSHOTS: usize = 100;

    /// # Panics
    ///
    /// Panics if `max_snapshots` is 0 — a history that retains nothing is a
    /// caller error, not a runtime condition to handle.
    pub fn new(max_snapshots: usize) -> Self {
        Self {
            inner: History::new(max_snapshots),
        }
    }

    pub fn can_undo(&self) -> bool {
        self.inner.can_undo()
    }

    pub fn can_redo(&self) -> bool {
        self.inner.can_redo()
    }

    /// Captures `document` as the new top of the undo stack, clearing the redo
    /// future and evicting the oldest snapshot once the cap is exceeded.
    pub fn push_document(&mut self, document: &Document) {
        self.inner.push(document.clone());
    }

    /// Holds `document` as the pending Edit Baseline — see
    /// [`DocumentHistory::end_edit`] for how it resolves. Nothing is pushed
    /// and the redo future stays untouched until then.
    pub fn begin_edit(&mut self, document: &Document) {
        self.inner.begin_edit(document.clone());
    }

    /// Resolves the pending Edit Baseline against `current`: pushes it as
    /// the new undo top (clearing the redo future) only when the edit
    /// actually changed the document; a no-op edit discards the baseline and
    /// leaves both stacks — including the redo future — untouched. No-op when
    /// no baseline is pending.
    pub fn end_edit(&mut self, current: &Document) {
        self.inner.end_edit(|baseline| baseline == current);
    }

    /// Pops the most recent snapshot from the undo stack and pushes `current`
    /// onto the redo stack, or returns `None` when the undo stack is empty.
    pub fn undo_document(&mut self, current: &Document) -> Option<Document> {
        self.inner.undo(current.clone())
    }

    /// Pops the most recent snapshot from the redo stack and pushes `current`
    /// onto the undo stack, or returns `None` when the redo stack is empty.
    pub fn redo_document(&mut self, current: &Document) -> Option<Document> {
        self.inner.redo(current.clone())
    }

    pub fn clear(&mut self) {
        self.inner.clear();
    }
}

impl Default for DocumentHistory {
    fn default() -> Self {
        Self::new(Self::DEFAULT_MAX_SNAPSHOTS)
    }
}

#[cfg(test)]
mod pixel_canvas_history_tests {
    use super::*;

    // -- initial state --

    #[test]
    fn initial_can_undo_is_false() {
        let history = PixelCanvasHistory::default();
        assert!(!history.can_undo());
    }

    #[test]
    fn initial_can_redo_is_false() {
        let history = PixelCanvasHistory::default();
        assert!(!history.can_redo());
    }

    // -- push_snapshot --

    #[test]
    fn push_enables_can_undo() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 2, 3, 4]);
        assert!(history.can_undo());
    }

    #[test]
    fn push_keeps_can_redo_false() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 2, 3, 4]);
        assert!(!history.can_redo());
    }

    #[test]
    fn push_clears_redo_stack() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.undo(1, 1, &[2, 0, 0, 0]);
        assert!(history.can_redo());

        history.push_snapshot(1, 1, &[3, 0, 0, 0]);
        assert!(!history.can_redo());
    }

    #[test]
    fn push_stores_independent_copy() {
        let mut history = PixelCanvasHistory::default();
        let mut pixels = vec![10, 20, 30, 40];
        history.push_snapshot(1, 1, &pixels);

        pixels[0] = 255;

        let restored = history.undo(1, 1, &[0, 0, 0, 0]).unwrap();
        assert_eq!(restored.pixels[0], 10);
    }

    // -- undo --

    #[test]
    fn undo_returns_most_recent_snapshot() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 2, 3, 4]);
        let result = history.undo(1, 1, &[5, 6, 7, 8]).unwrap();
        assert_eq!(result.pixels, vec![1, 2, 3, 4]);
    }

    #[test]
    fn undo_enables_can_redo() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 2, 3, 4]);
        history.undo(1, 1, &[5, 6, 7, 8]);
        assert!(history.can_redo());
    }

    #[test]
    fn undo_saves_current_to_redo_stack() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.undo(1, 1, &[2, 0, 0, 0]);
        let redone = history.redo(1, 1, &[99, 0, 0, 0]).unwrap();
        assert_eq!(redone.pixels, vec![2, 0, 0, 0]);
    }

    #[test]
    fn undo_returns_none_when_empty() {
        let mut history = PixelCanvasHistory::default();
        assert!(history.undo(1, 1, &[1, 2, 3, 4]).is_none());
    }

    #[test]
    fn undo_returns_snapshots_in_lifo_order() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.push_snapshot(1, 1, &[2, 0, 0, 0]);
        history.push_snapshot(1, 1, &[3, 0, 0, 0]);

        assert_eq!(history.undo(1, 1, &[4, 0, 0, 0]).unwrap().pixels[0], 3);
        assert_eq!(history.undo(1, 1, &[3, 0, 0, 0]).unwrap().pixels[0], 2);
        assert_eq!(history.undo(1, 1, &[2, 0, 0, 0]).unwrap().pixels[0], 1);
        assert!(history.undo(1, 1, &[1, 0, 0, 0]).is_none());
    }

    #[test]
    fn undo_stores_independent_copy_in_redo_stack() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);

        let mut current = vec![2, 0, 0, 0];
        history.undo(1, 1, &current);

        current[0] = 255;

        let redone = history.redo(1, 1, &[99, 0, 0, 0]).unwrap();
        assert_eq!(redone.pixels[0], 2);
    }

    // -- redo --

    #[test]
    fn redo_returns_most_recently_undone_snapshot() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.undo(1, 1, &[2, 0, 0, 0]);
        let result = history.redo(1, 1, &[1, 0, 0, 0]).unwrap();
        assert_eq!(result.pixels, vec![2, 0, 0, 0]);
    }

    #[test]
    fn redo_enables_can_undo() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.undo(1, 1, &[2, 0, 0, 0]);
        assert!(!history.can_undo());

        history.redo(1, 1, &[1, 0, 0, 0]);
        assert!(history.can_undo());
    }

    #[test]
    fn redo_returns_none_when_empty() {
        let mut history = PixelCanvasHistory::default();
        assert!(history.redo(1, 1, &[1, 2, 3, 4]).is_none());
    }

    #[test]
    fn redo_saves_current_to_undo_stack() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.undo(1, 1, &[2, 0, 0, 0]);
        history.redo(1, 1, &[1, 0, 0, 0]);

        let undone = history.undo(1, 1, &[99, 0, 0, 0]).unwrap();
        assert_eq!(undone.pixels, vec![1, 0, 0, 0]);
    }

    #[test]
    fn redo_stores_independent_copy_in_undo_stack() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.undo(1, 1, &[2, 0, 0, 0]);

        let mut current = vec![1, 0, 0, 0];
        history.redo(1, 1, &current);

        current[0] = 255;

        let undone = history.undo(1, 1, &[99, 0, 0, 0]).unwrap();
        assert_eq!(undone.pixels[0], 1);
    }

    // -- max_snapshots --

    #[test]
    fn evicts_oldest_when_limit_exceeded() {
        let mut history = PixelCanvasHistory::new(3);
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.push_snapshot(1, 1, &[2, 0, 0, 0]);
        history.push_snapshot(1, 1, &[3, 0, 0, 0]);
        history.push_snapshot(1, 1, &[4, 0, 0, 0]);

        assert_eq!(history.undo(1, 1, &[5, 0, 0, 0]).unwrap().pixels[0], 4);
        assert_eq!(history.undo(1, 1, &[4, 0, 0, 0]).unwrap().pixels[0], 3);
        assert_eq!(history.undo(1, 1, &[3, 0, 0, 0]).unwrap().pixels[0], 2);
        assert!(history.undo(1, 1, &[2, 0, 0, 0]).is_none());
    }

    // -- clear --

    #[test]
    fn clear_resets_both_stacks() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.push_snapshot(1, 1, &[2, 0, 0, 0]);
        history.undo(1, 1, &[3, 0, 0, 0]);

        history.clear();

        assert!(!history.can_undo());
        assert!(!history.can_redo());
    }

    // -- constructor validation --

    #[test]
    #[should_panic(expected = "History max must be > 0")]
    fn new_rejects_zero_max_snapshots() {
        PixelCanvasHistory::new(0);
    }

    // -- Default trait --

    #[test]
    fn default_uses_default_max_snapshots() {
        let mut history = PixelCanvasHistory::default();
        for i in 0..=PixelCanvasHistory::DEFAULT_MAX_SNAPSHOTS as u8 {
            history.push_snapshot(1, 1, &[i, 0, 0, 0]);
        }
        let mut count = 0;
        while history.undo(1, 1, &[0, 0, 0, 0]).is_some() {
            count += 1;
        }
        assert_eq!(count, PixelCanvasHistory::DEFAULT_MAX_SNAPSHOTS);
    }

    // -- edit baseline --

    #[test]
    fn noop_stroke_leaves_history_untouched() {
        let mut history = PixelCanvasHistory::default();
        history.begin_edit(1, 1, &[1, 2, 3, 4]);
        history.end_edit(1, 1, &[1, 2, 3, 4]);
        assert!(!history.can_undo());
    }

    #[test]
    fn changed_stroke_commits_one_entry_restoring_the_baseline() {
        let mut history = PixelCanvasHistory::default();
        history.begin_edit(1, 1, &[1, 0, 0, 0]);
        history.end_edit(1, 1, &[2, 0, 0, 0]);

        assert!(history.can_undo());
        let restored = history.undo(1, 1, &[2, 0, 0, 0]).unwrap();
        assert_eq!(restored.pixels, vec![1, 0, 0, 0]);
        assert!(!history.can_undo());
    }

    #[test]
    fn noop_stroke_preserves_the_redo_future() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.undo(1, 1, &[2, 0, 0, 0]);
        assert!(history.can_redo());

        history.begin_edit(1, 1, &[1, 0, 0, 0]);
        history.end_edit(1, 1, &[1, 0, 0, 0]);

        assert!(history.can_redo());
    }

    #[test]
    fn changed_stroke_discards_the_redo_future() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.undo(1, 1, &[2, 0, 0, 0]);
        assert!(history.can_redo());

        history.begin_edit(1, 1, &[1, 0, 0, 0]);
        history.end_edit(1, 1, &[3, 0, 0, 0]);

        assert!(!history.can_redo());
    }

    #[test]
    fn stroke_only_commits_at_end_never_at_begin() {
        let mut history = PixelCanvasHistory::default();
        history.begin_edit(1, 1, &[1, 0, 0, 0]);
        assert!(!history.can_undo());
        history.end_edit(1, 1, &[2, 0, 0, 0]);
        assert!(history.can_undo());
    }

    #[test]
    fn dimension_change_during_stroke_is_a_real_change() {
        let mut history = PixelCanvasHistory::default();
        history.begin_edit(1, 1, &[1, 0, 0, 0]);
        history.end_edit(2, 1, &[1, 0, 0, 0, 1, 0, 0, 0]);
        assert!(history.can_undo());
    }

    #[test]
    fn command_push_is_independent_of_a_pending_stroke() {
        let mut history = PixelCanvasHistory::default();
        history.begin_edit(1, 1, &[1, 0, 0, 0]);
        history.push_snapshot(1, 1, &[9, 0, 0, 0]);
        history.end_edit(1, 1, &[2, 0, 0, 0]);

        // Both the command entry and the edit baseline are on the stack.
        assert_eq!(history.undo(1, 1, &[2, 0, 0, 0]).unwrap().pixels[0], 1);
        assert_eq!(history.undo(1, 1, &[1, 0, 0, 0]).unwrap().pixels[0], 9);
    }

    #[test]
    #[should_panic(expected = "Edit Baseline")]
    fn undo_during_a_pending_stroke_is_a_precondition_violation() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.begin_edit(1, 1, &[2, 0, 0, 0]);
        history.undo(1, 1, &[2, 0, 0, 0]);
    }

    #[test]
    #[should_panic(expected = "Edit Baseline")]
    fn redo_during_a_pending_stroke_is_a_precondition_violation() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.undo(1, 1, &[2, 0, 0, 0]);
        history.begin_edit(1, 1, &[1, 0, 0, 0]);
        history.redo(1, 1, &[1, 0, 0, 0]);
    }

    #[test]
    fn end_edit_without_begin_is_a_noop() {
        let mut history = PixelCanvasHistory::default();
        history.end_edit(1, 1, &[1, 2, 3, 4]);
        assert!(!history.can_undo());
    }

    #[test]
    fn clear_discards_a_pending_stroke_baseline() {
        let mut history = PixelCanvasHistory::default();
        history.begin_edit(1, 1, &[1, 0, 0, 0]);
        history.clear();
        history.end_edit(1, 1, &[2, 0, 0, 0]);
        assert!(!history.can_undo());
    }

    // -- dimension-aware snapshots --

    #[test]
    fn undo_preserves_snapshot_dimensions() {
        let mut history = PixelCanvasHistory::default();
        // 1×1 canvas (4 bytes)
        history.push_snapshot(1, 1, &[255, 0, 0, 255]);
        // Current state is now 2×2 (16 bytes) after a resize
        let snapshot = history.undo(2, 2, &[0u8; 16]).unwrap();
        assert_eq!(snapshot.width, 1);
        assert_eq!(snapshot.height, 1);
        assert_eq!(snapshot.pixels, vec![255, 0, 0, 255]);
    }

    #[test]
    fn redo_preserves_snapshot_dimensions() {
        let mut history = PixelCanvasHistory::default();
        history.push_snapshot(1, 1, &[255, 0, 0, 255]);
        // Undo from 2×2 state
        history.undo(2, 2, &[0u8; 16]);
        // Redo from restored 1×1 state
        let snapshot = history.redo(1, 1, &[255, 0, 0, 255]).unwrap();
        assert_eq!(snapshot.width, 2);
        assert_eq!(snapshot.height, 2);
        assert_eq!(snapshot.pixels.len(), 16);
    }

    #[test]
    fn mixed_dimension_undo_chain() {
        let mut history = PixelCanvasHistory::default();
        // Push 1×1, then "resize" to 2×1, then "resize" to 2×2
        history.push_snapshot(1, 1, &[1, 0, 0, 0]);
        history.push_snapshot(2, 1, &[1, 0, 0, 0, 2, 0, 0, 0]);
        // Current state is 2×2
        let current_2x2 = [0u8; 16];

        let snap = history.undo(2, 2, &current_2x2).unwrap();
        assert_eq!((snap.width, snap.height), (2, 1));

        let snap = history.undo(2, 1, &snap.pixels).unwrap();
        assert_eq!((snap.width, snap.height), (1, 1));
        assert_eq!(snap.pixels, vec![1, 0, 0, 0]);

        assert!(history.undo(1, 1, &snap.pixels).is_none());
    }
}

#[cfg(test)]
mod document_history_tests {
    use super::*;
    use crate::canvas::PixelCanvas;
    use crate::color::Color;
    use crate::document::Document;
    use crate::layer::{Layer, LayerKind};
    use uuid::Uuid;

    fn doc() -> Document {
        Document::new(2, 2, Uuid::new_v4(), "Layer 1".into()).unwrap()
    }

    /// A document carrying `layer_count` layers, so snapshots are
    /// distinguishable by `layers().len()` in ordering/eviction assertions.
    fn doc_with_layers(layer_count: usize) -> Document {
        let mut document = Document::new(2, 2, Uuid::new_v4(), "Layer 1".into()).unwrap();
        for n in 1..layer_count {
            document.add_layer(Uuid::new_v4(), format!("Layer {}", n + 1));
        }
        document
    }

    fn pixel_canvas(layer: &Layer) -> &PixelCanvas {
        let LayerKind::Pixel(cels) = &layer.kind else {
            panic!("layer is not Pixel-kind");
        };
        cels.sole_canvas()
    }

    #[test]
    fn initial_can_undo_is_false() {
        let history = DocumentHistory::default();
        assert!(!history.can_undo());
    }

    #[test]
    fn initial_can_redo_is_false() {
        let history = DocumentHistory::default();
        assert!(!history.can_redo());
    }

    #[test]
    fn push_enables_can_undo() {
        let mut history = DocumentHistory::default();
        history.push_document(&doc());
        assert!(history.can_undo());
    }

    #[test]
    fn push_keeps_can_redo_false() {
        let mut history = DocumentHistory::default();
        history.push_document(&doc());
        assert!(!history.can_redo());
    }

    #[test]
    fn undo_returns_none_when_empty() {
        let mut history = DocumentHistory::default();
        assert!(history.undo_document(&doc()).is_none());
    }

    #[test]
    fn undo_enables_can_redo() {
        let mut history = DocumentHistory::default();
        history.push_document(&doc());
        history.undo_document(&doc());
        assert!(history.can_redo());
    }

    #[test]
    fn undo_restores_next_layer_number() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(2, 2, a, "A".into()).unwrap();
        assert_eq!(doc.next_layer_number(), 2);

        let mut history = DocumentHistory::default();
        history.push_document(&doc);
        doc.add_layer(b, "B".into());
        assert_eq!(doc.next_layer_number(), 3);

        let restored = history.undo_document(&doc).unwrap();
        assert_eq!(restored.next_layer_number(), 2);
    }

    #[test]
    fn redo_returns_none_when_empty() {
        let mut history = DocumentHistory::default();
        assert!(history.redo_document(&doc()).is_none());
    }

    #[test]
    fn push_clears_redo_stack() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(2, 2, a, "A".into()).unwrap();
        let mut history = DocumentHistory::default();

        history.push_document(&doc);
        doc.add_layer(b, "B".into());
        history.undo_document(&doc);
        assert!(history.can_redo());

        // A new push from the (restored) past must discard the former future.
        history.push_document(&doc);
        assert!(!history.can_redo());
    }

    #[test]
    fn redo_reapplies_post_undo_state() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(2, 2, a, "A".into()).unwrap();
        let mut history = DocumentHistory::default();

        history.push_document(&doc);
        doc.add_layer(b, "B".into()); // mutated state has [A, B]
        let pre_undo = doc.clone();

        let restored = history.undo_document(&doc).unwrap();
        let redone = history.redo_document(&restored).unwrap();

        let ids: Vec<Uuid> = redone.layers().iter().map(|l| l.id).collect();
        let pre_ids: Vec<Uuid> = pre_undo.layers().iter().map(|l| l.id).collect();
        assert_eq!(ids, pre_ids);
        assert_eq!(redone.active_layer_id(), pre_undo.active_layer_id());
    }

    #[test]
    fn redo_enables_can_undo() {
        let mut history = DocumentHistory::default();
        history.push_document(&doc());
        let restored = history.undo_document(&doc()).unwrap();
        assert!(!history.can_undo());

        history.redo_document(&restored);
        assert!(history.can_undo());
    }

    #[test]
    fn clear_resets_both_stacks() {
        let mut history = DocumentHistory::default();
        history.push_document(&doc());
        history.push_document(&doc());
        history.undo_document(&doc());

        history.clear();

        assert!(!history.can_undo());
        assert!(!history.can_redo());
    }

    #[test]
    fn undo_returns_documents_in_lifo_order() {
        let mut history = DocumentHistory::default();
        history.push_document(&doc_with_layers(1));
        history.push_document(&doc_with_layers(2));
        history.push_document(&doc_with_layers(3));

        let current = doc_with_layers(9);
        assert_eq!(history.undo_document(&current).unwrap().layers().len(), 3);
        assert_eq!(history.undo_document(&current).unwrap().layers().len(), 2);
        assert_eq!(history.undo_document(&current).unwrap().layers().len(), 1);
        assert!(history.undo_document(&current).is_none());
    }

    #[test]
    fn evicts_oldest_when_limit_exceeded() {
        let mut history = DocumentHistory::new(3);
        // Push one more than the limit; the oldest (1-layer) snapshot must go.
        history.push_document(&doc_with_layers(1));
        history.push_document(&doc_with_layers(2));
        history.push_document(&doc_with_layers(3));
        history.push_document(&doc_with_layers(4));

        let current = doc_with_layers(9);
        assert_eq!(history.undo_document(&current).unwrap().layers().len(), 4);
        assert_eq!(history.undo_document(&current).unwrap().layers().len(), 3);
        assert_eq!(history.undo_document(&current).unwrap().layers().len(), 2);
        // The oldest 1-layer snapshot was evicted, not retained.
        assert!(history.undo_document(&current).is_none());
    }

    #[test]
    fn default_uses_default_max_snapshots() {
        let doc = doc();
        let mut history = DocumentHistory::default();
        for _ in 0..=DocumentHistory::DEFAULT_MAX_SNAPSHOTS {
            history.push_document(&doc);
        }
        let mut count = 0;
        while history.undo_document(&doc).is_some() {
            count += 1;
        }
        assert_eq!(count, DocumentHistory::DEFAULT_MAX_SNAPSHOTS);
    }

    #[test]
    #[should_panic(expected = "History max must be > 0")]
    fn new_rejects_zero_max_snapshots() {
        DocumentHistory::new(0);
    }

    // -- edit baseline --

    #[test]
    fn noop_stroke_leaves_document_history_untouched() {
        let mut history = DocumentHistory::default();
        let doc = doc();
        history.begin_edit(&doc);
        history.end_edit(&doc);
        assert!(!history.can_undo());
    }

    #[test]
    fn changed_stroke_commits_the_pre_stroke_document() {
        let mut doc = doc();
        let mut history = DocumentHistory::default();

        history.begin_edit(&doc);
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap();
        history.end_edit(&doc);

        assert!(history.can_undo());
        let restored = history.undo_document(&doc).unwrap();
        assert_eq!(
            pixel_canvas(&restored.layers()[0]).get_pixel(0, 0).unwrap(),
            Color::TRANSPARENT
        );
    }

    #[test]
    fn noop_stroke_preserves_the_document_redo_future() {
        let mut doc = doc();
        let mut history = DocumentHistory::default();
        history.push_document(&doc);
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap();
        doc = history.undo_document(&doc).unwrap();
        assert!(history.can_redo());

        history.begin_edit(&doc);
        history.end_edit(&doc);

        assert!(history.can_redo());
    }

    #[test]
    fn retimed_frame_is_a_real_document_change() {
        // Frame equality is identity-only (a retimed frame stays the same
        // frame in sets and maps), but Document value equality must still see
        // the retiming — otherwise a stroke resolving over a retimed document
        // would be misjudged a no-op.
        let mut doc = doc();
        let frame_id = doc.frames()[0].id;
        let mut history = DocumentHistory::default();

        history.begin_edit(&doc);
        doc.set_frame_duration(frame_id, 500).unwrap();
        history.end_edit(&doc);

        assert!(history.can_undo());
    }

    #[test]
    fn undo_after_add_layer_restores_prior_stack() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut doc = Document::new(2, 2, a, "A".into()).unwrap();
        let mut history = DocumentHistory::default();

        history.push_document(&doc);
        doc.add_layer(b, "B".into());

        let restored = history.undo_document(&doc).unwrap();

        let ids: Vec<Uuid> = restored.layers().iter().map(|l| l.id).collect();
        assert_eq!(ids, vec![a]);
        assert_eq!(restored.active_layer_id(), a);
    }

    #[test]
    fn undo_after_remove_layer_restores_removed_layer() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let red = Color::new(255, 0, 0, 255);
        let mut doc = Document::new(2, 2, a, "A".into()).unwrap();
        doc.add_layer(b, "B".into()); // active=B
        doc.set_pixel(0, 0, red).unwrap(); // stamp B for round-trip verification

        let mut history = DocumentHistory::default();
        history.push_document(&doc);
        doc.remove_layer(b).unwrap();

        let restored = history.undo_document(&doc).unwrap();

        let ids: Vec<Uuid> = restored.layers().iter().map(|l| l.id).collect();
        assert_eq!(ids, vec![a, b]);
        assert_eq!(restored.layers()[1].name, "B");
        assert_eq!(
            pixel_canvas(&restored.layers()[1]).get_pixel(0, 0).unwrap(),
            red
        );
    }

    #[test]
    fn undo_after_reorder_restores_original_order() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let c = Uuid::new_v4();
        let mut doc = Document::new(2, 2, a, "A".into()).unwrap();
        doc.add_layer(b, "B".into());
        doc.add_layer(c, "C".into()); // [A, B, C]

        let mut history = DocumentHistory::default();
        history.push_document(&doc);
        doc.reorder_layer(a, 2).unwrap(); // [B, C, A]

        let restored = history.undo_document(&doc).unwrap();

        let ids: Vec<Uuid> = restored.layers().iter().map(|l| l.id).collect();
        assert_eq!(ids, vec![a, b, c]);
    }

    #[test]
    fn undo_after_pixel_change_restores_active_layer_pixels() {
        let id = Uuid::new_v4();
        let mut doc = Document::new(2, 2, id, "Layer 1".into()).unwrap();
        let mut history = DocumentHistory::default();

        history.push_document(&doc);
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap();

        let restored = history.undo_document(&doc).unwrap();

        assert_eq!(
            pixel_canvas(&restored.layers()[0]).get_pixel(0, 0).unwrap(),
            Color::TRANSPARENT
        );
    }
}
