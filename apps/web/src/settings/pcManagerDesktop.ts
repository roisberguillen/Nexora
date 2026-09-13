import { invoke, isTauri } from "@tauri-apps/api/core";

export interface DesktopHubStatus {
  readonly state: string;
  readonly binding: "loopback" | "lan";
  readonly address?: string;
}

export interface DesktopPairingInvite {
  readonly endpoint: string;
  readonly grantId: string;
  readonly code: string;
  readonly hostFingerprint: string;
  readonly expiresAtMs: number;
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

export function createDesktopPairingInvite(): Promise<DesktopPairingInvite> {
  return invoke<DesktopPairingInvite>("pc_manager_create_pairing_invite");
}

export function stopDesktopLocalHub(): Promise<void> {
  return invoke("pc_manager_stop");
}
