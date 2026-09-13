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

- **Modalità carriera** (Grande Slam: 4 tornei di fila con lo stesso
  giocatore, uno per superficie) e **modalità all-star**: entrambe secondarie,
  non ancora iniziate
- **Calibrare `LOGISTIC_K`** (oggi 0.65, scelto a occhio) contro un obiettivo
  esplicito di difficoltà
- **Deploy** su GitHub Pages
- Aperto: nessun tutorial/spiegazione delle regole nella schermata iniziale —
  un playtest ha mostrato che non è ovvio come si gioca al primo impatto

### Bug trovati giocandoci davvero (13/09/2026)

Un vero playtest ha fatto emergere due bug che nessun test automatico aveva
preso, entrambi corretti:

1. **Un turno "facile" poteva offrire una categoria sfavorevole travestita da
   opportunità.** Quando il matchup aveva meno categorie realmente favorevoli
   di quante bottoni servivano (21% dei matchup casuali, misurato — non un
   caso raro), il codice si allargava a tutta la lista comprese le categorie
   negative. Caso reale: Baghdatis 2006 contro Sampras 1993 ha solo 2
   categorie a favore di Baghdatis, e gli ottavi ne offrivano comunque 3.
   Corretto: ora offre sempre e solo le categorie realmente favorevoli, più —
   se non bastano — la singola meno sfavorevole rimasta, mai una peggiore.
2. **Un bottone si illuminava di verde a caso.** Era l'hover CSS che su
   schermo touch resta "attaccato" all'ultimo tasto toccato finché non tocchi
   altrove — sembrava un suggerimento del gioco, non lo era. Ora l'hover è
   limitato ai dispositivi con puntatore vero; su touch il feedback al tocco
   si spegne all'istante al rilascio.

Un terzo punto segnalato ("ho vinto con la statistica peggiore") è
comportamento corretto, non un bug: il motore è probabilistico, non
deterministico. Un'opzione al 23% di vincere non è uno 0% — vince circa 1
volta su 4. Verificato inoltre che ridurre il pool a Top10 **non risolve**
i matchup senza vantaggi reali (21.6% dei casi, identico al 21.1% del Top25):
la causa vera è l'incrocio fra epoche (34% dei matchup misti contro l'11%
nella stessa epoca), perché sotto certe combinazioni di categorie mancanti
diventa più facile per caso non avere alcun vantaggio.

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

| Turno | P(set) | % match a caso | peso della scelta |
|---|---|---|---|
| Ottavi | 0.631 | 67.7% | 0.15 |
| Quarti | 0.601 | 64.6% | 0.14 |
| Semifinale | 0.500 | 50.4% | 0.27 |
| Finale | 0.500 | 49.4% | 0.41 |

(Numeri dopo il fix di [`categories.js`](engine/categories.js) descritto sotto —
prima del fix i quarti risultavano al 56%, quasi un coin-flip, perché
occasionalmente offrivano una categoria sfavorevole travestita da "turno
facile".)

Due proprietà volute: la difficoltà **sale** turno dopo turno, e il **peso
della scelta** (distanza fra opzione migliore e peggiore) sale anch'esso, così
quello che hai capito sul tuo giocatore vale il massimo proprio in finale. Una
finale di soli scarti nulli sarebbe stata un lancio di monetina in cui nessuna
conoscenza conta.
