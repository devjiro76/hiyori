use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct CommandResult {
    pub success: bool,
    pub output: String,
}

fn ok(output: impl Into<String>) -> CommandResult {
    CommandResult { success: true, output: output.into() }
}

fn err(output: impl Into<String>) -> CommandResult {
    CommandResult { success: false, output: output.into() }
}

/// Open a URL in the default browser. Only http/https allowed.
#[tauri::command]
pub fn open_url(url: String) -> CommandResult {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return err("Only http:// and https:// URLs are allowed");
    }
    match open::that(&url) {
        Ok(_) => ok(format!("Opened {url}")),
        Err(e) => err(format!("Failed to open URL: {e}")),
    }
}

/// Launch a macOS application by name (e.g. "Slack", "Safari").
#[tauri::command]
#[allow(non_snake_case)]
pub fn launch_app(appName: String) -> CommandResult {
    let output = Command::new("open")
        .arg("-a")
        .arg(&appName)
        .output();
    match output {
        Ok(o) if o.status.success() => ok(format!("Launched {appName}")),
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            err(format!("Failed to launch {appName}: {stderr}"))
        }
        Err(e) => err(format!("Failed to launch {appName}: {e}")),
    }
}

/// Query system information: battery, memory, disk, hostname.
#[tauri::command]
#[allow(non_snake_case)]
pub fn get_system_info(infoType: String) -> CommandResult {
    use sysinfo::System;

    match infoType.as_str() {
        "battery" => {
            // macOS: use pmset to get battery info
            match Command::new("pmset").arg("-g").arg("batt").output() {
                Ok(o) => {
                    let stdout = String::from_utf8_lossy(&o.stdout);
                    ok(stdout.trim().to_string())
                }
                Err(e) => err(format!("Failed to get battery info: {e}")),
            }
        }
        "memory" => {
            let mut sys = System::new();
            sys.refresh_memory();
            let total = sys.total_memory() / 1024 / 1024;
            let used = sys.used_memory() / 1024 / 1024;
            let available = sys.available_memory() / 1024 / 1024;
            ok(format!("Memory: {used}MB used / {total}MB total ({available}MB available)"))
        }
        "disk" => {
            use sysinfo::Disks;
            let disks = Disks::new_with_refreshed_list();
            let mut info = String::new();
            for disk in disks.list() {
                let total = disk.total_space() / 1024 / 1024 / 1024;
                let available = disk.available_space() / 1024 / 1024 / 1024;
                let name = disk.name().to_string_lossy();
                info.push_str(&format!("{name}: {available}GB free / {total}GB total\n"));
            }
            ok(info.trim().to_string())
        }
        "hostname" => {
            ok(System::host_name().unwrap_or_else(|| "unknown".to_string()))
        }
        _ => err(format!("Unknown infoType: {infoType}. Use: battery, memory, disk, hostname")),
    }
}

/// Send a desktop notification.
#[tauri::command]
pub fn send_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> CommandResult {
    use tauri_plugin_notification::NotificationExt;
    match app.notification().builder().title(&title).body(&body).show() {
        Ok(_) => ok(format!("Notification sent: {title}")),
        Err(e) => err(format!("Failed to send notification: {e}")),
    }
}

/// Read from clipboard.
#[tauri::command]
pub fn clipboard_read() -> CommandResult {
    match arboard::Clipboard::new() {
        Ok(mut cb) => match cb.get_text() {
            Ok(text) => ok(text),
            Err(e) => err(format!("Failed to read clipboard: {e}")),
        },
        Err(e) => err(format!("Failed to access clipboard: {e}")),
    }
}

/// Write text to clipboard.
#[tauri::command]
pub fn clipboard_write(text: String) -> CommandResult {
    match arboard::Clipboard::new() {
        Ok(mut cb) => match cb.set_text(&text) {
            Ok(_) => ok("Text copied to clipboard"),
            Err(e) => err(format!("Failed to write clipboard: {e}")),
        },
        Err(e) => err(format!("Failed to access clipboard: {e}")),
    }
}

/// Open a file or folder in Finder.
#[tauri::command]
pub fn open_path(path: String) -> CommandResult {
    // Resolve ~ to home directory
    let resolved = if path.starts_with('~') {
        if let Some(home) = dirs::home_dir() {
            path.replacen('~', &home.to_string_lossy(), 1)
        } else {
            path.clone()
        }
    } else {
        path.clone()
    };

    match open::that(&resolved) {
        Ok(_) => ok(format!("Opened {path}")),
        Err(e) => err(format!("Failed to open path: {e}")),
    }
}

/// Dangerous shell command patterns that are never allowed.
const SHELL_BLACKLIST: &[&str] = &[
    "rm -rf /", "rm -rf ~", "rm -rf *",
    "mkfs", "dd if=",
    ":(){ :|:& };:", // fork bomb
    "> /dev/sda",
    "chmod -R 777 /",
    "sudo rm", "sudo mkfs", "sudo dd",
    "shutdown", "reboot", "halt",
    "kill -9 -1",
];

/// Run a shell command with safety checks.
#[tauri::command]
pub fn run_shell(command: String) -> CommandResult {
    let lower = command.to_lowercase();
    for pattern in SHELL_BLACKLIST {
        if lower.contains(pattern) {
            return err(format!("Blocked dangerous command pattern: {pattern}"));
        }
    }

    match Command::new("sh").arg("-c").arg(&command).output() {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let stderr = String::from_utf8_lossy(&o.stderr);
            if o.status.success() {
                let output = if stdout.is_empty() {
                    "(no output)".to_string()
                } else {
                    stdout.trim().to_string()
                };
                ok(output)
            } else {
                let msg = if stderr.is_empty() {
                    format!("Command failed with exit code {}", o.status.code().unwrap_or(-1))
                } else {
                    stderr.trim().to_string()
                };
                err(msg)
            }
        }
        Err(e) => err(format!("Failed to execute command: {e}")),
    }
}

/// Get the frontmost application name (macOS only).
#[tauri::command]
pub fn get_frontmost_app() -> CommandResult {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("osascript")
            .arg("-e")
            .arg("tell application \"System Events\" to get name of first application process whose frontmost is true")
            .output();
        match output {
            Ok(o) if o.status.success() => {
                let name = String::from_utf8_lossy(&o.stdout).trim().to_string();
                ok(name)
            }
            Ok(o) => {
                let stderr = String::from_utf8_lossy(&o.stderr);
                err(format!("Failed to get frontmost app: {stderr}"))
            }
            Err(e) => err(format!("Failed to get frontmost app: {e}")),
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        err("Not supported on this platform".to_string())
    }
}

/// Get the global mouse position (screen coordinates).
#[derive(Serialize)]
pub struct MousePosition {
    pub x: i32,
    pub y: i32,
}

#[tauri::command]
pub fn get_global_mouse_position() -> MousePosition {
    #[cfg(target_os = "macos")]
    {
        use objc::{msg_send, sel, sel_impl};
        use objc::runtime::Class;
        #[allow(unexpected_cfgs)]
        unsafe {
            let event_class = Class::get("NSEvent").expect("NSEvent class not found");
            let location: (f64, f64) = msg_send![event_class, mouseLocation];
            MousePosition {
                x: location.0 as i32,
                y: location.1 as i32,
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        MousePosition { x: 0, y: 0 }
    }
}
