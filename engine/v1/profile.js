/**
 * What a card costs you, and what you can see of your opponent.
 * See docs/V1_DESIGN.md.
 */

/**
 * Costs are assigned by each card's rank WITHIN YOUR OWN profile, not by its
 * standing in the pool. Pricing against the pool would make every card
 * expensive for a 97 and cheap for an 84 -- punishing the strong player and
 * handing the weak one a discount. Ranked against yourself, everyone faces the
 * same question every set: do I spend on my best, or save it?
 */
export const COST_LADDER = [45, 35, 28, 22, 17, 13, 9, 6];

/**
 * @param {Record<string, number>} categories z-scores by category
 * @returns {Record<string, number>} cost by category
 */
export function costsFor(categories) {
  const ranked = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  if (ranked.length > COST_LADDER.length) {
    throw new Error(`COST_LADDER has ${COST_LADDER.length} rungs but the profile has ${ranked.length} cards`);
  }
  return Object.fromEntries(ranked.map(([key], i) => [key, COST_LADDER[i]]));
}

/** The card you're strongest at -- the one the champion shot makes free. */
export function signatureCard(categories) {
  return Object.entries(categories).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * The opponent is never shown a number, only stars: enough to act on ("he's
 * strong here"), not enough to compute with. Ratings are percentiles, so
 * equal-width buckets are quintiles of the pool.
 * @param {number} rating 1-99
 * @returns {number} 1-5
 */
export function starsFor(rating) {
  return Math.min(5, Math.floor((rating - 1) / 20) + 1);
}
