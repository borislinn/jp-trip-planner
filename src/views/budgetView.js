import { BudgetViewModel } from "../viewmodels/BudgetViewModel.js";
import { BUDGET_CATEGORIES, categoryById } from "../domain/enums.js";
import { t } from "../domain/i18n.js";
import { formatCurrency, homeApprox } from "../domain/money.js";
import {
  el, empty, openSheet, field, helpText, moneyInput, progressBar, sectionTitle, toast
} from "./components.js";
import { svgPie, svgStackedBars } from "./charts.js";

export async function render(root, header, repo) {
  const vm = new BudgetViewModel(repo);
  await vm.load();
  const cur = vm.settings.currencyCode;
  const fmt = v => formatCurrency(v, cur);
  const colorFor = id => categoryById(id).color;
  const approxNode = jpy => {
    const text = homeApprox(jpy, vm.settings.homeCurrency, vm.settings.homeRate);
    return text ? el("div", { class: "home-approx" }, text) : null;
  };

  header.setTitle(t("Money"));
  header.setActions([
    el("button", { class: "btn-text", "aria-label": t("Budget settings"),
      onclick: () => settingsSheet() }, "⚙︎")
  ]);

  function goToExpenses() {
    location.hash = "#/food";
  }

  function metric(label, value, cls = "") {
    return el("div", { class: "metric" }, [
      el("span", {}, label),
      el("strong", { class: cls }, value)
    ]);
  }

  function pieChart() {
    const data = vm.categoryBudgetRows
      .filter(row => row.spent > 0)
      .map(row => ({ label: row.label, value: row.spent, color: row.color }));
    if (!data.length) return empty(t("No spending yet."));

    const chart = svgPie(data);
    chart.classList.add("pie-chart");
    return el("div", { class: "chart-layout" }, [
      el("div", { class: "pie-wrap" }, chart),
      el("div", { class: "chart-legend" },
        vm.categoryBudgetRows.map(row => el("div", { class: "legend-row" }, [
          el("span", { class: "legend-dot", style: `background:${row.color}` }),
          el("span", {}, t(row.label)),
          el("strong", {}, fmt(row.spent))
        ])))
    ]);
  }

  function categoryBudgetRow(row) {
    const amountClass = row.spentOnly ? "" : row.remaining < 0 ? "danger" : "good";
    return el("div", {
      class: row.rowClass,
      "data-category": row.id,
      "data-budget": row.budget == null ? "" : String(row.budget),
      "data-spent": String(row.spent),
      "data-remaining": row.remaining == null ? "" : String(row.remaining),
      "data-status": row.status
    }, [
      el("div", { class: "row" }, [
        el("span", { class: "category-label" }, [
          el("span", { class: "category-mark", style: `background:${row.color}` }, row.emoji),
          el("strong", {}, t(row.label))
        ]),
        el("strong", { class: amountClass },
          row.spentOnly ? fmt(row.spent) : fmt(row.remaining))
      ]),
      progressBar(row.spentOnly ? 1 : row.spent, row.spentOnly ? 1 : row.budget,
        `${row.label} budget progress`, row.color),
      row.spentOnly
        ? el("div", { class: "budget-meta single" }, [
          el("div", {}, [el("span", {}, t("Spent")), el("strong", {}, fmt(row.spent))])
        ])
        : el("div", { class: "budget-meta" }, [
          el("div", {}, [el("span", {}, t("Budget")), el("strong", {}, fmt(row.budget))]),
          el("div", {}, [el("span", {}, t("Spent")), el("strong", {}, fmt(row.spent))]),
          el("div", {}, [el("span", {}, t("Remaining")),
            el("strong", { class: row.remaining < 0 ? "danger" : "" }, fmt(row.remaining))])
        ])
    ]);
  }

  function paint() {
    root.replaceChildren();

    const progressLabel = vm.totalBudget > 0
      ? `${Math.round(Math.min(vm.totalSpent / vm.totalBudget, 1) * 100)}% spent`
      : t("Budget not set");

    root.appendChild(el("section", { class: "card overview-hero" }, [
      el("div", { class: "overview-hero__top" }, [
        el("div", {}, [
          el("span", { class: "eyebrow" }, t("Trip Balance")),
          el("strong", { class: vm.remaining < 0 ? "balance danger" : "balance good" },
            fmt(vm.remaining)),
          approxNode(vm.remaining)
        ]),
        el("span", { class: "status-chip" }, progressLabel)
      ]),
      progressBar(vm.totalSpent, vm.totalBudget, "Total trip budget progress"),
      el("div", { class: "metric-grid" }, [
        metric(t("Budget"), fmt(vm.totalBudget)),
        metric(t("Spent"), fmt(vm.totalSpent), "danger"),
        metric(t("Remaining"), fmt(vm.remaining), vm.remaining < 0 ? "danger" : "good")
      ]),
      el("div", { class: "quick-actions" }, [
        el("button", { class: "btn-primary", type: "button", onclick: goToExpenses },
          t("Add Expense")),
        el("button", { class: "btn-secondary", type: "button", onclick: settingsSheet },
          t("Budget Settings"))
      ])
    ]));

    root.appendChild(el("section", { class: "card chart-card" }, [
      sectionTitle(t("Spending Mix"), cur),
      pieChart()
    ]));

    const byCat = el("div", { class: "card budget-category-card" }, [
      sectionTitle(t("Category Budgets"), "JPY"),
      ...vm.categoryBudgetRows.map(categoryBudgetRow),
      el("div", { class: "row",
        style: "padding:6px 0;border-top:1px solid var(--border)" }, [
        el("span", {}, t("Total Spent")), el("strong", {}, fmt(vm.totalSpent))
      ])
    ]);
    root.appendChild(byCat);

    root.appendChild(el("section", { class: "card budget-daily-spend" }, [
      sectionTitle(t("Daily Spend"), t("by category")),
      vm.dailyByCategory.length
        ? svgStackedBars(vm.dailyByCategory, colorFor, fmt)
        : empty(t("No daily data"))
    ]));
  }

  function settingsSheet() {
    openSheet(close => {
      const input = moneyInput({
        value: vm.totalBudget ? fmt(vm.totalBudget) : ""
      }, cur);
      const categoryInputs = new Map(BUDGET_CATEGORIES.map(c => [c.id,
        moneyInput({
          value: vm.categoryBudgets[c.id] ? fmt(vm.categoryBudgets[c.id]) : ""
        }, cur)
      ]));
      const homeCur = el("input", {
        type: "text", autocomplete: "off", maxlength: "3",
        placeholder: "USD", value: vm.settings.homeCurrency || ""
      });
      const homeRate = el("input", {
        type: "text", inputmode: "decimal", autocomplete: "off",
        placeholder: "155", value: vm.settings.homeRate || ""
      });
      return el("div", {}, [
        el("h3", {}, t("Budget Settings")),
        field(t("Total trip budget (JPY)"), input),
        helpText(t("Leave the total blank to use the sum of your category budgets. Set category budgets where you want a spending guardrail.")),
        el("h3", {}, t("Home currency")),
        field(t("Home currency code"), homeCur),
        field(t("Home currency rate (¥ per 1 unit)"), homeRate),
        helpText(t("Optional. Shows an approximate home-currency figure next to balances. Enter the rate manually — it is not fetched online.")),
        el("h3", {}, t("Category Budgets")),
        ...BUDGET_CATEGORIES.map(c =>
          field(`${c.emoji} ${t(c.label)}`, categoryInputs.get(c.id))),
        el("button", { class: "btn-primary", onclick: async () => {
          await vm.setBudgetSettings({
            totalBudget: input.value,
            homeCurrency: homeCur.value,
            homeRate: homeRate.value,
            categoryBudgets: Object.fromEntries([...categoryInputs.entries()]
              .map(([id, categoryInput]) => [id, categoryInput.value]))
          });
          close(); paint(); toast(t("Budget saved"));
        } }, t("Save"))
      ]);
    });
  }

  paint();
}
