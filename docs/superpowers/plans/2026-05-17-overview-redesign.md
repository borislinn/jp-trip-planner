# "Go Go Osaka" — Overview Redesign & Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the app to "Go Go Osaka", simplify the budget to 3 categories, restructure the tab bar (Overview · Food · Stays · Flights), and redesign the budget screen as an "Overview" with a pie chart + per-category totals, a stacked-by-category daily bar chart with day totals on top, red Spent / green Remaining, and the raw entries list hidden (data still stored and ordered).

**Architecture:** Same zero-dependency static PWA, MVVM. Pure ViewModel additions are TDD'd under Node (`node --test`); browser-only chart/DOM code is syntax- and import-checked here and verified on-device. No new dependencies, no build step.

**Tech Stack:** Vanilla ES modules, IndexedDB, SVG (hand-rolled pie + stacked bars), Node built-in test runner.

---

## Context for the implementer (read first)

This modifies an existing, working app at the repo root. Current relevant state:
- `src/domain/enums.js` — `BUDGET_CATEGORIES` (8 entries) + `categoryById(id)` (falls back to the `other` entry by id — **but `other` is being removed**, so the fallback must change).
- `src/viewmodels/BudgetViewModel.js` — has `entries`, `totalSpent`, `totalBudget`, `remaining`, `spentByCategory`, `dailySpend`. Persists `receipt`. We **add** `dailyByCategory`; we do **not** remove `entries` (data must stay, just hidden in the UI).
- `src/views/charts.js` — `svgDonut`, `svgBars`. We replace these with `svgPie`, `svgStackedBars`.
- `src/views/budgetView.js` — renders summary, donut, daily bars, **and an Entries list**. We retitle to "Overview", swap charts, hide the Entries list, recolor Spent/Remaining.
- `index.html` — tab bar order is Budget · Stays · Flights · Food; `<title>`/apple meta say trip planner.
- `app.webmanifest` — `name`/`short_name`.
- `sw.js` — `CACHE = "jp-trip-v2"`; bump on shell change so devices fetch fresh assets.
- Routes in `src/main.js` key off `data-route` (`budget|stays|flights|food`); **keep these keys** — only the tab *order*, *labels*, and the budget view's *title* change.

**Known accepted effect:** hiding the Entries list also hides budget-entry receipt thumbnails (receipts are still stored, just not surfaced on Overview). Food receipts remain visible on the Food tab. This is per the user's "hide entries" instruction.

**Test command (this project):** `node --test` (Node v18+). Browser checks: `node --check <file>` + the import-resolution snippet in Task 6.

---

## Task 1: Rename to "Go Go Osaka" + Tab Bar Reorder/Relabel

**Files:**
- Modify: `index.html`
- Modify: `app.webmanifest`

- [ ] **Step 1: Update `app.webmanifest` name fields**

Replace the `name` and `short_name` values:

```json
{
  "name": "Go Go Osaka",
  "short_name": "Go Go Osaka",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0b5ca8",
  "theme_color": "#0b5ca8",
  "orientation": "portrait",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Update `index.html` title, apple meta, default header, and tab bar**

Replace the `<title>` line:

```html
  <title>Go Go Osaka</title>
```

Replace the apple title meta line:

```html
  <meta name="apple-mobile-web-app-title" content="Go Go Osaka" />
```

Replace the default header `<h1>` (router overwrites it per section; this is just the pre-render default):

```html
    <h1 id="headerTitle">Overview</h1>
```

Replace the entire `<nav id="tabBar">…</nav>` block (new order: Overview, Food, Stays, Flights; `data-route` keys unchanged):

```html
  <nav id="tabBar" class="tab-bar" role="tablist" aria-label="Sections">
    <button class="tab" data-route="budget"  role="tab">&#128202;<span>Overview</span></button>
    <button class="tab" data-route="food"    role="tab">&#127869;<span>Food</span></button>
    <button class="tab" data-route="stays"   role="tab">&#127976;<span>Stays</span></button>
    <button class="tab" data-route="flights" role="tab">&#9992;<span>Flights</span></button>
  </nav>
```

- [ ] **Step 3: Verify the rename + reorder**

Run:
```bash
cd "$PROJECT_ROOT"
grep -c "Go Go Osaka" index.html app.webmanifest
grep -n "data-route" index.html
```
Expected: `index.html` matches ≥2, `app.webmanifest` matches 1 (it appears once per file via grep -c per file); tab order prints `budget` then `food` then `stays` then `flights`.

- [ ] **Step 4: Commit**

```bash
git add index.html app.webmanifest
git commit -m "feat: rename app to Go Go Osaka; reorder tabs (Overview/Food/Stays/Flights)"
```

---

## Task 2: Budget Categories → 3 With Cute Icons + Safe Fallback (TDD)

**Files:**
- Modify: `src/domain/enums.js`
- Test: `test/enums.test.js` (new)

- [ ] **Step 1: Write the failing test**

`test/enums.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGET_CATEGORIES, categoryById } from "../src/domain/enums.js";

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

test("categoryById returns a safe object for unknown/legacy ids", () => {
  const known = categoryById("shopping");
  assert.equal(known.label, "Shopping");
  const legacy = categoryById("groceries"); // removed category
  assert.equal(legacy.id, "other");
  assert.ok(legacy.label && legacy.emoji && legacy.color);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/enums.test.js`
Expected: FAIL — categories list is still the 8-entry set; `categoryById("groceries")` currently returns the old `other` entry which no longer exists after the change.

- [ ] **Step 3: Replace the category list and fallback in `src/domain/enums.js`**

Replace the `BUDGET_CATEGORIES` array and the `categoryById` export (leave `TRANSPORT_MODES` and `MEAL_TYPES` untouched):

```js
export const BUDGET_CATEGORIES = [
  { id: "foodDrink", label: "Food & Drink",   emoji: "🍜", color: "#e8821e" },
  { id: "shopping",  label: "Shopping",        emoji: "🛍️", color: "#d64f93" },
  { id: "transport", label: "Transportation",  emoji: "🚆", color: "#1f6fd6" }
];

export const categoryById = id =>
  BUDGET_CATEGORIES.find(c => c.id === id) ||
  { id: "other", label: "Other", emoji: "•", color: "#8a8a8e" };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/enums.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/enums.js test/enums.test.js
git commit -m "feat: budget categories -> Food & Drink / Shopping / Transportation (TDD)"
```

---

## Task 3: `dailyByCategory` Getter on BudgetViewModel (TDD)

**Files:**
- Modify: `src/viewmodels/BudgetViewModel.js`
- Test: `test/budgetViewModel.test.js` (append)

- [ ] **Step 1: Append the failing test**

Add to the end of `test/budgetViewModel.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/budgetViewModel.test.js`
Expected: FAIL — `vm.dailyByCategory` is `undefined`.

- [ ] **Step 3: Add the getter**

In `src/viewmodels/BudgetViewModel.js`, add this getter immediately after the existing `get dailySpend()` getter (do not remove `dailySpend`; `sumMoney` and `dayKey` are already imported at the top of the file):

```js
  get dailyByCategory() {
    const days = new Map();
    for (const e of this.entries) {
      const k = dayKey(e.date);
      if (!days.has(k)) days.set(k, new Map());
      const cats = days.get(k);
      cats.set(e.category, sumMoney([cats.get(e.category) || 0, e.amount]));
    }
    return [...days.entries()]
      .map(([day, cats]) => ({
        day,
        segments: [...cats.entries()].map(([category, amount]) => ({ category, amount })),
        total: sumMoney([...cats.values()])
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/budgetViewModel.test.js`
Expected: PASS (all budget tests, including the new one).

- [ ] **Step 5: Commit**

```bash
git add src/viewmodels/BudgetViewModel.js test/budgetViewModel.test.js
git commit -m "feat: BudgetViewModel.dailyByCategory for stacked daily chart (TDD)"
```

---

## Task 4: New SVG Charts — Pie + Stacked Daily Bars

**Files:**
- Modify (replace contents): `src/views/charts.js`

> Browser-only (creates SVG DOM). Verified by syntax check here; visual check is on-device (Task 6).

- [ ] **Step 1: Replace `src/views/charts.js` entirely**

```js
const NS = "http://www.w3.org/2000/svg";

function svgEl(viewBox, label) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", label);
  return svg;
}

// Full pie chart. data: [{label, value, color}]. Returns an <svg>.
export function svgPie(data) {
  const slices = data.filter(d => d.value > 0);
  const total = slices.reduce((s, d) => s + d.value, 0);
  const svg = svgEl("0 0 120 120", "Spending by category");
  if (total <= 0) return svg;

  const cx = 60, cy = 60, r = 56;

  // Single category: a full circle (an arc with equal endpoints draws nothing).
  if (slices.length === 1) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", r);
    c.setAttribute("fill", slices[0].color);
    svg.appendChild(c);
    return svg;
  }

  let a0 = -Math.PI / 2;
  for (const d of slices) {
    const frac = d.value / total;
    const a1 = a0 + frac * 2 * Math.PI;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = frac > 0.5 ? 1 : 0;
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d",
      `M ${cx} ${cy} L ${x0.toFixed(3)} ${y0.toFixed(3)} ` +
      `A ${r} ${r} 0 ${large} 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z`);
    path.setAttribute("fill", d.color);
    svg.appendChild(path);
    a0 = a1;
  }
  return svg;
}

// Stacked daily bars with the day total printed on top of each bar.
// data: [{day, segments:[{category,amount}], total}]
// colorFor: (categoryId) => "#rrggbb"
// fmtTotal: (number) => string
export function svgStackedBars(data, colorFor, fmtTotal) {
  const W = 320, H = 190, padX = 22, padTop = 26, padBottom = 24;
  const svg = svgEl(`0 0 ${W} ${H}`, "Daily spending by category");
  if (!data.length) return svg;

  const max = Math.max(...data.map(d => d.total), 1);
  const plotH = H - padTop - padBottom;
  const slot = (W - padX * 2) / data.length;
  const bw = Math.min(46, slot * 0.6);

  data.forEach((d, i) => {
    const cx = padX + slot * i + slot / 2;
    let yTop = H - padBottom;
    for (const seg of d.segments) {
      const h = (seg.amount / max) * plotH;
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", cx - bw / 2);
      rect.setAttribute("y", yTop - h);
      rect.setAttribute("width", bw);
      rect.setAttribute("height", Math.max(1, h));
      rect.setAttribute("fill", colorFor(seg.category));
      svg.appendChild(rect);
      yTop -= h;
    }
    const total = document.createElementNS(NS, "text");
    total.setAttribute("x", cx);
    total.setAttribute("y", yTop - 6);
    total.setAttribute("font-size", "9");
    total.setAttribute("font-weight", "600");
    total.setAttribute("text-anchor", "middle");
    total.setAttribute("fill", "currentColor");
    total.textContent = fmtTotal(d.total);
    svg.appendChild(total);

    const dayLbl = document.createElementNS(NS, "text");
    dayLbl.setAttribute("x", cx);
    dayLbl.setAttribute("y", H - 8);
    dayLbl.setAttribute("font-size", "8");
    dayLbl.setAttribute("text-anchor", "middle");
    dayLbl.setAttribute("fill", "currentColor");
    dayLbl.textContent = d.day.slice(5); // MM-DD
    svg.appendChild(dayLbl);
  });
  return svg;
}
```

- [ ] **Step 2: Syntax check**

Run: `node --check src/views/charts.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add src/views/charts.js
git commit -m "feat: svgPie + svgStackedBars (replace donut/bars)"
```

---

## Task 5: Redesign `budgetView.js` as "Overview"

**Files:**
- Modify (replace contents): `src/views/budgetView.js`

> Title becomes "Overview"; pie + per-category total legend; stacked daily bars with totals; Spent red, Remaining green (red if overspent); Entries list removed from the UI (data still in `vm.entries` / IndexedDB, still ordered). Add Entry sheet + budget settings retained; receipt picker retained on the add sheet.

- [ ] **Step 1: Replace `src/views/budgetView.js` entirely**

```js
import { BudgetViewModel } from "../viewmodels/BudgetViewModel.js";
import { BUDGET_CATEGORIES, categoryById } from "../domain/enums.js";
import { formatCurrency } from "../domain/money.js";
import { el, empty, openSheet, field, receiptPicker } from "./components.js";
import { svgPie, svgStackedBars } from "./charts.js";

export async function render(root, header, repo) {
  const vm = new BudgetViewModel(repo);
  await vm.load();
  const cur = vm.settings.currencyCode;
  const fmt = v => formatCurrency(v, cur);
  const colorFor = id => categoryById(id).color;

  header.setTitle("Overview");
  header.setActions([
    el("button", { class: "btn-text", "aria-label": "Budget settings",
      onclick: () => settingsSheet() }, "⚙︎"),
    el("button", { class: "btn-text", "aria-label": "Add entry",
      onclick: () => addSheet() }, "＋")
  ]);

  function rowLine(label, value, cls = "") {
    return el("div", { class: "row", style: "padding:6px 0" },
      [el("span", {}, label), el("strong", { class: cls }, value)]);
  }

  function paint() {
    root.replaceChildren();

    // Summary: Spent red, Remaining green (red if overspent).
    root.appendChild(el("div", { class: "card" }, [
      rowLine("Total Budget", fmt(vm.totalBudget)),
      rowLine("Spent", fmt(vm.totalSpent), "danger"),
      rowLine("Remaining", fmt(vm.remaining),
              vm.remaining < 0 ? "danger" : "good")
    ]));

    // By category: pie + per-category totals + overall total.
    const pieData = BUDGET_CATEGORIES
      .map(c => ({ label: c.label, value: vm.spentByCategory[c.id] || 0, color: c.color }))
      .filter(d => d.value > 0);
    const byCat = el("div", { class: "card" }, [el("h3", {}, "By Category")]);
    if (!pieData.length) {
      byCat.appendChild(empty("No spending yet"));
    } else {
      byCat.appendChild(svgPie(pieData));
      for (const c of BUDGET_CATEGORIES) {
        const amt = vm.spentByCategory[c.id] || 0;
        if (amt <= 0) continue;
        byCat.appendChild(el("div", { class: "row", style: "padding:4px 0" }, [
          el("span", {}, `${c.emoji} ${c.label}`),
          el("strong", {}, fmt(amt))
        ]));
      }
      byCat.appendChild(el("div", { class: "row",
        style: "padding:6px 0;border-top:1px solid var(--border)" }, [
        el("span", {}, "Total"), el("strong", {}, fmt(vm.totalSpent))
      ]));
    }
    root.appendChild(byCat);

    // Daily spend: stacked by category, total on top of each bar.
    root.appendChild(el("div", { class: "card" }, [
      el("h3", {}, "Daily Spend"),
      vm.dailyByCategory.length
        ? svgStackedBars(vm.dailyByCategory, colorFor, fmt)
        : empty("No daily data")
    ]));
    // Entries are intentionally not rendered (kept in vm.entries / IndexedDB).
  }

  function settingsSheet() {
    openSheet(close => {
      const input = el("input", { type: "number", inputmode: "decimal",
        value: String(vm.totalBudget) });
      return el("div", {}, [
        el("h3", {}, "Total Trip Budget"),
        field("Amount", input),
        el("button", { class: "btn-primary", onclick: async () => {
          await vm.setTotalBudget(input.value); close(); paint();
        } }, "Save")
      ]);
    });
  }

  function addSheet() {
    openSheet(close => {
      const title = el("input", { type: "text" });
      const amount = el("input", { type: "number", inputmode: "decimal" });
      const cat = el("select", {},
        BUDGET_CATEGORIES.map(c => el("option", { value: c.id }, `${c.emoji} ${c.label}`)));
      const date = el("input", { type: "date",
        value: new Date().toISOString().slice(0, 10) });
      const note = el("textarea", { rows: "2" });
      const receipt = receiptPicker();
      return el("div", {}, [
        el("h3", {}, "New Entry"),
        field("Title", title), field("Amount", amount),
        field("Category", cat), field("Date", date), field("Note", note),
        receipt.element,
        el("button", { class: "btn-primary", onclick: async () => {
          const ok = await vm.addEntry({
            title: title.value, amount: amount.value, category: cat.value,
            date: new Date(date.value + "T12:00").getTime(), note: note.value,
            receipt: receipt.get() });
          if (ok) { close(); paint(); } else alert("Enter a title and amount > 0.");
        } }, "Save")
      ]);
    });
  }

  paint();
}
```

- [ ] **Step 2: Syntax + import-resolution + full test suite**

Run:
```bash
cd "$PROJECT_ROOT"
node --check src/views/budgetView.js
node -e '
const fs=require("fs"),path=require("path");let bad=0;
function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);
 if(fs.statSync(p).isDirectory())walk(p);
 else if(f.endsWith(".js")){const s=fs.readFileSync(p,"utf8");
  for(const m of s.matchAll(/from\s+["\x27](\.[^"\x27]+)["\x27]/g)){
   const r=path.resolve(path.dirname(p),m[1]);
   if(!fs.existsSync(r)){console.log("MISSING",m[1],"in",p);bad++;}}}}}
walk("src");walk("test");console.log(bad?bad+" broken":"imports OK");'
node --test 2>&1 | grep -E "ℹ (tests|pass|fail) "
```
Expected: no syntax output; `imports OK`; tests all pass (count = previous total + 3 new from Tasks 2–3).

- [ ] **Step 3: Commit**

```bash
git add src/views/budgetView.js
git commit -m "feat: Overview screen — pie + category totals, stacked daily bars, red/green, hide entries"
```

---

## Task 6: Service Worker Cache Bump + Local Preview Verification

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Bump the cache version**

In `sw.js`, change the first line:

```js
const CACHE = "jp-trip-v3";
```

(The shell file list is unchanged — no new files — but the bump forces devices to re-fetch the modified `index.html`/views/charts on next load.)

- [ ] **Step 2: Commit**

```bash
git add sw.js
git commit -m "chore: bump service worker cache to v3 for Overview redesign"
```

- [ ] **Step 3: Local preview checklist (manual — run by the user)**

Serve and open in a desktop browser:
```bash
cd "$PROJECT_ROOT" && python3 -m http.server 8000 --bind 127.0.0.1
```
Then at `http://127.0.0.1:8000/` (hard-refresh to bypass the old service worker):
- Browser tab title reads **Go Go Osaka**.
- Tab bar order is **Overview · Food · Stays · Flights**; first section header says **Overview**.
- Add a few entries across Food & Drink / Shopping / Transportation on ≥2 different dates.
- "By Category" shows a **filled pie** + a legend listing each category's amount + a Total line.
- "Daily Spend" shows **stacked bars** colored by category with the **day total printed above** each bar and MM-DD beneath.
- **Spent** is red; **Remaining** is green (turns red if you overspend the budget).
- No "Entries" list appears. Reload the page — totals/charts are unchanged (data persisted in IndexedDB, just hidden).
- Category dropdown in "New Entry" shows the 3 categories each with its icon.

> The implementing agent cannot drive a browser; this checklist is the user's verification gate. Do not claim the UI works without it.

---

## Self-Review

**Spec coverage:**
- "Budget categories: Food & Drink, Shopping, Transportation" → Task 2 (TDD, exact ids/labels asserted).
- "By category = pie chart, easy to view expense + total under each category" → Task 4 `svgPie` + Task 5 legend rows per category + Total line.
- "Daily Spend = bar chart, by-category + total amount on top of each candle" → Task 3 `dailyByCategory` (TDD) + Task 4 `svgStackedBars` (stacked segments + total label on top) + Task 5 wiring.
- "Entries: hide but keep, in order" → Task 5 removes the Entries render only; `vm.entries` still loaded sorted from IndexedDB; no delete of data.
- "Rename Food→… : move Food next to Budget; Budget→Overview" → Task 1 tab reorder (Overview · Food · Stays · Flights) + Task 5 title "Overview".
- "Spent red, Remaining green" → Task 5 (`danger`/`good` classes; Remaining red if negative — sensible overspend handling, called out).
- "Cute icon per category" → Task 2 emoji per category; surfaced in legend + add-entry dropdown (Task 5).
- "Rename app Budget→Go Go Osaka (home screen + title only)" → Task 1 manifest + `<title>` + apple meta; no in-app banner (per the chosen option).

**Placeholder scan:** none — every step has complete file content or exact commands with expected output.

**Type/contract consistency:** `dailyByCategory` shape `{day, segments:[{category,amount}], total}` is produced in Task 3 and consumed identically by `svgStackedBars(data, colorFor, fmtTotal)` in Task 4 and the Task 5 call `svgStackedBars(vm.dailyByCategory, colorFor, fmt)`. `categoryById` always returns an object with `{id,label,emoji,color}` (Task 2), relied on by `colorFor` and the legend. `svgPie(data)` expects `[{label,value,color}]` — matched by `pieData` in Task 5. Removed `svgDonut`/`svgBars` are no longer referenced (Task 5 imports only `svgPie`, `svgStackedBars`); `dayLabel`/`lightbox` imports dropped from budgetView since the entries list (their only use there) is gone — `foodView.js` keeps its own `lightbox` import and is untouched.

**Known limitation (accepted):** hiding the Entries list also hides budget receipt thumbnails on Overview; receipts remain stored and Food receipts remain visible. Documented in Context and acceptable per the explicit "hide entries" instruction.
```
