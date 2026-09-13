/**
 * UI-facing metadata for the 12 stat categories (docs/PROJECT_BRIEF.md,
 * "Statistiche disponibili"): the Italian tactic label shown on each
 * button, which of the three narrative "flavors" it belongs to, and the
 * comment variants used in the post-set reveal.
 *
 * Comments are keyed by flavor rather than by the exact stat category --
 * e.g. every servizio-flavored category ("Punta sul servizio", "Blinda il
 * turno di battuta"...) shares the same comment pool. The player never sees
 * which precise stat decided the set anyway (only the score + comment), so
 * flavor-level variety is what the brief's "un testo, non solo il numero...
 * con più varianti per fascia" actually needs, without requiring 12x the
 * copy to maintain.
 */

export const CATEGORY_META = {
  ace_pct: { label: "Punta sul servizio", flavor: "servizio" },
  first_in_pct: { label: "Prima di sicurezza", flavor: "servizio" },
  first_won_pct: { label: "Spingi sulla prima", flavor: "servizio" },
  second_won_pct: { label: "Rischia sulla seconda", flavor: "servizio" },
  bp_saved_pct: { label: "Tieni i nervi saldi in battuta", flavor: "servizio" },
  service_games_won_pct: { label: "Blinda il turno di battuta", flavor: "servizio" },
  return_first_won_pct: { label: "Aggredisci la prima avversaria", flavor: "risposta" },
  return_second_won_pct: { label: "Punisci la seconda avversaria", flavor: "risposta" },
  bp_converted_pct: { label: "Spingi sulle palle break", flavor: "risposta" },
  return_games_won_pct: { label: "Vai a caccia del break", flavor: "risposta" },
  tiebreaks_won_pct: { label: "Giocala punto a punto", flavor: "tenuta" },
  deciding_set_won_pct: { label: "Gestisci la pressione del set decisivo", flavor: "tenuta" },
};

const COMMENTS = {
  servizio: {
    dominant: {
      win: ["Dominio assoluto al servizio ({score}).", "Servizio schiacciante, avversario travolto ({score})."],
      loss: ["Servizio in crisi totale, set regalato ({score}).", "Giornata nera al servizio ({score})."],
    },
    close: {
      win: ["Tieni duro al servizio e la spunti ({score}).", "Battaglia punto a punto, la spunti di misura ({score})."],
      loss: [
        "Servizio troppo fragile nei momenti chiave, set perso di misura ({score}).",
        "Ci provi ma non basta, set sfuggito ({score}).",
      ],
    },
    tiebreak: {
      win: ["Al tie-break il servizio regge, set tuo ({score}).", "Nervi saldi al tie-break, la porti a casa ({score})."],
      loss: [
        "Al tie-break cede proprio quando conta, set perso ({score}).",
        "Un punto decide tutto, e va all'avversario ({score}).",
      ],
    },
  },
  risposta: {
    dominant: {
      win: ["Risposta chirurgica, avversario in bambola ({score}).", "Break su break, dominio in risposta ({score})."],
      loss: ["Risposta inconsistente, set che scivola via ({score}).", "Zero pericoli in risposta, set perso senza appello ({score})."],
    },
    close: {
      win: ["Un break basta e avanza, la spunti di misura ({score}).", "Risposta efficace nei momenti giusti ({score})."],
      loss: ["Poche occasioni in risposta, non abbastanza ({score}).", "Ci va vicino ma la risposta non basta ({score})."],
    },
    tiebreak: {
      win: [
        "Al tie-break la risposta fa la differenza ({score}).",
        "Punto a punto, alla fine la spunti in risposta ({score}).",
      ],
      loss: [
        "Al tie-break la risposta si spegne proprio ora ({score}).",
        "Vicinissimo, ma il break decisivo non arriva ({score}).",
      ],
    },
  },
  tenuta: {
    dominant: {
      win: ["Sangue freddo assoluto nei momenti che contano ({score}).", "Tenuta psicologica totale, set dominato ({score})."],
      loss: ["Crollo nervoso nei momenti decisivi ({score}).", "La pressione ti schiaccia completamente ({score})."],
    },
    close: {
      win: ["Tieni i nervi saldi quando conta di più ({score}).", "Lucidità nei punti chiave, la spunti ({score})."],
      loss: ["Cedi proprio sul più bello ({score}).", "Manca lucidità nei momenti decisivi ({score})."],
    },
    tiebreak: {
      win: ["Al tie-break sei un muro, set tuo ({score}).", "Freddezza totale al momento della verità ({score})."],
      loss: ["Al tie-break tradisce l'emozione ({score}).", "Il momento della verità non sorride ({score})."],
    },
  },
};

/**
 * @param {string} categoryKey one of the CATEGORY_META keys
 * @param {"tiebreak"|"close"|"dominant"} bucket
 * @param {boolean} won
 * @param {string} score e.g. "6-3"
 * @param {() => number} [random] injectable RNG, defaults to Math.random
 * @returns {string}
 */
export function pickComment(categoryKey, bucket, won, score, random = Math.random) {
  const meta = CATEGORY_META[categoryKey];
  if (!meta) {
    throw new Error(`Unknown category: ${categoryKey}`);
  }
  const variants = COMMENTS[meta.flavor][bucket][won ? "win" : "loss"];
  const template = variants[Math.floor(random() * variants.length)];
  return template.replace("{score}", score);
}
