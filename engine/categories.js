/**
 * Category (tactic) selection per round (docs/PROJECT_BRIEF.md,
 * "Meccanismo di difficoltà crescente").
 *
 * Difficulty does NOT depend on the (random) opponent's overall strength --
 * it depends on WHICH categories the engine is willing to offer as buttons
 * this round. Early rounds offer categories with a wide gap (in normalized
 * terms) and, where possible, one that favors the player -- so even a
 * careless pick is likely to land on a real advantage. The final offers only
 * near-zero-gap categories: a genuine coin flip regardless of which button
 * you press.
 *
 * "Wide" vs "narrow" is judged against gapPercentiles (p25/p50/p75 of
 * |normalized delta| over the whole pool, precomputed by the Python builder
 * -- see build_players.py's compute_gap_percentiles) rather than an
 * arbitrary fixed cutoff.
 */

const ROUND_TIER_ORDER = {
  ottavi: ["wide", "mid_wide", "mid_narrow", "narrow"],
  quarti: ["mid_wide", "wide", "mid_narrow", "narrow"],
  semifinale: ["mid_narrow", "narrow", "mid_wide", "wide"],
  finale: ["narrow", "mid_narrow", "mid_wide", "wide"],
};

// Only the two "easy" rounds bias toward gaps that favor the player; from
// the semifinal on, a wide gap against you is just as valid a proposal as
// one in your favor -- the round is about how NARROW the gap is, not who
// it favors.
const PREFERS_POSITIVE_DELTA = new Set(["ottavi", "quarti"]);

function classifyTier(gapSize, gapPercentiles) {
  if (gapSize >= gapPercentiles.p75) return "wide";
  if (gapSize >= gapPercentiles.p50) return "mid_wide";
  if (gapSize >= gapPercentiles.p25) return "mid_narrow";
  return "narrow";
}

function shuffle(items, random) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * @param {{key: string, delta: number}[]} deltas normalized deltas for this
 *   matchup (already excludes categories missing on either side)
 * @param {"ottavi"|"quarti"|"semifinale"|"finale"} round
 * @param {{p25: number, p50: number, p75: number}} gapPercentiles
 * @param {Set<string>|string[]} usedCategories categories already played
 *   this match -- excluded regardless of round
 * @param {number} optionCount how many buttons to offer (2 or 3)
 * @param {() => number} [random] injectable RNG for deterministic tests,
 *   defaults to Math.random
 * @returns {string[]} category keys to offer, length up to optionCount
 *   (fewer only if the matchup ran out of eligible categories entirely)
 */
export function selectCategoryOptions(deltas, round, gapPercentiles, usedCategories, optionCount, random = Math.random) {
  const tierOrder = ROUND_TIER_ORDER[round];
  if (!tierOrder) {
    throw new Error(`Unknown round: ${round}`);
  }
  const used = usedCategories instanceof Set ? usedCategories : new Set(usedCategories);
  const preferPositive = PREFERS_POSITIVE_DELTA.has(round);

  const byTier = { wide: [], mid_wide: [], mid_narrow: [], narrow: [] };
  for (const entry of deltas) {
    if (used.has(entry.key)) continue;
    byTier[classifyTier(Math.abs(entry.delta), gapPercentiles)].push(entry);
  }

  const chosen = [];
  const chosenKeys = new Set();

  for (const tier of tierOrder) {
    if (chosen.length >= optionCount) break;
    let pool = byTier[tier];
    if (pool.length === 0) continue;

    if (preferPositive) {
      // Best-for-the-player first, deterministically -- shuffling here would
      // risk handing the "easy" slot to a category that actually favors the
      // opponent, defeating the whole point of this tier for this round.
      pool = pool.slice().sort((a, b) => b.delta - a.delta);
    } else {
      // Sign doesn't matter at this difficulty: shuffle for variety among
      // equally-narrow (or equally-wide) categories.
      pool = shuffle(pool, random);
    }

    for (const entry of pool) {
      if (chosen.length >= optionCount) break;
      if (chosenKeys.has(entry.key)) continue;
      chosen.push(entry);
      chosenKeys.add(entry.key);
    }
  }

  return chosen.map((entry) => entry.key);
}
