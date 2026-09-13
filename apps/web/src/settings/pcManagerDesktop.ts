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

export interface DesktopLanStartRequest {
  readonly address: string;
  readonly certificatePath: string;
  readonly privateKeyPath: string;
}

export function isDesktopRuntime(): boolean {
  return isTauri();
}

export function isAndroidRuntime(): boolean {
  return isTauri() && /Android/i.test(globalThis.navigator?.userAgent ?? "");
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

export function startDesktopLanHub(input: DesktopLanStartRequest): Promise<DesktopHubStatus> {
  return invoke<DesktopHubStatus>("pc_manager_start_lan", { request: input });
}

export function stopDesktopLocalHub(): Promise<void> {
  return invoke("pc_manager_stop");
}

export function startPhoneLocalHub(): Promise<DesktopHubStatus> {
  return invoke<DesktopHubStatus>("phone_local_hub_start");
}

export function getPhoneLocalHubStatus(): Promise<DesktopHubStatus> {
  return invoke<DesktopHubStatus>("phone_local_hub_status");
}

export function stopPhoneLocalHub(): Promise<void> {
  return invoke("phone_local_hub_stop");
}
