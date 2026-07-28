import type { CloudAuthProvider, CloudBackupStatus } from "./cloudTypes";

const DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

interface GoogleTokenClient {
  requestAccessToken(input?: { readonly prompt?: string }): void;
}
interface GoogleAccountsOauth2 {
  initTokenClient(input: {
    readonly client_id: string;
    readonly scope: string;
    readonly callback: (response: {
      readonly access_token?: string;
      readonly error?: string;
    }) => void;
  }): GoogleTokenClient;
  revoke(token: string, callback: () => void): void;
}
interface GoogleIdentityWindow extends Window {
  google?: { readonly accounts?: { readonly oauth2?: GoogleAccountsOauth2 } };
}

export class GoogleIdentityAuth implements CloudAuthProvider {
  private status: CloudBackupStatus = "idle";
  private token: string | undefined;
  public constructor(
    private readonly clientId: string,
    private readonly windowRef: GoogleIdentityWindow = window,
  ) {}

  public getStatus(): CloudBackupStatus {
    return this.status;
  }
  public getAccessToken(): string | undefined {
    return this.token;
  }
  public async connect(): Promise<void> {
    const oauth = this.windowRef.google?.accounts?.oauth2;
    if (oauth === undefined || this.clientId === "") {
      this.status = "error";
      throw new Error("google_identity_unavailable");
    }
    this.status = "authorizing";
    await new Promise<void>((resolve, reject) => {
      const client = oauth.initTokenClient({
        client_id: this.clientId,
        scope: DRIVE_APPDATA_SCOPE,
        callback: (response) => {
          if (response.access_token === undefined) {
            this.status = "error";
            reject(new Error(response.error ?? "google_consent_denied"));
            return;
          }
          this.token = response.access_token;
          this.status = "connected";
          resolve();
        },
      });
      try {
        client.requestAccessToken({ prompt: "consent" });
      } catch (error) {
        this.status = "error";
        reject(error);
      }
    });
  }
  public async disconnect(): Promise<void> {
    const token = this.token;
    this.token = undefined;
    this.status = "idle";
    if (token !== undefined)
      await new Promise<void>(
        (resolve) => this.windowRef.google?.accounts?.oauth2?.revoke(token, resolve) ?? resolve(),
      );
  }
}
