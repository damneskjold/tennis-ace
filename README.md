# Blind Coach

Alleni una carriera senza vedere i numeri.

Gioco hobbistico, app statica (HTML/JS/CSS vanilla, niente backend, niente
build step). Sei il coach di un **giocatore-anno storico reale** in un torneo
a eliminazione diretta: a ogni set scegli una lente tattica fra 2-3 proposte,
ma le statistiche restano coperte. Le scopri solo dal *modo* in cui vinci o
perdi i set — e tutte insieme, alla fine, nella pagella.

Design completo in [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md).

## Eseguire in locale

Serve un server statico (il `fetch()` di `data/players.json` non funziona da
`file://`):

```
python3 -m http.server 8000
```

poi apri `http://localhost:8000/`.

## Dati

`data/players.json`: **1319 stagioni giocatore-anno, 1973-2025**, Top 25 ATP
di fine stagione, minimo 20 partite giocate.

Due famiglie di statistiche:

- **servizio e risposta** (10 categorie: ace, prime in campo, palle break
  salvate, punti in risposta, ecc.) — esistono solo **dal 1991**, prima le
  colonne sono vuote nel dataset di origine
- **derivate dal punteggio** (8 categorie: game vinti, vittorie senza
  perdere set, rimonte, primi set, tie-break, set decisivi, rese su terra e
  cemento) — calcolabili **in ogni epoca**, ed è ciò che rende giocabili gli
  anni '70 e '80

Un incrocio fra epoche diverse condivide in media 7,6 categorie (minimo 6);
un match fra due stagioni moderne ne ha 18. Il motore scarta automaticamente
le categorie mancanti su uno dei due lati.

Fonte e nota importante sul repo originale scomparso:
[`docs/DATA_SOURCE.md`](docs/DATA_SOURCE.md). Verifica del campione:
[`docs/VERIFICATION.md`](docs/VERIFICATION.md).

Rigenerare:

```
python3 builder/build_players.py --years $(seq 1973 2025) --top-n 25 \
    --min-matches 20 --cache-dir .cache/tennis_atp --out data/players.json
```

## Motore

```
npm test     # 31 test, nessuna dipendenza esterna (node:test)
```

- `engine/normalize.js` — normalizza il delta fra due giocatori dividendo per
  la deviazione standard di quella statistica sul pool
- `engine/categories.js` — sceglie le 2-3 categorie da proporre per turno.
  Selezione **rank-based** sul matchup: i turni facili offrono gli scarti più
  favorevoli, la finale gli scarti più ampi a segno misto (vedi sotto)
- `engine/resolution.js` — funzione logistica sul delta normalizzato per la
  probabilità di vincere il set, poi punteggio scelto in base a quanto è
  stato netto l'esito
- `engine/categoryMeta.js` — etichette italiane dei bottoni e commenti per
  "sapore" (servizio, risposta, tenuta, rendimento, superficie)
- `engine/index.js` — API pubblica `createEngine(playersData)`

### Curva di difficoltà (misurata, non presunta)

Su 4000 tornei simulati, con scelta casuale dei bottoni e con scelta sempre
ottimale:

| Turno | P(set) | % match a caso | % match scelta perfetta | peso della scelta |
|---|---|---|---|---|
| Ottavi | 0.616 | 64.8% | 71.9% | 0.16 |
| Quarti | 0.552 | 56.0% | 64.3% | 0.12 |
| Semifinale | 0.500 | 50.0% | 64.5% | 0.27 |
| Finale | 0.501 | 49.3% | 72.2% | 0.41 |

Due proprietà volute: la difficoltà **sale** turno dopo turno, e il **peso
della scelta** (distanza fra opzione migliore e peggiore) sale anch'esso,
così quello che hai imparato sul tuo giocatore vale il massimo proprio in
finale. Una finale di soli scarti nulli sarebbe stata un lancio di monetina
in cui nessuna conoscenza conta.
