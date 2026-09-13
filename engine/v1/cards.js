/**
 * The eight cards as the player meets them: what the button says, and what
 * the reveal says afterwards.
 *
 * Comments are keyed by flavor rather than by card, because the player already
 * knows which card they played -- the text is there to colour the result, not
 * to identify it. Four flavors keep the writing maintainable while still
 * making a serve set read differently from a nerves set.
 */

export const CARDS = {
  servizio: { label: "Punta sul servizio", flavor: "servizio" },
  prima: { label: "Prima di sicurezza", flavor: "servizio" },
  seconda: { label: "Rischia sulla seconda", flavor: "servizio" },
  risposta: { label: "Aggredisci in risposta", flavor: "risposta" },
  palle_break: { label: "Spingi sulle palle break", flavor: "risposta" },
  tenuta: { label: "Giocatela sui nervi", flavor: "tenuta" },
  palla_veloce: { label: "Gioca di palla veloce", flavor: "ritmo" },
  palla_lenta: { label: "Gioca di palla lenta", flavor: "ritmo" },
};

const COMMENTS = {
  servizio: {
    dominant: {
      win: ["Dominio assoluto al servizio ({score}).", "Servizio schiacciante, avversario travolto ({score})."],
      loss: ["Servizio in crisi, set regalato ({score}).", "Giornata nera in battuta ({score})."],
    },
    close: {
      win: ["Tieni la battuta quando conta e la spunti ({score}).", "Un turno di servizio decisivo, e basta ({score})."],
      loss: ["Un passaggio a vuoto in battuta, e il set se ne va ({score}).", "Servizio fragile sul più bello ({score})."],
    },
    tiebreak: {
      win: ["Al tie-break il servizio non trema ({score}).", "Nervi saldi in battuta quando serviva ({score})."],
      loss: ["Al tie-break la battuta cede proprio ora ({score}).", "Un punto solo, e va all'avversario ({score})."],
    },
  },
  risposta: {
    dominant: {
      win: ["Risposta chirurgica, avversario in bambola ({score}).", "Break su break, dominio in risposta ({score})."],
      loss: ["Mai un pericolo in risposta ({score}).", "Set perso senza mai impensierirlo ({score})."],
    },
    close: {
      win: ["Un break basta e avanza ({score}).", "Risposta pungente nei momenti giusti ({score})."],
      loss: ["Poche occasioni, e nessuna sfruttata ({score}).", "Ci vai vicino ma il break non arriva ({score})."],
    },
    tiebreak: {
      win: ["Al tie-break la risposta fa la differenza ({score}).", "Punto a punto, e la spunti in risposta ({score})."],
      loss: ["Al tie-break la risposta si spegne ({score}).", "Vicinissimo, ma il break decisivo non arriva ({score})."],
    },
  },
  tenuta: {
    dominant: {
      win: ["Sangue freddo assoluto nei momenti che contano ({score}).", "Tenuta totale, set mai in discussione ({score})."],
      loss: ["Crollo nervoso nei momenti decisivi ({score}).", "La pressione ti schiaccia ({score})."],
    },
    close: {
      win: ["Lucidità nei punti chiave, e la porti a casa ({score}).", "Tieni i nervi quando conta di più ({score})."],
      loss: ["Cedi proprio sul più bello ({score}).", "Manca lucidità nel momento decisivo ({score})."],
    },
    tiebreak: {
      win: ["Al tie-break sei un muro ({score}).", "Freddezza totale al momento della verità ({score})."],
      loss: ["Al tie-break tradisce l'emozione ({score}).", "Il momento della verità non sorride ({score})."],
    },
  },
  ritmo: {
    dominant: {
      win: ["Detti tu il ritmo, e lui non ci sta dentro ({score}).", "Palla sempre come piace a te ({score})."],
      loss: ["Ritmo tutto suo, tu a rincorrere ({score}).", "Mai trovato il tempo giusto sulla palla ({score})."],
    },
    close: {
      win: ["Imponi il tuo ritmo quel tanto che basta ({score}).", "La palla gira come vuoi tu nei momenti giusti ({score})."],
      loss: ["Il ritmo non è mai stato davvero tuo ({score}).", "Un tempo di gioco sbagliato al momento sbagliato ({score})."],
    },
    tiebreak: {
      win: ["Ritmi opposti fino al tie-break, e lo vinci tu ({score}).", "Nessuno impone il gioco, ma la chiudi tu ({score})."],
      loss: ["Ritmi opposti fino al tie-break, e lo perdi tu ({score}).", "Nessuno impone il gioco, e la chiude lui ({score})."],
    },
  },
};

/**
 * @param {string} card
 * @param {"tiebreak"|"close"|"dominant"} bucket
 * @param {boolean} won
 * @param {string} score
 * @param {() => number} [random]
 */
export function commentFor(card, bucket, won, score, random = Math.random) {
  const meta = CARDS[card];
  if (!meta) {
    throw new Error(`No metadata for card "${card}" -- data and engine are out of sync`);
  }
  const variants = COMMENTS[meta.flavor][bucket][won ? "win" : "loss"];
  return variants[Math.floor(random() * variants.length)].replace("{score}", score);
}
