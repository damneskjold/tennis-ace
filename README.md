# Tennis Storico — Coach di una carriera

Gioco hobbistico, app statica (HTML/JS/CSS vanilla, niente backend), in cui
sei il coach di un giocatore-anno storico reale in un torneo a
eliminazione diretta. Vedi [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md)
per il design completo.

## Stato

`data/players.json` generato: Top 10 ATP di fine stagione 2021-2025 (50
carte giocatore-anno). Nota: il repo originale di Jeff Sackmann è stato
rimosso da GitHub — vedi [`docs/DATA_SOURCE.md`](docs/DATA_SOURCE.md)
per la fonte sostitutiva usata e perché. Prossimo step: verifica a mano
del campione (vedi `docs/PROJECT_BRIEF.md`).

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
