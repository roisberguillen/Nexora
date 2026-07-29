# Baseline audit — 2026-07-29

- **Commit di partenza:** `6fe25651f32d76a49ff5fa059050ef3b721161e0`
- **Branch:** `main`
- **Remote:** `https://github.com/roisberguillen/Nexora.git`
- **Data e ora:** `2026-07-29T13:35:48+02:00` (`Europe/Rome`)
- **Sistema operativo:** Windows 11 Home 64 bit, `10.0.26200`
- **Node.js:** `v24.15.0`
- **pnpm:** `11.9.0`

## Comandi eseguiti

| Comando | Esito |
|---|---|
| `pnpm doctor` | verde; OPFS/File System Access richiedono browser reale, Drive non configurato |
| `pnpm format:check` | verde dopo normalizzazione Prettier |
| `pnpm lint` | verde |
| `pnpm typecheck` | verde |
| `pnpm test` | 63 file, 231 test superati |
| `pnpm build` | verde; soli warning Vite sulle dimensioni di alcuni chunk |
| `pnpm manifest:check` | verde dopo aggiornamento manifest |
| `pnpm test:e2e` | 52 superati, 17 skip previsti |
| `pnpm audit --prod` | nessuna vulnerabilità nota |

## Skip E2E verificati

I 17 skip sono dichiarati nel codice Playwright e non disabilitano funzionalità: test visuali,
offline e persistenza SQLite/OPFS o IndexedDB sono limitati al progetto `chromium-1440`, dove il
browser espone le API necessarie e la baseline visiva è definita. Le superfici funzionali restano
verificate nei viewport 320, 768 e 1440 dagli altri test E2E.

## Risultato

La baseline iniziale aveva evidenziato formattazione e manifest non aggiornati. Dopo la loro
correzione e il test della versione di build, tutti i quality gate sopra elencati sono verdi.
