export const startupLoadingSteps = [
  { label: "Verifica ambiente", states: ["CHECKING_ENVIRONMENT"] },
  { label: "Ricerca archivio", states: ["DISCOVERING_STORAGE", "OPENING_EXISTING_STORAGE"] },
  { label: "Controllo dati", states: ["VALIDATING_LEDGER"] },
  { label: "Aggiornamento archivio", states: ["RUNNING_MIGRATIONS"] },
  { label: "Preparazione interfaccia", states: ["VERIFYING_DATA", "READY"] },
] as const;
