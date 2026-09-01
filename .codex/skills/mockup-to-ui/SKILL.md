# Skill: Mockup to Nexora UI

Usare quando una modifica deriva dal mockup ufficiale in `design/mockup/stitch/`.

## Procedura

1. Leggere `docs/ux/MOCKUP_INTEGRATION.md`.
2. Estrarre intenzione visiva, non copiare markup in modo acritico.
3. Mappare colori, spaziature, tipografia e raggi su token semantici.
4. Separare shell, navigazione, componenti finanziari e contenuti pagina.
5. Implementare mobile e tastiera insieme al desktop.
6. Aggiungere test per stati e accessibilità.
7. Documentare divergenze deliberate.

## Divieti

- Nessun dato reale nei mock.
- Nessun HTML del prototipo incluso direttamente nella build.
- Nessun colore duplicato se esiste un token.
- Nessun componente finanziario privo di formattazione `it-IT`.
