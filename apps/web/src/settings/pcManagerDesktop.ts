import { invoke, isTauri } from "@tauri-apps/api/core";

export interface DesktopHubStatus {
  readonly state: string;
  readonly binding: "loopback" | "lan";
  readonly address?: string;
}

export function isDesktopRuntime(): boolean {
  return isTauri();
}

export function startDesktopLocalHub(): Promise<DesktopHubStatus> {
  return invoke<DesktopHubStatus>("pc_manager_start");
}

export function getDesktopLocalHubStatus(): Promise<DesktopHubStatus> {
  return invoke<DesktopHubStatus>("pc_manager_status");
}

export function stopDesktopLocalHub(): Promise<void> {
  return invoke("pc_manager_stop");
}
