/// RGBA color with 8-bit channels.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl Color {
    pub const TRANSPARENT: Self = Self {
        r: 0,
        g: 0,
        b: 0,
        a: 0,
    };

    pub const fn new(r: u8, g: u8, b: u8, a: u8) -> Self {
        Self { r, g, b, a }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transparent_has_all_zero_channels() {
        assert_eq!(Color::TRANSPARENT, Color::new(0, 0, 0, 0));
    }

    #[test]
    fn new_sets_all_channels() {
        let color = Color::new(255, 128, 0, 255);
        assert_eq!(color.r, 255);
        assert_eq!(color.g, 128);
        assert_eq!(color.b, 0);
        assert_eq!(color.a, 255);
    }

    #[test]
    fn copy_semantics() {
        let a = Color::new(10, 20, 30, 40);
        let b = a;
        assert_eq!(a, b);
    }

    #[test]
    fn equality() {
        let a = Color::new(1, 2, 3, 4);
        let b = Color::new(1, 2, 3, 4);
        let c = Color::new(1, 2, 3, 5);
        assert_eq!(a, b);
        assert_ne!(a, c);
    }

    #[test]
    fn usable_as_hash_key() {
        use std::collections::HashSet;
        let mut set = HashSet::new();
        set.insert(Color::new(255, 0, 0, 255));
        set.insert(Color::new(255, 0, 0, 255));
        assert_eq!(set.len(), 1);
    }
}
