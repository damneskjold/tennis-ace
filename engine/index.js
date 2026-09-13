/**
 * Public engine API tying together normalization, category selection and
 * set resolution. See docs/PROJECT_BRIEF.md for the overall design and the
 * sibling modules (normalize.js, categories.js, resolution.js,
 * categoryMeta.js) for the pieces this composes.
 */
import { normalizedDelta, computeMatchupDeltas } from "./normalize.js";
import { selectCategoryOptions } from "./categories.js";
import { resolveSet } from "./resolution.js";
import { CATEGORY_META, pickComment } from "./categoryMeta.js";

/**
 * @param {{stat_keys: string[], stat_stddev: Record<string, number>, gap_percentiles: {p25:number,p50:number,p75:number}}} playersData
 *   the parsed contents of data/players.json
 */
export function createEngine(playersData) {
  const statKeys = playersData.stat_keys;
  const stddevByKey = playersData.stat_stddev;
  const gapPercentiles = playersData.gap_percentiles;

  /**
   * The 2-3 tactic buttons to offer this set.
   * @param {{stats: Record<string, number|null>}} playerCard
   * @param {{stats: Record<string, number|null>}} opponentCard
   * @param {"ottavi"|"quarti"|"semifinale"|"finale"} round
   * @param {Set<string>|string[]} usedCategories categories already played this match
   * @param {number} [optionCount] 2 or 3 per docs/PROJECT_BRIEF.md
   * @param {() => number} [random]
   * @returns {{key: string, label: string}[]}
   */
  function getCategoryOptions(playerCard, opponentCard, round, usedCategories, optionCount = 3, random = Math.random) {
    const deltas = computeMatchupDeltas(playerCard.stats, opponentCard.stats, statKeys, stddevByKey);
    const keys = selectCategoryOptions(deltas, round, gapPercentiles, usedCategories, optionCount, random);
    return keys.map((key) => {
      const meta = CATEGORY_META[key];
      if (!meta) {
        // players.json carries a category the engine has no label for: the
        // builder and categoryMeta.js have drifted apart.
        throw new Error(`No CATEGORY_META entry for "${key}" -- data and engine are out of sync`);
      }
      return { key, label: meta.label };
    });
  }

  /**
   * Resolve the player's chosen tactic into a set outcome.
   * @param {{stats: Record<string, number|null>}} playerCard
   * @param {{stats: Record<string, number|null>}} opponentCard
   * @param {string} categoryKey one of the keys returned by getCategoryOptions
   * @param {() => number} [random]
   * @returns {{won: boolean, probability: number, bucket: string, score: string, comment: string, categoryKey: string, categoryLabel: string}}
   */
  function resolveChoice(playerCard, opponentCard, categoryKey, random = Math.random) {
    const delta = normalizedDelta(playerCard.stats, opponentCard.stats, categoryKey, stddevByKey);
    if (delta === null) {
      throw new Error(`Cannot resolve category "${categoryKey}": missing stat for one of the two players`);
    }
    const { won, probability, bucket, score } = resolveSet(delta, random);
    const comment = pickComment(categoryKey, bucket, won, score, random);
    return {
      won,
      probability,
      bucket,
      score,
      comment,
      categoryKey,
      categoryLabel: CATEGORY_META[categoryKey].label,
    };
  }

  return { getCategoryOptions, resolveChoice, statKeys, gapPercentiles };
}
