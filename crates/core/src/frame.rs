use std::hash::{Hash, Hasher};

use uuid::Uuid;

/// A single frame on a [`Document`](crate::Document)'s temporal axis.
///
/// A Frame carries its `id` (its identity) and a `duration_ms` — how long it is
/// displayed during playback. The duration is **mutable metadata, not
/// identity**: a retimed frame is the same frame, so equality and hashing key on
/// `id` alone. The shell displays a frame as its 1-based ordinal in
/// [`Document::frames`](crate::Document::frames); it carries no persistent name
/// or counter. A Document always holds at least one frame.
#[derive(Debug, Clone, Copy)]
pub struct Frame {
    pub id: Uuid,
    /// Display time in milliseconds during playback. The core trusts this value;
    /// range clamping is a boundary concern handled by the shell binding.
    pub duration_ms: u32,
}

// Identity is the `id` alone: `duration_ms` is mutable metadata, so a retimed
// frame must compare and hash equal to its former self. `PartialEq`/`Eq`/`Hash`
// stay mutually consistent (equal frames hash equal) by all keying on `id`.
impl PartialEq for Frame {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl Eq for Frame {}

impl Hash for Frame {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.id.hash(state);
    }
}

impl Frame {
    /// The default display time, in milliseconds, of a freshly created frame
    /// (100 ms = 10 fps). The single source of truth for "default duration":
    /// [`INITIAL`](Self::INITIAL) carries it and
    /// [`add_frame`](crate::Document::add_frame) seeds new frames with it.
    pub const DEFAULT_DURATION_MS: u32 = 100;

    /// The frame a [`Document`](crate::Document) is born with at construction
    /// ([`Document::new`](crate::Document::new) / `from_layers`).
    ///
    /// The core cannot mint UUIDs — `uuid`'s `v4` generator is a test-only
    /// dependency — so the initial frame uses the nil UUID rather than a random
    /// one. Frames added later carry caller-supplied ids. Keeping this in one
    /// named constant ties the initial frame's id, every Pixel Layer's initial
    /// cel key, and the initial active-frame pointer to a single source of
    /// truth, preserving the grid invariant by construction.
    pub const INITIAL: Frame = Frame {
        id: Uuid::nil(),
        duration_ms: Self::DEFAULT_DURATION_MS,
    };
}
