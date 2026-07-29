# Origine PWA ufficiale

In sviluppo Nexora usa esclusivamente `http://127.0.0.1:5173`.

La porta predefinita è fissata e l'app espone `127.0.0.1` come origine ufficiale.
I test di persistenza possono però avviare porte effimere isolate, senza condividere
l'archivio dell'app. Questo evita che `localhost`, `127.0.0.1` o porte differenti
mostrino archivi browser distinti come se fossero dati persi. La preview usa
`http://127.0.0.1:4173` e mantiene gli header COOP/COEP necessari al runtime WASM.

Il service worker elimina cache obsolete, prende possesso dei client e aggiorna
automaticamente l'app shell. Il precache include WASM e worker SQLite.
