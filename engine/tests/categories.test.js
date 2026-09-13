import test from "node:test";
import assert from "node:assert/strict";
import { selectCategoryOptions } from "../categories.js";

const GAP_PERCENTILES = { p25: 0.5, p50: 1.0, p75: 1.5 };

// One category per tier, unambiguous relative to GAP_PERCENTILES, so tests
// don't depend on shuffling among same-tier ties.
const DELTAS = [
  { key: "wide_favor_player", delta: 2.0 }, // |delta| >= p75 -> wide, positive
  { key: "wide_favor_opponent", delta: -2.0 }, // wide, negative
  { key: "mid_wide", delta: 1.2 }, // p50 <= |delta| < p75
  { key: "mid_narrow", delta: 0.7 }, // p25 <= |delta| < p50
  { key: "narrow", delta: 0.1 }, // |delta| < p25
];

test("ottavi favors a wide gap that benefits the player", () => {
  const chosen = selectCategoryOptions(DELTAS, "ottavi", GAP_PERCENTILES, [], 1, () => 0);
  assert.deepEqual(chosen, ["wide_favor_player"]);
});

test("finale favors the narrowest gap, ignoring sign", () => {
  const chosen = selectCategoryOptions(DELTAS, "finale", GAP_PERCENTILES, [], 1, () => 0);
  assert.deepEqual(chosen, ["narrow"]);
});

test("already-used categories are excluded regardless of round", () => {
  const chosen = selectCategoryOptions(DELTAS, "ottavi", GAP_PERCENTILES, ["wide_favor_player"], 1, () => 0);
  assert.deepEqual(chosen, ["wide_favor_opponent"]);
});

test("falls through tiers to fill the requested option count", () => {
  const chosen = selectCategoryOptions(DELTAS, "finale", GAP_PERCENTILES, [], 3, () => 0);
  assert.equal(chosen.length, 3);
  // finale's tier order is narrow, mid_narrow, mid_wide, wide -- so with only
  // one entry per tier the first three tiers fill the three slots.
  assert.deepEqual(new Set(chosen), new Set(["narrow", "mid_narrow", "mid_wide"]));
});

test("returns fewer than optionCount only when categories genuinely run out", () => {
  const chosen = selectCategoryOptions([DELTAS[0]], "ottavi", GAP_PERCENTILES, [], 3, () => 0);
  assert.deepEqual(chosen, ["wide_favor_player"]);
});

test("never returns duplicate categories", () => {
  const chosen = selectCategoryOptions(DELTAS, "quarti", GAP_PERCENTILES, [], 4, Math.random);
  assert.equal(new Set(chosen).size, chosen.length);
});

test("throws on an unknown round name", () => {
  assert.throws(() => selectCategoryOptions(DELTAS, "ottavo_e_mezzo", GAP_PERCENTILES, [], 2));
});
