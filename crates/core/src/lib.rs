pub mod canvas;
pub mod color;
pub use canvas::PixelCanvasError;
pub use color::ColorParseError;

pub fn core_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_not_empty() {
        assert!(!core_version().is_empty());
    }
}
