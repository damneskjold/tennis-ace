import test from "node:test";
import assert from "node:assert/strict";
import { selectCategoryOptions } from "../categories.js";

const GAP_PERCENTILES = { p25: 0.5, p50: 1.0, p75: 1.5 };

const DELTAS = [
  { key: "big_favor", delta: 2.4 },
  { key: "good_favor", delta: 1.6 },
  { key: "mild_favor", delta: 0.8 },
  { key: "tiny_favor", delta: 0.1 },
  { key: "tiny_against", delta: -0.2 },
  { key: "mild_against", delta: -0.9 },
  { key: "big_against", delta: -2.1 },
];

const noShuffle = () => 0;

// Real bug, found by a human playtester: Marcos Baghdatis 2006 vs. Pete
// Sampras 1993 has exactly two categories favoring Baghdatis
// (return_first_won_pct, tiebreaks_won_pct). A previous version of
// selectFavorable widened into the FULL sorted list whenever the favorable
// count fell short of what was asked, which could surface a third,
// unfavorable category disguised as part of "ottavi" -- the round that's
// supposed to guarantee a real edge. 21% of random matchups (measured on
// real data) have fewer than three favorable categories, so this wasn't a
// fringe case.
const THIN = [
  { key: "only_favor", delta: 0.3 },
  { key: "least_bad", delta: -0.1 },
  { key: "mid_bad", delta: -1.0 },
  { key: "worst", delta: -3.0 },
];

test("with too few favorable categories, ottavi never reaches for the worst ones", () => {
  for (let i = 0; i < 200; i++) {
    const chosen = selectCategoryOptions(THIN, "ottavi", GAP_PERCENTILES, [], 3, Math.random);
    assert.deepEqual(
      new Set(chosen),
      new Set(["only_favor", "least_bad", "mid_bad"]),
      `expected the one favorable category plus the two least-bad, got ${chosen}`,
    );
    assert.ok(!chosen.includes("worst"), `offered the worst available category: ${chosen}`);
  }
});

test("with zero favorable categories, ottavi still returns the least-bad options rather than crashing", () => {
  const allNegative = [
    { key: "least_bad", delta: -0.2 },
    { key: "mid_bad", delta: -1.5 },
    { key: "worst", delta: -4.0 },
  ];
  const chosen = selectCategoryOptions(allNegative, "ottavi", GAP_PERCENTILES, [], 3, Math.random);
  assert.deepEqual(new Set(chosen), new Set(["least_bad", "mid_bad", "worst"]));
});

test("ottavi only ever offers categories from the favorable end", () => {
  // Sampled from a shortlist for variety, so assert the property that matters:
  // never an option that favors the opponent while better ones went unoffered.
  for (let i = 0; i < 300; i++) {
    const chosen = selectCategoryOptions(DELTAS, "ottavi", GAP_PERCENTILES, [], 3, Math.random);
    for (const key of chosen) {
      assert.ok(
        DELTAS.find((d) => d.key === key).delta > 0,
        `ottavi offered a category favoring the opponent: ${key}`,
      );
    }
  }
});

test("ottavi rotates its options between sets instead of showing the same list", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    seen.add(selectCategoryOptions(DELTAS, "ottavi", GAP_PERCENTILES, [], 3, Math.random).slice().sort().join(","));
  }
  assert.ok(seen.size > 1, "the same three buttons came up every single time");
});

test("quarti offers favorable categories but skips the very best one", () => {
  for (let i = 0; i < 200; i++) {
    const chosen = selectCategoryOptions(DELTAS, "quarti", GAP_PERCENTILES, [], 3, Math.random);
    assert.ok(!chosen.includes("big_favor"), `quarti should skip the top pick, got ${chosen}`);
  }
});

test("finale offers the widest gaps available, with both signs represented", () => {
  const chosen = selectCategoryOptions(DELTAS, "finale", GAP_PERCENTILES, [], 3, noShuffle);
  const deltas = chosen.map((k) => DELTAS.find((d) => d.key === k).delta);
  assert.ok(
    deltas.some((d) => d > 0) && deltas.some((d) => d < 0),
    `finale must be a real bet: expected both signs, got ${JSON.stringify(deltas)}`,
  );
  // The widest gaps, not the narrowest -- the player's accumulated knowledge
  // has to be worth something in the final.
  const meanMagnitude = deltas.reduce((sum, d) => sum + Math.abs(d), 0) / deltas.length;
  assert.ok(meanMagnitude > 1.0, `expected wide gaps in the final, got mean |delta| ${meanMagnitude}`);
});

test("button order never correlates with quality (otherwise the game solves itself)", () => {
  // If the best option were always first, a player would just learn to press
  // button 1 forever. Over many draws each position must see the top pick
  // roughly equally often.
  const positionsOfBest = [0, 0, 0];
  let offered = 0;
  for (let i = 0; i < 4000; i++) {
    const chosen = selectCategoryOptions(DELTAS, "ottavi", GAP_PERCENTILES, [], 3, Math.random);
    const slot = chosen.indexOf("big_favor");
    if (slot === -1) continue; // not in this draw's shortlist sample
    positionsOfBest[slot]++;
    offered++;
  }
  assert.ok(offered > 1000, "the best option was hardly ever offered");
  for (const count of positionsOfBest) {
    const share = count / offered;
    assert.ok(share > 0.27 && share < 0.4, `best option lands in one slot too often: ${positionsOfBest}`);
  }
});

test("already-used categories are excluded regardless of round", () => {
  const chosen = selectCategoryOptions(DELTAS, "ottavi", GAP_PERCENTILES, ["big_favor", "good_favor"], 2, noShuffle);
  assert.ok(!chosen.includes("big_favor"));
  assert.ok(!chosen.includes("good_favor"));
  assert.equal(chosen.length, 2);
});

test("returns fewer options only when categories genuinely run out", () => {
  const chosen = selectCategoryOptions([DELTAS[0]], "ottavi", GAP_PERCENTILES, [], 3, noShuffle);
  assert.deepEqual(chosen, ["big_favor"]);
  assert.deepEqual(selectCategoryOptions([], "finale", GAP_PERCENTILES, [], 3, noShuffle), []);
});

test("never returns duplicate categories, in any round", () => {
  for (const round of ["ottavi", "quarti", "semifinale", "finale"]) {
    const chosen = selectCategoryOptions(DELTAS, round, GAP_PERCENTILES, [], 3, Math.random);
    assert.equal(new Set(chosen).size, chosen.length, `duplicates in ${round}`);
    assert.equal(chosen.length, 3, `wrong option count in ${round}`);
  }
});

test("throws on an unknown round name", () => {
  assert.throws(() => selectCategoryOptions(DELTAS, "ottavo_e_mezzo", GAP_PERCENTILES, [], 2));
});
