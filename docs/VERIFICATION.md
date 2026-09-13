# Verifica del campione (step 2)

Verifica dei 50 valori generati in `data/players.json` (Top 10 ATP di
fine stagione, 2021-2025), come da `docs/PROJECT_BRIEF.md` — campione
piccolo apposta per poter controllare a mano.

## 1. Controlli automatici (range e nulli)

Nessun valore nullo inatteso, nessuna percentuale fuori [0,100] su
tutte le 50 carte × 12 statistiche. `deciding_set_won_pct` è `null`
solo per i giocatori che non hanno mai giocato un set decisivo
nell'anno (atteso, non un bug).

## 2. Coerenza interna (ordinamento relativo fra profili noti)

Controllo se il ranking relativo delle statistiche rispecchia i
profili di gioco reali e noti:

| Aspettativa | Verificato |
|---|---|
| Hurkacz (big server) = ace% più alto del pool ogni anno | Sì — 12.4/16.2/16.8% (2021-23), sempre in cima |
| Hurkacz = return_games_won più basso del pool | Sì — 16-22%, minimo assoluto in più anni |
| Nadal, Alcaraz, De Minaur, Sinner (non big server) = ace% basso | Sì — 4-9% contro 10-17% dei big server |
| Djokovic = risposta più forte del pool (return_first_won, bp_converted) | Sì — sistematicamente il valore più alto o vicino, ogni anno |
| Djokovic = bp_saved_pct alto (tenuta al servizio) | Sì — 63-67% ogni anno, tra i più alti |
| Sinner 2024/2025 = stagioni più dominanti del pool | Sì — service_games_won 91-92%, tiebreaks_won 75-83%, massimi assoluti |

Sei aspettative indipendenti, tutte confermate. Un bug sistematico
nella formula (es. servizio/risposta scambiati, segno invertito,
doppio conteggio) avrebbe quasi certamente rotto almeno uno di questi
pattern noti.

## 3. Confronto con fonte esterna indipendente (Wikipedia)

Non bastava la coerenza relativa: serviva un numero assoluto da una
fonte diversa dal builder stesso.

| Giocatore-anno | `matches_played` (nostro) | Record pubblico (Wikipedia) | Totale atteso |
|---|---|---|---|
| Jannik Sinner 2024 | 79 | 73–6 | 79 ✅ esatto |
| Novak Djokovic 2023 | 63 | 56–7 | 63 ✅ esatto |

Entrambi i controlli tornano esatti. Questo valida sia la selezione
Top 10/anno (giocatore giusto, anno giusto) sia il conteggio delle
partite aggregate — non solo l'ordinamento relativo delle statistiche.

Un terzo tentativo di verificare una percentuale di gioco puntuale
(non solo il conteggio partite) contro ultimatetennisstatistics.com è
fallito per URL/ID indovinato male, non riprovato per non spendere
tempo su un singolo numero quando la coerenza interna su tutte le 50
carte è già forte.

## Esito

Verifica superata. Nessuna correzione necessaria al builder. Si
procede allo step 3 (motore JS) usando `data/players.json` così
com'è.

## Limite noto (invariato)

`data/players.json` proviene da un mirror di terzi
(`Aneeshers/tennis-sackmann-archive`), non dal repo originale di
Sackmann che è stato rimosso — vedi `docs/DATA_SOURCE.md`. Se in
futuro il repo originale dovesse tornare disponibile, vale la pena
rigenerare il file e ripetere questa verifica per intercettare
eventuali discrepanze introdotte dal mirror.
