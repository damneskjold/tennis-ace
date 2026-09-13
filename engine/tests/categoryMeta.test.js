import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_META, pickComment } from "../categoryMeta.js";

const BUCKETS = ["dominant", "close", "tiebreak"];

test("every category, bucket and outcome has at least one comment variant, no crashes", () => {
  for (const categoryKey of Object.keys(CATEGORY_META)) {
    for (const bucket of BUCKETS) {
      for (const won of [true, false]) {
        const comment = pickComment(categoryKey, bucket, won, "6-3", () => 0);
        assert.ok(comment.length > 0, `${categoryKey}/${bucket}/${won} produced an empty comment`);
      }
    }
  }
});

test("pickComment interpolates the score into the template", () => {
  const comment = pickComment("ace_pct", "dominant", true, "6-1", () => 0);
  assert.ok(comment.includes("6-1"), `expected the score in the comment, got: ${comment}`);
});

test("pickComment picks among variants using the injected random", () => {
  const first = pickComment("ace_pct", "dominant", true, "6-1", () => 0);
  const second = pickComment("ace_pct", "dominant", true, "6-1", () => 0.99);
  assert.notEqual(first, second, "expected different random draws to surface different variants");
});

test("pickComment throws on an unknown category", () => {
  assert.throws(() => pickComment("not_a_real_category", "dominant", true, "6-1"));
});

test("every category has a non-empty Italian label", () => {
  for (const [key, meta] of Object.entries(CATEGORY_META)) {
    assert.ok(meta.label && meta.label.length > 3, `category ${key} is missing a label`);
    assert.ok(["servizio", "risposta", "tenuta"].includes(meta.flavor), `category ${key} has an unknown flavor`);
  }
});
