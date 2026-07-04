use std::fmt;
use std::fmt::Write as _;
use std::io::Cursor;

use crate::canvas::PixelCanvas;
use crate::document::Document;

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
        encode_rgba_png(self.width(), self.height(), self.pixels())
    }
}

pub trait SpritesheetExport {
    /// Encodes every Frame's composite as one contiguous horizontal-strip
    /// RGBA 8-bit PNG: frames in axis order, each tile exactly canvas
    /// width × height with no padding, sheet dimensions
    /// `(width × frame count) × height`.
    ///
    /// A pure query reading through [`Document::composite_at`] — the Active
    /// Frame is neither consulted nor moved. Compositing matches Playback:
    /// visible Pixel Layers blended with their opacity; hidden layers and
    /// Reference Layers excluded.
    ///
    /// Returns [`ExportError::PngEncode`] when the underlying PNG encoder
    /// fails.
    fn encode_spritesheet_png(&self) -> Result<Vec<u8>, ExportError>;
}

impl SpritesheetExport for Document {
    fn encode_spritesheet_png(&self) -> Result<Vec<u8>, ExportError> {
        let (width, height) = (self.width(), self.height());
        let sheet_width = width * self.frames().len() as u32;
        let tile_row_bytes = (width * 4) as usize;
        let sheet_row_bytes = (sheet_width * 4) as usize;

        let mut sheet = vec![0u8; sheet_row_bytes * height as usize];
        for (tile, frame) in self.frames().iter().enumerate() {
            let composite = self.composite_at(frame.id);
            for y in 0..height as usize {
                let src = y * tile_row_bytes..(y + 1) * tile_row_bytes;
                let dest = y * sheet_row_bytes + tile * tile_row_bytes;
                sheet[dest..dest + tile_row_bytes].copy_from_slice(&composite[src]);
            }
        }
        encode_rgba_png(sheet_width, height, &sheet)
    }
}

/// Shared raw-buffer PNG encoding: RGBA 8-bit, `pixels` in row-major order.
fn encode_rgba_png(width: u32, height: u32, pixels: &[u8]) -> Result<Vec<u8>, ExportError> {
    let mut buf: Vec<u8> = Vec::new();
    {
        let cursor = Cursor::new(&mut buf);
        let mut encoder = png::Encoder::new(cursor, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);

        let mut writer = encoder.write_header().map_err(|e| ExportError::PngEncode {
            message: e.to_string(),
        })?;

        writer
            .write_image_data(pixels)
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
    use crate::document::Document;
    use uuid::Uuid;

    const PNG_SIGNATURE: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];

    fn decode_png(bytes: &[u8]) -> (u32, u32, Vec<u8>) {
        let decoder = png::Decoder::new(Cursor::new(bytes));
        let mut reader = decoder.read_info().unwrap();
        let mut decoded = vec![0u8; reader.output_buffer_size()];
        reader.next_frame(&mut decoded).unwrap();
        let info = reader.info();
        let (width, height) = (info.width, info.height);
        decoded.truncate(width as usize * height as usize * 4);
        (width, height, decoded)
    }

    /// Extracts tile `index`'s pixels (tile_width × height) from a decoded
    /// horizontal-strip sheet buffer.
    fn tile_pixels(
        sheet: &[u8],
        sheet_width: u32,
        tile_width: u32,
        height: u32,
        index: u32,
    ) -> Vec<u8> {
        let mut out = Vec::new();
        for y in 0..height {
            let row_start = ((y * sheet_width + index * tile_width) * 4) as usize;
            out.extend_from_slice(&sheet[row_start..row_start + (tile_width * 4) as usize]);
        }
        out
    }

    #[test]
    fn spritesheet_tiles_every_frame_left_to_right_in_axis_order() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap(); // red on the first frame
        let second = Uuid::new_v4();
        doc.add_frame(second); // second active and empty
        doc.set_pixel(1, 0, Color::new(0, 255, 0, 255)).unwrap(); // green on the second frame
        let third = Uuid::new_v4();
        doc.add_frame(third); // third active and empty
        doc.set_pixel(1, 1, Color::new(0, 0, 255, 255)).unwrap(); // blue on the third frame

        let bytes = doc.encode_spritesheet_png().unwrap();

        let (width, height, sheet) = decode_png(&bytes);
        assert_eq!((width, height), (6, 2)); // (2 × 3 frames) × 2
        for (i, frame_id) in [first, second, third].into_iter().enumerate() {
            assert_eq!(
                tile_pixels(&sheet, width, 2, 2, i as u32),
                doc.composite_at(frame_id),
                "tile {i} matches its frame's composite"
            );
        }
    }

    #[test]
    fn spritesheet_excludes_hidden_layers_and_reference_layers_from_every_tile() {
        // Bottom Pixel Layer: opaque red painted on the first frame.
        let bottom = Uuid::new_v4();
        let mut doc = Document::new(1, 1, bottom, "Bottom".to_string()).unwrap();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap();
        // Top Pixel Layer: opaque green on the first frame, then hidden.
        let top = Uuid::new_v4();
        doc.add_layer(top, "Top".to_string());
        doc.set_pixel(0, 0, Color::new(0, 255, 0, 255)).unwrap();
        doc.set_layer_visibility(top, false).unwrap();
        // A visible Reference Layer holding opaque blue — a viewport underlay
        // that must never reach an exported tile.
        doc.add_reference_layer(
            Uuid::new_v4(),
            "Reference".to_string(),
            vec![0, 0, 255, 255],
            1,
            1,
        )
        .unwrap();
        // A second, empty frame: the exclusion rules must hold on every tile.
        doc.add_frame(Uuid::new_v4());

        let bytes = doc.encode_spritesheet_png().unwrap();

        let (width, height, sheet) = decode_png(&bytes);
        assert_eq!((width, height), (2, 1));
        // First tile: hidden green and Reference blue excluded — red only.
        assert_eq!(tile_pixels(&sheet, width, 1, 1, 0), vec![255, 0, 0, 255]);
        // Second tile: fully transparent, no Reference bleed.
        assert_eq!(tile_pixels(&sheet, width, 1, 1, 1), vec![0, 0, 0, 0]);
    }

    #[test]
    fn spritesheet_multiplies_layer_opacity_into_tile_alpha_like_the_composite() {
        use crate::layer::Layer;

        let id = Uuid::new_v4();
        let mut layer = Layer::new(id, "Half".to_string(), 1, 1).unwrap();
        layer.opacity = 0.5;
        let mut doc = Document::from_layers(1, 1, vec![layer], id, 2, false).unwrap();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap();

        let bytes = doc.encode_spritesheet_png().unwrap();

        let (_, _, sheet) = decode_png(&bytes);
        // src_a = 1.0 * 0.5 → alpha byte 128 — byte-for-byte the composite.
        assert_eq!(sheet, doc.composite());
        assert_eq!(sheet, vec![255, 0, 0, 128]);
    }

    #[test]
    fn spritesheet_encoding_is_a_pure_query_that_leaves_the_active_frame_untouched() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap(); // first frame
        doc.add_frame(Uuid::new_v4()); // second active and empty
        let active_before = doc.active_frame_id();
        let active_composite_before = doc.composite();

        // Encoding reads every frame, including non-active ones — it must not
        // move the pointer or disturb the active frame's composite.
        let _ = doc.encode_spritesheet_png().unwrap();

        assert_eq!(doc.active_frame_id(), active_before);
        assert_eq!(doc.composite(), active_composite_before);
    }

    #[test]
    fn spritesheet_single_frame_document_is_a_one_tile_sheet_identical_to_its_composite() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap();

        let bytes = doc.encode_spritesheet_png().unwrap();

        assert_eq!(&bytes[..8], &PNG_SIGNATURE);
        let (width, height, pixels) = decode_png(&bytes);
        assert_eq!((width, height), (2, 2));
        assert_eq!(pixels, doc.composite());
    }

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
        canvas.set_pixel(1, 0, Color::new(255, 0, 0, 255)).unwrap();

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
        canvas.set_pixel(0, 0, Color::new(255, 0, 0, 128)).unwrap();

        let svg = canvas.encode_svg().unwrap();

        assert!(svg.contains(r#"fill-opacity="0.502""#));
    }

    #[test]
    fn svg_transparent_pixels_omitted() {
        let mut canvas = PixelCanvas::new(2, 2).unwrap();
        // Only set one pixel; the other three remain transparent
        canvas.set_pixel(0, 0, Color::new(0, 0, 255, 255)).unwrap();

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
