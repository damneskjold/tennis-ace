/**
 * Public v1 engine API. See docs/V1_DESIGN.md for the design and
 * CALIBRATION.md for how the slope was fitted.
 *
 * The engine owns the rules; the caller owns the tournament state. The wallet
 * is passed in and a new one comes back, so the UI can re-render from state
 * without the engine holding anything mutable.
 */
import { CARDS, commentFor } from "./cards.js";
import { affordable, costOf, isChampionShot, newWallet, playCard, rest } from "./credits.js";
import { costsFor, signatureCard, starsFor } from "./profile.js";
import { resolveSet } from "./resolution.js";

export { newWallet, rest };

export function createEngine(playersData) {
  const cards = playersData.categories;

  for (const card of cards) {
    if (!CARDS[card]) {
      throw new Error(`players.json has a card "${card}" the engine has no metadata for`);
    }
  }

  /** Everything the player is allowed to see about themselves: numbers included. */
  function ownProfile(playerCard) {
    const costs = costsFor(playerCard.categories);
    const signature = signatureCard(playerCard.categories);
    return {
      overall: playerCard.overall,
      signature,
      cards: cards.map((card) => ({
        card,
        label: CARDS[card].label,
        rating: playerCard.ratings[card],
        cost: costs[card],
        isSignature: card === signature,
      })),
      costs,
    };
  }

  /** Everything the player is allowed to see about the opponent: stars, never numbers. */
  function scoutOpponent(opponentCard) {
    return {
      overall: opponentCard.overall,
      cards: cards.map((card) => ({
        card,
        label: CARDS[card].label,
        stars: starsFor(opponentCard.ratings[card]),
      })),
    };
  }

  /** What the player can put on the table right now, with what it costs today. */
  function options(wallet, playerCard, costs) {
    const playable = new Set(affordable(wallet, playerCard.categories, costs));
    return cards.map((card) => ({
      card,
      label: CARDS[card].label,
      cost: costOf(wallet, playerCard.categories, costs, card),
      free: isChampionShot(wallet, playerCard.categories, card),
      affordable: playable.has(card),
    }));
  }

  /**
   * Play a card and resolve the set.
   * @returns {{wallet: object, paid: number, won: boolean, score: string,
   *   comment: string, probability: number, bucket: string, card: string, label: string}}
   */
  function play(wallet, playerCard, opponentCard, card, random = Math.random) {
    const costs = costsFor(playerCard.categories);
    const { wallet: next, paid } = playCard(wallet, playerCard.categories, costs, card);
    const delta = playerCard.categories[card] - opponentCard.categories[card];
    const outcome = resolveSet(delta, random);
    return {
      ...outcome,
      wallet: next,
      paid,
      card,
      label: CARDS[card].label,
      comment: commentFor(card, outcome.bucket, outcome.won, outcome.score, random),
    };
  }

  return { cards, ownProfile, scoutOpponent, options, play };
}
