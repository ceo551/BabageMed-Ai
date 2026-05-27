// Thin TypeScript bridge to the Tauri desktop layer. Used by React
// components to detect whether we're running inside the desktop shell and
// to call Rust commands defined in apps/desktop/src-tauri/src/.
//
// All calls are no-ops in the browser/mobile shells (they return the
// empty/default value instead of throwing), so feature code can call
// them unconditionally — no `if (isDesktop)` boilerplate at every site.

export type CpuInfo = {
  brand: string;
  vendor: string;
  physical_cores: number;
  logical_cores: number;
  frequency_mhz: number;
  usage_percent: number;
  per_core_usage: number[];
};

export type MemInfo = {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  available_bytes: number;
  swap_total_bytes: number;
  swap_used_bytes: number;
};

export type DiskInfo = {
  name: string;
  mount: string;
  fs: string;
  total_bytes: number;
  available_bytes: number;
  is_removable: boolean;
};

export type NetIface = {
  name: string;
  mac: string;
  received_bytes: number;
  transmitted_bytes: number;
};

export type ThermalSensor = {
  label: string;
  temperature_c: number | null;
  critical_c: number | null;
};

export type OsInfo = {
  family: string;
  name: string;
  kernel_version: string;
  os_version: string;
  host_name: string;
  arch: string;
  uptime_seconds: number;
};

export type GpuInfo = {
  name: string;
  vendor: string;
  backend: string;
  device_type: string;
  driver: string;
};

export type BatteryInfo = {
  state: string;
  percentage: number;
  time_to_full_seconds: number | null;
  time_to_empty_seconds: number | null;
  cycle_count: number | null;
};

export type SystemSnapshot = {
  cpu: CpuInfo;
  memory: MemInfo;
  disks: DiskInfo[];
  networks: NetIface[];
  thermals: ThermalSensor[];
  os: OsInfo;
};

export type AppInfo = {
  name: string;
  version: string;
  target_os: string;
  target_arch: string;
  physical_cores: number;
  logical_cores: number;
};

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { __TAURI_INTERNALS__?: { invoke: <T>(c: string, a?: Record<string, unknown>) => Promise<T> } };
  if (!w.__TAURI_INTERNALS__) return null;
  return w.__TAURI_INTERNALS__.invoke<T>(cmd, args);
}

export const isDesktop = (): boolean => {
  if (typeof window === "undefined") return false;
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
};

// Detect the Android shell by probing the actual JS bridge rather than
// the user-agent string — UA can be spoofed by browser devtools or
// extensions, so any code that grants extra capability based on it
// would be bypassable. The native shell injects window.BabbageNative
// with a typed `platform` field that's not present in browsers.
export const isMobileNative = (): "android" | null => {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { BabbageNative?: { platform?: string } }).BabbageNative;
  if (!bridge || typeof bridge.platform !== "string") return null;
  if (bridge.platform === "android") return "android";
  return null;
};

export const appInfo = () => invoke<AppInfo>("app_info");
export const systemSnapshot = () => invoke<SystemSnapshot>("system_snapshot");
export const gpuAdapters = () => invoke<GpuInfo[]>("gpu_adapters");
export const batteryStatus = () => invoke<BatteryInfo | null>("battery_status");

export const focusMain = () => invoke<void>("focus_main");
export const toggleDevtools = () => invoke<void>("toggle_devtools");
export const requestUserAttention = (critical = false) =>
  invoke<void>("request_user_attention", { critical });
export const setAlwaysOnTop = (on: boolean) => invoke<void>("set_always_on_top", { on });
export const toggleFullscreen = () => invoke<void>("toggle_fullscreen");
export const applyPerfHints = (highPriority: boolean) =>
  invoke<void>("apply_perf_hints", { highPriority });

export const secretSet = (key: string, value: string) =>
  invoke<void>("secret_set", { key, value });
export const secretGet = (key: string) => invoke<string | null>("secret_get", { key });
export const secretDelete = (key: string) => invoke<void>("secret_delete", { key });

// Native bridge for Android. The shell injects a `BabbageNative`
// global on the window so the React app can call into Kotlin.
type NativeBridge = {
  shareText?: (text: string) => void;
  pickFile?: (mime: string) => Promise<string | null>;
  authenticate?: (reason: string) => Promise<boolean>;
  haptic?: (pattern: "light" | "medium" | "heavy") => void;
  notify?: (title: string, body: string) => void;
};

export const native = (): NativeBridge | null => {
  if (typeof window === "undefined") return null;
  return ((window as unknown as { BabbageNative?: NativeBridge }).BabbageNative) ?? null;
};
