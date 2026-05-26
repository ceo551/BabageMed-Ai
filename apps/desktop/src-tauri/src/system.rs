// Hardware + OS introspection commands. Exposes a typed snapshot of the
// machine state to the React layer so the dashboard can show CPU/RAM/disk
// pressure, GPU info, network state, and battery status — and reactively
// scale UI quality (e.g. drop animations, pause MCP polling) on low-power
// devices.

use serde::Serialize;
use sysinfo::{Components, Disks, MemoryRefreshKind, Networks, RefreshKind, System};
use tokio::sync::Mutex;

/// Lazily-initialised System handle. `sysinfo` is cheap to refresh but
/// allocating a fresh one on every call would discard the deltas
/// (cpu_usage needs two consecutive samples).
pub struct SysState {
    pub sys: Mutex<System>,
}

impl SysState {
    pub fn new() -> Self {
        let mut sys = System::new_with_specifics(
            RefreshKind::new()
                .with_cpu(sysinfo::CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything()),
        );
        sys.refresh_all();
        Self { sys: Mutex::new(sys) }
    }
}

#[derive(Serialize, Clone)]
pub struct CpuInfo {
    pub brand: String,
    pub vendor: String,
    pub physical_cores: usize,
    pub logical_cores: usize,
    pub frequency_mhz: u64,
    pub usage_percent: f32,
    pub per_core_usage: Vec<f32>,
}

#[derive(Serialize, Clone)]
pub struct MemInfo {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub available_bytes: u64,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
}

#[derive(Serialize, Clone)]
pub struct DiskInfo {
    pub name: String,
    pub mount: String,
    pub fs: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub is_removable: bool,
}

#[derive(Serialize, Clone)]
pub struct NetIface {
    pub name: String,
    pub mac: String,
    pub received_bytes: u64,
    pub transmitted_bytes: u64,
}

#[derive(Serialize, Clone)]
pub struct ThermalSensor {
    pub label: String,
    pub temperature_c: Option<f32>,
    pub critical_c: Option<f32>,
}

#[derive(Serialize, Clone)]
pub struct OsInfo {
    pub family: String,
    pub name: String,
    pub kernel_version: String,
    pub os_version: String,
    pub host_name: String,
    pub arch: String,
    pub uptime_seconds: u64,
}

#[derive(Serialize, Clone)]
pub struct GpuInfo {
    pub name: String,
    pub vendor: String,
    pub backend: String,
    pub device_type: String,
    pub driver: String,
}

#[derive(Serialize, Clone)]
pub struct BatteryInfo {
    pub state: String,
    pub percentage: f32,
    pub time_to_full_seconds: Option<u64>,
    pub time_to_empty_seconds: Option<u64>,
    pub cycle_count: Option<u32>,
}

#[derive(Serialize, Clone)]
pub struct SystemSnapshot {
    pub cpu: CpuInfo,
    pub memory: MemInfo,
    pub disks: Vec<DiskInfo>,
    pub networks: Vec<NetIface>,
    pub thermals: Vec<ThermalSensor>,
    pub os: OsInfo,
}

#[tauri::command]
pub async fn system_snapshot(state: tauri::State<'_, SysState>) -> Result<SystemSnapshot, String> {
    let mut sys = state.sys.lock().await;
    // Two refreshes ~200ms apart are required for cpu_usage() to produce
    // a non-zero delta on first call. On subsequent calls one refresh
    // suffices because the previous tick is kept in memory.
    sys.refresh_cpu_usage();
    tokio::time::sleep(std::time::Duration::from_millis(
        sysinfo::MINIMUM_CPU_UPDATE_INTERVAL.as_millis() as u64,
    ))
    .await;
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpus = sys.cpus();
    let cpu = CpuInfo {
        brand: cpus.first().map(|c| c.brand().to_string()).unwrap_or_default(),
        vendor: cpus.first().map(|c| c.vendor_id().to_string()).unwrap_or_default(),
        physical_cores: sys.physical_core_count().unwrap_or_else(num_cpus::get_physical),
        logical_cores: cpus.len(),
        frequency_mhz: cpus.first().map(|c| c.frequency()).unwrap_or_default(),
        usage_percent: sys.global_cpu_usage(),
        per_core_usage: cpus.iter().map(|c| c.cpu_usage()).collect(),
    };

    let memory = MemInfo {
        total_bytes: sys.total_memory(),
        used_bytes: sys.used_memory(),
        free_bytes: sys.free_memory(),
        available_bytes: sys.available_memory(),
        swap_total_bytes: sys.total_swap(),
        swap_used_bytes: sys.used_swap(),
    };

    let disks = Disks::new_with_refreshed_list()
        .iter()
        .map(|d| DiskInfo {
            name: d.name().to_string_lossy().to_string(),
            mount: d.mount_point().to_string_lossy().to_string(),
            fs: d.file_system().to_string_lossy().to_string(),
            total_bytes: d.total_space(),
            available_bytes: d.available_space(),
            is_removable: d.is_removable(),
        })
        .collect();

    let networks = Networks::new_with_refreshed_list()
        .iter()
        .map(|(name, data)| NetIface {
            name: name.clone(),
            mac: data.mac_address().to_string(),
            received_bytes: data.total_received(),
            transmitted_bytes: data.total_transmitted(),
        })
        .collect();

    let thermals = Components::new_with_refreshed_list()
        .iter()
        .map(|c| ThermalSensor {
            label: c.label().to_string(),
            // sysinfo 0.32 returns f32 directly (no Option); the API has
            // sentinel values but we surface them as-is — the UI can hide
            // negatives or NaN as "unsupported".
            temperature_c: Some(c.temperature()),
            critical_c: c.critical(),
        })
        .collect();

    let os = OsInfo {
        family: std::env::consts::FAMILY.to_string(),
        name: System::name().unwrap_or_default(),
        kernel_version: System::kernel_version().unwrap_or_default(),
        os_version: System::os_version().unwrap_or_default(),
        host_name: System::host_name().unwrap_or_default(),
        arch: std::env::consts::ARCH.to_string(),
        uptime_seconds: System::uptime(),
    };

    Ok(SystemSnapshot { cpu, memory, disks, networks, thermals, os })
}

/// Probe attached GPU adapters. Requires the `gpu-probe` cargo feature
/// (off by default — it pulls in `wgpu` and ~3 MB of binary). When the
/// feature is disabled this returns an empty list rather than failing,
/// so the JS side can always call it.
#[tauri::command]
pub async fn gpu_adapters() -> Result<Vec<GpuInfo>, String> {
    #[cfg(feature = "gpu-probe")]
    {
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor::default());
        let mut out = Vec::new();
        for adapter in instance.enumerate_adapters(wgpu::Backends::all()) {
            let info = adapter.get_info();
            out.push(GpuInfo {
                name: info.name,
                vendor: format!("0x{:04x}", info.vendor),
                backend: format!("{:?}", info.backend),
                device_type: format!("{:?}", info.device_type),
                driver: info.driver_info,
            });
        }
        return Ok(out);
    }
    #[cfg(not(feature = "gpu-probe"))]
    Ok(Vec::new())
}

#[tauri::command]
pub async fn battery_status() -> Result<Option<BatteryInfo>, String> {
    #[cfg(feature = "battery")]
    {
        let manager = battery::Manager::new().map_err(|e| e.to_string())?;
        if let Some(bat_result) = manager.batteries().map_err(|e| e.to_string())?.next() {
            let bat = bat_result.map_err(|e| e.to_string())?;
            return Ok(Some(BatteryInfo {
                state: format!("{:?}", bat.state()),
                percentage: bat.state_of_charge().value * 100.0,
                time_to_full_seconds: bat.time_to_full().map(|t| t.value as u64),
                time_to_empty_seconds: bat.time_to_empty().map(|t| t.value as u64),
                cycle_count: bat.cycle_count(),
            }));
        }
        return Ok(None);
    }
    #[cfg(not(feature = "battery"))]
    Ok(None)
}
