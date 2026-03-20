use std::fmt;
use std::io::Cursor;

use crate::canvas::PixelCanvas;

/// Errors that can occur during export operations.
#[derive(Debug)]
pub enum ExportError {
    PngEncode { message: String },
}

impl fmt::Display for ExportError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::PngEncode { message } => write!(f, "PNG encoding failed: {message}"),
        }
    }
}

impl std::error::Error for ExportError {}

/// Encodes a `PixelCanvas` as a PNG image, returning the raw bytes.
///
/// The output is an RGBA 8-bit PNG. The pixel data from `canvas.pixels()` is
/// written directly — it is already in row-major RGBA layout.
pub fn encode_png(canvas: &PixelCanvas) -> Result<Vec<u8>, ExportError> {
    let mut buf: Vec<u8> = Vec::new();
    {
        let cursor = Cursor::new(&mut buf);
        let mut encoder = png::Encoder::new(cursor, canvas.width(), canvas.height());
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);

        let mut writer = encoder
            .write_header()
            .map_err(|e| ExportError::PngEncode {
                message: e.to_string(),
            })?;

        writer
            .write_image_data(canvas.pixels())
            .map_err(|e| ExportError::PngEncode {
                message: e.to_string(),
            })?;
    }
    Ok(buf)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::color::Color;

    const PNG_SIGNATURE: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];

    #[test]
    fn png_has_valid_signature() {
        let canvas = PixelCanvas::new(4, 4).unwrap();
        let bytes = encode_png(&canvas).unwrap();
        assert_eq!(&bytes[..8], &PNG_SIGNATURE);
    }

    #[test]
    fn opaque_canvas_round_trip() {
        let color = Color::new(200, 100, 50, 255);
        let canvas = PixelCanvas::with_color(4, 4, color).unwrap();
        let original_pixels = canvas.pixels().to_vec();

        let bytes = encode_png(&canvas).unwrap();

        let decoder = png::Decoder::new(Cursor::new(&bytes));
        let mut reader = decoder.read_info().unwrap();
        let mut decoded = vec![0u8; reader.output_buffer_size()];
        reader.next_frame(&mut decoded).unwrap();
        let info = reader.info();
        let row_bytes = info.width as usize * 4;
        let decoded_pixels: Vec<u8> = decoded[..row_bytes * info.height as usize].to_vec();

        assert_eq!(decoded_pixels, original_pixels);
    }

    #[test]
    fn transparent_canvas_preserved() {
        let canvas = PixelCanvas::new(2, 2).unwrap();
        let original_pixels = canvas.pixels().to_vec();
        assert!(original_pixels.iter().all(|&b| b == 0));

        let bytes = encode_png(&canvas).unwrap();

        let decoder = png::Decoder::new(Cursor::new(&bytes));
        let mut reader = decoder.read_info().unwrap();
        let mut decoded = vec![0u8; reader.output_buffer_size()];
        reader.next_frame(&mut decoded).unwrap();
        let info = reader.info();
        let decoded_pixels = &decoded[..info.width as usize * 4 * info.height as usize];

        assert_eq!(decoded_pixels, &original_pixels[..]);
    }

    #[test]
    fn single_pixel_canvas() {
        let color = Color::new(42, 128, 255, 200);
        let canvas = PixelCanvas::with_color(1, 1, color).unwrap();

        let bytes = encode_png(&canvas).unwrap();
        assert_eq!(&bytes[..8], &PNG_SIGNATURE);

        let decoder = png::Decoder::new(Cursor::new(&bytes));
        let mut reader = decoder.read_info().unwrap();
        let mut decoded = vec![0u8; reader.output_buffer_size()];
        reader.next_frame(&mut decoded).unwrap();

        assert_eq!(&decoded[..4], &[42, 128, 255, 200]);
    }

    #[test]
    fn non_square_canvas() {
        let color = Color::new(10, 20, 30, 255);
        let canvas = PixelCanvas::with_color(8, 4, color).unwrap();
        let original_pixels = canvas.pixels().to_vec();

        let bytes = encode_png(&canvas).unwrap();

        let decoder = png::Decoder::new(Cursor::new(&bytes));
        let mut reader = decoder.read_info().unwrap();
        let info = reader.info().clone();
        let mut decoded = vec![0u8; reader.output_buffer_size()];
        reader.next_frame(&mut decoded).unwrap();

        assert_eq!(info.width, 8);
        assert_eq!(info.height, 4);

        let decoded_pixels = &decoded[..info.width as usize * 4 * info.height as usize];
        assert_eq!(decoded_pixels, &original_pixels[..]);
    }
}
