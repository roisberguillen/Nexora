export interface GoogleCloudConfig {
  readonly clientId: string;
  readonly enabled: boolean;
}

interface GoogleCloudEnvironment {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_DRIVE_ENABLED?: string;
}

export function readGoogleCloudConfig(
  environment: GoogleCloudEnvironment = import.meta.env as unknown as GoogleCloudEnvironment,
): GoogleCloudConfig {
  const clientId = environment.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";
  const enabled = environment.VITE_GOOGLE_DRIVE_ENABLED === "true" && clientId.length > 0;
  return Object.freeze({ clientId, enabled });
}
