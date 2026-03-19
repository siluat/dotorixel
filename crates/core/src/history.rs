use std::collections::VecDeque;

/// Manages undo/redo history as raw pixel snapshots.
///
/// Stores snapshots as owned `Vec<u8>` byte buffers, keeping the history
/// module decoupled from any specific canvas representation. Both stacks
/// use `VecDeque` to support efficient eviction of the oldest undo entry
/// when `max_snapshots` is exceeded.
#[derive(Debug, Clone)]
pub struct HistoryManager {
    undo_stack: VecDeque<Vec<u8>>,
    redo_stack: VecDeque<Vec<u8>>,
    max_snapshots: usize,
}

impl HistoryManager {
    pub const DEFAULT_MAX_SNAPSHOTS: usize = 100;

    pub fn new(max_snapshots: usize) -> Self {
        assert!(
            max_snapshots > 0,
            "HistoryManager max_snapshots must be > 0"
        );
        Self {
            undo_stack: VecDeque::new(),
            redo_stack: VecDeque::new(),
            max_snapshots,
        }
    }

    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    /// Saves a snapshot of pixel data onto the undo stack.
    ///
    /// Evicts the oldest snapshot if the stack exceeds `max_snapshots`,
    /// and clears the redo stack (branching from a past state discards
    /// the former future).
    pub fn push_snapshot(&mut self, pixels: &[u8]) {
        self.undo_stack.push_back(pixels.to_vec());
        if self.undo_stack.len() > self.max_snapshots {
            self.undo_stack.pop_front();
        }
        self.redo_stack.clear();
    }

    /// Pops the most recent snapshot from the undo stack and pushes the
    /// caller's current pixel state onto the redo stack.
    pub fn undo(&mut self, current_pixels: &[u8]) -> Option<Vec<u8>> {
        let snapshot = self.undo_stack.pop_back()?;
        self.redo_stack.push_back(current_pixels.to_vec());
        Some(snapshot)
    }

    /// Pops the most recent snapshot from the redo stack and pushes the
    /// caller's current pixel state onto the undo stack.
    pub fn redo(&mut self, current_pixels: &[u8]) -> Option<Vec<u8>> {
        let snapshot = self.redo_stack.pop_back()?;
        self.undo_stack.push_back(current_pixels.to_vec());
        Some(snapshot)
    }

    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }
}

impl Default for HistoryManager {
    fn default() -> Self {
        Self::new(Self::DEFAULT_MAX_SNAPSHOTS)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // -- initial state --

    #[test]
    fn initial_can_undo_is_false() {
        let history = HistoryManager::default();
        assert!(!history.can_undo());
    }

    #[test]
    fn initial_can_redo_is_false() {
        let history = HistoryManager::default();
        assert!(!history.can_redo());
    }

    // -- push_snapshot --

    #[test]
    fn push_enables_can_undo() {
        let mut history = HistoryManager::default();
        history.push_snapshot(&[1, 2, 3, 4]);
        assert!(history.can_undo());
    }

    #[test]
    fn push_keeps_can_redo_false() {
        let mut history = HistoryManager::default();
        history.push_snapshot(&[1, 2, 3, 4]);
        assert!(!history.can_redo());
    }

    #[test]
    fn push_clears_redo_stack() {
        let mut history = HistoryManager::default();
        history.push_snapshot(&[1, 0, 0, 0]);
        history.undo(&[2, 0, 0, 0]);
        assert!(history.can_redo());

        history.push_snapshot(&[3, 0, 0, 0]);
        assert!(!history.can_redo());
    }

    #[test]
    fn push_stores_independent_copy() {
        let mut history = HistoryManager::default();
        let mut pixels = vec![10, 20, 30, 40];
        history.push_snapshot(&pixels);

        pixels[0] = 255;

        let restored = history.undo(&[0, 0, 0, 0]).unwrap();
        assert_eq!(restored[0], 10);
    }

    // -- undo --

    #[test]
    fn undo_returns_most_recent_snapshot() {
        let mut history = HistoryManager::default();
        history.push_snapshot(&[1, 2, 3, 4]);
        let result = history.undo(&[5, 6, 7, 8]).unwrap();
        assert_eq!(result, vec![1, 2, 3, 4]);
    }

    #[test]
    fn undo_enables_can_redo() {
        let mut history = HistoryManager::default();
        history.push_snapshot(&[1, 2, 3, 4]);
        history.undo(&[5, 6, 7, 8]);
        assert!(history.can_redo());
    }

    #[test]
    fn undo_saves_current_to_redo_stack() {
        let mut history = HistoryManager::default();
        history.push_snapshot(&[1, 0, 0, 0]);
        history.undo(&[2, 0, 0, 0]);
        let redone = history.redo(&[99, 0, 0, 0]).unwrap();
        assert_eq!(redone, vec![2, 0, 0, 0]);
    }

    #[test]
    fn undo_returns_none_when_empty() {
        let mut history = HistoryManager::default();
        assert!(history.undo(&[1, 2, 3, 4]).is_none());
    }

    #[test]
    fn undo_returns_snapshots_in_lifo_order() {
        let mut history = HistoryManager::default();
        history.push_snapshot(&[1, 0, 0, 0]);
        history.push_snapshot(&[2, 0, 0, 0]);
        history.push_snapshot(&[3, 0, 0, 0]);

        assert_eq!(history.undo(&[4, 0, 0, 0]).unwrap()[0], 3);
        assert_eq!(history.undo(&[3, 0, 0, 0]).unwrap()[0], 2);
        assert_eq!(history.undo(&[2, 0, 0, 0]).unwrap()[0], 1);
        assert!(history.undo(&[1, 0, 0, 0]).is_none());
    }

    #[test]
    fn undo_stores_independent_copy_in_redo_stack() {
        let mut history = HistoryManager::default();
        history.push_snapshot(&[1, 0, 0, 0]);

        let mut current = vec![2, 0, 0, 0];
        history.undo(&current);

        current[0] = 255;

        let redone = history.redo(&[99, 0, 0, 0]).unwrap();
        assert_eq!(redone[0], 2);
    }

    // -- redo --

    #[test]
    fn redo_returns_most_recently_undone_snapshot() {
        let mut history = HistoryManager::default();
        history.push_snapshot(&[1, 0, 0, 0]);
        history.undo(&[2, 0, 0, 0]);
        let result = history.redo(&[1, 0, 0, 0]).unwrap();
        assert_eq!(result, vec![2, 0, 0, 0]);
    }

    #[test]
    fn redo_enables_can_undo() {
        let mut history = HistoryManager::default();
        history.push_snapshot(&[1, 0, 0, 0]);
        history.undo(&[2, 0, 0, 0]);
        assert!(!history.can_undo());

        history.redo(&[1, 0, 0, 0]);
        assert!(history.can_undo());
    }

    #[test]
    fn redo_returns_none_when_empty() {
        let mut history = HistoryManager::default();
        assert!(history.redo(&[1, 2, 3, 4]).is_none());
    }

    #[test]
    fn redo_saves_current_to_undo_stack() {
        let mut history = HistoryManager::default();
        history.push_snapshot(&[1, 0, 0, 0]);
        history.undo(&[2, 0, 0, 0]);
        history.redo(&[1, 0, 0, 0]);

        let undone = history.undo(&[99, 0, 0, 0]).unwrap();
        assert_eq!(undone, vec![1, 0, 0, 0]);
    }

    #[test]
    fn redo_stores_independent_copy_in_undo_stack() {
        let mut history = HistoryManager::default();
        history.push_snapshot(&[1, 0, 0, 0]);
        history.undo(&[2, 0, 0, 0]);

        let mut current = vec![1, 0, 0, 0];
        history.redo(&current);

        current[0] = 255;

        let undone = history.undo(&[99, 0, 0, 0]).unwrap();
        assert_eq!(undone[0], 1);
    }

    // -- max_snapshots --

    #[test]
    fn evicts_oldest_when_limit_exceeded() {
        let mut history = HistoryManager::new(3);
        history.push_snapshot(&[1, 0, 0, 0]);
        history.push_snapshot(&[2, 0, 0, 0]);
        history.push_snapshot(&[3, 0, 0, 0]);
        history.push_snapshot(&[4, 0, 0, 0]);

        assert_eq!(history.undo(&[5, 0, 0, 0]).unwrap()[0], 4);
        assert_eq!(history.undo(&[4, 0, 0, 0]).unwrap()[0], 3);
        assert_eq!(history.undo(&[3, 0, 0, 0]).unwrap()[0], 2);
        assert!(history.undo(&[2, 0, 0, 0]).is_none());
    }

    // -- clear --

    #[test]
    fn clear_resets_both_stacks() {
        let mut history = HistoryManager::default();
        history.push_snapshot(&[1, 0, 0, 0]);
        history.push_snapshot(&[2, 0, 0, 0]);
        history.undo(&[3, 0, 0, 0]);

        history.clear();

        assert!(!history.can_undo());
        assert!(!history.can_redo());
    }

    // -- constructor validation --

    #[test]
    #[should_panic(expected = "max_snapshots must be > 0")]
    fn new_rejects_zero_max_snapshots() {
        HistoryManager::new(0);
    }

    // -- Default trait --

    #[test]
    fn default_uses_default_max_snapshots() {
        let mut history = HistoryManager::default();
        for i in 0..=HistoryManager::DEFAULT_MAX_SNAPSHOTS as u8 {
            history.push_snapshot(&[i]);
        }
        // The 0th snapshot should have been evicted
        let mut count = 0;
        while history.undo(&[0]).is_some() {
            count += 1;
        }
        assert_eq!(count, HistoryManager::DEFAULT_MAX_SNAPSHOTS);
    }
}
