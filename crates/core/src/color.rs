use std::fmt;
use std::str::FromStr;

/// RGBA color with 8-bit channels.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "uniffi", derive(uniffi::Record))]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

/// Error returned when parsing a hex color string fails.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ColorParseError {
    MissingHash,
    InvalidLength { actual: usize },
    InvalidHexDigit { position: usize, digit: char },
}

impl fmt::Display for ColorParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingHash => write!(f, "hex color must start with '#'"),
            Self::InvalidLength { actual } => {
                write!(f, "hex color must be 6 digits after '#', got {actual}")
            }
            Self::InvalidHexDigit { position, digit } => {
                write!(f, "invalid hex digit '{digit}' at position {position}")
            }
        }
    }
}

impl std::error::Error for ColorParseError {}

fn hex_digit_value(byte: u8, position: usize) -> Result<u8, ColorParseError> {
    match byte {
        b'0'..=b'9' => Ok(byte - b'0'),
        b'a'..=b'f' => Ok(byte - b'a' + 10),
        b'A'..=b'F' => Ok(byte - b'A' + 10),
        _ => Err(ColorParseError::InvalidHexDigit {
            position,
            digit: byte as char,
        }),
    }
}

fn parse_hex_pair(bytes: &[u8], offset: usize) -> Result<u8, ColorParseError> {
    let high = hex_digit_value(bytes[offset], offset)?;
    let low = hex_digit_value(bytes[offset + 1], offset + 1)?;
    Ok(high * 16 + low)
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

    /// Converts this color to a 6-digit lowercase hex string (e.g. `"#ff0000"`).
    /// Alpha channel is ignored.
    pub fn to_hex(&self) -> String {
        format!("#{:02x}{:02x}{:02x}", self.r, self.g, self.b)
    }

    /// Parses a 6-digit hex color string (e.g. `"#ff0000"`) into a `Color`.
    /// Alpha is always set to 255.
    pub fn from_hex(hex: &str) -> Result<Self, ColorParseError> {
        let bytes = hex.as_bytes();

        if bytes.first() != Some(&b'#') {
            return Err(ColorParseError::MissingHash);
        }

        let hex_part = &bytes[1..];
        if hex_part.len() != 6 {
            return Err(ColorParseError::InvalidLength {
                actual: hex_part.len(),
            });
        }

        let r = parse_hex_pair(hex_part, 0)?;
        let g = parse_hex_pair(hex_part, 2)?;
        let b = parse_hex_pair(hex_part, 4)?;

        Ok(Self::new(r, g, b, 255))
    }
}

impl fmt::Display for Color {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "rgba({}, {}, {}, {})", self.r, self.g, self.b, self.a)
    }
}

impl FromStr for Color {
    type Err = ColorParseError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::from_hex(s)
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

    // to_hex tests

    #[test]
    fn to_hex_black() {
        assert_eq!(Color::new(0, 0, 0, 255).to_hex(), "#000000");
    }

    #[test]
    fn to_hex_white() {
        assert_eq!(Color::new(255, 255, 255, 255).to_hex(), "#ffffff");
    }

    #[test]
    fn to_hex_arbitrary_color() {
        assert_eq!(Color::new(0xab, 0xcd, 0xef, 255).to_hex(), "#abcdef");
    }

    #[test]
    fn to_hex_pads_single_digits() {
        assert_eq!(Color::new(1, 2, 3, 255).to_hex(), "#010203");
    }

    #[test]
    fn to_hex_ignores_alpha() {
        assert_eq!(Color::new(255, 0, 0, 0).to_hex(), "#ff0000");
        assert_eq!(Color::new(255, 0, 0, 128).to_hex(), "#ff0000");
    }

    // from_hex tests

    #[test]
    fn from_hex_black() {
        assert_eq!(Color::from_hex("#000000"), Ok(Color::new(0, 0, 0, 255)));
    }

    #[test]
    fn from_hex_white() {
        assert_eq!(
            Color::from_hex("#ffffff"),
            Ok(Color::new(255, 255, 255, 255))
        );
    }

    #[test]
    fn from_hex_arbitrary_color() {
        assert_eq!(
            Color::from_hex("#abcdef"),
            Ok(Color::new(0xab, 0xcd, 0xef, 255))
        );
    }

    #[test]
    fn from_hex_uppercase() {
        assert_eq!(
            Color::from_hex("#ABCDEF"),
            Ok(Color::new(0xab, 0xcd, 0xef, 255))
        );
    }

    #[test]
    fn from_hex_sets_alpha_to_255() {
        let color = Color::from_hex("#ff0000").unwrap();
        assert_eq!(color.a, 255);
    }

    #[test]
    fn from_hex_round_trip() {
        let original = Color::new(0xab, 0xcd, 0xef, 255);
        let hex = original.to_hex();
        let parsed = Color::from_hex(&hex).unwrap();
        assert_eq!(original, parsed);
    }

    #[test]
    fn from_hex_missing_hash() {
        assert_eq!(Color::from_hex("ff0000"), Err(ColorParseError::MissingHash));
    }

    #[test]
    fn from_hex_too_short() {
        assert_eq!(
            Color::from_hex("#fff"),
            Err(ColorParseError::InvalidLength { actual: 3 })
        );
    }

    #[test]
    fn from_hex_too_long() {
        assert_eq!(
            Color::from_hex("#ff00ff00"),
            Err(ColorParseError::InvalidLength { actual: 8 })
        );
    }

    #[test]
    fn from_hex_empty_string() {
        assert_eq!(Color::from_hex(""), Err(ColorParseError::MissingHash));
    }

    #[test]
    fn from_hex_invalid_chars() {
        assert_eq!(
            Color::from_hex("#gg0000"),
            Err(ColorParseError::InvalidHexDigit {
                position: 0,
                digit: 'g'
            })
        );
    }

    // FromStr tests

    #[test]
    fn from_str_valid() {
        let color: Color = "#ff0000".parse().unwrap();
        assert_eq!(color, Color::new(255, 0, 0, 255));
    }

    #[test]
    fn from_str_invalid() {
        let result = "not-a-color".parse::<Color>();
        assert!(result.is_err());
    }

    // Display tests

    #[test]
    fn display_color() {
        let color = Color::new(255, 128, 0, 255);
        assert_eq!(format!("{color}"), "rgba(255, 128, 0, 255)");
    }

    #[test]
    fn display_transparent() {
        assert_eq!(format!("{}", Color::TRANSPARENT), "rgba(0, 0, 0, 0)");
    }

    // ColorParseError Display tests

    #[test]
    fn display_error_missing_hash() {
        let err = ColorParseError::MissingHash;
        assert_eq!(format!("{err}"), "hex color must start with '#'");
    }

    #[test]
    fn display_error_invalid_length() {
        let err = ColorParseError::InvalidLength { actual: 3 };
        assert_eq!(
            format!("{err}"),
            "hex color must be 6 digits after '#', got 3"
        );
    }

    #[test]
    fn display_error_invalid_hex_digit() {
        let err = ColorParseError::InvalidHexDigit {
            position: 0,
            digit: 'g',
        };
        assert_eq!(format!("{err}"), "invalid hex digit 'g' at position 0");
    }

    #[test]
    fn error_implements_std_error() {
        let err = ColorParseError::MissingHash;
        let _dyn_err: &dyn std::error::Error = &err;
    }
}
