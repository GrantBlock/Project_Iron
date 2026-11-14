//! T08: capture the monitor under the cursor and hold the frozen frame in app state.
//!
//! Capture sits behind the [`Capturer`] trait so tests run headless; the real
//! implementation uses `xcap`.

use std::fmt;
use std::sync::Mutex;

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use image::{ImageFormat, RgbaImage};
use serde::Serialize;
use tauri::{AppHandle, State};

/// Geometry of a monitor in virtual-desktop physical pixels (origin may be negative).
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct MonitorInfo {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f32,
}

/// The frozen frame plus the monitor it came from.
pub struct Frame {
    pub image: RgbaImage,
    pub monitor: MonitorInfo,
}

/// Managed state: `None` until a capture succeeds; a failed capture leaves it untouched.
#[derive(Default)]
pub struct CaptureState(pub Mutex<Option<Frame>>);

#[derive(Debug, Clone, PartialEq)]
pub enum CaptureError {
    CursorUnavailable,
    NoMonitor,
    CaptureFailed(String),
    EncodeFailed(String),
    StateUnavailable,
}

impl fmt::Display for CaptureError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CursorUnavailable => write!(f, "Could not read the cursor position — move the mouse and try again."),
            Self::NoMonitor => write!(f, "No monitor found under the cursor — check your display setup and try again."),
            Self::CaptureFailed(d) => write!(f, "Screen capture failed — check screen recording permission and try again. ({d})"),
            Self::EncodeFailed(d) => write!(f, "Could not encode the captured frame as PNG — try again; if it repeats, restart Collide. ({d})"),
            Self::StateUnavailable => write!(f, "Capture state is locked by a failed earlier capture — restart Collide."),
        }
    }
}

impl std::error::Error for CaptureError {}

impl Serialize for CaptureError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

/// Source of frames. Real: [`XcapCapturer`]. Tests use fakes.
pub trait Capturer {
    /// Capture the monitor containing the physical point `(x, y)`.
    fn capture_at(&self, x: i32, y: i32) -> Result<Frame, CaptureError>;
}

/// Pure monitor selection: index of the monitor containing the point, if any.
/// Handles negative origins (monitors left of / above the primary).
pub fn select_monitor(x: i32, y: i32, monitors: &[MonitorInfo]) -> Option<usize> {
    let (px, py) = (i64::from(x), i64::from(y));
    monitors.iter().position(|m| {
        let (mx, my) = (i64::from(m.x), i64::from(m.y));
        px >= mx && px < mx + i64::from(m.width) && py >= my && py < my + i64::from(m.height)
    })
}

pub struct XcapCapturer;

impl Capturer for XcapCapturer {
    fn capture_at(&self, x: i32, y: i32) -> Result<Frame, CaptureError> {
        let fail = |e: xcap::XCapError| CaptureError::CaptureFailed(e.to_string());
        let mon = xcap::Monitor::from_point(x, y).map_err(|_| CaptureError::NoMonitor)?;
        let monitor = MonitorInfo {
            x: mon.x().map_err(fail)?,
            y: mon.y().map_err(fail)?,
            width: mon.width().map_err(fail)?,
            height: mon.height().map_err(fail)?,
            scale_factor: mon.scale_factor().map_err(fail)?,
        };
        let image = mon.capture_image().map_err(fail)?;
        Ok(Frame { image, monitor })
    }
}

/// Command result. `png` is a `data:image/png;base64,...` URL (A: fine for Phase 2;
/// a 4K frame is a few MB of base64).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureResult {
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub scale_factor: f32,
    pub png: String,
}

pub fn encode_png(image: &RgbaImage) -> Result<Vec<u8>, CaptureError> {
    let mut buf = std::io::Cursor::new(Vec::new());
    image
        .write_to(&mut buf, ImageFormat::Png)
        .map_err(|e| CaptureError::EncodeFailed(e.to_string()))?;
    Ok(buf.into_inner())
}

/// Capture, store in state, and build the result. State changes only on full success.
pub fn capture_into(
    capturer: &dyn Capturer,
    state: &CaptureState,
    cursor: (i32, i32),
) -> Result<CaptureResult, CaptureError> {
    let frame = capturer.capture_at(cursor.0, cursor.1)?;
    let png = encode_png(&frame.image)?;
    let m = frame.monitor;
    let result = CaptureResult {
        width: m.width,
        height: m.height,
        x: m.x,
        y: m.y,
        scale_factor: m.scale_factor,
        png: format!("data:image/png;base64,{}", STANDARD.encode(png)),
    };
    *state.0.lock().map_err(|_| CaptureError::StateUnavailable)? = Some(frame);
    Ok(result)
}

#[tauri::command]
pub fn capture_monitor(app: AppHandle, state: State<'_, CaptureState>) -> Result<CaptureResult, CaptureError> {
    let pos = app.cursor_position().map_err(|_| CaptureError::CursorUnavailable)?;
    capture_into(&XcapCapturer, state.inner(), (pos.x.round() as i32, pos.y.round() as i32))
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fake(Result<(u32, u32, MonitorInfo), CaptureError>);

    impl Capturer for Fake {
        fn capture_at(&self, _x: i32, _y: i32) -> Result<Frame, CaptureError> {
            match &self.0 {
                Ok((w, h, m)) => Ok(Frame { image: RgbaImage::new(*w, *h), monitor: *m }),
                Err(e) => Err(e.clone()),
            }
        }
    }

    fn mon(x: i32, y: i32, width: u32, height: u32) -> MonitorInfo {
        MonitorInfo { x, y, width, height, scale_factor: 1.5 }
    }

    #[test]
    fn success_returns_png_of_monitor_size_and_stores_frame() {
        let m = mon(-1920, 0, 64, 48);
        let state = CaptureState::default();
        let r = capture_into(&Fake(Ok((64, 48, m))), &state, (-10, 5)).expect("capture ok");
        assert_eq!((r.width, r.height, r.x, r.y, r.scale_factor), (64, 48, -1920, 0, 1.5));
        let b64 = r.png.strip_prefix("data:image/png;base64,").expect("data URL");
        let bytes = STANDARD.decode(b64).expect("base64");
        let img = image::load_from_memory_with_format(&bytes, ImageFormat::Png).expect("png decodes");
        assert_eq!((img.width(), img.height()), (64, 48));
        let held = state.0.lock().unwrap();
        let f = held.as_ref().expect("frame stored");
        assert_eq!(f.monitor, m);
        assert_eq!((f.image.width(), f.image.height()), (64, 48));
    }

    #[test]
    fn failure_returns_typed_error_and_leaves_state_unchanged() {
        let state = CaptureState::default();
        let old = mon(0, 0, 8, 8);
        *state.0.lock().unwrap() = Some(Frame { image: RgbaImage::new(8, 8), monitor: old });
        let err = capture_into(&Fake(Err(CaptureError::CaptureFailed("denied".into()))), &state, (0, 0)).unwrap_err();
        assert_eq!(err, CaptureError::CaptureFailed("denied".into()));
        let msg = err.to_string();
        assert!(msg.contains("failed") && msg.contains("check screen recording permission"), "{msg}");
        assert_eq!(state.0.lock().unwrap().as_ref().unwrap().monitor, old);
        // Empty state stays empty too.
        let empty = CaptureState::default();
        assert!(capture_into(&Fake(Err(CaptureError::NoMonitor)), &empty, (0, 0)).is_err());
        assert!(empty.0.lock().unwrap().is_none());
    }

    #[test]
    fn error_serializes_to_cause_and_fix_message() {
        let v = serde_json::to_value(CaptureError::NoMonitor).unwrap();
        assert!(v.as_str().unwrap().contains("try again"));
    }

    #[test]
    fn select_monitor_across_several_with_negative_origins() {
        let ms = [mon(0, 0, 1920, 1080), mon(-1280, -200, 1280, 1024), mon(1920, 0, 2560, 1440)];
        assert_eq!(select_monitor(10, 10, &ms), Some(0));
        assert_eq!(select_monitor(-1, 0, &ms), Some(1));
        assert_eq!(select_monitor(-1280, -200, &ms), Some(1));
        assert_eq!(select_monitor(-1281, 0, &ms), None);
        assert_eq!(select_monitor(1919, 1079, &ms), Some(0));
        assert_eq!(select_monitor(1920, 0, &ms), Some(2));
        assert_eq!(select_monitor(4479, 1439, &ms), Some(2));
        assert_eq!(select_monitor(4480, 0, &ms), None);
        assert_eq!(select_monitor(0, 0, &[]), None);
    }
}
