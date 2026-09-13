/**
 * Category (tactic) selection per round (docs/PROJECT_BRIEF.md,
 * "Meccanismo di difficoltà crescente").
 *
 * Difficulty does NOT depend on the (random) opponent's overall strength --
 * it depends on WHICH categories the engine offers as buttons this round.
 *
 * Selection is RANK-BASED within the matchup, not threshold-based against
 * the pool. An earlier version classified each category into a tier by
 * comparing |delta| to the pool's gap percentiles and then fell back to
 * adjacent tiers when a tier couldn't fill all the buttons. Measured over
 * 4000 simulated tournaments that produced no difficulty curve at all
 * (57.5% / 57.8% / 50.1% / 49.8% win rate across the four rounds): 75% of
 * matchups don't have three categories that are both wide AND in the
 * player's favor, so the "easy" round kept padding its buttons with traps,
 * and 43% don't have three narrow categories, so the final kept falling
 * back to lopsided ones (win probabilities from 0.04 to 0.98 in a round
 * that was supposed to be a coin flip). Ranking within the matchup always
 * yields exactly what each round asks for.
 *
 * The two axes the rounds move along:
 *   - SIGN decides expected win rate. Offering categories that favor the
 *     player is the only thing that makes a round genuinely easier; picking
 *     by magnitude alone always averages out to 50%, because across random
 *     matchups half of the wide gaps favor the opponent.
 *   - MAGNITUDE decides how much the choice matters. Near-zero gaps mean
 *     every button is the same 50/50 and the player's accumulated knowledge
 *     of their own player-year is worth nothing. Wide gaps with mixed signs
 *     mean one button is a blowout win and another a blowout loss -- a
 *     genuine bet, and the payoff for having learned who your player is.
 *
 * So: early rounds hand you favorable gaps (easy), and the final is an
 * even-odds round where the stakes per button are as high as the matchup
 * allows, rather than a round where nothing you press matters.
 *
 * "Favorable" rounds (ottavi, quarti) never offer a category that actually
 * favors the opponent, even when the matchup is too lopsided to supply
 * enough genuine advantages -- see selectFavorable's degraded branch below.
 * A round can end up with fewer good options than button slots; it never
 * fakes one.
 */

const ROUND_STRATEGY = {
  // Most favorable categories available: even a blind pick likely lands a real edge.
  ottavi: { mode: "favorable", offset: 0 },
  // Still favorable, but skipping the very best ones.
  quarti: { mode: "favorable", offset: 2 },
  // Even odds, moderate stakes per button.
  semifinale: { mode: "extreme", band: "moderate" },
  // Even odds, maximum stakes per button: knowing your player is what pays here.
  finale: { mode: "extreme", band: "max" },
};

function shuffle(items, random) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Draw the buttons from a slightly wider shortlist than strictly needed, so
// consecutive sets in the same match don't show an identical list. Only the
// chosen category is barred from coming back, so without this the top options
// simply sit there every set.
const SHORTLIST_SLACK = 2;

function selectFavorable(deltas, count, offset, random) {
  const sorted = deltas.slice().sort((a, b) => b.delta - a.delta);
  const favorable = sorted.filter((entry) => entry.delta > 0);

  if (favorable.length >= count) {
    // Plenty of genuine advantages: shortlist WITHIN them only, for variety
    // across sets without ever risking a trap. (A previous version widened
    // into `sorted` -- the full list -- whenever favorable.length fell short
    // of count, which quietly mixed unfavorable categories into the
    // shortlist even when only one or two were missing: on real data,
    // Baghdatis 2006 vs. Sampras 1993 has exactly two categories favoring
    // Baghdatis, and "ottavi" offered a third where Sampras was clearly
    // better, disguised as an easy round. 21% of random matchups have fewer
    // than three favorable categories -- common, not a fringe case.)
    const start = Math.max(0, Math.min(offset, favorable.length - count));
    const shortlist = favorable.slice(start, start + count + SHORTLIST_SLACK);
    return shuffle(shortlist, random).slice(0, count);
  }

  // Not enough real advantages in this matchup for the round to keep its
  // promise. Offer every genuine one there is (possibly zero), then fill
  // remaining slots with the least-bad of what's left. Deterministic, not
  // diluted by the shuffle-for-variety mechanism above: a thin matchup
  // should never have a chance of quietly swapping in a worse trap when a
  // milder one was available. `offset` (quarti skipping the very best) is
  // ignored here -- when advantages are this scarce, skipping any of them
  // for variety's sake isn't worth it.
  const rest = sorted.slice(favorable.length);
  return [...favorable, ...rest.slice(0, count - favorable.length)];
}

/**
 * Guarantee the offered set contains both a favorable and an unfavorable
 * option when the band has both, so the choice is a real bet rather than
 * a set of buttons that all lean the same way.
 */
function ensureMixedSigns(chosen, pool, count) {
  if (chosen.length < 2) return chosen;
  const hasFavorable = chosen.some((e) => e.delta > 0);
  const hasUnfavorable = chosen.some((e) => e.delta < 0);
  if (hasFavorable && hasUnfavorable) return chosen;

  const wantedSign = hasFavorable ? -1 : 1;
  const replacement = pool.find((e) => Math.sign(e.delta) === wantedSign && !chosen.includes(e));
  if (!replacement) return chosen; // the whole band leans one way; nothing to swap in

  return [...chosen.slice(0, count - 1), replacement];
}

function selectExtreme(deltas, count, band, random) {
  const byMagnitude = deltas.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const pool = band === "max" ? byMagnitude : byMagnitude.slice(Math.floor(byMagnitude.length / 3));
  const shortlist = pool.slice(0, count + SHORTLIST_SLACK);
  const chosen = shuffle(shortlist, random).slice(0, count);
  return ensureMixedSigns(chosen, pool, count);
}

/**
 * @param {{key: string, delta: number}[]} deltas normalized deltas for this
 *   matchup (already excludes categories missing on either side)
 * @param {"ottavi"|"quarti"|"semifinale"|"finale"} round
 * @param {{p25: number, p50: number, p75: number}} _gapPercentiles retained
 *   for callers and diagnostics; selection is rank-based (see module note)
 * @param {Set<string>|string[]} usedCategories categories already played
 *   this match -- excluded regardless of round
 * @param {number} optionCount how many buttons to offer (2 or 3)
 * @param {() => number} [random] injectable RNG for deterministic tests
 * @returns {string[]} category keys to offer, in RANDOM order -- the order
 *   must never correlate with quality, or the player learns to always press
 *   the same button and the game solves itself
 */
export function selectCategoryOptions(deltas, round, _gapPercentiles, usedCategories, optionCount, random = Math.random) {
  const strategy = ROUND_STRATEGY[round];
  if (!strategy) {
    throw new Error(`Unknown round: ${round}`);
  }
  const used = usedCategories instanceof Set ? usedCategories : new Set(usedCategories);
  const available = deltas.filter((entry) => !used.has(entry.key));
  if (available.length === 0) return [];

  const count = Math.min(optionCount, available.length);
  const chosen =
    strategy.mode === "favorable"
      ? selectFavorable(available, count, strategy.offset, random)
      : selectExtreme(available, count, strategy.band, random);

  return shuffle(chosen, random).map((entry) => entry.key);
}
