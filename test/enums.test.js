import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUDGET_CATEGORIES, categoryById, normalizeBudgetCategoryId
} from "../src/domain/enums.js";

test("budget has exactly the three agreed categories", () => {
  assert.deepEqual(
    BUDGET_CATEGORIES.map(c => c.id),
    ["foodDrink", "shopping", "transport"]
  );
  assert.deepEqual(
    BUDGET_CATEGORIES.map(c => c.label),
    ["Food & Drink", "Shopping", "Transportation"]
  );
  for (const c of BUDGET_CATEGORIES) {
    assert.ok(c.emoji && c.color, `${c.id} needs an icon and color`);
  }
});

test("categoryById maps known legacy ids into the new categories", () => {
  const known = categoryById("shopping");
  assert.equal(known.label, "Shopping");
  assert.equal(categoryById("groceries").id, "foodDrink");
  assert.equal(categoryById("clothing").id, "shopping");
  assert.equal(categoryById("souvenirs").id, "shopping");
  assert.equal(categoryById("transportation").id, "transport");
});

test("unknown category ids still return a safe Other object", () => {
  assert.equal(normalizeBudgetCategoryId("mystery"), "other");
  const unknown = categoryById("mystery");
  assert.equal(unknown.id, "other");
  assert.ok(unknown.label && unknown.emoji && unknown.color);
});
