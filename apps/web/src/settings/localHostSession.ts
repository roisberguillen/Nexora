import {
  configureLocalHostPasscode,
  logoutLocalHostSession,
  unlockLocalHostSession,
  type LocalHostCredentials,
  type LocalHostSessionRequest,
} from "./localHostConnection";

export interface LocalHostSessionState {
  readonly deviceId: string;
  readonly deviceToken: string;
  readonly sessionToken?: string;
}

/** Volatile browser session; no token is written to localStorage or URL state. */
export class LocalHostSessionController {
  private sessionToken: string | undefined;

  public constructor(
    private readonly endpoint: string,
    private readonly credentials: LocalHostCredentials,
    private readonly request?: LocalHostSessionRequest,
  ) {}

  public async configure(passcode: string, salt: Uint8Array): Promise<void> {
    await configureLocalHostPasscode(this.endpoint, this.credentials, passcode, salt, this.request);
  }

  public async unlock(passcode: string, sessionToken: string, ttlMs?: number): Promise<void> {
    this.sessionToken = await unlockLocalHostSession(
      this.endpoint,
      this.credentials,
      passcode,
      sessionToken,
      ttlMs,
      this.request,
    );
  }

  public async logout(): Promise<void> {
    if (this.sessionToken === undefined) return;
    const token = this.sessionToken;
    try {
      await logoutLocalHostSession(this.endpoint, this.credentials.deviceId, token, this.request);
    } finally {
      this.sessionToken = undefined;
    }
  }

  public state(): LocalHostSessionState {
    return {
      deviceId: this.credentials.deviceId,
      deviceToken: this.credentials.deviceToken,
      ...(this.sessionToken === undefined ? {} : { sessionToken: this.sessionToken }),
    };
  }
}
