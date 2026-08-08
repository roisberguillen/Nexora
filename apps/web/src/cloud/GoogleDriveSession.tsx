import { type PropsWithChildren, useCallback, useMemo, useRef, useState } from "react";

import { GoogleDriveBackupProvider } from "./GoogleDriveBackupProvider";
import { GoogleIdentityAuth } from "./GoogleIdentityAuth";
import { readGoogleCloudConfig, type GoogleCloudConfig } from "./cloudConfig";
import type { CloudBackupStatus } from "./cloudTypes";
import {
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
  const [identityStatus, setIdentityStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const preparation = useRef<Promise<void> | undefined>(undefined);

  const prepare = useCallback(() => {
    if (!config.enabled) return Promise.reject(new Error("google_identity_unavailable"));
    if (identityStatus === "ready") return Promise.resolve();
    if (preparation.current !== undefined) return preparation.current;
    setIdentityStatus("loading");
    const loading = loadGoogleIdentity().then(
      () => setIdentityStatus("ready"),
      (error: unknown) => {
        setIdentityStatus("error");
        throw error;
      },
    );
    preparation.current = loading;
    return loading;
  }, [config.enabled, identityStatus]);

  const connect = useCallback(() => {
    if (!config.enabled || identityStatus !== "ready")
      return Promise.reject(new Error("google_identity_unavailable"));
    setStatus("authorizing");
    return auth.connect().then(
      () => setStatus(auth.getStatus()),
      (error: unknown) => {
        setStatus(auth.getStatus() === "idle" ? "error" : auth.getStatus());
        throw error;
      },
    );
  }, [auth, config.enabled, identityStatus]);

  const disconnect = useCallback(async () => {
    await auth.disconnect();
    setStatus(auth.getStatus());
  }, [auth]);

  const value = useMemo<GoogleDriveSessionValue>(
    () => ({ config, connect, disconnect, identityStatus, prepare, provider, status }),
    [config, connect, disconnect, identityStatus, prepare, provider, status],
  );

  return (
    <GoogleDriveSessionContext.Provider value={value}>
      {children}
    </GoogleDriveSessionContext.Provider>
  );
}
