use uuid::Uuid;

/// A single frame on a [`Document`](crate::Document)'s temporal axis.
///
/// A Frame is **identity-only**: it carries no persistent name, counter, or
/// duration. The shell displays a frame as its 1-based ordinal in
/// [`Document::frames`](crate::Document::frames). A Document always holds at
/// least one frame.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Frame {
    pub id: Uuid,
}

impl Frame {
    /// The frame a [`Document`](crate::Document) is born with at construction
    /// ([`Document::new`](crate::Document::new) / `from_layers`).
    ///
    /// The core cannot mint UUIDs — `uuid`'s `v4` generator is a test-only
    /// dependency — so the initial frame uses the nil UUID rather than a random
    /// one. Frames added later carry caller-supplied ids. Keeping this in one
    /// named constant ties the initial frame's id, every Pixel Layer's initial
    /// cel key, and the initial active-frame pointer to a single source of
    /// truth, preserving the grid invariant by construction.
    pub const INITIAL: Frame = Frame { id: Uuid::nil() };
}
