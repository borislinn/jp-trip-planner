import { FoodJournalViewModel } from "../viewmodels/FoodJournalViewModel.js";
import { BUDGET_CATEGORIES, categoryById } from "../domain/enums.js";
import { dayLabel } from "../domain/datetime.js";
import { t } from "../domain/i18n.js";
import { formatCurrency, homeApprox } from "../domain/money.js";
import {
  el, openSheet, field, helpText, moneyInput, receiptPicker, lightbox, toast,
  confirmDialog, emptyAction
} from "./components.js";

export async function render(root, header, repo) {
  const vm = new FoodJournalViewModel(repo);
  await vm.load();
  const fmt = value => formatCurrency(value, vm.settings.currencyCode);

  header.setTitle(t("Expenses"));
  header.setActions([
    el("button", { class: "btn-text", "aria-label": t("Add expense"),
      onclick: () => addSheet() }, "＋")
  ]);

  const pad = value => String(value).padStart(2, "0");
  const localDateTimeValue = (date = new Date()) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`;

  function totalSpent() {
    return vm.dailyExpenses.reduce((sum, day) => sum + day.total, 0);
  }

  function expenseTypeLabel(type) {
    if (!type) return "";
    const c = categoryById(type);
    if (c.id !== "other") return `${c.emoji} ${t(c.label)}`;
    return type;
  }

  function expenseCard(m, withDelete) {
    const category = categoryById(m.expenseType || m.mealType);
    return el("article", { class: "card expense-card" }, [
      el("div", { class: "expense-card__main" }, [
        el("div", {}, [
          el("strong", { class: "expense-name" }, m.name || m.restaurant),
          el("div", { class: "expense-meta" }, [
            (m.expenseType || m.mealType)
              ? el("span", { class: "pill", style: `--pill-color:${category.color}` },
                expenseTypeLabel(m.expenseType || m.mealType))
              : null,
            el("span", {}, dayLabel(m.date))
          ])
        ]),
        m.amount ? el("strong", { class: "expense-amount" }, fmt(m.amount)) : null
      ]),
      m.comment ? el("div", { class: "muted" }, m.comment) : null,
      m.receipt ? el("img", { class: "receipt-thumb", src: m.receipt,
        alt: "Receipt", "aria-label": "View receipt",
        role: "button", tabindex: "0", loading: "lazy", decoding: "async",
        onkeydown: e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            lightbox(m.receipt);
          }
        },
        onclick: () => lightbox(m.receipt) }) : null,
      withDelete ? el("div", { class: "card-actions" }, [
      el("button", { class: "btn-text", type: "button",
        "aria-label": `Edit expense ${m.name || m.restaurant}`, title: "Edit expense",
        onclick: () => addSheet(m) }, "✎"),
      el("button", { class: "btn-text", type: "button",
        "aria-label": `Delete expense ${m.name || m.restaurant}`, title: "Delete expense",
        onclick: async () => {
          const ok = await confirmDialog({
            title: t("Delete expense?"),
            message: m.name || m.restaurant
          });
          if (!ok) return;
          await vm.deleteExpense(m.id); paint();
        } }, "×")
      ]) : null
    ]);
  }

  function emptyState() {
    return emptyAction(t("No expenses logged."), t("Add First Expense"),
      () => addSheet());
  }

  // Two-tap path for the most frequent action on a trip: amount + category.
  // Place/notes/receipt are skipped; the category label becomes the name so
  // the entry is valid and editable later.
  function quickAddSheet() {
    openSheet(close => {
      const amount = moneyInput({}, vm.settings.currencyCode);
      const type = categoryPicker();
      const error = el("div", { class: "form-error", role: "alert", hidden: "hidden" });
      return el("div", {}, [
        el("h3", {}, t("Quick Add")),
        field(t("Amount (JPY)"), amount),
        field(t("Category"), type.element),
        error,
        el("button", { class: "btn-primary", type: "button", onclick: async () => {
          error.hidden = true;
          const category = categoryById(type.value);
          const ok = await vm.addExpense({
            name: t(category.label),
            expenseType: type.value || null,
            amount: amount.value,
            date: Date.now()
          });
          if (ok) { close(); paint(); toast(t("Expense saved")); }
          else {
            error.textContent = t("Enter an amount above zero.");
            error.hidden = false;
            amount.focus();
          }
        } }, t("Save"))
      ]);
    });
  }

  function paint() {
    root.replaceChildren();
    if (!vm.expenses.length) { root.appendChild(emptyState()); return; }
    root.appendChild(el("section", { class: "card expense-summary" }, [
      el("div", {}, [
        el("span", { class: "eyebrow" }, t("Trip Spend")),
        el("strong", { class: "balance danger" }, fmt(totalSpent())),
        (() => {
          const approx = homeApprox(totalSpent(),
            vm.settings.homeCurrency, vm.settings.homeRate);
          return approx ? el("div", { class: "home-approx" }, approx) : null;
        })()
      ]),
      el("div", { class: "metric-grid" }, [
        el("div", { class: "metric" }, [
          el("span", {}, t("Entries")),
          el("strong", {}, String(vm.expenses.length))
        ]),
        el("div", { class: "metric" }, [
          el("span", {}, t("Days")),
          el("strong", {}, String(vm.dailyExpenses.length))
        ])
      ]),
      el("div", { class: "quick-actions" }, [
        el("button", { class: "btn-primary", type: "button",
          onclick: quickAddSheet }, t("Quick Add")),
        el("button", { class: "btn-secondary", type: "button",
          onclick: () => addSheet() }, t("Add with details"))
      ])
    ]));
    for (const day of vm.dailyExpenses) {
      root.appendChild(el("section", { class: "day-group" }, [
        el("div", { class: "day-heading row" }, [
          el("span", {}, dayLabel(day.date)),
          el("strong", {}, fmt(day.total))
        ]),
        ...day.expenses.map(m => expenseCard(m, true))
      ]));
    }
  }

  function categoryPicker(initial = null) {
    let selected = BUDGET_CATEGORIES.some(c => c.id === initial)
      ? initial : BUDGET_CATEGORIES[0].id;
    const buttons = BUDGET_CATEGORIES.map(c => {
      const button = el("button", {
        class: "category-choice",
        type: "button",
        role: "radio",
        "aria-checked": String(c.id === selected),
        style: `--category-color:${c.color}`,
        onclick: () => select(c.id)
      }, [
        el("span", {}, c.emoji),
        el("strong", {}, t(c.label))
      ]);
      return [c.id, button];
    });
    const select = id => {
      selected = id;
      for (const [buttonId, button] of buttons) {
        button.setAttribute("aria-checked", String(buttonId === selected));
      }
    };
    return {
      element: el("div", { class: "category-choice-group",
        role: "radiogroup", "aria-label": "Expense category" },
        buttons.map(([, button]) => button)),
      get value() { return selected; }
    };
  }

  function addSheet(existing = null) {
    openSheet(close => {
      const name = el("input", { type: "text", autocomplete: "off",
        autocapitalize: "words" });
      const amount = moneyInput({}, vm.settings.currencyCode);
      const type = categoryPicker(existing?.expenseType || existing?.mealType || null);
      const spentAt = el("input", { type: "datetime-local",
        value: localDateTimeValue(existing ? new Date(existing.date) : new Date()) });
      const comment = el("textarea", { rows: "4", autocapitalize: "sentences" });
      const error = el("div", { class: "form-error", role: "alert", hidden: "hidden" });

      const receipt = receiptPicker(existing?.receipt || null);
      if (existing) {
        name.value = existing.name || existing.restaurant || "";
        amount.value = fmt(existing.amount);
        comment.value = existing.comment || "";
      }
      function showError(message) {
        error.textContent = message;
        error.hidden = false;
      }
      return el("div", {}, [
        el("h3", {}, existing ? t("Edit Expense") : t("New Expense")),
        field(t("Amount (JPY)"), amount),
        field(t("Place / service"), name),
        field(t("Category"), type.element),
        field(t("When"), spentAt),
        receipt.element,
        helpText(t("Receipt photos are optional proof only. Enter the amount manually above.")),
        field(t("Notes"), comment),
        error,
        el("button", { class: "btn-primary", onclick: async () => {
          error.hidden = true;
          const ok = await vm.addExpense({
            id: existing?.id,
            name: name.value, expenseType: type.value || null,
            amount: amount.value, comment: comment.value,
            date: spentAt.value ? new Date(spentAt.value).getTime() : Date.now(),
            receipt: receipt.get() });
          if (ok) { close(); paint(); toast(t("Expense saved")); }
          else {
            showError("Enter a place or service and an amount above zero.");
            (!amount.value ? amount : name).focus();
          }
        } }, t("Save"))
      ]);
    });
  }

  paint();
}
