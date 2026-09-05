# 12.5.C4.9 — Backup manuale, restore, rollback e regressione Google Drive

Framework: `docs/ux/C4_REAL_COMPLETE_FLOWS_FRAMEWORK.md`
Template: `.codex/templates/c3-screen-audit.md`
Manifest: nexora-ui-ux-mobile-desktop/v1
Checklist: Nexora_Checklist_UI_UX_Mobile_Desktop/v2
Surface: Backup, Restore, Startup/Recovery, Conti, Dashboard, Drive opzionale
Schermata: C4.9 complete backup, restore and rollback flow
Route: `#backup`, `#accounts`, `#transactions`, `#overview`
Routes: `backup`, `accounts`, `transactions`, `overview`
Task/Fase: 12.5.C4.9
Branch: `codex/phase-12-5-0-checkpoint`
Data: 2026-09-05
Reviewer/fase: Codex — Security + UI/UX + QA, 12.5.C4.9
Modifiche: E2E A → B → A, offline IndexedDB, provider Drive con metadati tecnici e marker Nexora.
Result: `FLOW_AUDIT_PASS`
Esito: PASS
Flusso principale: ledger controllato → backup cifrato → download → stato B → verifica read-only → conferma restore → reload/reopen
Viewport applicabili: 320, 375, 390, 768, 1024 e 1440 px; zoom CDP 200% e round-trip cifrato a 1440.

| Area | ID | Esito | Evidenza / N.A. |
| --- | --- | --- | --- |
| Universale | U-01 | PASS | Stato A/B/A reale, download cifrato, ricevuta, restore e confronto post-reload. |
| Mobile | M-01 | PASS | Backup accessibile e senza overflow su 320/375/390; flusso principale desktop-only. |
| Desktop | D-01 | PASS | Round-trip OPFS/PWA e zoom reale 200% coperti a 1440; layout 1024 verificato nei test esistenti. |
| Tablet | T-01 | PASS | Smoke Backup responsive a 768 px. |
| Visuale | V-01 | PASS | Form, ricevuta, dialog e cronologia coerenti con il mockup ufficiale. |
| Ricerca | R-01 | PASS | Stato A restaurato e rileggibile nelle superfici locali; nessun dato inviato. |
| Form | F-01 | PASS | Passphrase minima, file picker, verifica, invalidazione ricevuta e conferma separata. |
| Feedback | FB-01 | PASS | Errori accessibili, stato occupato, cronologia tecnica e successo restore. |
| Accessibilità | A-01 | PASS | Axe, focus dialog, Escape, tastiera, target ≥44×44 e overflow verificati. |
| Finanza | FN-01 | PASS | Stato A `1180/300`, totale `1480`; stato B `1100/300/50`, totale `1450`; A restaurato esatto. |
| Performance | P-01 | PASS | IndexedDB offline, OPFS reale, SQLite repository, rollback atomico e benchmark esistente. |

## Sicurezza e riconciliazione

Il formato resta `.nexora-backup`, AES-256-GCM, PBKDF2-HMAC-SHA-256 a 600.000 iterazioni,
salt/IV casuali, manifest/checksum/schema verificati prima del download o restore. La ricevuta
espone solo nome file, schema, data, prefisso checksum e conteggi; la passphrase non viene
persistita. Il provider Drive usa esclusivamente `drive.appdata`, `appDataFolder`, token in memoria,
upload senza retry e metadati tecnici `checksum`, `backupId`, formato, schema, data e dimensione.

Il test UI usa fixture sintetiche: A contiene Operativo `1000 + 500 - 120 - 200 = 1180` e Riserva
`100 + 200 = 300`, quattro transazioni e trasferimento a due gambe. B aggiunge spesa `80` e conto
Temporaneo `50`, ottenendo Operativo `1100`, Riserva `300`, Temporaneo `50`, totale `1450`.
La verifica errata non modifica B; la verifica corretta è read-only; cambio passphrase invalida la
ricevuta; Escape/Annulla non scrivono; il restore confermato torna ad A dopo reload e nuova pagina.

Rollback post-write è coperto dal PortableBackupEngine e dagli adapter IndexedDB/SQLite/OPFS;
gli archivi manomessi, passphrase errate, schema futuro, checksum/dimensione Drive incoerenti e
metadati Drive non Nexora sono rifiutati prima della sostituzione. Nessun account, token, segreto,
importo o richiesta reale è stato usato.
P0 aperti: Nessuno
P1/P2 aperti: Nessuno

## Gate

Unit/verify: 140 file, 629 pass, 4 skip, 0 failure; nuovo C4.9 E2E `2 passed` a 1440; matrice
backup/regressioni `66 passed`, `60 skipped`, `0 failed` sui sei profili. Skip motivati da test
one-shot desktop/offline/backend; retry Playwright invariati. UI/UX e audit dipendenze da eseguire
nel gate finale. Evidence principale: `test/e2e/c4-backup-restore-drive-flow.spec.ts`.
