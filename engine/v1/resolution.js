/**
 * How a chosen card becomes a set score.
 *
 * The only thing that decides the set is the gap between the two players on
 * the card you played. The overall rating stays a badge and never enters this
 * calculation: it tells you who you're up against, it doesn't decide who wins.
 *
 * Deltas here are differences between category scores, which are already in
 * z-score space, so a delta of 1 means "one pool standard deviation better at
 * this particular thing".
 */

// Calibrated against explicit targets, not inherited: see CALIBRATION.md.
// v0's 0.65 was fitted to a different delta scale and would have made a
// typical best card worth 74% a set.
export const LOGISTIC_K = 0.45;

export function winProbability(delta, k = LOGISTIC_K) {
  return 1 / (1 + Math.exp(-k * delta));
}

// How lopsided the coin was: 0 for a dead-even 50/50, 1 for a certainty.
function decisiveness(probability) {
  return Math.abs(probability - 0.5) * 2;
}

const DECISIVENESS_TIEBREAK_MAX = 0.15;
const DECISIVENESS_CLOSE_MAX = 0.45;

/**
 * The scoreline follows how decisive the odds were, not the raw delta -- so
 * it's symmetric around an even matchup by construction.
 * @returns {"tiebreak"|"close"|"dominant"}
 */
export function classifyBucket(probability) {
  const d = decisiveness(probability);
  if (d < DECISIVENESS_TIEBREAK_MAX) return "tiebreak";
  if (d < DECISIVENESS_CLOSE_MAX) return "close";
  return "dominant";
}

const SCORES = {
  dominant: { win: ["6-0", "6-1", "6-2", "6-3"], loss: ["0-6", "1-6", "2-6", "3-6"] },
  close: { win: ["6-4", "7-5"], loss: ["4-6", "5-7"] },
  tiebreak: { win: ["7-6"], loss: ["6-7"] },
};

export function pickScore(bucket, won, random) {
  const pool = SCORES[bucket][won ? "win" : "loss"];
  return pool[Math.floor(random() * pool.length)];
}

/**
 * @param {number} delta difference in category score, player minus opponent
 * @param {() => number} [random]
 * @returns {{won: boolean, probability: number, bucket: string, score: string}}
 */
export function resolveSet(delta, random = Math.random) {
  const probability = winProbability(delta);
  const won = random() < probability;
  const bucket = classifyBucket(probability);
  return { won, probability, bucket, score: pickScore(bucket, won, random) };
}
