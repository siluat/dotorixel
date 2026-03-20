#[cfg(feature = "uniffi")]
uniffi::setup_scaffolding!();

pub mod canvas;
pub mod color;
pub mod export;
pub mod history;
pub mod tool;
pub mod viewport;
pub use canvas::PixelCanvasError;
pub use color::ColorParseError;
pub use export::{ExportError, PngExport};
pub use history::HistoryManager;
pub use tool::ToolType;
pub use viewport::{ScreenCanvasCoords, Viewport, ViewportSize};

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
