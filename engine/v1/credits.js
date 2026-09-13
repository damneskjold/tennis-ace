/**
 * The credit economy (docs/V1_DESIGN.md, "Economia dei crediti").
 *
 * The budget is what stops you playing your best card every single set -- the
 * brake is the wallet, not a rule forbidding repeats. Forbidding repeats was
 * tried and measured: with eight cards and five sets it forced everyone
 * through nearly the same repertoire, and the advantage of playing well
 * collapsed from 3.1x over random to 1.4x.
 *
 * Fatigue applies to the REFILL, not to a cap. Draining the cap did nothing in
 * simulation (the refill was always the binding constraint), and squeezing the
 * budget uniformly actually flattens skill, because it drags every player down
 * onto the same cheap cards. Shrinking what you recover instead makes the late
 * rounds harder for everyone while leaving the gap between good and careless
 * play intact.
 */
import { signatureCard } from "./profile.js";

export const STARTING_BUDGET = 100;
export const BASE_REFILL = 60;
export const FATIGUE_PER_SET = 3;
export const MIN_REFILL = 15;

export function newWallet() {
  return { budget: STARTING_BUDGET, setsPlayed: 0, championUsed: false };
}

/**
 * Once per match your signature card is free, so the fantasy the card
 * represents -- the big server who always steals a set -- survives even in a
 * final played on fumes.
 */
export function isChampionShot(wallet, categories, card) {
  return !wallet.championUsed && card === signatureCard(categories);
}

export function costOf(wallet, categories, costs, card) {
  return isChampionShot(wallet, categories, card) ? 0 : costs[card];
}

/**
 * Cards you can pay for. The cheapest is always included: running dry leaves
 * you playing your worst tennis, never unable to play at all.
 * @returns {string[]} never empty
 */
export function affordable(wallet, categories, costs) {
  const cards = Object.keys(costs);
  const withinBudget = cards.filter((c) => costOf(wallet, categories, costs, c) <= wallet.budget);
  if (withinBudget.length > 0) return withinBudget;
  return [cards.reduce((cheapest, c) => (costs[c] < costs[cheapest] ? c : cheapest))];
}

/** @returns {{wallet: object, paid: number}} */
export function playCard(wallet, categories, costs, card) {
  const paid = costOf(wallet, categories, costs, card);
  return {
    paid,
    wallet: {
      budget: Math.max(0, wallet.budget - paid),
      setsPlayed: wallet.setsPlayed + 1,
      championUsed: wallet.championUsed || isChampionShot(wallet, categories, card),
    },
  };
}

/** Between matches: recover, minus everything the tournament has cost so far. */
export function rest(wallet) {
  const recovered = Math.max(MIN_REFILL, BASE_REFILL - FATIGUE_PER_SET * wallet.setsPlayed);
  return {
    budget: Math.min(STARTING_BUDGET, wallet.budget + recovered),
    setsPlayed: wallet.setsPlayed,
    championUsed: false,
  };
}
