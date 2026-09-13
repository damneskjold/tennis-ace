/**
 * Set resolution: probability, not fixed brackets (docs/PROJECT_BRIEF.md,
 * "Risoluzione del set").
 *
 * The draft this replaces had two bugs: an off-center "tie-break zone"
 * (-3 to +1 instead of symmetric around 0) and a fixed 60% coin flip inside
 * that zone regardless of how close the delta actually was. Here the win
 * probability is a continuous logistic function of the normalized delta
 * (symmetric by construction: delta=0 always means exactly 50/50), and the
 * scoreline shown to the player is driven by how decisive THAT probability
 * was -- not by re-deriving a bracket from the raw delta.
 */

// Steepness of the logistic curve. At delta=1 (one pool-stddev advantage)
// this gives ~65% win probability; at delta=2, ~79%; at delta=3, ~87%.
// Reasonable-feeling defaults for a first playable version -- revisit once
// there's actual playtesting to calibrate against.
export const LOGISTIC_K = 0.65;

/**
 * @param {number} delta normalized delta for the chosen category
 * @param {number} [k]
 * @returns {number} probability in (0, 1) that the player wins the set
 */
export function winProbability(delta, k = LOGISTIC_K) {
  return 1 / (1 + Math.exp(-k * delta));
}

// How lopsided the coin was, from 0 (dead-even 50/50) to 1 (certain).
function decisiveness(probability) {
  return Math.abs(probability - 0.5) * 2;
}

// Percentile thresholds on |normalized delta| shape the categories offered
// (categories.js); these are the analogous thresholds on the *outcome*
// probability's decisiveness, used only to pick a plausible scoreline once
// win/loss is already decided. Symmetric around 0.5 by construction, which
// is exactly what the old fixed-bracket draft got wrong.
const DECISIVENESS_TIEBREAK_MAX = 0.15; // probability within ~[0.425, 0.575]
const DECISIVENESS_CLOSE_MAX = 0.45; // probability within ~[0.275, 0.725), excluding the tiebreak band

/**
 * @param {number} probability
 * @returns {"tiebreak"|"close"|"dominant"}
 */
export function classifyBucket(probability) {
  const d = decisiveness(probability);
  if (d < DECISIVENESS_TIEBREAK_MAX) return "tiebreak";
  if (d < DECISIVENESS_CLOSE_MAX) return "close";
  return "dominant";
}

const SCORES = {
  dominant: {
    win: ["6-0", "6-1", "6-2", "6-3"],
    loss: ["0-6", "1-6", "2-6", "3-6"],
  },
  close: {
    win: ["6-4", "7-5"],
    loss: ["4-6", "5-7"],
  },
  tiebreak: {
    win: ["7-6"],
    loss: ["6-7"],
  },
};

function pickOne(list, random) {
  return list[Math.floor(random() * list.length)];
}

/**
 * @param {"tiebreak"|"close"|"dominant"} bucket
 * @param {boolean} won
 * @param {() => number} random
 * @returns {string} e.g. "6-3" (player games - opponent games)
 */
export function pickScore(bucket, won, random) {
  return pickOne(SCORES[bucket][won ? "win" : "loss"], random);
}

/**
 * Full resolution of a chosen category into a set outcome.
 * @param {number} delta normalized delta for the chosen category
 * @param {() => number} [random] injectable RNG, defaults to Math.random
 * @returns {{won: boolean, probability: number, bucket: "tiebreak"|"close"|"dominant", score: string}}
 */
export function resolveSet(delta, random = Math.random) {
  const probability = winProbability(delta);
  const won = random() < probability;
  const bucket = classifyBucket(probability);
  const score = pickScore(bucket, won, random);
  return { won, probability, bucket, score };
}
