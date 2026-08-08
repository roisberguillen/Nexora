/* global document, window */

(() => {
  const parameters = new URLSearchParams(window.location.search);
  const clientId = parameters.get("client_id") || "";
  const nonce = parameters.get("nonce") || "";
  const scope = parameters.get("scope") || "";
  const status = document.getElementById("status");
  const button = document.getElementById("continue");
  const valid =
    /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId) &&
    nonce.length >= 16 &&
    scope === "https://www.googleapis.com/auth/drive.appdata";
  const channel = valid ? new BroadcastChannel(`nexora-google-oauth-${nonce}`) : undefined;
  const setStatus = (message, error) => {
    if (status === null) return;
    status.textContent = message;
    status.className = error ? "error" : "";
  };
  const publish = (message) => {
    channel?.postMessage({ type: "nexora-google-oauth-result", nonce, ...message });
    channel?.close();
  };

  if (!valid || button === null) {
    if (button !== null) button.disabled = true;
    setStatus("Richiesta di collegamento non valida.", true);
    return;
  }

  button.addEventListener("click", () => {
    const oauth = window.google?.accounts?.oauth2;
    if (oauth === undefined) {
      setStatus("Google non è ancora pronto. Attendi un istante e riprova.", true);
      return;
    }
    button.disabled = true;
    setStatus("Attendi la conferma Google…", false);
    const client = oauth.initTokenClient({
      client_id: clientId,
      scope,
      callback: (response) => {
        if (typeof response.access_token === "string" && response.access_token.length > 0) {
          publish({ token: response.access_token });
          window.close();
          return;
        }
        publish({ error: response.error || "google_consent_denied" });
        setStatus("Google ha rifiutato il collegamento.", true);
        button.disabled = false;
      },
      error_callback: (error) => {
        publish({
          error:
            error.type === "popup_closed" || error.type === "popup_failed_to_open"
              ? `google_identity_${error.type}`
              : "google_identity_failed",
        });
        setStatus("Il popup Google non ha completato il collegamento.", true);
        button.disabled = false;
      },
    });
    client.requestAccessToken({ prompt: "select_account" });
  });
})();
