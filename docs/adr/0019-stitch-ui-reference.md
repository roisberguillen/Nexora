# ADR 0019: Stitch come riferimento UI

## Stato

Accepted

## Decisione

L'archivio Stitch identificato in `docs/ux/STITCH_UI_REFERENCE.md` è la fonte ufficiale per
composizione, spaziature, responsive e stati delle superfici Nexora. Palette, font, dominio e
regole contabili del repository hanno precedenza. I prototipi HTML sono materiale di riferimento,
non codice di produzione.

## Conseguenze

La Fase 1 mantiene una matrice esplicita schermata → feature. Le implementazioni usano
componenti React accessibili, testabili e riutilizzabili, senza duplicare markup Stitch.
