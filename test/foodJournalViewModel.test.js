import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRepo } from "./helpers.js";
import { FoodJournalViewModel } from "../src/viewmodels/FoodJournalViewModel.js";
import { BudgetViewModel } from "../src/viewmodels/BudgetViewModel.js";

test("expense entries are sorted newest first and can include transportation", async () => {
  const vm = new FoodJournalViewModel(makeRepo());
  await vm.load();
  await vm.addExpense({ name: "Ramen", expenseType: "foodDrink",
    amount: 12, comment: "Lunch", date: 1 });
  await vm.addExpense({ name: "Osaka Metro", expenseType: "transport",
    amount: 8, comment: "ICOCA top-up", date: 2 });

  assert.deepEqual(vm.expenses.map(e => e.name), ["Osaka Metro", "Ramen"]);
  assert.equal(vm.expenses[0].expenseType, "transport");
  assert.equal(vm.expenses[0].amount, 8);
});

test("dailyExpenses groups expenses by day with daily totals", async () => {
  const vm = new FoodJournalViewModel(makeRepo());
  await vm.load();
  const d1 = new Date(2026, 4, 1, 9).getTime();
  const d1b = new Date(2026, 4, 1, 20).getTime();
  const d2 = new Date(2026, 4, 2, 9).getTime();
  await vm.addExpense({ name: "Breakfast", expenseType: "foodDrink", amount: 500, date: d1 });
  await vm.addExpense({ name: "Train", expenseType: "transport", amount: 220, date: d1b });
  await vm.addExpense({ name: "Gift", expenseType: "shopping", amount: 900, date: d2 });

  const daily = vm.dailyExpenses;
  assert.equal(daily.length, 2);
  assert.equal(daily[0].total, 900);
  assert.deepEqual(daily[0].expenses.map(e => e.name), ["Gift"]);
  assert.equal(daily[1].total, 720);
  assert.deepEqual(daily[1].expenses.map(e => e.name), ["Train", "Breakfast"]);
});

test("expense entries do not store ratings", async () => {
  const vm = new FoodJournalViewModel(makeRepo());
  await vm.load();
  await vm.addExpense({ name: "No stars", expenseType: "shopping",
    amount: 5, rating: 5, comment: "" });

  assert.equal("rating" in vm.expenses[0], false);
});

test("rejects empty expense name", async () => {
  const vm = new FoodJournalViewModel(makeRepo());
  await vm.load();
  const ok = await vm.addExpense({ name: "  ", expenseType: "transport",
    amount: 5, comment: "x" });
  assert.equal(ok, false);
});

test("rejects missing expense amount", async () => {
  const vm = new FoodJournalViewModel(makeRepo());
  await vm.load();
  const ok = await vm.addExpense({ name: "Metro", expenseType: "transport",
    amount: 0, comment: "x" });
  assert.equal(ok, false);
});

test("delete removes an expense", async () => {
  const vm = new FoodJournalViewModel(makeRepo());
  await vm.load();
  await vm.addExpense({ name: "Z", expenseType: "shopping", amount: 3, comment: "" });
  await vm.deleteExpense(vm.expenses[0].id);
  assert.equal(vm.expenses.length, 0);
});

test("receipt photo persists with an expense and clears when absent", async () => {
  const vm = new FoodJournalViewModel(makeRepo());
  await vm.load();
  await vm.addExpense({ name: "Ichiran", expenseType: "foodDrink", amount: 30, comment: "great",
    receipt: "data:image/jpeg;base64,BBBB" });
  await vm.addExpense({ name: "Cafe", expenseType: "foodDrink", amount: 4, comment: "ok" });

  const withReceipt = vm.expenses.find(e => e.name === "Ichiran");
  const without = vm.expenses.find(e => e.name === "Cafe");
  assert.equal(withReceipt.receipt, "data:image/jpeg;base64,BBBB");
  assert.equal(without.receipt, null);
});

test("saving an expense creates an overview budget entry by category", async () => {
  const repo = makeRepo();
  const vm = new FoodJournalViewModel(repo);
  await vm.load();
  await vm.addExpense({ name: "Train", expenseType: "transport",
    amount: 280, comment: "Airport line", date: 123 });

  const entries = await repo.getAll("budgetEntries");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, "Train");
  assert.equal(entries[0].amount, 280);
  assert.equal(entries[0].category, "transport");
  assert.equal(entries[0].sourceExpenseId, vm.expenses[0].id);
});

test("saved expenses and overview spend can be loaded by fresh view models", async () => {
  const repo = makeRepo();
  const first = new FoodJournalViewModel(repo);
  await first.load();
  await first.addExpense({
    name: "Airport train",
    expenseType: "transport",
    amount: "¥1,200",
    comment: "Nankai",
    date: 123
  });

  const second = new FoodJournalViewModel(repo);
  await second.load();
  const overview = new BudgetViewModel(repo);
  await overview.load();

  assert.equal(second.expenses.length, 1);
  assert.equal(second.expenses[0].name, "Airport train");
  assert.equal(second.expenses[0].amount, 1200);
  assert.equal(second.expenses[0].comment, "Nankai");
  assert.equal(overview.totalSpent, 1200);
  assert.equal(overview.spentByCategory.transport, 1200);
});

test("expense yen amount input accepts commas and yen symbols", async () => {
  const repo = makeRepo();
  const vm = new FoodJournalViewModel(repo);
  await vm.load();
  await vm.addExpense({ name: "Dinner", expenseType: "foodDrink", amount: "¥1,800" });

  assert.equal(vm.expenses[0].amount, 1800);
  assert.equal((await repo.getAll("budgetEntries"))[0].amount, 1800);
});

test("deleting an expense removes its overview budget entry", async () => {
  const repo = makeRepo();
  const vm = new FoodJournalViewModel(repo);
  await vm.load();
  await vm.addExpense({ name: "Gift", expenseType: "shopping", amount: 900 });

  await vm.deleteExpense(vm.expenses[0].id);

  assert.equal((await repo.getAll("budgetEntries")).length, 0);
});
