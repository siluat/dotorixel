#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct MarqueeRegion {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

impl MarqueeRegion {
    pub fn from_drag(x0: i32, y0: i32, x1: i32, y1: i32) -> Self {
        let min_x = x0.min(x1);
        let max_x = x0.max(x1);
        let min_y = y0.min(y1);
        let max_y = y0.max(y1);

        Self {
            x: min_x,
            y: min_y,
            width: (max_x - min_x + 1) as u32,
            height: (max_y - min_y + 1) as u32,
        }
    }

    pub fn x(&self) -> i32 {
        self.x
    }

    pub fn y(&self) -> i32 {
        self.y
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn contains(&self, x: i32, y: i32) -> bool {
        x >= self.x
            && y >= self.y
            && x < self.x + self.width as i32
            && y < self.y + self.height as i32
    }

    pub fn translate(&self, dx: i32, dy: i32) -> Self {
        Self {
            x: self.x + dx,
            y: self.y + dy,
            width: self.width,
            height: self.height,
        }
    }

    pub fn clip_to(&self, canvas_w: u32, canvas_h: u32) -> Option<Self> {
        let left = self.x.max(0);
        let top = self.y.max(0);
        let right = (self.x + self.width as i32).min(canvas_w as i32);
        let bottom = (self.y + self.height as i32).min(canvas_h as i32);

        if left >= right || top >= bottom {
            return None;
        }

        Some(Self {
            x: left,
            y: top,
            width: (right - left) as u32,
            height: (bottom - top) as u32,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::MarqueeRegion;

    #[test]
    fn from_drag_normalizes_drag_direction_to_inclusive_region() {
        let region = MarqueeRegion::from_drag(5, 7, 2, 3);

        assert_eq!(region.x(), 2);
        assert_eq!(region.y(), 3);
        assert_eq!(region.width(), 4);
        assert_eq!(region.height(), 5);
    }

    #[test]
    fn contains_includes_only_pixels_inside_the_region() {
        let region = MarqueeRegion::from_drag(2, 3, 5, 7);

        assert!(region.contains(2, 3));
        assert!(region.contains(5, 7));
        assert!(!region.contains(1, 3));
        assert!(!region.contains(6, 7));
        assert!(!region.contains(5, 8));
    }

    #[test]
    fn translate_moves_origin_and_preserves_size() {
        let region = MarqueeRegion::from_drag(2, 3, 5, 7).translate(-4, 6);

        assert_eq!(region.x(), -2);
        assert_eq!(region.y(), 9);
        assert_eq!(region.width(), 4);
        assert_eq!(region.height(), 5);
    }

    #[test]
    fn clip_to_canvas_returns_only_the_in_bounds_region() {
        let clipped = MarqueeRegion::from_drag(-2, 1, 3, 6)
            .clip_to(4, 4)
            .expect("region overlaps the canvas");

        assert_eq!(clipped.x(), 0);
        assert_eq!(clipped.y(), 1);
        assert_eq!(clipped.width(), 4);
        assert_eq!(clipped.height(), 3);
    }

    #[test]
    fn clip_to_canvas_returns_none_when_region_does_not_overlap() {
        assert_eq!(MarqueeRegion::from_drag(-4, 1, -1, 3).clip_to(4, 4), None);
        assert_eq!(MarqueeRegion::from_drag(1, 4, 3, 7).clip_to(4, 4), None);
    }

    #[test]
    fn from_drag_keeps_degenerate_input_as_one_pixel_region() {
        let region = MarqueeRegion::from_drag(3, 5, 3, 5);

        assert_eq!(region.x(), 3);
        assert_eq!(region.y(), 5);
        assert_eq!(region.width(), 1);
        assert_eq!(region.height(), 1);
        assert!(region.contains(3, 5));
    }
}
