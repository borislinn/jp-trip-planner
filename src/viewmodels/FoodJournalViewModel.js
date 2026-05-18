import { dayKey } from "../domain/datetime.js";
import { parseCurrencyInput, sumMoney } from "../domain/money.js";

export class FoodJournalViewModel {
  constructor(repo) {
    this.repo = repo;
    this.meals = [];
    this.settings = { currencyCode: "JPY" };
  }

  async load() {
    const settings = await this.repo.get("settings", "singleton");
    if (settings) this.settings = settings;
    const rows = await this.repo.getAll("meals");
    this.meals = rows.sort((a, b) => b.date - a.date);
  }

  get expenses()        { return this.meals; }

  get dailyExpenses() {
    const groups = new Map();
    for (const expense of this.expenses) {
      const day = dayKey(expense.date);
      if (!groups.has(day)) groups.set(day, { day, date: expense.date, expenses: [] });
      groups.get(day).expenses.push(expense);
    }
    return [...groups.values()]
      .map(group => ({
        ...group,
        total: sumMoney(group.expenses.map(expense => expense.amount))
      }))
      .sort((a, b) => b.day.localeCompare(a.day));
  }

  async addMeal(d) {
    const name = d.name || d.restaurant;
    if (!name || !name.trim()) return false;
    const amount = parseCurrencyInput(d.amount);
    if (!(amount > 0)) return false;
    const cleanName = name.trim();
    const type = d.expenseType || d.mealType || null;
    const date = d.date || Date.now();
    const expense = await this.repo.put("meals", {
      name: cleanName,
      restaurant: cleanName,
      amount,
      expenseType: type,
      mealType: type,
      comment: (d.comment || "").trim(),
      date,
      receipt: d.receipt || null
    });
    await this.repo.put("budgetEntries", {
      title: cleanName,
      amount,
      category: type || "other",
      date,
      note: (d.comment || "").trim() || null,
      receipt: d.receipt || null,
      sourceExpenseId: expense.id
    });
    await this.load();
    return true;
  }

  async addExpense(d) {
    return this.addMeal(d);
  }

  async deleteMeal(id) {
    await this.repo.remove("meals", id);
    const entries = await this.repo.getAll("budgetEntries");
    await Promise.all(entries
      .filter(e => e.sourceExpenseId === id)
      .map(e => this.repo.remove("budgetEntries", e.id)));
    await this.load();
  }

  async deleteExpense(id) {
    return this.deleteMeal(id);
  }
}
