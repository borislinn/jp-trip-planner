import { test } from "node:test";
import assert from "node:assert/strict";
import { homeApprox } from "../src/domain/money.js";
import { InMemoryRepository } from "../src/data/repository.js";
import { BudgetViewModel } from "../src/viewmodels/BudgetViewModel.js";

test("homeApprox converts JPY to the home currency at the configured rate", () => {
  // 15500 JPY at ¥155 = 1 USD => ~ $100
  const text = homeApprox(15500, "USD", 155);
  assert.match(text, /≈/);
  assert.match(text, /100/);
  assert.match(text, /\$/);
});

test("homeApprox returns null when no usable rate is configured", () => {
  assert.equal(homeApprox(15500, "USD", 0), null);
  assert.equal(homeApprox(15500, "", 155), null);
  assert.equal(homeApprox(15500, "USD", undefined), null);
});

test("budget settings persist the home currency and rate", async () => {
  const repo = new InMemoryRepository();
  const vm = new BudgetViewModel(repo);
  await vm.load();
  await vm.setBudgetSettings({
    totalBudget: 100000, categoryBudgets: {},
    homeCurrency: "usd", homeRate: "155"
  });

  const fresh = new BudgetViewModel(repo);
  await fresh.load();
  assert.equal(fresh.settings.homeCurrency, "USD");
  assert.equal(fresh.settings.homeRate, 155);
});
