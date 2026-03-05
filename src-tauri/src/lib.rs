#![allow(unexpected_cfgs)]

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_sql::Builder::default().build())

        .invoke_handler(tauri::generate_handler![
            commands::open_url,
            commands::launch_app,
            commands::get_system_info,
            commands::send_notification,
            commands::clipboard_read,
            commands::clipboard_write,
            commands::open_path,
            commands::run_shell,
            commands::get_frontmost_app,
            commands::get_global_mouse_position,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
