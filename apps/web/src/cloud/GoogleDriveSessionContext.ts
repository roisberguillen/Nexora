import { createContext, useContext } from "react";

import type { GoogleDriveBackupProvider } from "./GoogleDriveBackupProvider";
import type { GoogleCloudConfig } from "./cloudConfig";
import type { CloudBackupStatus } from "./cloudTypes";

export interface GoogleDriveSessionValue {
  readonly config: GoogleCloudConfig;
  readonly provider: GoogleDriveBackupProvider;
  readonly status: CloudBackupStatus;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export const GoogleDriveSessionContext = createContext<GoogleDriveSessionValue | undefined>(
  undefined,
);

export function useGoogleDriveSession(): GoogleDriveSessionValue {
  const session = useContext(GoogleDriveSessionContext);
  if (session === undefined) {
    throw new Error("GoogleDriveSessionProvider is missing");
  }
  return session;
}
