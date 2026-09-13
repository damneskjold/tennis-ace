import test from "node:test";
import assert from "node:assert/strict";
import { COST_LADDER, costsFor, signatureCard, starsFor } from "../profile.js";

const PROFILE = {
  servizio: 1.8,
  seconda: 1.1,
  prima: 0.6,
  palla_veloce: 0.2,
  tenuta: -0.3,
  palla_lenta: -0.7,
  palle_break: -1.2,
  risposta: -1.9,
};

test("the best card costs the most, the worst the least", () => {
  const costs = costsFor(PROFILE);
  assert.equal(costs.servizio, COST_LADDER[0]);
  assert.equal(costs.risposta, COST_LADDER.at(-1));
});

test("costs follow your own ranking, not the pool's", () => {
  // Same shape, but every card is weak in absolute terms: a poor player still
  // pays top price for their own best card, so nobody gets a discount for
  // being bad or a surcharge for being good.
  const weak = Object.fromEntries(Object.entries(PROFILE).map(([k, v]) => [k, v - 3]));
  assert.deepEqual(costsFor(weak), costsFor(PROFILE));
});

test("every card gets a distinct rung, in descending order", () => {
  const costs = costsFor(PROFILE);
  const ordered = Object.entries(PROFILE)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => costs[k]);
  assert.deepEqual(ordered, COST_LADDER);
});

test("throws rather than silently dropping a card the ladder can't price", () => {
  const tooMany = { ...PROFILE, nona_carta: 0.5 };
  assert.throws(() => costsFor(tooMany), /ladder/i);
});

test("the signature card is the strongest one", () => {
  assert.equal(signatureCard(PROFILE), "servizio");
});

test("stars bucket ratings into pool quintiles", () => {
  assert.equal(starsFor(1), 1);
  assert.equal(starsFor(20), 1);
  assert.equal(starsFor(21), 2);
  assert.equal(starsFor(60), 3);
  assert.equal(starsFor(80), 4);
  assert.equal(starsFor(81), 5);
  assert.equal(starsFor(99), 5);
});

test("stars never exceed five, whatever the rating", () => {
  for (let r = 1; r <= 99; r++) {
    const s = starsFor(r);
    assert.ok(s >= 1 && s <= 5, `rating ${r} produced ${s} stars`);
  }
});
