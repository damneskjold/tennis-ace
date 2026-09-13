# Tennis Storico — Coach di una carriera

Gioco hobbistico, app statica (HTML/JS/CSS vanilla, niente backend), in cui
sei il coach di un giocatore-anno storico reale in un torneo a
eliminazione diretta. Vedi [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md)
per il design completo.

## Stato

`data/players.json` generato e verificato: Top 10 ATP di fine stagione
2021-2025 (50 carte giocatore-anno). Nota: il repo originale di Jeff
Sackmann è stato rimosso da GitHub — vedi
[`docs/DATA_SOURCE.md`](docs/DATA_SOURCE.md) per la fonte sostitutiva
usata e perché. Verifica del campione in
[`docs/VERIFICATION.md`](docs/VERIFICATION.md).

Motore di gioco (`engine/`) completo e testato: normalizzazione del
delta, selezione categorie per turno via percentili sul pool, funzione
logistica per la probabilità di vittoria del set, punteggio/commento.
Prossimo step: frontend (bracket, loop match/set, schermata finale).

## Motore di gioco

```
npm test
```

- `engine/normalize.js` — normalizza il delta fra due giocatori su una
  statistica dividendo per la deviazione standard della statistica sul
  pool (`stat_stddev` in `data/players.json`)
- `engine/categories.js` — sceglie 2-3 categorie da proporre per turno:
  ottavi/quarti privilegiano scarti ampi e a favore del giocatore,
  semifinale/finale scarti via via più piccoli, usando i percentili
  del pool (`gap_percentiles`) invece di soglie fisse
- `engine/resolution.js` — funzione logistica sul delta normalizzato
  per la probabilità di vincere il set, punteggio scelto in base a
  quanto è stata netta quella probabilità (non fasce fisse sul delta
  grezzo — vedi la sezione "Risoluzione del set" del brief)
- `engine/categoryMeta.js` — etichette italiane dei bottoni tattici e
  varianti di commento testuale per il reveal, per "sapore"
  (servizio/risposta/tenuta)
- `engine/index.js` — API pubblica (`createEngine(playersData)`) che
  compone i moduli sopra

## Builder

```
python builder/build_players.py --years 2021 2022 2023 2024 2025 --top-n 10 \
    --cache-dir .cache/tennis_atp --out data/players.json
```

Scarica (e mette in cache in `--cache-dir`) le classifiche e i CSV match di
Sackmann, filtra il Top N ATP di fine stagione per ciascun anno richiesto,
aggrega le 12 statistiche servizio/risposta/clutch per ogni giocatore-anno e
calcola media e deviazione standard di ciascuna statistica sull'intero pool
(necessaria al motore di gioco per normalizzare i delta fra categorie a
varianza naturale molto diversa — vedi il brief).

Test offline (fixture sintetica, non dati reali) della logica di
aggregazione:

```
python builder/tests/test_build_players.py
```
