const GOOGLE_IDENTITY_URL = "https://accounts.google.com/gsi/client";

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
  documentRef.head.append(script);
  return waitForScript(script);
}

function waitForScript(script: HTMLScriptElement): Promise<void> {
  return new Promise((resolve, reject) => {
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("google_identity_load_failed")), {
      once: true,
    });
  });
}
