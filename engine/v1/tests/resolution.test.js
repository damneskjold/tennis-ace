import test from "node:test";
import assert from "node:assert/strict";
import { LOGISTIC_K, classifyBucket, pickScore, resolveSet, winProbability } from "../resolution.js";

test("an even matchup on the chosen card is exactly a coin flip", () => {
  assert.equal(winProbability(0), 0.5);
});

test("probability is symmetric: what one side gains the other loses", () => {
  for (const delta of [0.4, 1.3, 2.8]) {
    assert.ok(Math.abs(winProbability(delta) - (1 - winProbability(-delta))) < 1e-12);
  }
});

test("a bigger gap on the card always means better odds", () => {
  const probs = [-3, -1, 0, 1, 3].map((d) => winProbability(d));
  for (let i = 1; i < probs.length; i++) {
    assert.ok(probs[i] > probs[i - 1], `not monotonic: ${probs}`);
  }
});

test("the slope constant is the only thing setting the odds", () => {
  assert.ok(Math.abs(winProbability(1) - 1 / (1 + Math.exp(-LOGISTIC_K))) < 1e-12);
});

test("scorelines are symmetric around an even matchup", () => {
  for (const p of [0.5, 0.58, 0.66, 0.74, 0.9]) {
    assert.equal(classifyBucket(p), classifyBucket(1 - p), `asymmetric at ${p}`);
  }
});

test("near-even odds give a tiebreak, lopsided ones a blowout", () => {
  assert.equal(classifyBucket(0.5), "tiebreak");
  assert.equal(classifyBucket(0.56), "tiebreak");
  assert.equal(classifyBucket(0.65), "close");
  assert.equal(classifyBucket(0.92), "dominant");
});

test("a winning set never reads as a loss on the scoreboard", () => {
  const random = () => 0.999999;
  for (const bucket of ["tiebreak", "close", "dominant"]) {
    const [a, b] = pickScore(bucket, true, random).split("-").map(Number);
    assert.ok(a > b, `${bucket} win produced ${a}-${b}`);
    const [c, d] = pickScore(bucket, false, random).split("-").map(Number);
    assert.ok(c < d, `${bucket} loss produced ${c}-${d}`);
  }
});

test("the random draw decides the set, and the scoreline follows it", () => {
  const winning = resolveSet(0, () => 0.49);
  assert.equal(winning.won, true);
  assert.equal(winning.score, "7-6");

  const losing = resolveSet(0, () => 0.51);
  assert.equal(losing.won, false);
  assert.equal(losing.score, "6-7");
});

test("an underdog still wins sometimes -- that's what a probability means", () => {
  let wins = 0;
  const delta = -1.5;
  const expected = winProbability(delta);
  for (let i = 0; i < 20000; i++) {
    if (resolveSet(delta, Math.random).won) wins++;
  }
  const rate = wins / 20000;
  assert.ok(Math.abs(rate - expected) < 0.02, `expected about ${expected.toFixed(3)}, measured ${rate.toFixed(3)}`);
});
