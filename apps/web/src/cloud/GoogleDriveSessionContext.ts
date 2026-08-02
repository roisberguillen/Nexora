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
const onboardingDismissedKey = "nexora.google-drive-onboarding-dismissed.v1";

export function wasGoogleDriveOnboardingDismissed(
  storage: Pick<Storage, "getItem"> = sessionStorage,
): boolean {
  try {
    return storage.getItem(onboardingDismissedKey) === "1";
  } catch {
    return false;
  }
}

export function dismissGoogleDriveOnboarding(
  storage: Pick<Storage, "setItem"> = sessionStorage,
): void {
  try {
    storage.setItem(onboardingDismissedKey, "1");
  } catch {
    // A blocked storage API must never prevent local-first use or disconnection.
  }
}

export function useGoogleDriveSession(): GoogleDriveSessionValue {
  const session = useContext(GoogleDriveSessionContext);
  if (session === undefined) {
    throw new Error("GoogleDriveSessionProvider is missing");
  }
  return session;
}
