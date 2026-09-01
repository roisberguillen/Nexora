# NEXORA — Fase 12.5.C3.20

Manifest: nexora-ui-ux-mobile-desktop/v1
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Schermata: Settings / Cestino / Reset
Route: `#settings`
Flusso principale: apertura → preferenze → Cestino → restore/purge → reset finanziario → reset totale
Reviewer/fase: Codex — 12.5.C3.20
Modifiche: feedback accessibile per restore failure e fallback sicuro delle preferenze malformate.
Data: 2026-09-02
Esito: PASS

## Contratto reale

Settings contiene soltanto preferenze realmente supportate: tema `light/dark/system`, dimensione
testo, riduzione animazioni e retention del Cestino 7/30/90 giorni. Sono locali, persistite al
cambio, ricaricate dopo refresh e non modificano il ledger. EUR, formato italiano e mese civile
restano valori fissi dichiarati; non esistono selettori fake di valuta o lingua.

Il Cestino contiene esclusivamente transazioni soft-deleted. Il movimento sparisce dalle superfici
attive, mantiene ID/metadati e può essere ripristinato; transfer e relative leg vengono trattati
come gruppo atomico. La purge singola e `Svuota cestino` richiedono dialog esplicito, sono protette
dal doppio submit e usano transazioni atomiche; splits, tag, transfer e import audit sono gestiti
dal repository senza orphan.

Il reset finanziario elimina i dati del ledger e ricrea le categorie di sistema; non elimina
preferenze, App Lock o backup. Richiede frase `RESETTA DATI FINANZIARI`; il backup è consigliato,
la rinuncia è esplicita e, con App Lock attivo, è richiesta la verifica del PIN. Il reset totale
elimina i dati locali, preferenze, App Lock e cache, mantiene invariati i backup Drive e richiede
`RIPRISTINA NEXORA`. Non equivale a logout, non cancella file esterni e ha report locale.

## Viewport ed evidence

- 320 / 375 / 390 px: Mobile — liste, CTA e dialog completi, nessun overflow.
- 768 px: Tablet — Settings e dialog leggibili.
- 1024 / 1440 px: Desktop — densità e gerarchia coerenti con shell/Stitch.
- Zoom browser 200%: coperto dai percorsi E2E desktop esistenti senza perdita delle CTA.
- Keyboard-only, focus, safe area, touch `>=44×44 px`: dialog con Escape/focus return, label e target verificati.
- Browser/Playwright: `test/e2e/transactions.spec.ts`, 24 pass su sei viewport.

## Mobile-first gate

| Area | Controllo | Esito | Evidenza |
| --- | --- | --- | --- |
| Universale | Confini Settings/Profile/Security/Trash/Reset | PASS | Sezioni separate e copy preciso. |
| Mobile | Reflow, safe area, CTA e dialog | PASS | 320/375/390 px. |
| Desktop | Densità, pannelli e azioni | PASS | 1024/1440 px. |
| Tablet | Layout intermedio | PASS | 768 px. |
| Visuale | Coerenza Nexora/Stitch | PASS | Token, Inter, colori e componenti condivisi. |
| Ricerca | Ricerca in Settings | N/A | La superficie non espone ricerca propria. |
| Form | Preferences e reset | PASS | Select/toggle, frase forte, backup e PIN. |
| Feedback | Success/error/disabled | PASS | Restore failure ora produce alert accessibile; reset/purge hanno stati busy. |
| Accessibilità | Label, dialog, focus e names | PASS | Axe, Escape e focus return coperti. |
| Finanza | Delete/restore/reset projections | PASS | Repository e test cross-surface verificano saldi/KPI. |
| Performance | Local/offline e build | PASS | Nessuna rete per Settings/Trash/Reset; build PASS. |

## Verifiche

| Area | Risultato | Evidence |
| --- | --- | --- |
| Funzionalità e CTA | PASS | Preference persistence, trash lifecycle, purge e reset. |
| Mobile | PASS | 320/375/390 px. |
| Desktop | PASS | 1024/1440 px e zoom 200%. |
| Responsive | PASS | Sei viewport, no horizontal overflow. |
| Stati UI | PASS | Empty, error, loading/busy, success e destructive dialogs. |
| Accessibilità | PASS | Labels, focus trap/return, Escape, axe. |
| Edge case | PASS | Storage malformato, double submit, transfer group, split/tag references. |
| Coerenza Nexora/Stitch | PASS | Layout e tipografia approvati invariati. |
| Backup interaction | PASS | Backup verificato prima del reset; backup Drive esterni invariati dal reset totale. |
| Security | PASS | App Lock richiesto dal reset finanziario; no secret/log/file deletion fuori contratto; React escaping. |

## Financial integrity

Delete/restore e purge usano le policy del repository: balances, income, expense, saving, Budget e
Analytics sono derivati dal ledger attivo e non includono il cestino. Transfer e split restano
atomici; il reset è transazionale e ricrea soltanto le categorie di sistema.

## Rilievi

### P0

P0 aperti: Nessuno

### P1

Nessuno.

### P2

Nessuno.

## Correzioni e test

- `apps/web/src/settings/SettingsPage.tsx`: feedback `alert/status` per restore failure senza rimuovere l’elemento dal Cestino.
- Correzione post-freeze: dialog distruttivi di Settings riportati a card neutre con padding, gap e azioni
  coerenti; verificati su mobile e desktop.
- Correzione post-freeze aggiuntiva: margini laterali del dialog allineati all’inset del pannello Settings;
  verifica responsive su 320, 375, 390, 768, 1024 e 1440 px.
- Correzione post-freeze aggiuntiva: tema chiaro/scuro applicato prima del mount e persistente al reload;
  modalità Sistema supportata via `prefers-color-scheme`.
- Correzione post-freeze aggiuntiva: Dimensione testo e Riduci animazioni verificate con persistenza;
  CTA e messaggio della Connessione dispositivi allineati all’inset del pannello.
- `apps/web/src/settings/preferences.test.ts`: fallback malformed-storage verificato.
- Review, test evidence, matrice, roadmap e changelog aggiornati.
- Unit/integration mirati Settings/repository/reset: 64 pass.
- E2E Settings/Cestino/Reset: 24 pass su 320/375/390/768/1024/1440.
- `pnpm verify`, `pnpm test:ui-ux`, `pnpm quality:ui-ux`, manifest e `pnpm codex:validate`: PASS.

## Conclusione

`SCREEN_AUDIT_PASS`; P0=0, P1=0, P2=0. Settings, Cestino e Reset sono `FROZEN` per C3.

`UI_REVIEW_PASS`
