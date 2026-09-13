import test from "node:test";
import assert from "node:assert/strict";
import { normalizedDelta, computeMatchupDeltas } from "../normalize.js";

test("normalizedDelta divides the raw gap by the stat's stddev", () => {
  const a = { ace_pct: 12 };
  const b = { ace_pct: 8 };
  const stddev = { ace_pct: 2 };
  assert.equal(normalizedDelta(a, b, "ace_pct", stddev), 2); // (12-8)/2
});

test("normalizedDelta is negative when the opponent leads", () => {
  const a = { ace_pct: 8 };
  const b = { ace_pct: 12 };
  const stddev = { ace_pct: 2 };
  assert.equal(normalizedDelta(a, b, "ace_pct", stddev), -2);
});

test("normalizedDelta returns null when either side is missing the stat", () => {
  const stddev = { deciding_set_won_pct: 10 };
  assert.equal(
    normalizedDelta({ deciding_set_won_pct: null }, { deciding_set_won_pct: 50 }, "deciding_set_won_pct", stddev),
    null,
  );
  assert.equal(
    normalizedDelta({ deciding_set_won_pct: 50 }, { deciding_set_won_pct: null }, "deciding_set_won_pct", stddev),
    null,
  );
});

test("normalizedDelta returns null rather than dividing by zero", () => {
  const stddev = { flat_stat: 0 };
  assert.equal(normalizedDelta({ flat_stat: 5 }, { flat_stat: 5 }, "flat_stat", stddev), null);
});

test("computeMatchupDeltas skips categories with a missing value on either side", () => {
  const player = { ace_pct: 10, deciding_set_won_pct: null };
  const opponent = { ace_pct: 6, deciding_set_won_pct: 40 };
  const stddev = { ace_pct: 2, deciding_set_won_pct: 10 };

  const deltas = computeMatchupDeltas(player, opponent, ["ace_pct", "deciding_set_won_pct"], stddev);

  assert.deepEqual(deltas, [{ key: "ace_pct", delta: 2 }]);
});
