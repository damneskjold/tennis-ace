import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_REFILL,
  FATIGUE_PER_SET,
  MIN_REFILL,
  STARTING_BUDGET,
  affordable,
  costOf,
  isChampionShot,
  newWallet,
  playCard,
  rest,
} from "../credits.js";
import { costsFor } from "../profile.js";

const CATEGORIES = {
  servizio: 1.8,
  seconda: 1.1,
  prima: 0.6,
  palla_veloce: 0.2,
  tenuta: -0.3,
  palla_lenta: -0.7,
  palle_break: -1.2,
  risposta: -1.9,
};
const COSTS = costsFor(CATEGORIES);

test("the signature card is free once per match, then costs full price", () => {
  let wallet = newWallet();
  assert.equal(costOf(wallet, CATEGORIES, COSTS, "servizio"), 0);

  ({ wallet } = playCard(wallet, CATEGORIES, COSTS, "servizio"));
  assert.equal(wallet.budget, STARTING_BUDGET, "the champion shot must not cost anything");
  assert.equal(costOf(wallet, CATEGORIES, COSTS, "servizio"), COSTS.servizio);
});

test("playing something else leaves the champion shot available", () => {
  let wallet = newWallet();
  ({ wallet } = playCard(wallet, CATEGORIES, COSTS, "tenuta"));
  assert.ok(isChampionShot(wallet, CATEGORIES, "servizio"));
  assert.equal(wallet.budget, STARTING_BUDGET - COSTS.tenuta);
});

test("you can never be left with nothing to play", () => {
  const broke = { budget: 0, setsPlayed: 6, championUsed: true };
  const options = affordable(broke, CATEGORIES, COSTS);
  assert.equal(options.length, 1);
  assert.equal(options[0], "risposta", "the cheapest card is the one that stays available");
});

test("running low leaves only the weak cards, which is the point", () => {
  const low = { budget: 20, setsPlayed: 4, championUsed: true };
  const options = affordable(low, CATEGORIES, COSTS);
  assert.ok(!options.includes("servizio"), "the best card must be out of reach at 20 credits");
  assert.ok(options.includes("risposta"));
  for (const card of options) {
    assert.ok(COSTS[card] <= 20, `${card} costs ${COSTS[card]}, over budget`);
  }
});

test("rest recovers less as the tournament wears on", () => {
  const fresh = rest({ budget: 0, setsPlayed: 0, championUsed: true });
  const tired = rest({ budget: 0, setsPlayed: 10, championUsed: true });
  assert.equal(fresh.budget, BASE_REFILL);
  assert.equal(tired.budget, BASE_REFILL - FATIGUE_PER_SET * 10);
  assert.ok(tired.budget < fresh.budget);
});

test("recovery has a floor, so a long tournament never becomes unplayable", () => {
  const exhausted = rest({ budget: 0, setsPlayed: 40, championUsed: true });
  assert.equal(exhausted.budget, MIN_REFILL);
});

test("rest never pushes you above the starting budget, and rearms the champion shot", () => {
  const wallet = rest({ budget: 95, setsPlayed: 1, championUsed: true });
  assert.equal(wallet.budget, STARTING_BUDGET);
  assert.equal(wallet.championUsed, false);
});

test("a tournament's budget curve declines round by round", () => {
  let wallet = newWallet();
  const atEachRound = [];
  for (let round = 0; round < 4; round++) {
    atEachRound.push(wallet.budget);
    // A three-set match, spending mid-priced cards.
    for (const card of ["seconda", "prima", "tenuta"]) {
      ({ wallet } = playCard(wallet, CATEGORIES, COSTS, card));
    }
    wallet = rest(wallet);
  }
  for (let i = 1; i < atEachRound.length; i++) {
    assert.ok(
      atEachRound[i] < atEachRound[i - 1],
      `round ${i + 1} started richer than round ${i}: ${atEachRound}`,
    );
  }
});
