//! T11: window choreography for a snip. The JS orchestrator (`src/snip/flow.ts`)
//! decides the order; these commands only move windows.

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

const EDITOR: &str = "main";
const OVERLAY: &str = "overlay";

fn win(app: &AppHandle, label: &str) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window(label)
        .ok_or_else(|| format!("The {label} window is missing — restart Collide."))
}

fn msg(what: &str, e: tauri::Error) -> String {
    format!("Could not {what} ({e}) — restart Collide and try again.")
}

#[tauri::command]
pub fn hide_editor(app: AppHandle) -> Result<(), String> {
    win(&app, EDITOR)?.hide().map_err(|e| msg("hide the editor", e))
}

#[tauri::command]
pub fn show_editor(app: AppHandle) -> Result<(), String> {
    let w = win(&app, EDITOR)?;
    let _ = w.unminimize();
    w.show().map_err(|e| msg("show the editor", e))?;
    w.set_focus().map_err(|e| msg("focus the editor", e))
}

/// Size and place the overlay on the captured monitor (virtual-desktop physical px), then show and focus it.
#[tauri::command]
pub fn show_overlay(app: AppHandle, x: i32, y: i32, width: u32, height: u32) -> Result<(), String> {
    let w = win(&app, OVERLAY)?;
    // Not OS-fullscreen: that would pick the monitor the window is on, not the captured one.
    w.set_fullscreen(false).map_err(|e| msg("prepare the overlay", e))?;
    w.set_position(PhysicalPosition::new(x, y)).map_err(|e| msg("position the overlay", e))?;
    w.set_size(PhysicalSize::new(width, height)).map_err(|e| msg("size the overlay", e))?;
    w.show().map_err(|e| msg("show the overlay", e))?;
    w.set_focus().map_err(|e| msg("focus the overlay", e))
}

#[tauri::command]
pub fn hide_overlay(app: AppHandle) -> Result<(), String> {
    win(&app, OVERLAY)?.hide().map_err(|e| msg("hide the overlay", e))
}
