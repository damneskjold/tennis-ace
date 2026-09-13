# Fonte dati: nota

Il brief originale indica [JeffSackmann/tennis_atp](https://github.com/JeffSackmann/tennis_atp)
come fonte. Quel repository **non esiste più** sotto quell'owner/nome: il
profilo GitHub di JeffSackmann mostra oggi una sola repository
(`tennis_MatchChartingProject`), e l'URL del vecchio repo restituisce 404
sia dall'interfaccia web sia via richiesta diretta — non è un problema di
rete o di permessi, il repo è stato rimosso, rinominato o reso privato in
un momento imprecisato dopo la metà del 2026.

## Sostituto in uso

[`Aneeshers/tennis-sackmann-archive`](https://github.com/Aneeshers/tennis-sackmann-archive):
un mirror archiviale dichiarato dei dataset pubblici di Jeff Sackmann,
con uno snapshot di `tennis_atp` preso da un commit upstream di giugno
2026 (quindi presumibilmente l'ultima versione disponibile prima della
rimozione). Contiene la stessa struttura di file (`atp_matches_<anno>.csv`,
`atp_rankings_<decade>.csv`, stesse intestazioni di colonna) sotto
`atp/`.

- Licenza dichiarata: **CC BY-NC-SA 4.0** (non-commerciale, stessa
  licenza attribuita all'originale) — compatibile con un progetto
  hobbistico non a scopo di lucro come questo.
- `builder/build_players.py` punta a questo mirror (`RAW_BASE`).
- Verificato: `atp_rankings_20s.csv` di questo mirror copre già fino al
  29/12/2025, quindi non serve concatenare `atp_rankings_current.csv`
  per il campione di test 2021-2025.

## Cosa tenere d'occhio

- Non è la fonte primaria originale: se in futuro si trova il vero
  repo di Sackmann (rinominato, trasferito, o ripristinato), vale la
  pena ripuntare `RAW_BASE` lì.
- Un mirror di terzi potrebbe divergere silenziosamente dall'originale
  (correzioni successive, dati mancanti). La verifica a mano dei 50
  valori del campione di test (vedi `docs/PROJECT_BRIEF.md`, "Prossimi
  passi" punto 2) resta comunque in programma e serve anche a
  intercettare eventuali discrepanze introdotte dal mirror stesso.
