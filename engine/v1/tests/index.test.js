import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine, newWallet, rest } from "../index.js";
import { CARDS } from "../cards.js";

const DATA = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../data/players-v1.json", import.meta.url)), "utf-8"),
);
const engine = createEngine(DATA);
const find = (name, year) => DATA.players.find((p) => p.name === name && p.year === year);

test("every card in the data has engine metadata", () => {
  assert.equal(DATA.categories.length, 8);
  for (const card of DATA.categories) {
    assert.ok(CARDS[card], `no metadata for ${card}`);
  }
});

test("createEngine refuses data carrying a card it can't label", () => {
  assert.throws(
    () => createEngine({ ...DATA, categories: [...DATA.categories, "sottorete"] }),
    /metadata/i,
  );
});

test("your own profile shows real numbers; the opponent shows only stars", () => {
  const karlovic = find("Ivo Karlovic", 2015);
  const mine = engine.ownProfile(karlovic);
  const theirs = engine.scoutOpponent(karlovic);

  assert.equal(mine.signature, "servizio", "Karlovic's best card should be the serve");
  const serve = mine.cards.find((c) => c.card === "servizio");
  assert.ok(serve.rating > 90, `expected an elite serve rating, got ${serve.rating}`);
  assert.equal(serve.cost, 45, "the signature card carries the top price");

  for (const card of theirs.cards) {
    assert.ok(card.stars >= 1 && card.stars <= 5);
    assert.equal(card.rating, undefined, "scouting must never leak the rating");
    assert.equal(card.cost, undefined, "scouting must never leak costs");
  }
});

test("a specialist's weapon survives against the best card in the pool", () => {
  // The whole David-and-Goliath promise: Isner should be able to take a set
  // off anyone on serve.
  const isner = find("John Isner", 2016);
  const sinner = find("Jannik Sinner", 2025);
  const signature = engine.ownProfile(isner).signature;

  let wins = 0;
  for (let i = 0; i < 4000; i++) {
    if (engine.play(newWallet(), isner, sinner, signature, Math.random).won) wins++;
  }
  const rate = wins / 4000;
  assert.ok(rate > 0.55 && rate < 0.72, `Isner's weapon vs Sinner came out at ${(100 * rate).toFixed(0)}%`);
  assert.ok(isner.overall < sinner.overall, "and he really is the underdog overall");
});

test("a player with no weapon has no weapon, however they play it", () => {
  const seppi = find("Andreas Seppi", 2013);
  const sinner = find("Jannik Sinner", 2025);
  const best = engine.ownProfile(seppi).signature;

  let wins = 0;
  for (let i = 0; i < 4000; i++) {
    if (engine.play(newWallet(), seppi, sinner, best, Math.random).won) wins++;
  }
  assert.ok(wins / 4000 < 0.5, "an overall-80 with no peak shouldn't be favoured against a 98");
});

test("the champion shot is free once, then the card costs full price", () => {
  const me = find("John Isner", 2016);
  const opp = find("Jannik Sinner", 2025);
  const { signature } = engine.ownProfile(me);

  const first = engine.play(newWallet(), me, opp, signature, () => 0.5);
  assert.equal(first.paid, 0);
  assert.equal(first.free, undefined, "play() reports what was paid, not the offer flag");

  const second = engine.play(first.wallet, me, opp, signature, () => 0.5);
  assert.equal(second.paid, 45);
});

test("options mark what's free, what's affordable, and what's out of reach", () => {
  const me = find("Ivo Karlovic", 2015);
  const { costs, signature } = engine.ownProfile(me);

  const fresh = engine.options(newWallet(), me, costs);
  assert.equal(fresh.find((o) => o.card === signature).cost, 0, "the signature starts free");
  assert.ok(fresh.every((o) => o.affordable), "everything is within reach at full budget");

  const broke = engine.options({ budget: 10, setsPlayed: 8, championUsed: true }, me, costs);
  assert.ok(broke.some((o) => !o.affordable), "the expensive cards should be out of reach");
  assert.ok(broke.some((o) => o.affordable), "but something must always remain playable");
});

/** Walks four rounds of three sets, picking cards by the given rule. */
function playTournament(me, pick) {
  const { costs } = engine.ownProfile(me);
  let wallet = newWallet();
  const budgetAtRoundStart = [];

  for (let round = 0; round < 4; round++) {
    budgetAtRoundStart.push(wallet.budget);
    const opp = DATA.players[(round * 137) % DATA.players.length];
    for (let set = 0; set < 3; set++) {
      const playable = engine.options(wallet, me, costs).filter((o) => o.affordable);
      assert.ok(playable.length > 0, "ran out of playable cards mid-tournament");
      const result = engine.play(wallet, me, opp, pick(playable).card, Math.random);
      wallet = result.wallet;
      assert.match(result.score, /^\d+-\d+$/);
      assert.ok(result.comment.includes(result.score));
    }
    wallet = rest(wallet);
  }
  return budgetAtRoundStart;
}

test("spending on your good cards wears the wallet down round by round", () => {
  const budgets = playTournament(
    find("Carlos Alcaraz", 2023),
    (playable) => playable.reduce((a, b) => (b.cost > a.cost ? b : a)),
  );
  assert.ok(budgets[3] < budgets[0], `fatigue should bite a spender: ${budgets}`);
});

test("playing only cheap cards keeps you solvent -- the cost of that is losing, not going broke", () => {
  const budgets = playTournament(
    find("Carlos Alcaraz", 2023),
    (playable) => playable.reduce((a, b) => (b.cost < a.cost ? b : a)),
  );
  assert.ok(
    budgets.every((b) => b > 80),
    `a frugal player shouldn't be squeezed on budget: ${budgets}`,
  );
});
