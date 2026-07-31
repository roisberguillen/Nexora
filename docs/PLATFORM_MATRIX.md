# Matrice piattaforme

| Capacità | Browser/PWA | Windows/macOS | Android |
|---|---|---|---|
| Runtime | React/Vite | Tauri 2 | Tauri 2 Android |
| Database | SQLite WASM OPFS / IndexedDB | SQLite nativo | SQLite nativo |
| Backup manuale | download/upload `.nexora` | file picker nativo | document picker |
| Google Drive | OAuth browser | adapter piattaforma | adapter piattaforma |
| Sicurezza | Web APIs disponibili | secure storage | Android Keystore/biometria |
| Local Hub | client associato | host o client | client associato |

La PWA è un prodotto opzionale separato. Le applicazioni native devono funzionare senza Node,
browser, Docker o rete Internet.
