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

test("ottavi offers the most favorable categories available", () => {
  const chosen = selectCategoryOptions(DELTAS, "ottavi", GAP_PERCENTILES, [], 3, noShuffle);
  assert.deepEqual(new Set(chosen), new Set(["big_favor", "good_favor", "mild_favor"]));
});

test("quarti offers favorable categories but skips the very best ones", () => {
  const chosen = selectCategoryOptions(DELTAS, "quarti", GAP_PERCENTILES, [], 3, noShuffle);
  assert.ok(!chosen.includes("big_favor"), `quarti should skip the top pick, got ${chosen}`);
  assert.ok(chosen.includes("mild_favor"));
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
  const trials = 3000;
  for (let i = 0; i < trials; i++) {
    const chosen = selectCategoryOptions(DELTAS, "ottavi", GAP_PERCENTILES, [], 3, Math.random);
    positionsOfBest[chosen.indexOf("big_favor")]++;
  }
  for (const count of positionsOfBest) {
    const share = count / trials;
    assert.ok(share > 0.25 && share < 0.42, `best option lands in one slot too often: ${positionsOfBest}`);
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
