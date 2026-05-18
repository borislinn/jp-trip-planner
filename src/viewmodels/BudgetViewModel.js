import { parseCurrencyInput, sumMoney } from "../domain/money.js";
import { dayKey } from "../domain/datetime.js";
import { BUDGET_CATEGORIES, categoryById, normalizeBudgetCategoryId } from "../domain/enums.js";

const SETTINGS_ID = "singleton";
const SETTINGS_BACKUP_KEY = "jp-trip-budget-settings-v1";
const CATEGORY_ORDER = new Map(BUDGET_CATEGORIES.map((c, i) => [c.id, i]));
CATEGORY_ORDER.set("other", BUDGET_CATEGORIES.length);

const normalizedCategory = id => normalizeBudgetCategoryId(id);
const categoryRank = id => CATEGORY_ORDER.get(id) ?? CATEGORY_ORDER.get("other");
const defaultCategoryBudgets = () =>
  Object.fromEntries(BUDGET_CATEGORIES.map(c => [c.id, 0]));
const categoryBudgetStatus = (spent, budget, spentOnly) => {
  if (spentOnly) return "spent-only";
  if (!(budget > 0)) return spent > 0 ? "unset-active" : "unset";
  const ratio = spent / budget;
  if (ratio >= 1) return "over";
  if (ratio >= 0.8) return "near";
  return "ok";
};
const canUseLocalStorage = () => {
  try { return typeof localStorage !== "undefined"; }
  catch { return false; }
};

export class BudgetViewModel {
  constructor(repo) {
    this.repo = repo;
    this.entries = [];
    this.settings = {
      id: SETTINGS_ID,
      totalBudget: 0,
      currencyCode: "JPY",
      categoryBudgets: defaultCategoryBudgets()
    };
  }

  async load() {
    const s = await this.repo.get("settings", SETTINGS_ID);
    if (s) this.settings = this.normalizedSettings(s);
    else {
      this.settings = this.loadSettingsBackup() || this.settings;
      await this.persistSettings();
    }
    const rows = await this.repo.getAll("budgetEntries");
    this.entries = rows.sort((a, b) => b.date - a.date);
  }

  loadSettingsBackup() {
    if (!canUseLocalStorage()) return null;
    try {
      const raw = localStorage.getItem(SETTINGS_BACKUP_KEY);
      return raw ? this.normalizedSettings(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  backupSettings() {
    if (!canUseLocalStorage()) return;
    try {
      localStorage.setItem(SETTINGS_BACKUP_KEY, JSON.stringify(this.settings));
    } catch {
      // IndexedDB remains the source of truth; the backup is best-effort.
    }
  }

  async persistSettings() {
    this.settings.id = SETTINGS_ID;
    await this.repo.put("settings", this.settings);
    this.backupSettings();
  }

  normalizedSettings(settings) {
    const categoryBudgets = defaultCategoryBudgets();
    for (const c of BUDGET_CATEGORIES) {
      categoryBudgets[c.id] = parseCurrencyInput(settings.categoryBudgets?.[c.id] || 0);
    }
    for (const [id, value] of Object.entries(settings.categoryBudgets || {})) {
      const category = normalizedCategory(id);
      if (category !== "other" && !BUDGET_CATEGORIES.some(c => c.id === id)) {
        categoryBudgets[category] = sumMoney([categoryBudgets[category], parseCurrencyInput(value)]);
      }
    }
    return {
      id: SETTINGS_ID,
      currencyCode: settings.currencyCode || "JPY",
      totalBudget: parseCurrencyInput(settings.totalBudget || 0),
      categoryBudgets
    };
  }

  get totalSpent() { return sumMoney(this.entries.map(e => e.amount)); }
  get categoryBudgetTotal() {
    return sumMoney(BUDGET_CATEGORIES.map(c => Number(this.categoryBudgets[c.id]) || 0));
  }
  // Effective trip budget: the explicit "total trip budget" when set,
  // otherwise the sum of the per-category budgets — so entering category
  // budgets alone still reflects in the trip balance.
  get totalBudget() {
    const explicit = Number(this.settings.totalBudget) || 0;
    return explicit > 0 ? explicit : this.categoryBudgetTotal;
  }
  get remaining() { return sumMoney([this.totalBudget, -this.totalSpent]); }
  get categoryBudgets() {
    return { ...defaultCategoryBudgets(), ...(this.settings.categoryBudgets || {}) };
  }

  get spentByCategory() {
    const out = {};
    for (const e of this.entries) {
      const category = normalizedCategory(e.category);
      out[category] = sumMoney([out[category] || 0, e.amount]);
    }
    return out;
  }

  get dailySpend() {
    const groups = new Map();
    for (const e of this.entries) {
      const k = dayKey(e.date);
      groups.set(k, [...(groups.get(k) || []), e.amount]);
    }
    return [...groups.entries()]
      .map(([day, amts]) => ({ day, total: sumMoney(amts) }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  get dailyByCategory() {
    const days = new Map();
    for (const e of this.entries) {
      const k = dayKey(e.date);
      if (!days.has(k)) days.set(k, new Map());
      const cats = days.get(k);
      const category = normalizedCategory(e.category);
      cats.set(category, sumMoney([cats.get(category) || 0, e.amount]));
    }
    return [...days.entries()]
      .map(([day, cats]) => ({
        day,
        segments: [...cats.entries()]
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => categoryRank(a.category) - categoryRank(b.category)),
        total: sumMoney([...cats.values()])
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  get categoryBudgetRows() {
    const spentByCategory = this.spentByCategory;
    const budgets = this.categoryBudgets;
    const rows = BUDGET_CATEGORIES.map(c => {
      const spent = spentByCategory[c.id] || 0;
      const budget = budgets[c.id] || 0;
      const remaining = sumMoney([budget, -spent]);
      const progress = budget > 0 ? Math.min(spent / budget, 1) : 0;
      const status = categoryBudgetStatus(spent, budget, false);
      return {
        ...c,
        spent,
        budget,
        remaining,
        progress,
        progressPercent: Math.round(progress * 100),
        status,
        rowClass: `budget-category-row budget-category-row--${status}`,
        progressClass: `budget-progress budget-progress--${status}`,
        spentOnly: false
      };
    });

    const otherSpent = spentByCategory.other || 0;
    if (otherSpent > 0) {
      const c = categoryById("other");
      rows.push({
        ...c,
        spent: otherSpent,
        budget: null,
        remaining: null,
        progress: null,
        progressPercent: null,
        status: "spent-only",
        rowClass: "budget-category-row budget-category-row--spent-only",
        progressClass: "budget-progress budget-progress--spent-only",
        spentOnly: true
      });
    }

    return rows;
  }

  async setTotalBudget(value) {
    this.settings.totalBudget = parseCurrencyInput(value);
    await this.persistSettings();
  }

  async setCategoryBudget(categoryId, value) {
    const category = BUDGET_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return false;
    this.settings.categoryBudgets = this.categoryBudgets;
    this.settings.categoryBudgets[category.id] = parseCurrencyInput(value);
    await this.persistSettings();
    return true;
  }

  async setBudgetSettings({ totalBudget, categoryBudgets }) {
    this.settings.totalBudget = parseCurrencyInput(totalBudget);
    const nextBudgets = this.categoryBudgets;
    for (const c of BUDGET_CATEGORIES) {
      nextBudgets[c.id] = parseCurrencyInput(categoryBudgets?.[c.id] || 0);
    }
    this.settings.categoryBudgets = nextBudgets;
    await this.persistSettings();
  }

  async addEntry({ title, amount, category, date, note, receipt }) {
    const parsedAmount = parseCurrencyInput(amount);
    if (!title?.trim() || !(parsedAmount > 0)) return false;
    await this.repo.put("budgetEntries", {
      title: title.trim(), amount: parsedAmount,
      category: category || "other", date: date || Date.now(),
      note: note?.trim() || null,
      receipt: receipt || null
    });
    await this.load();
    return true;
  }

  async deleteEntry(id) {
    await this.repo.remove("budgetEntries", id);
    await this.load();
  }
}
