use std::fmt;
use std::fmt::Write as _;
use std::io::Cursor;

use crate::canvas::PixelCanvas;
use crate::document::Document;

#[derive(Debug)]
pub enum ExportError {
    PngEncode {
        message: String,
    },
    GifEncode {
        message: String,
    },
    SheetTooLarge {
        width: u32,
        height: u32,
        frame_count: usize,
    },
}

impl fmt::Display for ExportError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::PngEncode { message } => write!(f, "PNG encoding failed: {message}"),
            Self::GifEncode { message } => write!(f, "GIF encoding failed: {message}"),
            Self::SheetTooLarge {
                width,
                height,
                frame_count,
            } => write!(
                f,
                "spritesheet too large: {frame_count} frames of {width}x{height} pixels exceed the maximum encodable sheet size"
            ),
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
    /// Returns [`ExportError::SheetTooLarge`] when `width × frame count`
    /// (or the resulting byte size) overflows the encodable sheet size, and
    /// [`ExportError::PngEncode`] when the underlying PNG encoder fails.
    fn encode_spritesheet_png(&self) -> Result<Vec<u8>, ExportError>;
}

impl SpritesheetExport for Document {
    fn encode_spritesheet_png(&self) -> Result<Vec<u8>, ExportError> {
        let (width, height) = (self.width(), self.height());
        let frame_count = self.frames().len();
        // Canvas dimensions are constructor-validated and small, but the
        // frame axis is unbounded: checked math turns an absurd frame count
        // into a deterministic error instead of a wrapping allocation size
        // followed by a copy panic (usize is 32-bit on wasm32).
        let too_large = || ExportError::SheetTooLarge {
            width,
            height,
            frame_count,
        };
        let sheet_width: u32 = (width as u64)
            .checked_mul(frame_count as u64)
            .and_then(|w| w.try_into().ok())
            .ok_or_else(too_large)?;
        let sheet_bytes: usize = (sheet_width as u64 * height as u64)
            .checked_mul(4)
            .and_then(|b| b.try_into().ok())
            .ok_or_else(too_large)?;

        let tile_row_bytes = width as usize * 4;
        // Fits usize: sheet_bytes = sheet_row_bytes × height with height ≥ 1.
        let sheet_row_bytes = sheet_width as usize * 4;

        let mut sheet = vec![0u8; sheet_bytes];
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

pub trait GifExport {
    /// Encodes every Frame's composite as an animated GIF: frames in axis
    /// order, each a full-canvas image disposing to background (transparent
    /// regions never ghost an earlier frame), looping forever via the
    /// standard looping extension.
    ///
    /// Each frame's delay is its `duration_ms` quantized to GIF's native
    /// centisecond unit, round-to-nearest with a 1 cs floor. Transparency is
    /// binary at the alpha-128 threshold: composite alpha ≥ 128 is opaque,
    /// below is transparent. Palettes are per-frame with an exactness
    /// guarantee — when a frame's unique opaque colors fit the palette (one
    /// index reserved for transparency when needed), colors are preserved
    /// exactly; only overflow frames fall back to quantization.
    ///
    /// A pure query reading through [`Document::composite_at`] — the Active
    /// Frame is neither consulted nor moved. Compositing matches Playback:
    /// visible Pixel Layers blended with their opacity; hidden layers and
    /// Reference Layers excluded.
    ///
    /// Returns [`ExportError::GifEncode`] when the underlying GIF encoder
    /// fails.
    fn encode_gif(&self) -> Result<Vec<u8>, ExportError>;
}

/// Composite alpha at or above this encodes as opaque in GIF's 1-bit
/// transparency; anything below encodes as fully transparent.
const GIF_OPAQUE_ALPHA_THRESHOLD: u8 = 128;

impl GifExport for Document {
    fn encode_gif(&self) -> Result<Vec<u8>, ExportError> {
        // Canvas dimensions are constructor-validated to MAX_DIMENSION (256),
        // so they always fit GIF's u16 fields.
        let width = self.width() as u16;
        let height = self.height() as u16;
        let gif_error = |e: gif::EncodingError| ExportError::GifEncode {
            message: e.to_string(),
        };

        let mut buf = Vec::new();
        {
            let mut encoder = gif::Encoder::new(&mut buf, width, height, &[]).map_err(gif_error)?;
            encoder
                .set_repeat(gif::Repeat::Infinite)
                .map_err(gif_error)?;
            for frame in self.frames() {
                let mut rgba = self.composite_at(frame.id);
                // Opaque pixels are forced to alpha 255 up front (the encoder
                // treats any non-zero alpha as opaque, so RGB alone must
                // distinguish palette entries); sub-threshold pixels zero out
                // entirely so every transparent pixel maps to one
                // deterministic palette entry. `from_rgba` then builds an
                // exact per-frame palette whenever the unique colors fit,
                // quantizing only on overflow.
                for px in rgba.chunks_exact_mut(4) {
                    if px[3] >= GIF_OPAQUE_ALPHA_THRESHOLD {
                        px[3] = 255;
                    } else {
                        px.fill(0);
                    }
                }
                let mut gif_frame = gif::Frame::from_rgba(width, height, &mut rgba);
                gif_frame.delay = centisecond_delay(frame.duration_ms);
                // Full-canvas frames that dispose to background: each frame
                // fully replaces the previous one, so transparent regions
                // never ghost.
                gif_frame.dispose = gif::DisposalMethod::Background;
                encoder.write_frame(&gif_frame).map_err(gif_error)?;
            }
        }
        Ok(buf)
    }
}

/// Quantizes a frame duration to GIF's native centisecond delay unit:
/// round-to-nearest (half up) with a 1 cs floor, saturating at the field's
/// `u16` ceiling (the shell-enforced 60 000 ms maximum sits well below it).
fn centisecond_delay(duration_ms: u32) -> u16 {
    let centiseconds = (u64::from(duration_ms) + 5) / 10;
    centiseconds.clamp(1, u64::from(u16::MAX)) as u16
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

    /// Opens a decoder over encoded GIF bytes with RGBA color output, so
    /// frame buffers decode straight into composite-comparable pixels.
    fn rgba_gif_decoder(bytes: &[u8]) -> gif::Decoder<Cursor<&[u8]>> {
        let mut options = gif::DecodeOptions::new();
        options.set_color_output(gif::ColorOutput::RGBA);
        options.read_info(Cursor::new(bytes)).unwrap()
    }

    #[test]
    fn gif_encodes_every_frame_in_axis_order() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        let first = doc.active_frame_id();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap(); // red on the first frame
        let second = Uuid::new_v4();
        doc.add_frame(second); // second active and empty
        doc.set_pixel(1, 0, Color::new(0, 255, 0, 255)).unwrap(); // green on the second frame
        let third = Uuid::new_v4();
        doc.add_frame(third); // third active and empty
        doc.set_pixel(1, 1, Color::new(0, 0, 255, 255)).unwrap(); // blue on the third frame

        let bytes = doc.encode_gif().unwrap();

        let mut decoder = rgba_gif_decoder(&bytes);
        for (i, frame_id) in [first, second, third].into_iter().enumerate() {
            let frame = decoder.read_next_frame().unwrap().expect("frame present");
            assert_eq!(
                frame.buffer.as_ref(),
                doc.composite_at(frame_id).as_slice(),
                "GIF frame {i} matches its Frame's composite in axis order"
            );
        }
        assert!(decoder.read_next_frame().unwrap().is_none());
    }

    #[test]
    fn gif_quantizes_each_frame_duration_to_centiseconds_round_to_nearest_with_a_floor() {
        let mut doc = Document::new(1, 1, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        // (duration_ms, expected delay in centiseconds): round-to-nearest
        // (half up), the 1 cs floor, and the 60 000 ms maximum duration.
        let cases: [(u32, u16); 5] = [(83, 8), (85, 9), (4, 1), (100, 10), (60_000, 6_000)];
        let (first_ms, _) = cases[0];
        doc.set_frame_duration(doc.active_frame_id(), first_ms)
            .unwrap();
        for &(ms, _) in &cases[1..] {
            let id = Uuid::new_v4();
            doc.add_frame(id);
            doc.set_frame_duration(id, ms).unwrap();
        }

        let bytes = doc.encode_gif().unwrap();

        let mut decoder = rgba_gif_decoder(&bytes);
        for (ms, expected_cs) in cases {
            let frame = decoder.read_next_frame().unwrap().expect("frame present");
            assert_eq!(
                frame.delay, expected_cs,
                "{ms} ms quantizes to {expected_cs} cs"
            );
        }
    }

    #[test]
    fn gif_always_carries_the_infinite_loop_extension() {
        let doc = Document::new(1, 1, Uuid::new_v4(), "Layer 1".to_string()).unwrap();

        let bytes = doc.encode_gif().unwrap();

        // Looping is not configurable: every export loops forever via the
        // standard (NETSCAPE) looping extension.
        let decoder = rgba_gif_decoder(&bytes);
        assert_eq!(decoder.repeat(), gif::Repeat::Infinite);
    }

    #[test]
    fn gif_preserves_colors_exactly_when_a_frames_unique_colors_fit_the_palette() {
        let mut doc = Document::new(16, 16, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        // 255 unique opaque colors in adjacent shades a quantizer would blur,
        // plus one transparent pixel: exactly fills the 256-entry palette with
        // one index reserved for transparency — the exactness boundary.
        for i in 0..255u32 {
            let (x, y) = ((i + 1) % 16, (i + 1) / 16); // pixel (0,0) stays transparent
            let color = Color::new(100 + (i % 5) as u8, (i / 5) as u8, 200, 255);
            doc.set_pixel(x, y, color).unwrap();
        }

        let bytes = doc.encode_gif().unwrap();

        let mut decoder = rgba_gif_decoder(&bytes);
        let frame = decoder.read_next_frame().unwrap().unwrap();
        assert_eq!(frame.buffer.as_ref(), doc.composite().as_slice());
    }

    #[test]
    fn gif_binarizes_transparency_at_the_alpha_128_threshold() {
        let mut doc = Document::new(2, 1, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 128)).unwrap(); // at the threshold → opaque
        doc.set_pixel(1, 0, Color::new(0, 255, 0, 127)).unwrap(); // below → transparent

        let bytes = doc.encode_gif().unwrap();

        let mut decoder = rgba_gif_decoder(&bytes);
        let frame = decoder.read_next_frame().unwrap().unwrap();
        assert_eq!(
            &frame.buffer[0..4],
            &[255, 0, 0, 255],
            "alpha 128 is opaque"
        );
        assert_eq!(
            &frame.buffer[4..8],
            &[0, 0, 0, 0],
            "alpha 127 is transparent"
        );
    }

    #[test]
    fn gif_excludes_hidden_layers_and_reference_layers_from_every_frame() {
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
        // that must never reach an exported frame.
        doc.add_reference_layer(
            Uuid::new_v4(),
            "Reference".to_string(),
            vec![0, 0, 255, 255],
            1,
            1,
        )
        .unwrap();
        // A second, empty frame: the exclusion rules must hold on every frame.
        doc.add_frame(Uuid::new_v4());

        let bytes = doc.encode_gif().unwrap();

        let mut decoder = rgba_gif_decoder(&bytes);
        // First frame: hidden green and Reference blue excluded — red only.
        let first = decoder.read_next_frame().unwrap().unwrap();
        assert_eq!(first.buffer.as_ref(), &[255, 0, 0, 255]);
        // Second frame: fully transparent, no Reference bleed.
        let second = decoder.read_next_frame().unwrap().unwrap();
        assert_eq!(second.buffer.as_ref(), &[0, 0, 0, 0]);
    }

    #[test]
    fn gif_multiplies_layer_opacity_into_alpha_before_the_transparency_threshold() {
        use crate::layer::Layer;

        // Two layers painting disjoint pixels: opacity 0.5 lands its pixel
        // exactly at the alpha-128 threshold (opaque), 0.25 lands below it
        // (transparent) — the same blend the composite produces.
        let half = Uuid::new_v4();
        let mut half_layer = Layer::new(half, "Half".to_string(), 2, 1).unwrap();
        half_layer.opacity = 0.5;
        let quarter = Uuid::new_v4();
        let mut quarter_layer = Layer::new(quarter, "Quarter".to_string(), 2, 1).unwrap();
        quarter_layer.opacity = 0.25;
        let mut doc =
            Document::from_layers(2, 1, vec![half_layer, quarter_layer], half, 2, false).unwrap();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap();
        doc.set_active_layer(quarter).unwrap();
        doc.set_pixel(1, 0, Color::new(0, 255, 0, 255)).unwrap();
        // The composite itself carries the blended alphas this GIF binarizes.
        assert_eq!(doc.composite(), vec![255, 0, 0, 128, 0, 255, 0, 64]);

        let bytes = doc.encode_gif().unwrap();

        let mut decoder = rgba_gif_decoder(&bytes);
        let frame = decoder.read_next_frame().unwrap().unwrap();
        assert_eq!(
            &frame.buffer[0..4],
            &[255, 0, 0, 255],
            "opacity 0.5 → alpha 128 → opaque"
        );
        assert_eq!(
            &frame.buffer[4..8],
            &[0, 0, 0, 0],
            "opacity 0.25 → alpha 64 → transparent"
        );
    }

    #[test]
    fn gif_transparent_regions_never_ghost_the_previous_frame() {
        let mut doc = Document::new(1, 1, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap(); // opaque first frame
        doc.add_frame(Uuid::new_v4()); // fully transparent second frame

        let bytes = doc.encode_gif().unwrap();

        // Ghosting is decided by the on-wire frame geometry + disposal a
        // viewer consumes: every frame must be full-canvas and dispose to
        // background, so a transparent pixel shows the page background —
        // never a leftover from an earlier frame.
        let mut decoder = rgba_gif_decoder(&bytes);
        while let Some(frame) = decoder.read_next_frame().unwrap() {
            assert_eq!(frame.dispose, gif::DisposalMethod::Background);
            assert_eq!(
                (frame.top, frame.left, frame.width, frame.height),
                (0, 0, 1, 1),
                "every frame is a full-canvas image"
            );
        }
    }

    #[test]
    fn gif_quantization_fallback_keeps_the_transparency_contract() {
        let mut doc = Document::new(17, 16, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        // Pixel (0,0) stays transparent while the remaining 271 pixels take
        // unique opaque colors — past the palette limit, so the reserved
        // transparent index must be assigned inside the quantization
        // fallback. This combination leans on the encoder crate's internals
        // (alpha-aware color learning + nearest-index mapping), the kind of
        // dependency a crate upgrade could silently regress.
        for i in 0..271u32 {
            let n = i + 1;
            let (x, y) = (n % 17, n / 17);
            let color = Color::new((i % 256) as u8, (i / 256 * 90 + 30) as u8, 10, 255);
            doc.set_pixel(x, y, color).unwrap();
        }

        let bytes = doc.encode_gif().unwrap();

        let mut decoder = rgba_gif_decoder(&bytes);
        let frame = decoder.read_next_frame().unwrap().unwrap();
        let alpha_of = |i: usize| frame.buffer[i * 4 + 3];
        assert_eq!(
            alpha_of(0),
            0,
            "the transparent pixel survives quantization as transparent"
        );
        let opaque_count = (1..272).filter(|&i| alpha_of(i) == 255).count();
        assert_eq!(
            opaque_count, 271,
            "no opaque pixel is swallowed by the transparent index"
        );
    }

    #[test]
    fn gif_frame_exceeding_the_palette_limit_still_encodes_via_quantization() {
        let mut doc = Document::new(17, 16, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        // 272 unique opaque colors — no 256-entry palette can hold them, so
        // this frame must take the quantization fallback instead of erroring.
        for i in 0..272u32 {
            let (x, y) = (i % 17, i / 17);
            let color = Color::new((i % 256) as u8, (i / 256 * 90) as u8, 0, 255);
            doc.set_pixel(x, y, color).unwrap();
        }

        let bytes = doc.encode_gif().unwrap();

        // Quantization approximates colors, so pin what survives it: a valid
        // one-frame GIF whose pixels all stay opaque.
        let mut decoder = rgba_gif_decoder(&bytes);
        let frame = decoder.read_next_frame().unwrap().unwrap();
        assert_eq!((frame.width, frame.height), (17, 16));
        assert!(frame.buffer.chunks_exact(4).all(|px| px[3] == 255));
        assert!(decoder.read_next_frame().unwrap().is_none());
    }

    #[test]
    fn gif_encoding_is_a_pure_query_that_leaves_the_active_frame_untouched() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap(); // first frame
        doc.add_frame(Uuid::new_v4()); // second active and empty
        let active_before = doc.active_frame_id();
        let active_composite_before = doc.composite();

        // Encoding reads every frame, including non-active ones — it must not
        // move the pointer or disturb the active frame's composite.
        let _ = doc.encode_gif().unwrap();

        assert_eq!(doc.active_frame_id(), active_before);
        assert_eq!(doc.composite(), active_composite_before);
    }

    #[test]
    fn gif_single_frame_document_is_a_valid_one_frame_gif_matching_its_composite() {
        let mut doc = Document::new(2, 2, Uuid::new_v4(), "Layer 1".to_string()).unwrap();
        doc.set_pixel(0, 0, Color::new(255, 0, 0, 255)).unwrap();

        let bytes = doc.encode_gif().unwrap();

        assert_eq!(&bytes[..6], b"GIF89a");
        let mut decoder = rgba_gif_decoder(&bytes);
        let frame = decoder.read_next_frame().unwrap().unwrap();
        assert_eq!((frame.width, frame.height), (2, 2));
        assert_eq!(frame.buffer.as_ref(), doc.composite().as_slice());
        assert!(
            decoder.read_next_frame().unwrap().is_none(),
            "a single-frame Document encodes exactly one GIF frame"
        );
    }

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

    // The SheetTooLarge branch itself is unreachable through the public API: a
    // document big enough to overflow the checked sheet math cannot be
    // constructed in test memory. The actionable message is what remains
    // observable, so that is what gets pinned.
    #[test]
    fn sheet_too_large_error_names_the_offending_dimensions() {
        let err = ExportError::SheetTooLarge {
            width: 256,
            height: 1,
            frame_count: 20_000_000,
        };

        let message = err.to_string();

        assert!(message.contains("20000000 frames"));
        assert!(message.contains("256x1"));
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
