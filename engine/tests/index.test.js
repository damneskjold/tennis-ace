import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createEngine } from "../index.js";

const ROUNDS = ["ottavi", "quarti", "semifinale", "finale"];

function loadRealPlayersData() {
  const path = fileURLToPath(new URL("../../data/players.json", import.meta.url));
  return JSON.parse(readFileSync(path, "utf-8"));
}

test("getCategoryOptions + resolveChoice work end to end on synthetic data", () => {
  const playersData = {
    stat_keys: ["ace_pct", "bp_saved_pct"],
    stat_stddev: { ace_pct: 2, bp_saved_pct: 3 },
    gap_percentiles: { p25: 0.3, p50: 0.8, p75: 1.5 },
  };
  const engine = createEngine(playersData);
  const player = { stats: { ace_pct: 10, bp_saved_pct: 60 } };
  const opponent = { stats: { ace_pct: 6, bp_saved_pct: 63 } };

  const options = engine.getCategoryOptions(player, opponent, "ottavi", [], 2, () => 0);
  assert.equal(options.length, 2);
  for (const opt of options) {
    assert.ok(opt.key);
    assert.ok(opt.label);
  }

  const outcome = engine.resolveChoice(player, opponent, options[0].key, () => 0.1);
  assert.equal(typeof outcome.won, "boolean");
  assert.ok(outcome.score.includes("-"));
  assert.ok(outcome.comment.includes(outcome.score));
});

test("resolveChoice throws for a category missing on either side", () => {
  const playersData = {
    stat_keys: ["deciding_set_won_pct"],
    stat_stddev: { deciding_set_won_pct: 10 },
    gap_percentiles: { p25: 0.3, p50: 0.8, p75: 1.5 },
  };
  const engine = createEngine(playersData);
  const player = { stats: { deciding_set_won_pct: null } };
  const opponent = { stats: { deciding_set_won_pct: 50 } };

  assert.throws(() => engine.resolveChoice(player, opponent, "deciding_set_won_pct"));
});

test("integration: a full Bo3 match against real players.json never repeats a category within the match", () => {
  const playersData = loadRealPlayersData();
  const engine = createEngine(playersData);
  const byId = Object.fromEntries(playersData.players.map((p) => [p.id, p]));

  const player = byId["104925-2023"]; // Djokovic 2023 (see docs/VERIFICATION.md for the id scheme)
  const opponent = playersData.players.find((p) => p.id !== player.id && p.year === 2023);
  assert.ok(player, "expected Djokovic 2023 in the real dataset");
  assert.ok(opponent, "expected at least one other 2023 player-year for a matchup");

  let seed = 42;
  const random = () => {
    // xorshift-ish deterministic PRNG so the test is reproducible.
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed |= 0;
    return ((seed >>> 0) % 100000) / 100000;
  };

  const round = "ottavi";
  const usedCategories = new Set();
  let playerSets = 0;
  let opponentSets = 0;

  while (playerSets < 2 && opponentSets < 2) {
    const options = engine.getCategoryOptions(player, opponent, round, usedCategories, 3, random);
    assert.ok(options.length > 0, "ran out of category options mid-match");
    for (const opt of options) {
      assert.ok(!usedCategories.has(opt.key), `category ${opt.key} was offered twice in the same match`);
    }

    const chosen = options[0];
    const result = engine.resolveChoice(player, opponent, chosen.key, random);
    usedCategories.add(chosen.key);

    if (result.won) playerSets++;
    else opponentSets++;

    assert.ok(result.probability > 0 && result.probability < 1);
    assert.match(result.score, /^\d+-\d+$/);
  }

  assert.ok(playerSets === 2 || opponentSets === 2);
  assert.ok(usedCategories.size <= 3, "a Bo3 match should resolve in at most 3 sets");
});

test("every round is usable for every real player-year pairing without throwing", () => {
  const playersData = loadRealPlayersData();
  const engine = createEngine(playersData);
  const [a, b, ...rest] = playersData.players;
  void rest;

  for (const round of ROUNDS) {
    const options = engine.getCategoryOptions(a, b, round, [], 3);
    assert.ok(options.length > 0, `no options offered for round ${round}`);
    for (const opt of options) {
      engine.resolveChoice(a, b, opt.key, () => 0.5);
    }
  }
});
