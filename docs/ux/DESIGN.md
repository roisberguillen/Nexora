# Design system Nexora — specifica congelata

Fonte: Stitch ufficiale registrato in `STITCH_UI_REFERENCE.md`. Questo documento applica il
mockup senza sostituire palette, font e semantica Nexora esistenti.

## Viewport e composizione

| Contesto | Viewport di riferimento | Composizione |
|---|---:|---|
| Mobile compatto | 320 px | header mobile, azione principale raggiungibile, bottom navigation |
| Mobile | 390 × 844 px | card e liste verticali, drawer e bottom sheet per filtri/azioni |
| Tablet | 768 × 1024 px | contenuto fluido, pannelli impilabili |
| Desktop | 1440 × 1024 px | sidebar persistente, top bar, area dati e pannello contestuale |

## Token invarianti

- Spaziatura: scala 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px.
- Raggi: 8, 12, 16, 24 px e pill.
- Tipografia: font applicativi esistenti, corpo non inferiore a 16 px nei controlli mobile e
  cifre tabulari per i valori monetari.
- Semantica: entrate/successo, attenzione, errore/spesa e informazione hanno sempre anche una
  label, icona o testo; il colore non è l'unico segnale.
- Stati: focus ring, hover, pressed, disabled, loading, empty, errore, offline e successo sono
  requisiti di ogni componente interattivo.

## Componenti da consolidare

App shell, navigazione desktop/mobile, top app bar, page header, KPI, account card, righe e
tabelle movimenti, campi importo/data/categoria, controlli segmentati, stati vuoti/caricamento/
errore/offline, toast, dialog distruttivi, drawer e bottom sheet. Le feature non duplicano icone
o SVG: usano un wrapper unico del design system.
