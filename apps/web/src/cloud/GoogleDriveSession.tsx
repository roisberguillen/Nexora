import { type PropsWithChildren, useCallback, useMemo, useState } from "react";

import { GoogleDriveBackupProvider } from "./GoogleDriveBackupProvider";
import { GoogleIdentityAuth } from "./GoogleIdentityAuth";
import { readGoogleCloudConfig, type GoogleCloudConfig } from "./cloudConfig";
import type { CloudBackupStatus } from "./cloudTypes";
import {
  dismissGoogleDriveOnboarding,
  GoogleDriveSessionContext,
  type GoogleDriveSessionValue,
} from "./GoogleDriveSessionContext";
import { loadGoogleIdentity } from "./loadGoogleIdentity";

export function GoogleDriveSessionProvider({
  children,
  config: configOverride,
}: PropsWithChildren<{ readonly config?: GoogleCloudConfig }>) {
  const config = useMemo(() => configOverride ?? readGoogleCloudConfig(), [configOverride]);
  const auth = useMemo(() => new GoogleIdentityAuth(config.clientId), [config.clientId]);
  const provider = useMemo(
    () => new GoogleDriveBackupProvider(() => auth.getAccessToken()),
    [auth],
  );
  const [status, setStatus] = useState<CloudBackupStatus>(() => auth.getStatus());

  const connect = useCallback(async () => {
    if (!config.enabled) throw new Error("google_identity_unavailable");
    setStatus("authorizing");
    try {
      await loadGoogleIdentity();
      await auth.connect();
      setStatus(auth.getStatus());
    } catch (error) {
      setStatus(auth.getStatus() === "idle" ? "error" : auth.getStatus());
      throw error;
    }
  }, [auth, config.enabled]);

  const disconnect = useCallback(async () => {
    dismissGoogleDriveOnboarding();
    await auth.disconnect();
    setStatus(auth.getStatus());
  }, [auth]);

  const value = useMemo<GoogleDriveSessionValue>(
    () => ({ config, connect, disconnect, provider, status }),
    [config, connect, disconnect, provider, status],
  );

  return (
    <GoogleDriveSessionContext.Provider value={value}>
      {children}
    </GoogleDriveSessionContext.Provider>
  );
}
