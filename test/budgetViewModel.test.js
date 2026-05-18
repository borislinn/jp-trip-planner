import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRepo } from "./helpers.js";
import { BudgetViewModel } from "../src/viewmodels/BudgetViewModel.js";

function withLocalStorage(fn) {
  const previous = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: key => { store.delete(key); }
  };
  return Promise.resolve()
    .then(() => fn(store))
    .finally(() => {
      if (previous === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = previous;
    });
}

test("totals, remaining, and per-category breakdown", async () => {
  const vm = new BudgetViewModel(makeRepo());
  await vm.load();
  await vm.setBudgetSettings({
    totalBudget: 1000,
    categoryBudgets: { foodDrink: 10, shopping: 50, transport: 20 }
  });
  await vm.addEntry({ title: "Ramen", amount: 12, category: "foodDrink", date: Date.now() });
  await vm.addEntry({ title: "Metro", amount: 8, category: "transport", date: Date.now() });

  assert.equal(vm.totalSpent, 20);
  assert.equal(vm.remaining, 980);
  assert.equal(vm.categoryBudgets.foodDrink, 10);
  assert.equal(vm.categoryBudgets.shopping, 50);
  assert.equal(vm.categoryBudgets.transport, 20);
  assert.equal(vm.spentByCategory.foodDrink, 12);
  assert.equal(vm.spentByCategory.transport, 8);

  const rows = vm.categoryBudgetRows;
  assert.deepEqual(rows.map(r => r.id), ["foodDrink", "shopping", "transport"]);

  const food = rows.find(r => r.id === "foodDrink");
  assert.equal(food.budget, 10);
  assert.equal(food.spent, 12);
  assert.equal(food.remaining, -2);
  assert.equal(food.progress, 1);
  assert.equal(food.progressPercent, 100);
  assert.equal(food.status, "over");
  assert.match(food.rowClass, /budget-category-row--over/);
  assert.match(food.progressClass, /budget-progress--over/);

  const transport = rows.find(r => r.id === "transport");
  assert.equal(transport.remaining, 12);
  assert.equal(transport.progress, 0.4);
  assert.equal(transport.status, "ok");

  const shopping = rows.find(r => r.id === "shopping");
  assert.equal(shopping.spent, 0);
  assert.equal(shopping.remaining, 50);
  assert.equal(shopping.status, "ok");
});

test("budget settings and entries can be loaded by a fresh view model", async () => {
  const repo = makeRepo();
  const first = new BudgetViewModel(repo);
  await first.load();
  await first.setBudgetSettings({
    totalBudget: "¥20,000",
    categoryBudgets: { foodDrink: "¥8,000", shopping: "¥7,000", transport: "¥5,000" }
  });
  await first.addEntry({
    title: "Ramen",
    amount: "¥1,100",
    category: "foodDrink",
    date: 123
  });

  const second = new BudgetViewModel(repo);
  await second.load();

  assert.equal(second.totalBudget, 20000);
  assert.equal(second.categoryBudgets.foodDrink, 8000);
  assert.equal(second.categoryBudgets.shopping, 7000);
  assert.equal(second.categoryBudgets.transport, 5000);
  assert.equal(second.totalSpent, 1100);
  assert.equal(second.entries[0].title, "Ramen");
});

test("budget settings are mirrored and restored if IndexedDB settings are missing", async () => {
  await withLocalStorage(async store => {
    const firstRepo = makeRepo();
    const first = new BudgetViewModel(firstRepo);
    await first.load();
    await first.setBudgetSettings({
      totalBudget: "¥50,000",
      categoryBudgets: { foodDrink: "¥20,000", shopping: "¥20,000", transport: "¥10,000" }
    });

    assert.ok(store.get("jp-trip-budget-settings-v1"));

    const emptyRepo = makeRepo();
    const second = new BudgetViewModel(emptyRepo);
    await second.load();

    assert.equal(second.totalBudget, 50000);
    assert.equal(second.categoryBudgets.foodDrink, 20000);
    assert.equal(second.categoryBudgets.shopping, 20000);
    assert.equal(second.categoryBudgets.transport, 10000);
    assert.equal((await emptyRepo.get("settings", "singleton")).totalBudget, 50000);
  });
});

test("daily spend groups by calendar day", async () => {
  const vm = new BudgetViewModel(makeRepo());
  await vm.load();
  const d1 = new Date(2026, 4, 1, 9).getTime();
  const d1b = new Date(2026, 4, 1, 20).getTime();
  const d2 = new Date(2026, 4, 2, 9).getTime();
  await vm.addEntry({ title: "A", amount: 10, category: "food", date: d1 });
  await vm.addEntry({ title: "B", amount: 5,  category: "food", date: d1b });
  await vm.addEntry({ title: "C", amount: 7,  category: "food", date: d2 });

  const daily = vm.dailySpend;
  assert.equal(daily.length, 2);
  assert.equal(daily[0].total, 15);
  assert.equal(daily[1].total, 7);
});

test("delete removes an entry from totals", async () => {
  const vm = new BudgetViewModel(makeRepo());
  await vm.load();
  await vm.addEntry({ title: "X", amount: 50, category: "shopping", date: Date.now() });
  await vm.deleteEntry(vm.entries[0].id);
  assert.equal(vm.totalSpent, 0);
  assert.equal(vm.entries.length, 0);
});

test("float drift avoided when summing", async () => {
  const vm = new BudgetViewModel(makeRepo());
  await vm.load();
  await vm.addEntry({ title: "a", amount: 0.1, category: "foodDrink", date: Date.now() });
  await vm.addEntry({ title: "b", amount: 0.2, category: "foodDrink", date: Date.now() });
  assert.equal(vm.totalSpent, 0.3);
});

test("yen amount input accepts commas and yen symbols", async () => {
  const vm = new BudgetViewModel(makeRepo());
  await vm.load();
  await vm.setTotalBudget("¥10,000");
  await vm.setCategoryBudget("transport", "￥2,500");
  await vm.addEntry({ title: "Train", amount: "￥1,200", category: "transport",
    date: Date.now() });

  assert.equal(vm.totalBudget, 10000);
  assert.equal(vm.categoryBudgets.transport, 2500);
  assert.equal(vm.totalSpent, 1200);
  assert.equal(vm.remaining, 8800);
});

test("legacy settings load with default category budgets", async () => {
  const repo = makeRepo();
  await repo.put("settings", {
    id: "singleton",
    totalBudget: "¥10,000",
    currencyCode: "JPY",
    categoryBudgets: {
      shopping: "￥1,500",
      clothing: "￥2,000",
      groceries: "￥3,000",
      transportation: "￥1,000"
    }
  });

  const vm = new BudgetViewModel(repo);
  await vm.load();

  assert.equal(vm.totalBudget, 10000);
  assert.equal(vm.categoryBudgets.foodDrink, 3000);
  assert.equal(vm.categoryBudgets.shopping, 3500);
  assert.equal(vm.categoryBudgets.transport, 1000);
});

test("receipt photo persists with an entry and clears when absent", async () => {
  const vm = new BudgetViewModel(makeRepo());
  await vm.load();
  await vm.addEntry({ title: "Sushi", amount: 30, category: "foodDrink",
    date: Date.now(), receipt: "data:image/jpeg;base64,AAAA" });
  await vm.addEntry({ title: "Tea", amount: 4, category: "foodDrink",
    date: Date.now() });

  const withReceipt = vm.entries.find(e => e.title === "Sushi");
  const without = vm.entries.find(e => e.title === "Tea");
  assert.equal(withReceipt.receipt, "data:image/jpeg;base64,AAAA");
  assert.equal(without.receipt, null);
});

test("dailyByCategory groups per day with per-category segments and a total", async () => {
  const vm = new BudgetViewModel(makeRepo());
  await vm.load();
  const d1 = new Date(2026, 4, 1, 9).getTime();
  const d1b = new Date(2026, 4, 1, 20).getTime();
  const d2 = new Date(2026, 4, 2, 12).getTime();
  await vm.addEntry({ title: "Lunch", amount: 10, category: "foodDrink", date: d1 });
  await vm.addEntry({ title: "Train", amount: 5,  category: "transport", date: d1b });
  await vm.addEntry({ title: "Gift",  amount: 7,  category: "shopping",  date: d2 });

  const out = vm.dailyByCategory;
  assert.equal(out.length, 2);

  const day1 = out[0];
  assert.equal(day1.total, 15);
  assert.equal(day1.segments.find(s => s.category === "foodDrink").amount, 10);
  assert.equal(day1.segments.find(s => s.category === "transport").amount, 5);

  const day2 = out[1];
  assert.equal(day2.total, 7);
  assert.equal(day2.segments.length, 1);
  assert.equal(day2.segments[0].category, "shopping");
});

test("legacy known budget categories roll into the new category model", async () => {
  const vm = new BudgetViewModel(makeRepo());
  await vm.load();
  const d1 = new Date(2026, 4, 1, 9).getTime();
  await vm.addEntry({ title: "Old groceries", amount: 4, category: "groceries", date: d1 });
  await vm.addEntry({ title: "Old clothes", amount: 6, category: "clothing", date: d1 });
  await vm.addEntry({ title: "Old souvenir", amount: 8, category: "souvenirs", date: d1 });
  await vm.addEntry({ title: "Old transit", amount: 3, category: "transportation", date: d1 });
  await vm.addEntry({ title: "Ramen", amount: 10, category: "foodDrink", date: d1 });

  assert.equal(vm.spentByCategory.foodDrink, 14);
  assert.equal(vm.spentByCategory.shopping, 14);
  assert.equal(vm.spentByCategory.transport, 3);
  assert.equal(vm.spentByCategory.other, undefined);
  assert.equal(vm.spentByCategory.groceries, undefined);
  assert.equal(vm.spentByCategory.clothing, undefined);
  assert.equal(vm.spentByCategory.transportation, undefined);

  const day = vm.dailyByCategory[0];
  assert.deepEqual(day.segments.map(s => s.category), ["foodDrink", "shopping", "transport"]);
  assert.equal(day.segments.find(s => s.category === "foodDrink").amount, 14);
  assert.equal(day.segments.find(s => s.category === "shopping").amount, 14);
  assert.equal(day.segments.find(s => s.category === "transport").amount, 3);

  const rows = vm.categoryBudgetRows;
  assert.deepEqual(rows.map(r => r.id), ["foodDrink", "shopping", "transport"]);
});

test("unknown budget categories roll into Other for breakdowns", async () => {
  const vm = new BudgetViewModel(makeRepo());
  await vm.load();
  const d1 = new Date(2026, 4, 1, 9).getTime();
  await vm.addEntry({ title: "Old activity", amount: 6, category: "activities", date: d1 });

  assert.equal(vm.spentByCategory.other, 6);

  const rows = vm.categoryBudgetRows;
  assert.deepEqual(rows.map(r => r.id), ["foodDrink", "shopping", "transport", "other"]);
  const other = rows.find(r => r.id === "other");
  assert.equal(other.spent, 6);
  assert.equal(other.budget, null);
  assert.equal(other.remaining, null);
  assert.equal(other.spentOnly, true);
  assert.equal(other.status, "spent-only");
});

test("trip budget falls back to the sum of category budgets when total is blank", async () => {
  const repo = makeRepo();
  const vm = new BudgetViewModel(repo);
  await vm.load();
  await vm.setBudgetSettings({
    totalBudget: "",
    categoryBudgets: { foodDrink: "¥50,000", transport: "30000" }
  });

  const fresh = new BudgetViewModel(repo);
  await fresh.load();
  assert.equal(fresh.categoryBudgetTotal, 80000);
  assert.equal(fresh.totalBudget, 80000);
  assert.equal(fresh.remaining, 80000);
});

test("an explicit total trip budget overrides the category sum", async () => {
  const repo = makeRepo();
  const vm = new BudgetViewModel(repo);
  await vm.load();
  await vm.setBudgetSettings({
    totalBudget: "¥200,000",
    categoryBudgets: { foodDrink: "50000", transport: "30000" }
  });

  const fresh = new BudgetViewModel(repo);
  await fresh.load();
  assert.equal(fresh.categoryBudgetTotal, 80000);
  assert.equal(fresh.totalBudget, 200000);
});
