# Blind Coach v1 — documento di design

La v1 **non è un aggiornamento della v0: è un gioco diverso**. La v0 resta
intatta sul branch `claude/project-evaluation-atq3o3`.

## Perché

La v0 è stata giocata davvero, e il verdetto è stato: *"non ho capito
assolutamente come giocare… è un po' clicca a caso e spera"*.

La diagnosi non era un bug. In v0 il gioco ha **un solo canale informativo**
(il taccuino: come sono andate le categorie già giocate), ma con 18 categorie
e ~10-14 scelte per torneo la maggior parte delle categorie la vedi zero o una
volta sola. Un 6-3 isolato è rumore, non segnale. E sotto il velo "non conosci
il numero" la decisione è banale: scegli la probabilità più alta. Quindi
**l'unica abilità del gioco era dedurre la probabilità da un feedback troppo
rado per dare segnale** — e quel che resta, matematicamente, è cliccare a caso.

## Il capovolgimento

Il "cieco" si sposta: **da te all'avversario**.

| | v0 | v1 |
|---|---|---|
| Le tue statistiche | nascoste | **visibili** |
| Quelle dell'avversario | nascoste | **stelline** (1-5), mai il numero |
| Forza dell'avversario | ignota | **Overall 80-99** |
| La scelta | una lente fra 2-3 | una **giocata che costi crediti** |

Hai informazione vera dal primo set (nessuna partenza a freddo), e l'incertezza
resta dove ha senso: non conosci lo sconosciuto che hai di fronte, non te
stesso. Un coach vero funziona così.

## Perimetro dati

**Solo dal 1991**, 870 carte giocatore-anno, Top 25 ATP di fine stagione.

Obbligato dalla consolidazione: le categorie nuove sono quasi tutte
servizio/risposta, che prima del 1991 nel dataset non esistono. Un Borg 1980
avrebbe **1 categoria giocabile su 8**. L'era classica tornerà come modalità
separata con le sue regole, non mescolata.

## Le 8 categorie

Scelte per correlazione misurata sul pool reale, non a occhio. Le fusioni sono
gruppi che correlavano fra 0.62 e 0.89 — cioè lo stesso asse misurato più volte.

| Carta | Da cosa nasce |
|---|---|
| **Servizio** | ace% + punti vinti su 1ª + palle break salvate% + game al servizio vinti% *(correlate 0.62-0.86)* |
| **Prima di sicurezza** | % prime in campo *(asse di rischio, non correla col resto)* |
| **Seconda** | % punti vinti sulla seconda *(asse a sé)* |
| **Risposta** | punti in risposta su 1ª + su 2ª + game in risposta vinti *(correlate 0.67-0.89)* |
| **Palle break** | % convertite — tenuta separata su richiesta, ed è anche la meno correlata del gruppo risposta (0.67-0.79 contro 0.89 fra le altre) |
| **Tenuta** | tie-break vinti + set decisivi + rimonte da sotto *(l'unico gruppo genuinamente indipendente)* |
| **Palla veloce** | rese su cemento + erba + sintetico |
| **Palla lenta** | rese sulla terra |

Superficie come **stile di gioco**, non come campo: "gioco a palla veloce" è
una cosa che scegli, "giocare sul cemento" no. L'erba non è un terzo stile,
sta con la palla veloce.

### Due trappole già evitate

**Le carte di superficie usano i valori grezzi, non lo stile relativo.** Una
prima versione le normalizzava rispetto al giocatore stesso (`terra − cemento`),
ottenendo uno stile "puro" scollegato dalla bravura. Effetto misurato:
chiunque si ritrovava un'arma gratis contro chiunque avesse stile diverso, e
**un OVR 80 batteva Sinner 2025 il 52% delle volte**. Coi valori grezzi:
Seppi 2013 scende a 40%, l'underdog estremo dal 69% al 41%. Le due carte non
sono ridondanti fra loro: r=+0.21.

**Niente soglia secca sulle superfici.** Una soglia a 8 match escludeva 102
carte, di cui 91 per mancanza di terra: Sampras (5 stagioni), Agassi (4),
Federer 2016-2018, Roddick, Isner, Karlovic, Ivanisevic 2001, Kyrgios — cioè
esattamente gli specialisti che rendono il gioco interessante. Saltare la
stagione sulla terra *è* il profilo del giocatore da campo veloce, non un buco
nei dati. Si usa invece un **avvicinamento alla media proporzionale al numero
di match** giocati su quella superficie. Caso limite: Federer 2017, zero match
sulla terra, carta neutra.

## Overall (80-99)

Media degli z-score su tutte le categorie, scalata min-max. Sul pool 1991+:
**99 Sinner 2025**, 98 Nadal 2018 / Federer 2006 / Djokovic 2015, fondo a 80
(Seppi 2013, Cecchinato 2018).

**L'Overall non entra nel calcolo del set.** È un distintivo: ti dice contro
chi stai giocando, non decide chi vince. L'esito dipende solo dalla categoria
che scegli.

## Economia dei crediti

| | |
|---|---|
| Budget iniziale | 100, **per torneo** |
| Costo per carta | **45 / 35 / 28 / 22 / 17 / 13 / 9 / 6** secondo il rango nel **tuo** profilo |
| Ripetizioni | **consentite** — il costo è l'unico limite |
| Ricarica dopo ogni match | +60, meno ~3 per ogni set già giocato nel torneo (pavimento 15) |
| Carta più economica | sempre acquistabile, anche a zero crediti |
| Colpo del campione | 1 volta a match la tua carta migliore è **gratis** |

Il costo è relativo al *tuo* profilo, non al pool: altrimenti un 97 avrebbe
tutto carissimo e un 84 tutto economico, e il forte verrebbe punito. Così
ognuno affronta la stessa domanda — uso l'arma buona o la conservo?

### Tre risultati di simulazione che hanno guidato i numeri

**Le ripetizioni vanno consentite.** Sembra il contrario di quel che serve
("come evito di vincere sempre 6-0 con la stessa arma"), ma il divieto faceva
collassare il Bo5: con 8 carte e 5 set tutti giocano quasi lo stesso
repertorio, e il vantaggio di chi gioca bene crollava da 3.1x a **1.4x**.
Lasciando ripetere ma facendo pagare, il freno allo spam lo mette il
portafoglio — un meccanismo solo invece di due.

**La stanchezza va sulla ricarica, non sul tetto.** Nella prima formulazione
(tetto che cala da 100 a 95 a 93) la stanchezza non faceva niente: era la
ricarica a vincolare, il tetto non veniva mai toccato. E stringere il budget in
modo uniforme **appiattisce l'abilità** (divario giù a 1.5x, perché trascina
tutti sulle stesse opzioni economiche). Sulla ricarica invece il divario resta
3.1x a ogni livello di durezza.

**Il budget deve vincolare, ma poco.** Con ricarica quasi piena i crediti sono
decorazione (il giocatore non resta mai a secco, e la strategia "parsimoniosa"
non batte quella "prendi il meglio"). Troppo stretta e il divario si schiaccia.
Il punto di equilibrio tiene il divario sopra 2.5x con qualche strozzatura vera
per torneo.

## Davide contro Golia

Non serve un handicap artificiale: **l'arma è già nei dati**. Isner 2016
(OVR 86) contro Sinner 2025 (OVR 99) ha la prima di servizio al **74%** e il
servizio al 69%. Schwartzman 2021 ha tre armi marginali (51-57%). Seppi 2013,
che è un OVR 80 senza picchi, non ha niente: il suo massimo è 40% — ed è
giusto così.

Quindi il problema non è dare a Davide una fionda, è **fargli permettere di
usarla**: è l'economia dei crediti a decidere se ce la fa. Il colpo del
campione garantisce che la tua firma sia giocabile almeno una volta a match,
anche in finale a crediti bassi.

## Cosa sparisce dalla v0

- **Taccuino** come strumento di scoperta: le tue statistiche ora le vedi.
  Resta solo come cronaca del match in corso.
- **Selezione categorie per turno** (ottavi = scarti favorevoli, finale =
  scarti ampi a segno misto): la difficoltà ora viene dall'avversario e dai
  crediti, non da quali carte il motore ti concede. Tutte le carte sono sempre
  disponibili, se te le puoi permettere.
- **Curva di difficoltà per turno** in quella forma. Va ripensata: l'avversario
  è casuale e l'Overall è visibile, quindi la difficoltà di un turno è quella
  che ti capita.

## Da tarare

`LOGISTIC_K` (la pendenza della curva) va ricalibrato insieme ai costi, perché
la risoluzione cambia. Il valore v0 (0.65) è un punto di partenza, non una
scelta motivata.

## In memoria, dopo la v1

- Modalità **carriera** (Grande Slam: 4 tornei, coi colori degli Slam)
- Modalità **leggende** (20-30 nomi scelti a mano, solo le annate migliori)
- **Era classica** pre-1991, con le sue categorie da punteggio
- **Puntata variabile**: scegliere quanto investire su una giocata, non solo
  pagarne il costo fisso
- **L'avversario che gioca anche lui una carta** — la versione più ricca del
  problema Davide-Golia, scartata per ora perché molto più complessa
- **Deploy** su GitHub Pages
- **Tutorial**: forse meno urgente ora che l'impianto si spiega da solo
