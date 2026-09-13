# Verifica dei dati

Verifica di `data/players.json` — **1319 carte giocatore-anno, Top 25 ATP di
fine stagione, 1973-2025, minimo 20 partite**.

> Una versione precedente di questo documento verificava il campione
> iniziale (50 carte, Top 10, 2021-2025). Quel campione non esiste più: i
> controlli qui sotto sono rifatti sul pool attuale.

## 1. Controlli automatici

Nessun valore fuori da [0,100], nessun nullo inatteso. I nulli presenti sono
tutti spiegati:

- statistiche di servizio e risposta nulle per le stagioni **precedenti al
  1991** (nel dataset di origine quelle colonne sono vuote)
- `deciding_set_won_pct` nullo per chi non ha mai giocato un set decisivo
- `clay_win_pct` / `hard_win_pct` nulli sotto le 8 partite sulla superficie
  (soglia deliberata: su 3 partite una percentuale è rumore, non un profilo)

## 2. Confronto con fonte esterna (Wikipedia)

Il controllo che conta davvero: il numero di partite giocate, contro record
pubblici indipendenti dal nostro builder.

| Giocatore-anno | `matches_played` | Record pubblico | Atteso |
|---|---|---|---|
| Jannik Sinner 2024 | 79 | 73–6 | 79 ✅ |
| Novak Djokovic 2023 | 63 | 56–7 | 63 ✅ |
| Roger Federer 2006 | 97 | 92–5 | 97 ✅ |

### Bug trovato da questo controllo

Il primo build post-estensione dava Sinner 2024 a **81** partite invece di 79.
Le due in eccesso erano **walkover** (Madrid e Cincinnati 2024): ritiri prima
di scendere in campo. Un walkover non è una partita giocata e non entra nei
record ufficiali, ma il builder lo contava. Corretto: `W/O` e `DEF` ora sono
esclusi ovunque (record, game, set, superfici). I ritiri a match iniziato
(`RET`) continuano a contare come vittoria/sconfitta, che è la convenzione
corretta.

## 3. Coerenza dei profili (face validity)

Se l'aggregazione fosse sbagliata, i primi e gli ultimi di ogni classifica non
sarebbero i nomi che chiunque segua il tennis si aspetta. Lo sono:

| Classifica | Primi posti |
|---|---|
| % ace più alta | Karlovic 2015 (26.97%), Isner 2019 (26.97%), Isner 2016, Karlovic 2007 |
| % ace più bassa | Arrese 1991 (1.13%), Schwartzman 2022 (1.44%), Schwartzman 2020, Clavet 1992 |
| Migliori in risposta sulla prima | Gustafsson 1991, Nadal 2012, Murray 2011, Coria 2003 |
| Più game vinti in risposta | Coria 2003, Djokovic 2011, Agassi 1993, Nadal 2012 |
| Migliori sulla terra | Nadal 2006 e 2010 (100%), Muster 1995 (97.01%), Nadal 2007 |

I due estremi della classifica ace sono esattamente i due battitori più
estremi della storia recente da un lato e i regolaristi più bassi di statura
dall'altro; la risposta premia i returner canonici; la terra premia Nadal e
Muster. Nota secondaria: il brief temeva che un pool Top 25 perdesse gli
"specialisti dai profili anomali" — Karlovic, Isner e Schwartzman sono tutti
presenti, quindi il timore non si è materializzato.

## 4. Ridondanza fra categorie

Controllo di correlazione su tutte le coppie di categorie. Il primo tentativo
di famiglia "da punteggio" conteneva `matches_won_pct`, `sets_won_pct` e
`games_won_pct` con correlazioni **r = 0.91–0.96**: lo stesso asse misurato
tre volte, che avrebbe fatto proporre al motore tre varianti della stessa
scelta. Ne è sopravvissuta una sola (`games_won_pct`). Nessuna correlazione
residua sopra 0.85.

## Limite noto

I dati vengono da un mirror di terzi
(`Aneeshers/tennis-sackmann-archive`), perché il repo originale di Sackmann è
stato rimosso da GitHub — vedi [`DATA_SOURCE.md`](DATA_SOURCE.md). I tre
riscontri esterni del punto 2 servono anche a intercettare eventuali
divergenze introdotte dal mirror.
