const GOOGLE_IDENTITY_URL = "https://accounts.google.com/gsi/client";
const GOOGLE_IDENTITY_LOAD_TIMEOUT_MS = 10_000;

export function loadGoogleIdentity(documentRef: Document = document): Promise<void> {
  const identityWindow = window as Window & {
    readonly google?: { readonly accounts?: { readonly oauth2?: unknown } };
  };
  if (identityWindow.google?.accounts?.oauth2 !== undefined) return Promise.resolve();
  const existing = documentRef.querySelector<HTMLScriptElement>(
    `script[src="${GOOGLE_IDENTITY_URL}"]`,
  );
  if (existing !== null) return waitForScript(existing);

  const script = documentRef.createElement("script");
  script.src = GOOGLE_IDENTITY_URL;
  script.async = true;
  script.defer = true;
  const loading = waitForScript(script);
  documentRef.head.append(script);
  return loading;
}

function waitForScript(script: HTMLScriptElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const identityWindow = window as Window & {
      readonly google?: { readonly accounts?: { readonly oauth2?: unknown } };
    };
    let interval: number | undefined;
    const timeout = window.setTimeout(
      () => finish(new Error("google_identity_load_failed")),
      GOOGLE_IDENTITY_LOAD_TIMEOUT_MS,
    );
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
      script.removeEventListener("load", checkReady);
      script.removeEventListener("error", onError);
      if (error === undefined) resolve();
      else reject(error);
    };
    const checkReady = () => {
      if (identityWindow.google?.accounts?.oauth2 !== undefined) finish();
    };
    const onError = () => finish(new Error("google_identity_load_failed"));

    script.addEventListener("load", checkReady);
    script.addEventListener("error", onError);
    checkReady();
    if (identityWindow.google?.accounts?.oauth2 === undefined)
      interval = window.setInterval(checkReady, 25);
  });
}
