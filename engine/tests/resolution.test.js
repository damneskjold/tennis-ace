import test from "node:test";
import assert from "node:assert/strict";
import { winProbability, classifyBucket, pickScore, resolveSet, LOGISTIC_K } from "../resolution.js";

test("winProbability is exactly 50% at delta=0, symmetric around it", () => {
  assert.equal(winProbability(0), 0.5);
  const pPos = winProbability(1.3);
  const pNeg = winProbability(-1.3);
  assert.ok(Math.abs(pPos - (1 - pNeg)) < 1e-9, `expected symmetry, got ${pPos} vs ${1 - pNeg}`);
});

test("winProbability increases monotonically with delta", () => {
  const deltas = [-3, -1, 0, 1, 3];
  const probs = deltas.map((d) => winProbability(d));
  for (let i = 1; i < probs.length; i++) {
    assert.ok(probs[i] > probs[i - 1], `expected increasing probabilities, got ${probs}`);
  }
});

test("LOGISTIC_K is documented and matches the exported constant used by winProbability", () => {
  // Regression guard: if someone tunes the constant, this pins down what a
  // one-stddev advantage means until it's deliberately changed again.
  assert.ok(Math.abs(winProbability(1) - 1 / (1 + Math.exp(-LOGISTIC_K))) < 1e-12);
});

test("classifyBucket is symmetric around p=0.5 (the old draft's asymmetry bug)", () => {
  // A prior draft had an off-center tie-break zone (-3 to +1 on the raw
  // delta). Here the equivalent check is over probability, which by
  // construction of winProbability is already centered on 0 delta -- this
  // test guards classifyBucket itself from introducing new asymmetry.
  for (const p of [0.5, 0.55, 0.6, 0.7, 0.8, 0.95]) {
    assert.equal(classifyBucket(p), classifyBucket(1 - p), `mismatch at p=${p} vs ${1 - p}`);
  }
});

test("classifyBucket: near 50/50 is a tiebreak, far from it is dominant", () => {
  assert.equal(classifyBucket(0.5), "tiebreak");
  assert.equal(classifyBucket(0.55), "tiebreak");
  assert.equal(classifyBucket(0.65), "close");
  assert.equal(classifyBucket(0.9), "dominant");
});

test("pickScore never returns a score from the wrong outcome", () => {
  const random = () => 0.999999;
  for (const bucket of ["tiebreak", "close", "dominant"]) {
    const winScore = pickScore(bucket, true, random);
    const [a, b] = winScore.split("-").map(Number);
    assert.ok(a > b, `expected a win score in ${bucket}, got ${winScore}`);

    const lossScore = pickScore(bucket, false, random);
    const [c, d] = lossScore.split("-").map(Number);
    assert.ok(c < d, `expected a loss score in ${bucket}, got ${lossScore}`);
  }
});

test("resolveSet ties together probability, win/loss draw, bucket and score consistently", () => {
  // random() < probability decides the win; feed a deterministic sequence.
  const calls = [0.1, 0.0]; // first call decides win/loss, second picks the score
  let i = 0;
  const random = () => calls[i++];

  const result = resolveSet(2, random); // delta=2 -> high probability, first draw 0.1 -> win
  assert.equal(result.won, true);
  assert.equal(result.bucket, "dominant");
  const [a, b] = result.score.split("-").map(Number);
  assert.ok(a > b);
});

test("resolveSet at delta=0 is a coin flip that respects the random draw", () => {
  const winning = resolveSet(0, () => 0.49);
  assert.equal(winning.won, true);
  const losing = resolveSet(0, () => 0.51);
  assert.equal(losing.won, false);
});
