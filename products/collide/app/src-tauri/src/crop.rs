//! T09: crop the held frozen frame to the box the user dragged on the overlay.
//!
//! Coordinate spaces: the overlay is fullscreen on the captured monitor, so the
//! incoming x/y/w/h are logical (CSS) px relative to the overlay window, i.e.
//! relative to the monitor's top-left. The held frame is monitor-local physical
//! px. So `physical = logical * scale`, and the monitor's virtual-desktop origin
//! (negative for monitors left of / above the primary) is NOT subtracted: the
//! incoming coordinates are never global. Passing global coordinates is a caller bug.

use std::fmt;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use image::{imageops, RgbaImage};
use serde::Serialize;
use tauri::State;

use crate::capture::{encode_png, CaptureError, CaptureState};

/// Box in logical px, relative to the overlay window (top-left origin).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LogicalRect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

/// Box in monitor-local physical px, already clamped to the frame.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PhysicalRect {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CropError {
    NoCapture,
    EmptyBox,
    OutsideFrame,
    InvalidInput,
    Encode(String),
    StateUnavailable,
}

impl fmt::Display for CropError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NoCapture => write!(f, "No capture to crop — start a new snip."),
            Self::EmptyBox => write!(f, "The selection has no width or height — drag a larger box and release again."),
            Self::OutsideFrame => write!(f, "The selection is outside the captured screen — drag a box over the screen and release again."),
            Self::InvalidInput => write!(f, "The selection or display scale is not a valid number — start a new snip."),
            Self::Encode(d) => write!(f, "Could not encode the cropped image as PNG — try again; if it repeats, restart Collide. ({d})"),
            Self::StateUnavailable => write!(f, "Capture state is locked by a failed earlier capture — restart Collide."),
        }
    }
}

impl std::error::Error for CropError {}

impl Serialize for CropError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

/// Snap values within float noise of an integer (e.g. 0.8 * 1.25 = 1.0000000000000002).
fn snap(v: f64) -> f64 {
    let r = v.round();
    if (v - r).abs() < 1e-6 { r } else { v }
}

/// Logical box -> physical box clamped to a `frame_w` x `frame_h` frame.
///
/// Rounding rule: scale first, then floor the near edges (x, y) and ceil the far
/// edges (x + w, y + h), so the crop never loses a partly-covered pixel. Edges are
/// derived from the scaled origin and far edge, not from a rounded width.
pub fn crop_rect(logical: LogicalRect, scale: f64, frame_w: u32, frame_h: u32) -> Result<PhysicalRect, CropError> {
    let LogicalRect { x, y, w, h } = logical;
    if ![x, y, w, h, scale].iter().all(|v| v.is_finite()) || scale <= 0.0 {
        return Err(CropError::InvalidInput);
    }
    if w <= 0.0 || h <= 0.0 {
        return Err(CropError::EmptyBox);
    }
    let (fw, fh) = (f64::from(frame_w), f64::from(frame_h));
    let x0 = snap(x * scale).floor().max(0.0);
    let y0 = snap(y * scale).floor().max(0.0);
    let x1 = snap((x + w) * scale).ceil().min(fw);
    let y1 = snap((y + h) * scale).ceil().min(fh);
    if x1 <= x0 || y1 <= y0 {
        return Err(CropError::OutsideFrame);
    }
    // All four are within 0..=frame size (u32), so the casts are exact.
    Ok(PhysicalRect { x: x0 as u32, y: y0 as u32, w: (x1 - x0) as u32, h: (y1 - y0) as u32 })
}

/// Result of a crop. `png` is a `data:image/png;base64,...` URL, as in `CaptureResult`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CropResult {
    pub width: u32,
    pub height: u32,
    pub png: String,
}

/// Crop the held frame. The frame stays held, so the user can crop again.
pub fn crop_from_state(state: &CaptureState, logical: LogicalRect, scale: f64) -> Result<CropResult, CropError> {
    let guard = state.0.lock().map_err(|_| CropError::StateUnavailable)?;
    let frame = guard.as_ref().ok_or(CropError::NoCapture)?;
    let r = crop_rect(logical, scale, frame.image.width(), frame.image.height())?;
    let cropped: RgbaImage = imageops::crop_imm(&frame.image, r.x, r.y, r.w, r.h).to_image();
    drop(guard);
    let png = encode_png(&cropped).map_err(|e| match e {
        CaptureError::EncodeFailed(d) => CropError::Encode(d),
        other => CropError::Encode(other.to_string()),
    })?;
    Ok(CropResult { width: r.w, height: r.h, png: format!("data:image/png;base64,{}", STANDARD.encode(png)) })
}

#[tauri::command]
pub fn crop_capture(state: State<'_, CaptureState>, x: f64, y: f64, w: f64, h: f64, scale: f64) -> Result<CropResult, CropError> {
    crop_from_state(state.inner(), LogicalRect { x, y, w, h }, scale)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capture::{capture_into, Capturer, Frame, MonitorInfo};
    use image::{ImageFormat, Rgba};

    fn lr(x: f64, y: f64, w: f64, h: f64) -> LogicalRect {
        LogicalRect { x, y, w, h }
    }
    fn pr(x: u32, y: u32, w: u32, h: u32) -> PhysicalRect {
        PhysicalRect { x, y, w, h }
    }

    #[test]
    fn integer_boxes_at_each_scale() {
        // 1920x1080 physical frame at each Windows scale.
        assert_eq!(crop_rect(lr(10.0, 20.0, 100.0, 50.0), 1.0, 1920, 1080), Ok(pr(10, 20, 100, 50)));
        assert_eq!(crop_rect(lr(8.0, 8.0, 80.0, 40.0), 1.25, 1920, 1080), Ok(pr(10, 10, 100, 50)));
        assert_eq!(crop_rect(lr(10.0, 20.0, 100.0, 50.0), 1.5, 1920, 1080), Ok(pr(15, 30, 150, 75)));
        assert_eq!(crop_rect(lr(10.0, 20.0, 100.0, 50.0), 2.0, 1920, 1080), Ok(pr(20, 40, 200, 100)));
    }

    #[test]
    fn fractional_logical_coords_round_outward() {
        // x 10.3..20.7 at 1.25 -> 12.875..25.875 -> 12..26
        assert_eq!(crop_rect(lr(10.3, 10.3, 10.4, 10.4), 1.25, 1920, 1080), Ok(pr(12, 12, 14, 14)));
        // 100% : 0.5..2.5 -> 0..3
        assert_eq!(crop_rect(lr(0.5, 0.5, 2.0, 2.0), 1.0, 100, 100), Ok(pr(0, 0, 3, 3)));
        // 150%: 3.3..6.7 -> 4.95..10.05 -> 4..11
        assert_eq!(crop_rect(lr(3.3, 3.3, 3.4, 3.4), 1.5, 100, 100), Ok(pr(4, 4, 7, 7)));
        // 200%: 0.25..0.75 -> 0.5..1.5 -> 0..2
        assert_eq!(crop_rect(lr(0.25, 0.25, 0.5, 0.5), 2.0, 100, 100), Ok(pr(0, 0, 2, 2)));
        // Float noise must not widen an exact box: 0.8*1.25 is 1.0000000000000002.
        assert_eq!(crop_rect(lr(0.8, 0.8, 0.8, 0.8), 1.25, 100, 100), Ok(pr(1, 1, 1, 1)));
        // A sub-pixel sliver still yields at least one pixel.
        assert_eq!(crop_rect(lr(5.1, 5.1, 0.01, 0.01), 1.0, 100, 100), Ok(pr(5, 5, 1, 1)));
    }

    #[test]
    fn zero_or_negative_size_is_an_error() {
        for (w, h) in [(0.0, 10.0), (10.0, 0.0), (0.0, 0.0), (-5.0, 10.0), (10.0, -5.0)] {
            assert_eq!(crop_rect(lr(1.0, 1.0, w, h), 1.0, 100, 100), Err(CropError::EmptyBox), "{w}x{h}");
        }
    }

    #[test]
    fn invalid_numbers_are_errors() {
        assert_eq!(crop_rect(lr(f64::NAN, 0.0, 1.0, 1.0), 1.0, 10, 10), Err(CropError::InvalidInput));
        assert_eq!(crop_rect(lr(0.0, 0.0, f64::INFINITY, 1.0), 1.0, 10, 10), Err(CropError::InvalidInput));
        assert_eq!(crop_rect(lr(0.0, 0.0, 1.0, 1.0), 0.0, 10, 10), Err(CropError::InvalidInput));
        assert_eq!(crop_rect(lr(0.0, 0.0, 1.0, 1.0), -1.0, 10, 10), Err(CropError::InvalidInput));
    }

    #[test]
    fn partially_outside_box_clamps() {
        assert_eq!(crop_rect(lr(-10.0, -10.0, 30.0, 30.0), 1.0, 100, 100), Ok(pr(0, 0, 20, 20)));
        assert_eq!(crop_rect(lr(90.0, 95.0, 30.0, 30.0), 1.0, 100, 100), Ok(pr(90, 95, 10, 5)));
        assert_eq!(crop_rect(lr(-1000.0, -1000.0, 5000.0, 5000.0), 2.0, 100, 80), Ok(pr(0, 0, 100, 80)));
    }

    #[test]
    fn fully_outside_box_errors() {
        for r in [lr(-30.0, 0.0, 30.0, 10.0), lr(100.0, 0.0, 10.0, 10.0), lr(0.0, 100.0, 10.0, 10.0), lr(0.0, -10.0, 10.0, 10.0), lr(500.0, 500.0, 10.0, 10.0)] {
            assert_eq!(crop_rect(r, 1.0, 100, 100), Err(CropError::OutsideFrame), "{r:?}");
        }
    }

    #[test]
    fn monitor_origin_does_not_affect_local_coordinates() {
        // Same overlay-relative box on monitors at (0,0), left of and above the primary:
        // the crop is identical because coordinates are monitor-local.
        let mut results = Vec::new();
        for (mx, my) in [(0, 0), (-1920, 0), (0, -1080), (-2560, -1440)] {
            let state = CaptureState::default();
            let monitor = MonitorInfo { x: mx, y: my, width: 40, height: 30, scale_factor: 1.0 };
            *state.0.lock().unwrap() = Some(Frame { image: marked_frame(40, 30), monitor });
            let r = crop_from_state(&state, lr(5.0, 6.0, 10.0, 8.0), 1.0).unwrap();
            results.push(decode(&r.png));
        }
        assert!(results.windows(2).all(|p| p[0] == p[1]));
        assert_eq!(results[0].dimensions(), (10, 8));
    }

    /// Each pixel encodes its own coordinates: r = x, g = y, b = 7.
    fn marked_frame(w: u32, h: u32) -> RgbaImage {
        RgbaImage::from_fn(w, h, |x, y| Rgba([x as u8, y as u8, 7, 255]))
    }

    fn decode(data_url: &str) -> RgbaImage {
        let b64 = data_url.strip_prefix("data:image/png;base64,").expect("data URL");
        let bytes = STANDARD.decode(b64).expect("base64");
        image::load_from_memory_with_format(&bytes, ImageFormat::Png).expect("png decodes").to_rgba8()
    }

    #[test]
    fn no_capture_held_errors_with_fix() {
        let state = CaptureState::default();
        let err = crop_from_state(&state, lr(0.0, 0.0, 10.0, 10.0), 1.0).unwrap_err();
        assert_eq!(err, CropError::NoCapture);
        assert_eq!(err.to_string(), "No capture to crop — start a new snip.");
        assert!(serde_json::to_value(&err).unwrap().as_str().unwrap().contains("start a new snip"));
    }

    struct FakeCap(u32, u32, MonitorInfo);
    impl Capturer for FakeCap {
        fn capture_at(&self, _x: i32, _y: i32) -> Result<Frame, CaptureError> {
            Ok(Frame { image: marked_frame(self.0, self.1), monitor: self.2 })
        }
    }

    #[test]
    fn end_to_end_capture_then_crop_takes_pixels_from_the_right_region() {
        // 150% monitor, left of and above the primary; frame is 90x60 physical (60x40 logical).
        let monitor = MonitorInfo { x: -90, y: -60, width: 90, height: 60, scale_factor: 1.5 };
        let state = CaptureState::default();
        capture_into(&FakeCap(90, 60, monitor), &state, (-10, -10)).unwrap();

        // Logical 10,8 size 20x10 -> physical 15..45 x 12..27 -> 30x15 at (15,12).
        let r = crop_from_state(&state, lr(10.0, 8.0, 20.0, 10.0), 1.5).unwrap();
        assert_eq!((r.width, r.height), (30, 15));
        let img = decode(&r.png);
        assert_eq!(img.dimensions(), (30, 15));
        for (px, py, p) in img.enumerate_pixels() {
            assert_eq!(p.0, [(15 + px) as u8, (12 + py) as u8, 7, 255], "pixel {px},{py}");
        }

        // Partly outside: clamped, still from the right region; frame stays held for a re-crop.
        let r = crop_from_state(&state, lr(50.0, 30.0, 40.0, 40.0), 1.5).unwrap();
        assert_eq!((r.width, r.height), (15, 15));
        let img = decode(&r.png);
        assert_eq!(img.get_pixel(0, 0).0, [75, 45, 7, 255]);
        assert_eq!(img.get_pixel(14, 14).0, [89, 59, 7, 255]);
    }
}
