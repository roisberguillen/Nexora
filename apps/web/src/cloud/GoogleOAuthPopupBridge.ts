const bridgePath = "/google-drive-oauth-bridge.html";
const bridgeTimeoutMs = 60_000;

export interface GoogleOAuthPopupBridge {
  requestToken(input: { readonly clientId: string; readonly scope: string }): Promise<string>;
}

interface BridgeMessage {
  readonly type: "nexora-google-oauth-result";
  readonly nonce: string;
  readonly token?: string;
  readonly error?: string;
}

interface BroadcastChannelLike {
  close(): void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
}

interface BrowserBridgeWindow {
  BroadcastChannel?: new (name: string) => BroadcastChannelLike;
  crypto: Pick<Crypto, "randomUUID">;
  location: Pick<Location, "origin">;
  open(url?: string, target?: string, features?: string): Window | null;
}

export class BrowserGoogleOAuthPopupBridge implements GoogleOAuthPopupBridge {
  public constructor(
    private readonly windowRef: BrowserBridgeWindow = window,
    private readonly timeoutMs = bridgeTimeoutMs,
  ) {}

  public requestToken({ clientId, scope }: { readonly clientId: string; readonly scope: string }) {
    const BroadcastChannelConstructor = this.windowRef.BroadcastChannel;
    if (BroadcastChannelConstructor === undefined) {
      return Promise.reject(new Error("google_identity_unavailable"));
    }
    const nonce = this.windowRef.crypto.randomUUID();
    const channel = new BroadcastChannelConstructor(`nexora-google-oauth-${nonce}`);
    const query = new URLSearchParams({ client_id: clientId, nonce, scope });
    const popup = this.windowRef.open(
      `${this.windowRef.location.origin}${bridgePath}?${query.toString()}`,
      "nexora-google-oauth",
      "popup,width=460,height=640",
    );
    if (popup === null) {
      channel.close();
      return Promise.reject(new Error("google_identity_popup_failed_to_open"));
    }

    return new Promise<string>((resolve, reject) => {
      const finish = (error?: Error, token?: string) => {
        clearTimeout(timeout);
        channel.close();
        if (error === undefined && token !== undefined) resolve(token);
        else reject(error ?? new Error("google_identity_failed"));
      };
      const timeout = setTimeout(
        () => finish(new Error("google_identity_timeout")),
        this.timeoutMs,
      );
      channel.onmessage = (event) => {
        const message = parseBridgeMessage(event.data);
        if (message === undefined || message.nonce !== nonce) return;
        if (message.token !== undefined) finish(undefined, message.token);
        else finish(new Error(message.error ?? "google_identity_failed"));
      };
    });
  }
}

function parseBridgeMessage(value: unknown): BridgeMessage | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Partial<BridgeMessage>;
  if (candidate.type !== "nexora-google-oauth-result" || typeof candidate.nonce !== "string") {
    return undefined;
  }
  if (
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    candidate.token.length <= 8192
  ) {
    return { type: candidate.type, nonce: candidate.nonce, token: candidate.token };
  }
  if (typeof candidate.error === "string") {
    return { type: candidate.type, nonce: candidate.nonce, error: candidate.error };
  }
  return undefined;
}
