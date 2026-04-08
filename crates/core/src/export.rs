use std::fmt;
use std::fmt::Write as _;
use std::io::Cursor;

use crate::canvas::PixelCanvas;

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

pub trait SvgExport {
    /// Encodes each non-transparent pixel as an SVG `<rect>` element.
    /// The root `<svg>` uses `viewBox` only (no fixed width/height) with `shape-rendering="crispEdges"`.
    fn encode_svg(&self) -> Result<String, ExportError>;
}

impl SvgExport for PixelCanvas {
    fn encode_svg(&self) -> Result<String, ExportError> {
        let mut svg = String::new();
        write!(
            svg,
            r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {} {}" shape-rendering="crispEdges">"#,
            self.width(),
            self.height()
        )
        .unwrap();

        for y in 0..self.height() {
            for x in 0..self.width() {
                let color = self.get_pixel(x, y).unwrap();
                if color.a == 0 {
                    continue;
                }
                if color.a < 255 {
                    let opacity = color.a as f64 / 255.0;
                    write!(
                        svg,
                        r##"<rect x="{x}" y="{y}" width="1" height="1" fill="{}" fill-opacity="{opacity:.3}"/>"##,
                        color.to_hex()
                    )
                    .unwrap();
                } else {
                    write!(
                        svg,
                        r##"<rect x="{x}" y="{y}" width="1" height="1" fill="{}"/>"##,
                        color.to_hex()
                    )
                    .unwrap();
                }
            }
        }

        svg.push_str("</svg>");
        Ok(svg)
    }
}

pub trait PngExport {
    /// Encodes the canvas as an RGBA 8-bit PNG.
    fn encode_png(&self) -> Result<Vec<u8>, ExportError>;
}

impl PngExport for PixelCanvas {
    fn encode_png(&self) -> Result<Vec<u8>, ExportError> {
        let mut buf: Vec<u8> = Vec::new();
        {
            let cursor = Cursor::new(&mut buf);
            let mut encoder = png::Encoder::new(cursor, self.width(), self.height());
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);

            let mut writer = encoder.write_header().map_err(|e| ExportError::PngEncode {
                message: e.to_string(),
            })?;

            writer
                .write_image_data(self.pixels())
                .map_err(|e| ExportError::PngEncode {
                    message: e.to_string(),
                })?;
        }
        Ok(buf)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::color::Color;

    const PNG_SIGNATURE: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];

    #[test]
    fn png_has_valid_signature() {
        let canvas = PixelCanvas::new(4, 4).unwrap();
        let bytes = canvas.encode_png().unwrap();
        assert_eq!(&bytes[..8], &PNG_SIGNATURE);
    }

    #[test]
    fn opaque_canvas_round_trip() {
        let color = Color::new(200, 100, 50, 255);
        let canvas = PixelCanvas::with_color(4, 4, color).unwrap();
        let original_pixels = canvas.pixels().to_vec();

        let bytes = canvas.encode_png().unwrap();

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

        let bytes = canvas.encode_png().unwrap();

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

        let bytes = canvas.encode_png().unwrap();
        assert_eq!(&bytes[..8], &PNG_SIGNATURE);

        let decoder = png::Decoder::new(Cursor::new(&bytes));
        let mut reader = decoder.read_info().unwrap();
        let mut decoded = vec![0u8; reader.output_buffer_size()];
        reader.next_frame(&mut decoded).unwrap();

        assert_eq!(&decoded[..4], &[42, 128, 255, 200]);
    }

    #[test]
    fn svg_opaque_pixel_produces_rect() {
        let mut canvas = PixelCanvas::new(2, 2).unwrap();
        canvas
            .set_pixel(1, 0, Color::new(255, 0, 0, 255))
            .unwrap();

        let svg = canvas.encode_svg().unwrap();

        assert!(svg.contains(r##"<rect x="1" y="0" width="1" height="1" fill="#ff0000"/>"##));
    }

    #[test]
    fn svg_non_square_canvas_viewbox() {
        let color = Color::new(10, 20, 30, 255);
        let canvas = PixelCanvas::with_color(8, 3, color).unwrap();

        let svg = canvas.encode_svg().unwrap();

        assert!(svg.contains(r#"viewBox="0 0 8 3""#));
        assert_eq!(svg.matches("<rect").count(), 24); // 8 * 3
    }

    #[test]
    fn svg_all_transparent_canvas_has_no_rects() {
        let canvas = PixelCanvas::new(4, 4).unwrap();

        let svg = canvas.encode_svg().unwrap();

        assert_eq!(svg.matches("<rect").count(), 0);
        // Should still have a valid SVG root
        assert!(svg.starts_with("<svg "));
        assert!(svg.ends_with("</svg>"));
    }

    #[test]
    fn svg_single_pixel_canvas() {
        let canvas = PixelCanvas::with_color(1, 1, Color::new(0, 255, 0, 255)).unwrap();

        let svg = canvas.encode_svg().unwrap();

        assert!(svg.contains(r#"viewBox="0 0 1 1""#));
        assert_eq!(svg.matches("<rect").count(), 1);
        assert!(svg.contains(r##"<rect x="0" y="0" width="1" height="1" fill="#00ff00"/>"##));
    }

    #[test]
    fn svg_root_has_correct_attributes() {
        let canvas = PixelCanvas::new(16, 16).unwrap();

        let svg = canvas.encode_svg().unwrap();

        assert!(svg.starts_with("<svg "));
        assert!(svg.contains(r#"xmlns="http://www.w3.org/2000/svg""#));
        assert!(svg.contains(r#"viewBox="0 0 16 16""#));
        assert!(svg.contains(r#"shape-rendering="crispEdges""#));
        assert!(!svg.contains("width="));
        assert!(!svg.contains("height="));
        assert!(svg.ends_with("</svg>"));
    }

    #[test]
    fn svg_semi_transparent_pixel_has_fill_opacity() {
        let mut canvas = PixelCanvas::new(1, 1).unwrap();
        // alpha 128 → opacity 128/255 ≈ 0.502
        canvas
            .set_pixel(0, 0, Color::new(255, 0, 0, 128))
            .unwrap();

        let svg = canvas.encode_svg().unwrap();

        assert!(svg.contains(r#"fill-opacity="0.502""#));
    }

    #[test]
    fn svg_transparent_pixels_omitted() {
        let mut canvas = PixelCanvas::new(2, 2).unwrap();
        // Only set one pixel; the other three remain transparent
        canvas
            .set_pixel(0, 0, Color::new(0, 0, 255, 255))
            .unwrap();

        let svg = canvas.encode_svg().unwrap();

        // Exactly one rect for the opaque pixel
        assert_eq!(svg.matches("<rect").count(), 1);
    }

    #[test]
    fn non_square_canvas() {
        let color = Color::new(10, 20, 30, 255);
        let canvas = PixelCanvas::with_color(8, 4, color).unwrap();
        let original_pixels = canvas.pixels().to_vec();

        let bytes = canvas.encode_png().unwrap();

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
