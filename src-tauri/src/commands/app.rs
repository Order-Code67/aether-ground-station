use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    pub stage: &'static str,
    pub platform: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskSpaceInfo {
    pub path: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "Aether Ground Station",
        version: env!("CARGO_PKG_VERSION"),
        stage: "2.0-core",
        platform: std::env::consts::OS,
    }
}

/// Free space for the volume that holds the given path (Windows via GetDiskFreeSpaceExW).
#[tauri::command]
pub fn system_disk_space(path: Option<String>) -> Result<DiskSpaceInfo, String> {
    let target = path.unwrap_or_else(|| {
        std::env::var("LOCALAPPDATA")
            .or_else(|_| std::env::var("SystemDrive").map(|d| format!("{d}\\")))
            .unwrap_or_else(|_| "C:\\".into())
    });

    #[cfg(windows)]
    {
        disk_space_windows(&target)
    }
    #[cfg(not(windows))]
    {
        let _ = target;
        Err("Disk space query не поддерживается на этой ОС".into())
    }
}

#[cfg(windows)]
fn disk_space_windows(path: &str) -> Result<DiskSpaceInfo, String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetDiskFreeSpaceExW(
            lp_directory_name: *const u16,
            lp_free_bytes_available_to_caller: *mut u64,
            lp_total_number_of_bytes: *mut u64,
            lp_total_number_of_free_bytes: *mut u64,
        ) -> i32;
    }

    let wide: Vec<u16> = OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut avail: u64 = 0;
    let mut total: u64 = 0;
    let mut total_free: u64 = 0;
    let ok = unsafe {
        GetDiskFreeSpaceExW(wide.as_ptr(), &mut avail, &mut total, &mut total_free)
    };
    if ok == 0 {
        return Err(format!("GetDiskFreeSpaceExW failed for {path}"));
    }
    Ok(DiskSpaceInfo {
        path: path.to_string(),
        total_bytes: total,
        available_bytes: avail,
    })
}
