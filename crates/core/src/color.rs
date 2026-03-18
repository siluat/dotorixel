/// RGBA color with 8-bit channels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

pub const TRANSPARENT: Color = Color {
    r: 0,
    g: 0,
    b: 0,
    a: 0,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transparent_has_all_zero_channels() {
        assert_eq!(TRANSPARENT.r, 0);
        assert_eq!(TRANSPARENT.g, 0);
        assert_eq!(TRANSPARENT.b, 0);
        assert_eq!(TRANSPARENT.a, 0);
    }

    #[test]
    fn color_creation_and_field_access() {
        let color = Color {
            r: 255,
            g: 128,
            b: 0,
            a: 255,
        };
        assert_eq!(color.r, 255);
        assert_eq!(color.g, 128);
        assert_eq!(color.b, 0);
        assert_eq!(color.a, 255);
    }

    #[test]
    fn color_is_copy() {
        let a = Color {
            r: 10,
            g: 20,
            b: 30,
            a: 40,
        };
        let b = a; // Copy
        assert_eq!(a, b); // `a` is still usable after copy
    }

    #[test]
    fn color_equality() {
        let a = Color {
            r: 1,
            g: 2,
            b: 3,
            a: 4,
        };
        let b = Color {
            r: 1,
            g: 2,
            b: 3,
            a: 4,
        };
        let c = Color {
            r: 1,
            g: 2,
            b: 3,
            a: 5,
        };
        assert_eq!(a, b);
        assert_ne!(a, c);
    }
}
