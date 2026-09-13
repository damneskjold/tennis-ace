# Calibrazione della pendenza (`LOGISTIC_K`)

`LOGISTIC_K = 0.45`

In v0 questa costante valeva 0.65 ed era stata scelta a occhio — un debito
segnalato nel README per mesi. In v1 non poteva essere ereditata comunque: il
delta non è più "differenza fra due statistiche grezze diviso la deviazione
standard", è la differenza fra due **punteggi di categoria** già composti in
spazio z. Scala diversa, costante diversa.

## Com'è distribuito il delta nel pool v1

Su 6000 accoppiamenti casuali (870 carte, 8 categorie ciascuna):

| | |
|---|---|
| scarto mediano su una categoria | 0.88 |
| 90° percentile | 2.20 |
| 99° percentile | 3.63 |
| massimo osservato | 6.57 |
| **miglior carta disponibile** in un matchup a caso (mediana) | **1.61** |

Quest'ultima riga è quella che conta: è lo scarto su cui il giocatore gioca
davvero, perché sceglie la carta migliore che può permettersi.

## Gli obiettivi

1. La carta migliore in un matchup tipico deve essere **un vantaggio vero, non
   una certezza** — altrimenti la scelta non è una scommessa.
2. L'arma di uno specialista deve reggere **anche contro il migliore del
   pool**: Isner 2016 (Overall 86) contro Sinner 2025 (98) deve poter portare
   a casa un set.
3. Vincere un torneo dev'essere **un risultato, non la norma**.
4. Giocare bene deve valere **molto più** che cliccare a caso.

## Cosa danno le varie pendenze

Bo3, 4000 tornei per riga. "Bravo" = vede le proprie carte e le stelline
avversarie e sceglie il miglior rapporto vantaggio/costo; "a caso" = sceglie a
sorte fra quel che può permettersi.

| K | arma di Isner vs Sinner | tornei vinti (bravo) | (a caso) | divario |
|---|---|---|---|---|
| 0.30 | 59% | 16.9% | 6.4% | 2.7x |
| 0.40 | 62% | 21.3% | 7.6% | 2.8x |
| **0.45** | **63%** | **23.5%** | **7.0%** | **3.3x** |
| 0.50 | 65% | 26.1% | 7.0% | 3.7x |
| 0.65 | 69% | 33.6% | 8.3% | 4.1x |

Pendenze più alte premiano di più l'abilità (4.1x a 0.65), ma fanno vincere un
torneo su tre: il titolo smette di essere un traguardo. **0.45** tiene l'arma
di Isner a un 63% che è un vantaggio reale senza essere una garanzia, un
torneo vinto ogni quattro, e 3.3 volte il rendimento di chi gioca a caso.

## Effetto sui formati

| | bravo | a caso | divario |
|---|---|---|---|
| Bo3 | 23.5% | 7.0% | 3.3x |
| Bo5 | 13.8% | 6.0% | 2.3x |

Il Bo5 è finalmente **una modalità diversa e non solo più lunga**: più set
significa più occasioni in cui il portafoglio ti costringe alle carte deboli.
In v0 i due formati differivano solo per durata.

## Una nota su Schwartzman

La sua arma (risposta, punteggio 96) contro Sinner 2025 vale ~51%, non 63%
come quella di Isner. Non è un difetto della calibrazione: Sinner 2025 ha
risposta 95, quindi lo specialista della risposta non trova lì nessun
vantaggio. Contro un avversario diverso la stessa carta vale molto di più. È
esattamente il comportamento voluto — le armi sono relative a chi hai davanti,
non assolute.

## Come rifare la misura

Lo script di calibrazione non è in repo perché usa un giocatore simulato che
non fa parte del gioco. La ricetta: per ogni K, far giocare N tornei a una
strategia "bravo" (miglior vantaggio percepito per credito, stimando
l'avversario dalle sole stelline) e a una "a caso", e confrontare le quattro
righe della tabella qui sopra.
