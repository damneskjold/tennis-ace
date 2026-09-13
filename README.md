# Blind Coach

Alleni una carriera senza vedere i numeri.

Gioco hobbistico, app statica (HTML/JS/CSS vanilla, niente backend, niente
build step). Ti viene **estratto a sorte** un giocatore-anno storico reale —
Borg 1980, Agassi 1999, Sinner 2024 — e lo porti in un torneo a eliminazione
diretta. A ogni set scegli una lente tattica fra 2-3 proposte, ma le sue
statistiche restano coperte: le deduci solo dal *modo* in cui vinci o perdi i
set, e le vedi tutte solo alla fine, nella pagella.

Design e storia delle decisioni: [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md).

## Eseguire in locale

Serve un server statico (il `fetch()` di `data/players.json` non funziona da
`file://`):

```
python3 -m http.server 8000
```

poi apri `http://localhost:8000/`.

## Stato

Funzionante e giocabile dall'inizio alla fine. Fatto:

- **Dati** — 1319 stagioni giocatore-anno, verificate ([`docs/VERIFICATION.md`](docs/VERIFICATION.md))
- **Motore** — normalizzazione, selezione categorie con curva di difficoltà
  misurata, risoluzione probabilistica del set (31 test)
- **Frontend** — estrazione animata, tabellone, loop match/set, reveal in due
  tempi, taccuino, pagella con controfattuali

Il **taccuino** è il ciclo di apprendimento del gioco: mentre scegli vedi
quali lenti hai già giocato e con che punteggio le hai vinte o perse, nel
match in corso e raggruppate per lente nei turni precedenti. Mai una
statistica vera — quelle restano coperte fino alla pagella, altrimenti il
gioco diventa un esercizio di memoria. Il *quanto* (6-1 contro 7-6) è invece
l'unica informazione con cui puoi dedurre chi stai allenando, ed è tua di
diritto: l'hai guadagnata sul campo.

Da fare:

- **Modalità all-star**: solo i veri fuoriclasse (20-30 nomi scelti a mano) e
  solo le loro annate migliori
- **Calibrare `LOGISTIC_K`** (oggi 0.65, scelto a occhio) contro un obiettivo
  esplicito di difficoltà
- **Deploy** su GitHub Pages
- Aperto: dentro al singolo torneo il taccuino ora fa il suo lavoro, ma fra un
  torneo e l'altro non si accumula nulla — esce un giocatore nuovo e riparti da
  zero. Una modalità **carriera** (stesso giocatore estratto per più tornei di
  fila) darebbe respiro alla premessa, ed è letteralmente il sottotitolo del
  brief originale

## Dati

`data/players.json`: **1319 stagioni, 1973-2025**, Top 25 ATP di fine
stagione, minimo 20 partite giocate.

Due famiglie di statistiche:

- **servizio e risposta** (10 categorie) — esistono solo **dal 1991**, prima
  le colonne sono vuote nel dataset di origine
- **derivate dal punteggio** (8 categorie: game vinti, vittorie senza perdere
  set, rimonte, primi set, tie-break, set decisivi, rese su terra e cemento) —
  calcolabili **in ogni epoca**, ed è ciò che rende giocabili gli anni '70 e '80

Un incrocio fra epoche condivide in media 7,6 categorie (minimo 6); due
stagioni moderne ne condividono 18. Il motore scarta da solo le categorie
mancanti su un lato, quindi Borg contro Sinner si gioca su temperamento e
risultati, non su statistiche di servizio che per Borg nessuno ha mai
registrato.

Fonte e nota sul repo originale scomparso:
[`docs/DATA_SOURCE.md`](docs/DATA_SOURCE.md).

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
- `engine/categories.js` — sceglie le 2-3 categorie da proporre per turno
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
della scelta** (distanza fra opzione migliore e peggiore) sale anch'esso, così
quello che hai capito sul tuo giocatore vale il massimo proprio in finale. Una
finale di soli scarti nulli sarebbe stata un lancio di monetina in cui nessuna
conoscenza conta.
