# Blind Coach — v1

> **Questo è il branch della v1.** La v1 non è un aggiornamento della v0:
> è un gioco diverso, con un'altra premessa. La v0 — giocabile e completa —
> resta intatta sul branch `claude/project-evaluation-atq3o3`.

Ti viene estratto a sorte un giocatore-anno storico reale — Sampras 1997,
Agassi 1999, Sinner 2024 — e lo porti in un torneo a eliminazione diretta.

**Le sue statistiche le vedi.** Quelle dell'avversario no: di lui conosci solo
un **Overall** (80-99) e delle **stelline** per categoria. A ogni set scegli
una giocata — servizio, risposta, palle break, tenuta, palla veloce, palla
lenta — e ognuna ti costa **crediti**, tanti più quanto più è forte per te. I
crediti valgono per tutto il torneo e si ricaricano solo in parte fra un match
e l'altro: la stanchezza si accumula, e in finale non potrai permetterti tutto.

Design completo, con i numeri che lo sostengono:
[`docs/V1_DESIGN.md`](docs/V1_DESIGN.md).

## Perché una v1

La v0 è stata giocata davvero e il verdetto è stato *"clicca a caso e spera"*.
Non era un bug: con le statistiche nascoste e 18 categorie, il gioco non
riusciva a darti abbastanza segnale per decidere qualcosa. La v1 capovolge il
cieco — **conosci te stesso, non l'avversario** — e aggiunge la risorsa che
mancava del tutto: dover scegliere *cosa puoi permetterti*.

## Stato

Design chiuso e validato per simulazione. Implementazione da fare:

- [ ] Builder: 8 categorie consolidate, Overall, superfici con avvicinamento alla media
- [ ] Motore: costi, crediti, stanchezza, colpo del campione, ricalibrazione della curva
- [ ] UI: profilo visibile, stelline avversario, Overall, contatore crediti
- [ ] Playtest

## Dati

Da `data/players.json`. In v1 il perimetro è **1991-2025, Top 25 ATP di fine
stagione** (~870 carte): prima del 1991 il dataset non ha statistiche di
servizio e risposta, e senza quelle 7 delle 8 categorie non esistono. L'era
classica tornerà come modalità separata.

Fonte e nota sul repo originale scomparso:
[`docs/DATA_SOURCE.md`](docs/DATA_SOURCE.md) — verifica dei dati:
[`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Eseguire in locale

Serve un server statico (il `fetch()` di `data/players.json` non funziona da
`file://`):

```
python3 -m http.server 8000
```

## Test

```
npm test
```
