/**
 * Delta normalization (docs/PROJECT_BRIEF.md, "Normalizzazione del delta").
 *
 * Raw stat deltas aren't comparable across categories: ace% varies far more
 * naturally across players than, say, break-points-saved%. Dividing by each
 * stat's own standard deviation over the pool puts every category on the
 * same scale before comparing "how big is this gap".
 */

/**
 * @param {Record<string, number|null>} playerStats
 * @param {Record<string, number|null>} opponentStats
 * @param {string} key
 * @param {Record<string, number>} stddevByKey
 * @returns {number|null} (player - opponent) / stddev, or null if either
 *   side is missing this stat (e.g. a player who never played a deciding
 *   set that season) or the pool stddev for it is zero.
 */
export function normalizedDelta(playerStats, opponentStats, key, stddevByKey) {
  const playerValue = playerStats[key];
  const opponentValue = opponentStats[key];
  const stddev = stddevByKey[key];

  if (playerValue == null || opponentValue == null || !stddev) {
    return null;
  }

  return (playerValue - opponentValue) / stddev;
}

/**
 * Normalized delta for every category both players have a value for.
 * @param {Record<string, number|null>} playerStats
 * @param {Record<string, number|null>} opponentStats
 * @param {string[]} statKeys
 * @param {Record<string, number>} stddevByKey
 * @returns {{key: string, delta: number}[]}
 */
export function computeMatchupDeltas(playerStats, opponentStats, statKeys, stddevByKey) {
  const deltas = [];
  for (const key of statKeys) {
    const delta = normalizedDelta(playerStats, opponentStats, key, stddevByKey);
    if (delta !== null) {
      deltas.push({ key, delta });
    }
  }
  return deltas;
}
