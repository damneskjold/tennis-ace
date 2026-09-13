# Tennis Storico — Coach di una carriera

Gioco hobbistico ispirato nello spirito (non nella meccanica) a
[82-0-lega-a](https://github.com/damneskjold/82-0-lega-a): pochi click,
zero abilità tecnica richiesta, guidato da statistiche storiche reali.
App statica (HTML/JS/CSS vanilla), niente backend, stile GitHub Pages.

## Concept

Sei il **coach di un giocatore-anno storico** (es. "Murray 2016") in un
torneo a eliminazione diretta. Ad ogni set scegli una **lente tattica**
(es. "Punta sul servizio", "Giocala da fondo") fra 2-3 proposte dal
motore. Il motore confronta le statistiche vere del tuo giocatore e
dell'avversario su quell'asse e decide l'esito — ma **non ti mostra i
numeri prima di scegliere**: li scopri solo nel feedback dopo la scelta,
sotto forma di punteggio tennistico (6-2, 7-6...) più un commento
testuale.

### Perché questa forma e non altre

Scartate esplicitamente durante il brainstorming:
- **Trivia puro** (mostrare due stat e chiedere "chi ha fatto più ace",
tipo Higher/Lower): richiede di *sapere* un numero, non di ragionare.
- **Simulatore autonomo** (tocchi "Sfida" e il motore decide tutto):
zero controllo reale del giocatore.
- **Scelta esplicita di stat coi numeri visibili**: ridiventa trivia per
chi conosce a memoria le statistiche dei giocatori reali.

La soluzione: **stesso giocatore per tutto il torneo, stat sempre
coperte**. Non sai i numeri, ma impari a "conoscere" il tuo giocatore
match dopo match dal *modo* in cui vinci o perdi i set (6-1 vs 7-6 dice
cose diverse sulla stessa categoria). Il controllo è reale — scegli la
lente, e quella scelta pesa davvero sull'esito — ma non è mai un test di
cultura tennistica.

## Struttura del torneo

- Scelta iniziale: **Bo3** o **Bo5** (best of 3 / best of 5 set)
- Bracket a eliminazione, tipicamente 4 turni (ottavi → quarti →
semifinale → finale)
- **Stesso giocatore-coach per tutto il torneo**; ad ogni turno viene
estratto un nuovo avversario a caso
- Ad ogni set: 2-3 bottoni tattici → click → reveal punteggio + commento
- Vinci il match (maggioranza set) → prossimo turno, nuovo avversario
- Fine torneo (vittoria o eliminazione): schermata finale con la
"pagella" — qui, e solo qui, si svelano tutte le statistiche vere di
tutti i match giocati

## Meccanismo di difficoltà crescente (il cuore del design)

La difficoltà **non** dipende dalla forza dell'avversario pescato (che è
casuale), ma da **quali categorie il motore ti propone** a ogni turno:

- **Ottavi**: propone le categorie dove lo scarto fra te e l'avversario
è più ampio (in termini normalizzati, vedi sotto) — è "facile" perché
anche scegliendo a caso è probabile pescare un vero vantaggio
- **Quarti/Semifinale**: mix, scarti via via più piccoli
- **Finale**: solo categorie a scarto minimo — vero coin-flip anche per
chi segue tennis da una vita

Stesso principio già usato in LBA 30-0 per la curva di difficoltà
(percentili calcolati dal pool reale, non frazioni scelte a occhio).

### Normalizzazione del delta (bug da evitare fin da subito)

**Problema**: statistiche diverse hanno varianza naturale molto diversa
nel pool (es. ace% può variare di 10+ punti fra un battitore puro e un
regolarista; palle break salvate% varia tipicamente di 3-4 punti anche
fra giocatori molto diversi). Confrontare i delta grezzi fra categorie
diverse per decidere "quale proporre come facile/difficile" fa scegliere
quasi sempre le statistiche ad alta varianza naturale (es. ace%) e quasi
mai quelle a bassa varianza (es. clutch), anche quando in queste ultime
lo scarto relativo è enorme.

**Fix**: normalizzare ogni delta per la deviazione standard di quella
specifica statistica sul pool intero, prima di usarlo per ordinare le
categorie per "facilità":

```
delta_normalizzato = (stat_mio_giocatore - stat_avversario) / deviazione_standard_di_quella_stat_sul_pool
```

La deviazione standard per ciascuna statistica si calcola una volta sola
su tutto il pool (nel builder Python o all'avvio del JS) e si usa per
ogni confronto successivo.

## Risoluzione del set: probabilità, non fasce fisse arbitrarie

Bozza iniziale (dalla demo) da **non** portare così com'è in produzione:

```javascript
if (delta > 4) category = "dominante_win";
else if (delta > 1) category = "misura_win";
else if (delta >= -3 && delta <= 1) {
    category = Math.random() > 0.4 ? "tie_break_win" : "tie_break_loss";
}
else if (delta >= -6) category = "misura_loss";
else category = "dominante_loss";
```

Due difetti identificati:
1. **Fascia tie-break asimmetrica** (-3 a +1, non centrata sullo zero) —
le probabilità implicite non sono quello che sembrano.
2. **Dentro la fascia tie-break il risultato è un coin flip fisso al
60%, indipendente dal valore reale del delta** — un delta di +0.9 e uno
di -2.9 vincono con la stessa probabilità. Il numero vero diventa
ininfluente proprio nella fascia più delicata.

**Fix proposto**: usare una funzione logistica sul delta normalizzato
(stesso principio della curva a due tratti di LBA 30-0) per determinare
la probabilità di vincere il set, poi tirare un numero casuale pesato da
quella probabilità per decidere l'esito e mappare lo scarto sul
punteggio tennistico (liste di punteggi possibili per fascia, con
varianti multiple per non ripetere sempre lo stesso — es. dominante_win
→ 6-0/6-1/6-2/6-3 a caso — e più liste di commenti testuali per fascia,
per varietà).

## Fonte dati

[Jeff Sackmann — tennis_atp](https://github.com/JeffSackmann/tennis_atp):
dataset open match-by-match dal 1991 in poi, licenza libera, nessun
rischio ToS (a differenza di Transfermarkt/Opta per il calcio, o del
lavoro di verifica scraping fatto per legabasket.it in LBA 30-0).

### Statistiche disponibili (12-15 categorie utilizzabili)

**Fase servizio**: % ace, % prime in campo, % punti vinti su prima, %
punti vinti su seconda, % palle break salvate, % game al servizio vinti

**Fase risposta**: % punti vinti in risposta su prima avversaria, % su
seconda avversaria, % palle break convertite, % game in risposta vinti

**Tenuta/clutch**: % tie-break vinti in stagione, % partite vinte al set
decisivo

Non serve una categoria diversa per ogni set del torneo (fino a 20 set
in un Bo5 su 4 turni) — è corretto e voluto ripetere la stessa categoria
fra un turno e l'altro (impari che il tuo giocatore è forte a rete al
turno 1 e rigiochi quella carta più avanti); va evitato solo ripetere la
stessa categoria **nello stesso match**.

## Perimetro dati (2 modalità)

1. **Base** (partire da qui): Top 50 ATP, maschile, dal 2000 in poi (in
prospettiva — il test iniziale userà un campione più piccolo, vedi sotto)
2. **All-star** (da affinare dopo): solo giocatori con almeno uno Slam
vinto o ex n.1, solo annate "top" — modalità secondaria

Perché Top 50 e non 25 o 100 (discusso): Top 25 è troppo schiacciata
verso l'alto (valori tutti simili, poca varietà); Top 100 include troppi
sconosciuti per il giocatore occasionale; Top 50 include sia i campioni
sia gli "specialisti" dai profili statistici anomali (battitori puri
alla Isner, regolaristi da fondo alla Schwartzman) che rendono le scelte
tattiche davvero interessanti.

### Campione di test iniziale

Top 10 ATP, stagioni 2021-2025 → **50 carte giocatore-anno**. Abbastanza
grande da vedere se le statistiche variano a sufficienza da rendere il
gioco interessante, abbastanza piccolo da verificare i numeri a mano.

## Feedback del set (UX)

Dopo ogni scelta, reveal con:
- Punteggio tennistico plausibile (mai lo stesso ripetuto identico, pool
di punteggi per fascia + rumore statistico dove serve)
- **Un testo, non solo il numero** — es. "Dominio assoluto al servizio
(6-2)" — con più varianti per fascia per non diventare ripetitivo
- Nessuna statistica vera mostrata fino alla schermata finale del
torneo, dove si svelano tutti i numeri di tutti i match giocati

## Limite noto, da tenere a mente (non necessariamente da risolvere)

L'app è statica senza backend: tutte le statistiche vere sono comunque
scaricabili nel JSON pubblico e ispezionabili da chi apre gli strumenti
di sviluppo del browser. Il "cieco" è un contratto di design col
giocatore casual, non un vincolo tecnico reale — per un gioco hobbistico
è un compromesso accettabile, va solo tenuto presente.

## Prossimi passi

1. Builder Python: scarica CSV Sackmann, filtra Top 10 2021-2025, calcola
le statistiche aggregate per giocatore-anno, calcola anche la deviazione
standard di ogni statistica sul pool, esporta `players.json`
2. Verificare a mano i 50 valori (campione piccolo apposta per questo)
3. Motore JS: normalizzazione del delta, selezione categorie per turno
in base al delta normalizzato, funzione logistica per la probabilità di
vittoria del set (non fasce fisse con coin flip interno)
4. Frontend: bracket, loop match/set, schermata finale con pagella
5. Solo dopo la v1 funzionante: estendere a Top 50, poi eventualmente
alla modalità "all-star"
