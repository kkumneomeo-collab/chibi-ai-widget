// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
fn get_companion_status() -> String {
    "ready".to_string()
}

#[tauri::command]
fn set_window_size(app_handle: tauri::AppHandle, width: f64, height: f64) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }));
    }
}

#[tauri::command]
fn set_always_on_top(app_handle: tauri::AppHandle, always_on_top: bool) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.set_always_on_top(always_on_top);
    }
}

#[tauri::command]
fn minimize_window(app_handle: tauri::AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.minimize();
    }
}

#[tauri::command]
fn close_window(app_handle: tauri::AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.close();
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_companion_status,
            set_window_size,
            set_always_on_top,
            minimize_window,
            close_window
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                // Ensure always on top and transparent window support on macOS
                let _ = window.set_always_on_top(true);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

