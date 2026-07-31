const startupErrorMarkup = `
  <main class="fatal-error" id="main-content">
    <div class="fatal-error-card" role="alert">
      <span aria-hidden="true" class="brand-mark">N</span>
      <h1>Nexora non è riuscita ad avviarsi</h1>
      <p>I dati locali non sono stati modificati. Ricarica l’applicazione per riprovare.</p>
      <button class="primary-button" type="button" data-startup-reload>Ricarica applicazione</button>
    </div>
  </main>`;

/** Renders without React when an error occurs before an Error Boundary can mount. */
export function renderPreMountError(root: HTMLElement | null): void {
  const container = root ?? document.body;
  container.innerHTML = startupErrorMarkup;
  container
    .querySelector<HTMLButtonElement>("[data-startup-reload]")
    ?.addEventListener("click", () => {
      window.location.reload();
    });
}
