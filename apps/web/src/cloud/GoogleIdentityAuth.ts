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
    readonly error_callback?: (error: { readonly type?: string }) => void;
  }): GoogleTokenClient;
  revoke(token: string, callback: () => void): void;
}
interface GoogleIdentityWindow extends Window {
  google?: { readonly accounts?: { readonly oauth2?: GoogleAccountsOauth2 } };
}

export interface GoogleIdentityAuthOptions {
  readonly authorizationTimeoutMs?: number;
}

export class GoogleIdentityAuth implements CloudAuthProvider {
  private status: CloudBackupStatus = "idle";
  private token: string | undefined;
  private connection: Promise<void> | undefined;
  private authorizationAttempt = 0;
  public constructor(
    private readonly clientId: string,
    private readonly windowRef: GoogleIdentityWindow = window,
    private readonly options: GoogleIdentityAuthOptions = {},
  ) {}

  public getStatus(): CloudBackupStatus {
    return this.status;
  }
  public getAccessToken(): string | undefined {
    return this.token;
  }
  public connect(): Promise<void> {
    if (this.status === "connected" && this.token !== undefined) return Promise.resolve();
    if (this.connection !== undefined) return this.connection;
    const connection = this.authorize();
    this.connection = connection;
    const clearConnection = () => {
      if (this.connection === connection) this.connection = undefined;
    };
    void connection.then(clearConnection, clearConnection);
    return connection;
  }
  private async authorize(): Promise<void> {
    const oauth = this.windowRef.google?.accounts?.oauth2;
    if (oauth === undefined || this.clientId === "") {
      this.status = "error";
      throw new Error("google_identity_unavailable");
    }
    const attempt = ++this.authorizationAttempt;
    this.status = "authorizing";
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error === undefined) resolve();
        else reject(error);
      };
      const timeout = setTimeout(() => {
        if (attempt !== this.authorizationAttempt) return;
        this.status = "error";
        finish(new Error("google_identity_timeout"));
      }, this.options.authorizationTimeoutMs ?? 60_000);
      const client = oauth.initTokenClient({
        client_id: this.clientId,
        scope: DRIVE_APPDATA_SCOPE,
        callback: (response) => {
          if (settled || attempt !== this.authorizationAttempt) return;
          if (response.access_token === undefined || response.access_token.length === 0) {
            this.status = "error";
            finish(new Error(response.error ?? "google_consent_denied"));
            return;
          }
          this.token = response.access_token;
          this.status = "connected";
          finish();
        },
        error_callback: (error) => {
          if (settled || attempt !== this.authorizationAttempt) return;
          this.status = "error";
          const type = error.type;
          finish(
            new Error(
              type === "popup_closed" || type === "popup_failed_to_open"
                ? `google_identity_${type}`
                : "google_identity_failed",
            ),
          );
        },
      });
      try {
        client.requestAccessToken({ prompt: "select_account" });
      } catch (error) {
        this.status = "error";
        finish(error instanceof Error ? error : new Error("google_identity_unavailable"));
      }
    });
  }
  public async disconnect(): Promise<void> {
    this.authorizationAttempt += 1;
    const token = this.token;
    this.token = undefined;
    this.status = "idle";
    if (token !== undefined)
      await new Promise<void>(
        (resolve) => this.windowRef.google?.accounts?.oauth2?.revoke(token, resolve) ?? resolve(),
      );
  }
}
