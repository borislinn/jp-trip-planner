# JP Trip Planner — Mobile Web App (PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline-first, installable mobile web app (PWA) trip planner — budget tracking with charts, stays & transport logging, flights with correct time-zone handling, and a voice-enabled food journal with a good/bad summary — that runs in Safari on an iPhone with no App Store, no Xcode, no Apple account.

**Architecture:** Zero-dependency static site (plain HTML/CSS/ES modules, no build step). Strict MVVM: **Model** = IndexedDB stores behind a `Repository` interface (with an in-memory implementation for tests); **ViewModel** = pure async classes holding a repo, exposing data + derived analytics + mutations (no DOM/browser globals so they run under Node's test runner); **View** = DOM-render modules that read a ViewModel and wire events. Hash router + bottom tab bar (4 tabs) with per-section top header bars. A service worker caches the app shell for full offline use. Charts are hand-rolled SVG. Voice uses the Web Speech API behind a capability-detected wrapper with a typed-text fallback.

**Tech Stack:** HTML5, CSS (custom properties, `prefers-color-scheme`, `env(safe-area-inset-*)`), vanilla ES modules, IndexedDB, Service Worker + Web App Manifest, Web Speech API (`SpeechRecognition`), `Intl.DateTimeFormat` for time zones, SVG for charts. Tests: Node built-in test runner (`node --test`) — zero npm dependencies. Deploy: free static host.

---

## ⚠️ Read first — environment & platform realities

1. **Node is only needed for running tests.** The app itself has no build step and no runtime dependencies — it is plain files. Verify Node exists before the TDD tasks: `node --version` (expect v18+; `node --test` is stable from v18).
2. **iOS voice caveat (unavoidable, by platform):** iOS Safari's `SpeechRecognition` support is limited and historically unreliable — when present it typically needs a network connection (audio is processed by Apple's servers) and may be absent entirely depending on iOS version. The food journal therefore *always* has a working typed-notes field; the mic button is feature-detected and only augments it. This is a platform limitation, not a bug to fix.
3. **HTTPS is mandatory** for PWA install, service worker, and microphone. Local `file://` and plain-`http://` LAN access will not get a secure context. Delivery is via a free static host (Task 12), which provides real HTTPS. `localhost` is also a secure context, so local dev works without a cert.
4. **No automated browser testing in this environment.** Automated tests cover ViewModel + time-zone logic via Node. UI, PWA install, offline behavior, and voice require manual verification on the device (Task 13 checklist) — the implementing agent must not claim UI/voice "works" without that.

---

## Key Design Decisions (read before coding)

**MVVM with async data:** ViewModels take a `Repository` in their constructor, expose `async load()` that fills an in-memory cache array, expose synchronous derived getters (totals, groupings, partitions) computed from that cache, and `async` mutation methods that write through the repo then `await this.load()`. Views call `load()` on mount and after mutations re-render. ViewModels import **no** browser globals so they are unit-testable under `node --test` with an `InMemoryRepository`.

**Money:** JavaScript has no decimal type. Amounts are stored as numbers; all summation goes through `sumMoney()` which sums in integer minor units (×100, round, ÷100) to avoid float drift. Default currency JPY (no minor units) is unaffected; this keeps other currencies correct enough for a personal trip tracker. Documented tradeoff — not bank-grade, intentionally.

**Time zones (tricky):** For each flight endpoint store an absolute instant as epoch milliseconds plus an IANA time-zone id string (e.g. `"Asia/Tokyo"`). Input is a wall-clock `datetime-local` value + a zone `<select>`; `zonedWallClockToEpoch()` converts it using `Intl.DateTimeFormat().formatToParts` to derive the zone's offset at that instant (with a one-pass DST-boundary refinement). Display uses `Intl.DateTimeFormat` with the stored `timeZone`. Duration = `arrivalEpoch - departureEpoch` — correct across zones because both are absolute. Fully Node-testable, no UI.

**No frameworks / no deps:** Honors the original "no third-party dependencies" requirement. Charts are small hand-written SVG generators. Routing is hash-based. DOM is built with explicit `createElement`/text nodes only — **never `innerHTML`** — so there is no XSS surface from user-entered trip data. This also makes hosting trivial (drag a folder to a static host).

---

## File Structure

```
/ (repository root — the deployable artifact is this whole folder)
  index.html                     app shell: tab bar + view container
  styles.css                     CSS variables, dark mode, safe-area insets
  app.webmanifest                PWA manifest (name, icons, display standalone)
  sw.js                          service worker — cache-first app shell
  icons/
    icon-192.png  icon-512.png   PWA + apple-touch icons (generated in Task 1)
  src/
    main.js                      bootstrap: SW registration, router, tab bar
    data/
      db.js                      IndexedDB open + Promise helpers
      repository.js              Repository, IndexedDBRepository, InMemoryRepository
    domain/
      enums.js                   budget categories, transport modes, meal types
      money.js                   sumMoney, formatCurrency
      datetime.js                zonedWallClockToEpoch, formatInstant, dayKey
    viewmodels/
      BudgetViewModel.js
      StaysViewModel.js
      FlightsViewModel.js
      FoodJournalViewModel.js
    views/
      components.js              el() helper, sheet/modal, StarRating, header bar
      charts.js                  svgDonut(), svgBars()
      budgetView.js
      staysView.js
      flightsView.js
      foodView.js
    services/
      speech.js                  SpeechInput wrapper + isSpeechSupported()
  test/
    helpers.js                   makeRepo() -> InMemoryRepository
    budgetViewModel.test.js
    staysViewModel.test.js
    flightTimeZone.test.js
    foodJournalViewModel.test.js
  docs/superpowers/plans/2026-05-17-jp-trip-planner.md   (this file)
```

---

## Task 1: Project Scaffold, PWA Shell & Tooling Check

**Files:**
- Create: `index.html`, `styles.css`, `app.webmanifest`, `sw.js`
- Create: `icons/icon-192.png`, `icons/icon-512.png`
- Create: `.gitignore`

- [ ] **Step 1: Verify tooling**

Run: `node --version && python3 --version`
Expected: Node v18+ (for tests) and Python 3 (for the local dev server). If Node < 18, stop and ask the user to upgrade — `node --test` is required for the TDD tasks.

- [ ] **Step 2: Create `.gitignore`**

```
.DS_Store
node_modules/
*.log
```

- [ ] **Step 3: Generate placeholder PWA icons**

Run (creates solid-color PNGs so the manifest is valid; user can swap art later):

```bash
cd "$PROJECT_ROOT"
mkdir -p icons
python3 - <<'PY'
import struct, zlib
def png(path, size, rgb):
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t+d) & 0xffffffff)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    row = b'\x00' + bytes(rgb) * size
    raw = row * size
    idat = zlib.compress(raw, 9)
    open(path, "wb").write(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b''))
png("icons/icon-192.png", 192, (11, 92, 168))
png("icons/icon-512.png", 512, (11, 92, 168))
print("icons written")
PY
```

Expected: `icons written`, two PNG files present.

- [ ] **Step 4: Create `app.webmanifest`**

```json
{
  "name": "JP Trip Planner",
  "short_name": "Trip Planner",
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

- [ ] **Step 5: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport"
        content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0b5ca8" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="Trip Planner" />
  <link rel="apple-touch-icon" href="icons/icon-192.png" />
  <link rel="manifest" href="app.webmanifest" />
  <link rel="stylesheet" href="styles.css" />
  <title>JP Trip Planner</title>
</head>
<body>
  <header id="appHeader" class="app-header">
    <h1 id="headerTitle">Budget</h1>
    <div id="headerActions" class="header-actions"></div>
  </header>

  <main id="viewRoot" class="view-root" aria-live="polite"></main>

  <nav id="tabBar" class="tab-bar" role="tablist" aria-label="Sections">
    <button class="tab" data-route="budget"  role="tab">&#128180;<span>Budget</span></button>
    <button class="tab" data-route="stays"   role="tab">&#127976;<span>Stays</span></button>
    <button class="tab" data-route="flights" role="tab">&#9992;<span>Flights</span></button>
    <button class="tab" data-route="food"    role="tab">&#127869;<span>Food</span></button>
  </nav>

  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 6: Create `styles.css`**

```css
:root {
  --bg: #f2f2f7; --surface: #ffffff; --text: #1c1c1e;
  --muted: #6b6b70; --accent: #0b5ca8; --danger: #d23b3b;
  --good: #2e7d32; --neutral: #8a8a8e; --border: #d8d8dc;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #000000; --surface: #1c1c1e; --text: #f2f2f7;
    --muted: #98989f; --accent: #4a9fe6; --danger: #ff6b6b;
    --good: #5cd07a; --neutral: #98989f; --border: #38383a;
  }
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; height: 100%; }
body {
  font: -apple-system-body, system-ui, sans-serif;
  background: var(--bg); color: var(--text);
  display: flex; flex-direction: column; min-height: 100vh;
}
.app-header {
  position: sticky; top: 0; z-index: 10;
  padding: calc(env(safe-area-inset-top) + 12px) 16px 12px;
  background: var(--surface); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.app-header h1 { font-size: 1.4rem; margin: 0; }
.header-actions button {
  font-size: 1.4rem; background: none; border: none;
  color: var(--accent); padding: 4px 8px;
}
.view-root {
  flex: 1; overflow-y: auto;
  padding: 16px 16px calc(env(safe-area-inset-bottom) + 84px);
}
.tab-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; background: var(--surface);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom);
}
.tab {
  flex: 1; background: none; border: none; color: var(--muted);
  padding: 8px 0; font-size: 1.3rem; display: flex;
  flex-direction: column; align-items: center; gap: 2px;
}
.tab span { font-size: .7rem; }
.tab[aria-selected="true"] { color: var(--accent); }
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 14px; margin-bottom: 12px;
}
.row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.muted { color: var(--muted); font-size: .85rem; }
input, select, textarea, button { font: inherit; color: var(--text); }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.field label { font-size: .8rem; color: var(--muted); }
.field input, .field select, .field textarea {
  background: var(--bg); border: 1px solid var(--border);
  border-radius: 8px; padding: 10px;
}
.btn-primary {
  background: var(--accent); color: #fff; border: none;
  border-radius: 10px; padding: 12px; width: 100%; font-weight: 600;
}
.btn-primary:disabled { opacity: .5; }
.btn-text { background: none; border: none; color: var(--accent); padding: 8px; }
.sheet-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.4);
  display: flex; align-items: flex-end; z-index: 50;
}
.sheet {
  background: var(--surface); width: 100%;
  border-radius: 16px 16px 0 0;
  padding: 16px 16px calc(env(safe-area-inset-bottom) + 16px);
  max-height: 90vh; overflow-y: auto;
}
.stars { font-size: 1.6rem; letter-spacing: 4px; cursor: pointer; }
.empty { text-align: center; color: var(--muted); padding: 40px 0; }
.pill {
  font-size: .7rem; background: var(--bg); border: 1px solid var(--border);
  border-radius: 999px; padding: 2px 8px;
}
.danger { color: var(--danger); }
.good { color: var(--good); }
svg { display: block; max-width: 100%; }
```

- [ ] **Step 7: Create `sw.js`**

```js
const CACHE = "jp-trip-v1";
const SHELL = [
  "./", "./index.html", "./styles.css", "./app.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png",
  "./src/main.js",
  "./src/data/db.js", "./src/data/repository.js",
  "./src/domain/enums.js", "./src/domain/money.js", "./src/domain/datetime.js",
  "./src/viewmodels/BudgetViewModel.js", "./src/viewmodels/StaysViewModel.js",
  "./src/viewmodels/FlightsViewModel.js", "./src/viewmodels/FoodJournalViewModel.js",
  "./src/views/components.js", "./src/views/charts.js",
  "./src/views/budgetView.js", "./src/views/staysView.js",
  "./src/views/flightsView.js", "./src/views/foodView.js",
  "./src/services/speech.js"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(ks =>
      Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
```

- [ ] **Step 8: Commit**

```bash
cd "$PROJECT_ROOT"
git init
git add .gitignore index.html styles.css app.webmanifest sw.js icons docs
git commit -m "chore: scaffold PWA shell, manifest, service worker"
```

---

## Task 2: Domain Helpers — Enums, Money, DateTime

**Files:**
- Create: `src/domain/enums.js`
- Create: `src/domain/money.js`
- Create: `src/domain/datetime.js`
- Test: `test/flightTimeZone.test.js` (datetime portion only here; full flight VM test in Task 6)
- Create: `test/helpers.js`

- [ ] **Step 1: Create `src/domain/enums.js`**

```js
export const BUDGET_CATEGORIES = [
  { id: "food",          label: "Food",          emoji: "🍜", color: "#e8821e" },
  { id: "transport",     label: "Transport",     emoji: "🚆", color: "#1f6fd6" },
  { id: "accommodation", label: "Accommodation", emoji: "🏨", color: "#7a4fd0" },
  { id: "activities",    label: "Activities",    emoji: "🥾", color: "#2e9e4f" },
  { id: "shopping",      label: "Shopping",      emoji: "🛍️", color: "#d64f93" },
  { id: "other",         label: "Other",         emoji: "•",  color: "#8a8a8e" }
];
export const TRANSPORT_MODES = [
  { id: "train",     label: "Train" },
  { id: "taxi",      label: "Taxi" },
  { id: "rentalCar", label: "Rental Car" },
  { id: "bus",       label: "Bus" },
  { id: "walk",      label: "Walk" },
  { id: "ferry",     label: "Ferry" },
  { id: "flight",    label: "Flight" },
  { id: "other",     label: "Other" }
];
export const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch",     label: "Lunch" },
  { id: "dinner",    label: "Dinner" },
  { id: "snack",     label: "Snack" }
];
export const categoryById = id =>
  BUDGET_CATEGORIES.find(c => c.id === id) || BUDGET_CATEGORIES[5];
```

- [ ] **Step 2: Create `src/domain/money.js`**

```js
// Sum in integer minor units to avoid float drift, then back to a number.
export function sumMoney(values) {
  const cents = values.reduce((acc, v) => acc + Math.round((Number(v) || 0) * 100), 0);
  return cents / 100;
}
export function formatCurrency(amount, code = "JPY") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code })
      .format(Number(amount) || 0);
  } catch {
    return `${code} ${(Number(amount) || 0).toFixed(2)}`;
  }
}
```

- [ ] **Step 3: Create `src/domain/datetime.js`**

```js
// Offset (ms) of `tz` relative to UTC at the given absolute instant.
function tzOffsetMs(tz, epochMs) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  const p = Object.fromEntries(
    dtf.formatToParts(new Date(epochMs))
       .filter(x => x.type !== "literal")
       .map(x => [x.type, x.value])
  );
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - epochMs;
}

// Interpret a wall-clock "YYYY-MM-DDTHH:mm" string AS LOCAL TIME IN `tz`,
// return the absolute instant (epoch ms). DST-safe via one refinement pass.
export function zonedWallClockToEpoch(localStr, tz) {
  const [d, t] = localStr.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const guessUTC = Date.UTC(y, mo - 1, da, h, mi);
  let epoch = guessUTC - tzOffsetMs(tz, guessUTC);
  const refined = tzOffsetMs(tz, epoch);
  epoch = guessUTC - refined;
  return epoch;
}

export function formatInstant(epochMs, tz) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz, dateStyle: "medium", timeStyle: "short", timeZoneName: "short"
  }).format(new Date(epochMs));
}

// Local-day bucket key (YYYY-MM-DD) for grouping spend/meals by day.
export function dayKey(epochMs) {
  const dt = new Date(epochMs);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
export function dayLabel(epochMs) {
  return new Intl.DateTimeFormat(undefined,
    { weekday: "short", month: "short", day: "numeric" }).format(new Date(epochMs));
}
```

- [ ] **Step 4: Create `test/helpers.js`**

```js
import { InMemoryRepository } from "../src/data/repository.js";
export function makeRepo() { return new InMemoryRepository(); }
```

> `repository.js` is created in Task 3; `helpers.js` imports it but is only *run* from Task 3 onward. (Subagent note: implement Task 3 before executing any `node --test` that imports `helpers.js`. Task 2's own test in Step 5 imports only `datetime.js`, so it is safe to run now.)

- [ ] **Step 5: Write the datetime test**

`test/flightTimeZone.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { zonedWallClockToEpoch, formatInstant } from "../src/domain/datetime.js";

test("wall-clock in a zone converts to the correct absolute instant", () => {
  // 2026-05-01 11:00 in Los Angeles (PDT, UTC-7) == 18:00:00Z.
  const epoch = zonedWallClockToEpoch("2026-05-01T11:00", "America/Los_Angeles");
  assert.equal(new Date(epoch).toISOString(), "2026-05-01T18:00:00.000Z");
});

test("same instant renders differently per display zone", () => {
  const epoch = zonedWallClockToEpoch("2026-05-01T11:00", "America/Los_Angeles");
  const tokyo = formatInstant(epoch, "Asia/Tokyo"); // 2026-05-02 03:00 JST
  assert.match(tokyo, /3:00|03:00/);
  assert.match(tokyo, /GMT\+9|JST/);
});

test("duration across zones equals difference of absolute instants", () => {
  const dep = zonedWallClockToEpoch("2026-05-01T11:00", "America/Los_Angeles");
  const arr = zonedWallClockToEpoch("2026-05-02T14:30", "Asia/Tokyo");
  assert.equal((arr - dep) / 3600000, 11.5); // 11h30m
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test test/flightTimeZone.test.js`
Expected: PASS (3 tests). (datetime.js was written in Step 3; this proves the tricky tz math before any VM depends on it.)

- [ ] **Step 7: Commit**

```bash
git add src/domain test/helpers.js test/flightTimeZone.test.js
git commit -m "feat: domain enums, money, timezone-correct datetime helpers (TDD)"
```

---

## Task 3: Data Layer — IndexedDB + Repository (with in-memory test impl)

**Files:**
- Create: `src/data/db.js`
- Create: `src/data/repository.js`

- [ ] **Step 1: Create `src/data/db.js`**

```js
const DB_NAME = "jp-trip-planner";
const DB_VERSION = 1;
export const STORES = ["settings", "budgetEntries", "stays", "flights", "meals"];

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function store(db, name, mode) {
  return db.transaction(name, mode).objectStore(name);
}
export function idbGetAll(db, name) {
  return new Promise((res, rej) => {
    const r = store(db, name, "readonly").getAll();
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export function idbGet(db, name, id) {
  return new Promise((res, rej) => {
    const r = store(db, name, "readonly").get(id);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export function idbPut(db, name, value) {
  return new Promise((res, rej) => {
    const r = store(db, name, "readwrite").put(value);
    r.onsuccess = () => res(value); r.onerror = () => rej(r.error);
  });
}
export function idbDelete(db, name, id) {
  return new Promise((res, rej) => {
    const r = store(db, name, "readwrite").delete(id);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  });
}
```

- [ ] **Step 2: Create `src/data/repository.js`**

```js
const newId = () =>
  (globalThis.crypto?.randomUUID?.() ??
   "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));

// Browser implementation backed by IndexedDB (db.js is lazily imported so
// this module stays importable under Node for tests).
export class IndexedDBRepository {
  constructor() { this._dbPromise = null; this._idb = null; }
  async _db() {
    if (!this._idb) {
      const mod = await import("./db.js");
      this._idb = mod;
      this._dbPromise = this._dbPromise || mod.openDB();
    }
    return { mod: this._idb, db: await this._dbPromise };
  }
  async getAll(name) { const { mod, db } = await this._db(); return mod.idbGetAll(db, name); }
  async get(name, id) { const { mod, db } = await this._db(); return mod.idbGet(db, name, id); }
  async put(name, obj) {
    const { mod, db } = await this._db();
    const rec = obj.id ? obj : { ...obj, id: newId() };
    return mod.idbPut(db, name, rec);
  }
  async remove(name, id) { const { mod, db } = await this._db(); return mod.idbDelete(db, name, id); }
}

// Pure in-memory implementation for unit tests (no IndexedDB needed).
export class InMemoryRepository {
  constructor() { this._stores = new Map(); }
  _s(name) {
    if (!this._stores.has(name)) this._stores.set(name, new Map());
    return this._stores.get(name);
  }
  async getAll(name) { return [...this._s(name).values()].map(v => ({ ...v })); }
  async get(name, id) { const v = this._s(name).get(id); return v ? { ...v } : undefined; }
  async put(name, obj) {
    const rec = obj.id ? { ...obj } : { ...obj, id: newId() };
    this._s(name).set(rec.id, rec);
    return { ...rec };
  }
  async remove(name, id) { this._s(name).delete(id); }
}
```

- [ ] **Step 3: Run existing tests to confirm wiring**

Run: `node --test test/flightTimeZone.test.js`
Expected: PASS (3 tests) — confirms `helpers.js` now resolves `repository.js` import without error.

- [ ] **Step 4: Commit**

```bash
git add src/data
git commit -m "feat: IndexedDB repository with in-memory test implementation"
```

---

## Task 4: Budget ViewModel (TDD)

**Files:**
- Test: `test/budgetViewModel.test.js`
- Create: `src/viewmodels/BudgetViewModel.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRepo } from "./helpers.js";
import { BudgetViewModel } from "../src/viewmodels/BudgetViewModel.js";

test("totals, remaining, and per-category breakdown", async () => {
  const vm = new BudgetViewModel(makeRepo());
  await vm.load();
  await vm.setTotalBudget(1000);
  await vm.addEntry({ title: "Ramen", amount: 12, category: "food", date: Date.now() });
  await vm.addEntry({ title: "Metro", amount: 8, category: "transport", date: Date.now() });

  assert.equal(vm.totalSpent, 20);
  assert.equal(vm.remaining, 980);
  assert.equal(vm.spentByCategory.food, 12);
  assert.equal(vm.spentByCategory.transport, 8);
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
  await vm.addEntry({ title: "a", amount: 0.1, category: "food", date: Date.now() });
  await vm.addEntry({ title: "b", amount: 0.2, category: "food", date: Date.now() });
  assert.equal(vm.totalSpent, 0.3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/budgetViewModel.test.js`
Expected: FAIL — cannot find `../src/viewmodels/BudgetViewModel.js`.

- [ ] **Step 3: Implement `src/viewmodels/BudgetViewModel.js`**

```js
import { sumMoney } from "../domain/money.js";
import { dayKey } from "../domain/datetime.js";

const SETTINGS_ID = "singleton";

export class BudgetViewModel {
  constructor(repo) {
    this.repo = repo;
    this.entries = [];
    this.settings = { id: SETTINGS_ID, totalBudget: 0, currencyCode: "JPY" };
  }

  async load() {
    const s = await this.repo.get("settings", SETTINGS_ID);
    if (s) this.settings = s;
    else await this.repo.put("settings", this.settings);
    const rows = await this.repo.getAll("budgetEntries");
    this.entries = rows.sort((a, b) => b.date - a.date);
  }

  get totalSpent() { return sumMoney(this.entries.map(e => e.amount)); }
  get totalBudget() { return Number(this.settings.totalBudget) || 0; }
  get remaining() { return sumMoney([this.totalBudget, -this.totalSpent]); }

  get spentByCategory() {
    const out = {};
    for (const e of this.entries) {
      out[e.category] = sumMoney([out[e.category] || 0, e.amount]);
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

  async setTotalBudget(value) {
    this.settings.totalBudget = Number(value) || 0;
    await this.repo.put("settings", this.settings);
  }

  async addEntry({ title, amount, category, date, note }) {
    if (!title?.trim() || !(Number(amount) > 0)) return false;
    await this.repo.put("budgetEntries", {
      title: title.trim(), amount: Number(amount),
      category: category || "other", date: date || Date.now(),
      note: note?.trim() || null
    });
    await this.load();
    return true;
  }

  async deleteEntry(id) {
    await this.repo.remove("budgetEntries", id);
    await this.load();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/budgetViewModel.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/viewmodels/BudgetViewModel.js test/budgetViewModel.test.js
git commit -m "feat: budget viewmodel with category + daily analytics (TDD)"
```

---

## Task 5: Stays ViewModel (TDD)

**Files:**
- Test: `test/staysViewModel.test.js`
- Create: `src/viewmodels/StaysViewModel.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRepo } from "./helpers.js";
import { StaysViewModel } from "../src/viewmodels/StaysViewModel.js";

const day = (y, m, d) => new Date(y, m - 1, d).getTime();

test("stays sorted by check-in; nights + onward transport computed", async () => {
  const vm = new StaysViewModel(makeRepo());
  await vm.load();
  await vm.addStay({ hotelName: "B", checkIn: day(2026,5,5), checkOut: day(2026,5,7),
                     onwardTransport: "train", onwardNote: "Shinkansen 8:00" });
  await vm.addStay({ hotelName: "A", checkIn: day(2026,5,1), checkOut: day(2026,5,5),
                     bookingReference: "ABC123", onwardTransport: "taxi" });

  assert.deepEqual(vm.stays.map(s => s.hotelName), ["A", "B"]);
  assert.equal(vm.nights(vm.stays[0]), 4);
  assert.equal(vm.stays[0].bookingReference, "ABC123");
  assert.equal(vm.stays[0].onwardTransport, "taxi");
});

test("rejects checkout before checkin", async () => {
  const vm = new StaysViewModel(makeRepo());
  await vm.load();
  const ok = await vm.addStay({ hotelName: "Bad",
    checkIn: day(2026,5,10), checkOut: day(2026,5,2) });
  assert.equal(ok, false);
  assert.equal(vm.stays.length, 0);
  assert.ok(vm.lastError);
});

test("rejects empty hotel name", async () => {
  const vm = new StaysViewModel(makeRepo());
  await vm.load();
  const ok = await vm.addStay({ hotelName: "  ",
    checkIn: day(2026,5,1), checkOut: day(2026,5,3) });
  assert.equal(ok, false);
});

test("delete removes a stay", async () => {
  const vm = new StaysViewModel(makeRepo());
  await vm.load();
  await vm.addStay({ hotelName: "X", checkIn: day(2026,5,1), checkOut: day(2026,5,3) });
  await vm.deleteStay(vm.stays[0].id);
  assert.equal(vm.stays.length, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/staysViewModel.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/viewmodels/StaysViewModel.js`**

```js
export class StaysViewModel {
  constructor(repo) { this.repo = repo; this.stays = []; this.lastError = null; }

  async load() {
    const rows = await this.repo.getAll("stays");
    this.stays = rows.sort((a, b) => a.checkIn - b.checkIn);
  }

  nights(stay) {
    const ms = stay.checkOut - stay.checkIn;
    return Math.max(0, Math.round(ms / 86400000));
  }

  async addStay(d) {
    if (!d.hotelName || !d.hotelName.trim()) {
      this.lastError = "Hotel name is required."; return false;
    }
    if (!(d.checkOut >= d.checkIn)) {
      this.lastError = "Check-out must be on or after check-in."; return false;
    }
    this.lastError = null;
    await this.repo.put("stays", {
      hotelName: d.hotelName.trim(),
      checkIn: d.checkIn, checkOut: d.checkOut,
      bookingReference: d.bookingReference?.trim() || null,
      address: d.address?.trim() || null,
      note: d.note?.trim() || null,
      onwardTransport: d.onwardTransport || null,
      onwardNote: d.onwardNote?.trim() || null
    });
    await this.load();
    return true;
  }

  async deleteStay(id) {
    await this.repo.remove("stays", id);
    await this.load();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/staysViewModel.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/viewmodels/StaysViewModel.js test/staysViewModel.test.js
git commit -m "feat: stays viewmodel with validation + nights (TDD)"
```

---

## Task 6: Flights ViewModel (TDD)

**Files:**
- Test: append to `test/flightTimeZone.test.js`
- Create: `src/viewmodels/FlightsViewModel.js`

- [ ] **Step 1: Append the failing test to `test/flightTimeZone.test.js`**

```js
import { makeRepo } from "./helpers.js";
import { FlightsViewModel } from "../src/viewmodels/FlightsViewModel.js";

test("flight stores dual zones; duration correct across zones", async () => {
  const vm = new FlightsViewModel(makeRepo());
  await vm.load();
  await vm.addFlight({
    flightNumber: "NH7", airline: "ANA",
    from: "SFO", to: "HND",
    departureLocal: "2026-05-01T11:00", departureTZ: "America/Los_Angeles",
    arrivalLocal: "2026-05-02T14:30",  arrivalTZ: "Asia/Tokyo",
    passengers: 2, departureTerminal: "I", departureGate: "G1", arrivalTerminal: "3"
  });
  const f = vm.flights[0];
  assert.equal(f.passengers, 2);
  assert.equal(vm.durationText(f), "11h 30m");
});

test("flights sorted by absolute departure instant", async () => {
  const vm = new FlightsViewModel(makeRepo());
  await vm.load();
  await vm.addFlight({ flightNumber: "L2", from: "A", to: "B",
    departureLocal: "2026-05-10T09:00", departureTZ: "Asia/Tokyo",
    arrivalLocal: "2026-05-10T10:00",  arrivalTZ: "Asia/Tokyo" });
  await vm.addFlight({ flightNumber: "E1", from: "A", to: "B",
    departureLocal: "2026-05-01T09:00", departureTZ: "Asia/Tokyo",
    arrivalLocal: "2026-05-01T10:00",  arrivalTZ: "Asia/Tokyo" });
  assert.deepEqual(vm.flights.map(f => f.flightNumber), ["E1", "L2"]);
});

test("flight rejects missing number or airports", async () => {
  const vm = new FlightsViewModel(makeRepo());
  await vm.load();
  const ok = await vm.addFlight({ flightNumber: "", from: "", to: "",
    departureLocal: "2026-05-01T09:00", departureTZ: "Asia/Tokyo",
    arrivalLocal: "2026-05-01T10:00", arrivalTZ: "Asia/Tokyo" });
  assert.equal(ok, false);
  assert.equal(vm.flights.length, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/flightTimeZone.test.js`
Expected: FAIL — cannot find `../src/viewmodels/FlightsViewModel.js` (the original 3 datetime tests still pass).

- [ ] **Step 3: Implement `src/viewmodels/FlightsViewModel.js`**

```js
import { zonedWallClockToEpoch } from "../domain/datetime.js";

export class FlightsViewModel {
  constructor(repo) { this.repo = repo; this.flights = []; }

  async load() {
    const rows = await this.repo.getAll("flights");
    this.flights = rows.sort((a, b) => a.departureEpoch - b.departureEpoch);
  }

  async addFlight(d) {
    if (!d.flightNumber?.trim() || !d.from?.trim() || !d.to?.trim()) return false;
    await this.repo.put("flights", {
      flightNumber: d.flightNumber.trim(),
      airline: d.airline?.trim() || null,
      from: d.from.trim().toUpperCase(),
      to: d.to.trim().toUpperCase(),
      departureEpoch: zonedWallClockToEpoch(d.departureLocal, d.departureTZ),
      departureTZ: d.departureTZ,
      arrivalEpoch: zonedWallClockToEpoch(d.arrivalLocal, d.arrivalTZ),
      arrivalTZ: d.arrivalTZ,
      passengers: Math.max(1, Number(d.passengers) || 1),
      departureTerminal: d.departureTerminal?.trim() || null,
      departureGate: d.departureGate?.trim() || null,
      arrivalTerminal: d.arrivalTerminal?.trim() || null,
      arrivalGate: d.arrivalGate?.trim() || null,
      note: d.note?.trim() || null
    });
    await this.load();
    return true;
  }

  async deleteFlight(id) {
    await this.repo.remove("flights", id);
    await this.load();
  }

  durationText(f) {
    const mins = Math.round((f.arrivalEpoch - f.departureEpoch) / 60000);
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/flightTimeZone.test.js`
Expected: PASS (6 tests total — 3 datetime + 3 flight).

- [ ] **Step 5: Commit**

```bash
git add src/viewmodels/FlightsViewModel.js test/flightTimeZone.test.js
git commit -m "feat: flights viewmodel with timezone-correct duration (TDD)"
```

---

## Task 7: Food Journal ViewModel (TDD)

**Files:**
- Test: `test/foodJournalViewModel.test.js`
- Create: `src/viewmodels/FoodJournalViewModel.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRepo } from "./helpers.js";
import { FoodJournalViewModel } from "../src/viewmodels/FoodJournalViewModel.js";

test("summary partitions good (4-5), bad (1-2), neutral (3)", async () => {
  const vm = new FoodJournalViewModel(makeRepo());
  await vm.load();
  await vm.addMeal({ restaurant: "Great", mealType: "dinner", rating: 5, comment: "Amazing" });
  await vm.addMeal({ restaurant: "Fine",  mealType: "lunch",  rating: 3, comment: "Okay" });
  await vm.addMeal({ restaurant: "Bad",   mealType: "breakfast", rating: 1, comment: "Cold" });
  await vm.addMeal({ restaurant: "Good2", rating: 4, comment: "Nice" });

  assert.deepEqual(new Set(vm.goodMeals.map(m => m.restaurant)), new Set(["Great", "Good2"]));
  assert.deepEqual(vm.badMeals.map(m => m.restaurant), ["Bad"]);
  assert.deepEqual(vm.neutralMeals.map(m => m.restaurant), ["Fine"]);
});

test("rating clamped to 1..5", async () => {
  const vm = new FoodJournalViewModel(makeRepo());
  await vm.load();
  await vm.addMeal({ restaurant: "X", rating: 9, comment: "" });
  await vm.addMeal({ restaurant: "Y", rating: 0, comment: "" });
  const ratings = vm.meals.map(m => m.rating).sort();
  assert.deepEqual(ratings, [1, 5]);
});

test("rejects empty restaurant name", async () => {
  const vm = new FoodJournalViewModel(makeRepo());
  await vm.load();
  const ok = await vm.addMeal({ restaurant: "  ", rating: 3, comment: "x" });
  assert.equal(ok, false);
});

test("delete removes a meal", async () => {
  const vm = new FoodJournalViewModel(makeRepo());
  await vm.load();
  await vm.addMeal({ restaurant: "Z", rating: 3, comment: "" });
  await vm.deleteMeal(vm.meals[0].id);
  assert.equal(vm.meals.length, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/foodJournalViewModel.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/viewmodels/FoodJournalViewModel.js`**

```js
export class FoodJournalViewModel {
  constructor(repo) { this.repo = repo; this.meals = []; }

  async load() {
    const rows = await this.repo.getAll("meals");
    this.meals = rows.sort((a, b) => b.date - a.date);
  }

  get goodMeals()    { return this.meals.filter(m => m.rating >= 4); }
  get badMeals()     { return this.meals.filter(m => m.rating <= 2); }
  get neutralMeals() { return this.meals.filter(m => m.rating === 3); }

  async addMeal(d) {
    if (!d.restaurant || !d.restaurant.trim()) return false;
    const rating = Math.min(5, Math.max(1, Math.round(Number(d.rating) || 3)));
    await this.repo.put("meals", {
      restaurant: d.restaurant.trim(),
      mealType: d.mealType || null,
      rating,
      comment: (d.comment || "").trim(),
      date: d.date || Date.now()
    });
    await this.load();
    return true;
  }

  async deleteMeal(id) {
    await this.repo.remove("meals", id);
    await this.load();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/foodJournalViewModel.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite**

Run: `node --test test/`
Expected: PASS — all four ViewModel suites + datetime (17 tests total).

- [ ] **Step 6: Commit**

```bash
git add src/viewmodels/FoodJournalViewModel.js test/foodJournalViewModel.test.js
git commit -m "feat: food journal viewmodel with good/bad summary (TDD)"
```

---

## Task 8: Shared View Components + SVG Charts

**Files:**
- Create: `src/views/components.js`
- Create: `src/views/charts.js`

> All DOM is built with `createElement` + text nodes. The `el()` helper deliberately has **no `innerHTML` path** — user-entered trip data is never interpreted as HTML, so there is no XSS surface.

- [ ] **Step 1: Create `src/views/components.js`**

```js
export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function")
      n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return n;
}

export function empty(message) {
  return el("div", { class: "empty" }, message);
}

// Bottom-sheet modal. `build(close)` returns the body element.
export function openSheet(build) {
  const backdrop = el("div", { class: "sheet-backdrop" });
  const sheet = el("div", { class: "sheet" });
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", e => { if (e.target === backdrop) close(); });
  sheet.appendChild(build(close));
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
}

// Tappable 1..5 star control. onChange(value) called on tap.
export function starRating(value, onChange, editable = true) {
  const wrap = el("div", { class: "stars", role: "slider",
    "aria-valuemin": "1", "aria-valuemax": "5", "aria-valuenow": String(value) });
  const render = v => {
    wrap.textContent = "★★★★★☆☆☆☆☆".slice(5 - v, 10 - v);
    wrap.setAttribute("aria-valuenow", String(v));
  };
  render(value);
  if (editable) {
    wrap.addEventListener("click", e => {
      const rect = wrap.getBoundingClientRect();
      const v = Math.min(5, Math.max(1,
        Math.ceil(((e.clientX - rect.left) / rect.width) * 5)));
      render(v); onChange(v);
    });
  }
  return wrap;
}

export function field(labelText, inputEl) {
  return el("div", { class: "field" }, [el("label", {}, labelText), inputEl]);
}
```

- [ ] **Step 2: Create `src/views/charts.js`**

```js
const NS = "http://www.w3.org/2000/svg";

// Donut chart. data: [{label, value, color}]. Returns an <svg> element.
export function svgDonut(data) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Spending by category");
  if (total <= 0) return svg;
  const cx = 60, cy = 60, r = 45, C = 2 * Math.PI * r;
  let offset = 0;
  for (const d of data) {
    if (d.value <= 0) continue;
    const frac = d.value / total;
    const circle = document.createElementNS(NS, "circle");
    circle.setAttribute("cx", cx); circle.setAttribute("cy", cy);
    circle.setAttribute("r", r); circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", d.color);
    circle.setAttribute("stroke-width", "18");
    circle.setAttribute("stroke-dasharray", `${frac * C} ${C}`);
    circle.setAttribute("stroke-dashoffset", String(-offset * C));
    circle.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);
    svg.appendChild(circle);
    offset += frac;
  }
  return svg;
}

// Bar chart. data: [{label, value}]. Returns an <svg> element.
export function svgBars(data) {
  const W = 320, H = 160, pad = 24;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Spending per day");
  if (!data.length) return svg;
  const max = Math.max(...data.map(d => d.value), 1);
  const bw = (W - pad * 2) / data.length;
  data.forEach((d, i) => {
    const h = (d.value / max) * (H - pad * 2);
    const x = pad + i * bw;
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("x", x + bw * 0.15);
    rect.setAttribute("y", H - pad - h);
    rect.setAttribute("width", bw * 0.7);
    rect.setAttribute("height", Math.max(1, h));
    rect.setAttribute("fill", "#4a9fe6");
    rect.setAttribute("rx", "3");
    svg.appendChild(rect);
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", x + bw / 2);
    t.setAttribute("y", H - 6);
    t.setAttribute("font-size", "8");
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("fill", "currentColor");
    t.textContent = d.label;
    svg.appendChild(t);
  });
  return svg;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/views/components.js src/views/charts.js
git commit -m "feat: shared DOM components and SVG charts"
```

---

## Task 9: Speech Service (capability-detected, with fallback)

**Files:**
- Create: `src/services/speech.js`

- [ ] **Step 1: Create `src/services/speech.js`**

```js
export function isSpeechSupported() {
  return typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Thin wrapper. onResult(text) is called with the running transcript.
// The caller always also has a typed text field as the source of truth,
// so this only augments manual input.
export class SpeechInput {
  constructor(onResult, onError) {
    this.onResult = onResult;
    this.onError = onError;
    this.recording = false;
    this._rec = null;
  }

  start() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) { this.onError?.("Voice input is not supported on this browser."); return; }
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = e => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      this.onResult?.(text.trim());
    };
    rec.onerror = e => {
      this.recording = false;
      this.onError?.(
        e.error === "not-allowed"
          ? "Microphone permission denied."
          : "Voice input error (it may need a connection on iOS)."
      );
    };
    rec.onend = () => { this.recording = false; };
    try { rec.start(); this.recording = true; this._rec = rec; }
    catch { this.onError?.("Could not start voice input."); }
  }

  stop() {
    try { this._rec?.stop(); } catch {}
    this.recording = false;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/speech.js
git commit -m "feat: speech input wrapper with capability detection"
```

---

## Task 10: Feature Views (Budget, Stays, Flights, Food)

**Files:**
- Create: `src/views/budgetView.js`
- Create: `src/views/staysView.js`
- Create: `src/views/flightsView.js`
- Create: `src/views/foodView.js`

> Each view exports `render(root, header, repo)` where `header = { setTitle, setActions }`. Views own a ViewModel, call `load()`, paint into `root`, and re-render after mutations. All user data goes through `el()` text nodes — never HTML strings.

- [ ] **Step 1: Create `src/views/budgetView.js`**

```js
import { BudgetViewModel } from "../viewmodels/BudgetViewModel.js";
import { BUDGET_CATEGORIES, categoryById } from "../domain/enums.js";
import { formatCurrency } from "../domain/money.js";
import { dayLabel } from "../domain/datetime.js";
import { el, empty, openSheet, field } from "./components.js";
import { svgDonut, svgBars } from "./charts.js";

export async function render(root, header, repo) {
  const vm = new BudgetViewModel(repo);
  await vm.load();
  const cur = vm.settings.currencyCode;

  header.setTitle("Budget");
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
    root.appendChild(el("div", { class: "card" }, [
      rowLine("Total Budget", formatCurrency(vm.totalBudget, cur)),
      rowLine("Spent", formatCurrency(vm.totalSpent, cur)),
      rowLine("Remaining", formatCurrency(vm.remaining, cur),
              vm.remaining < 0 ? "danger" : "good")
    ]));

    const donutData = BUDGET_CATEGORIES
      .map(c => ({ label: c.label, value: vm.spentByCategory[c.id] || 0, color: c.color }))
      .filter(d => d.value > 0);
    root.appendChild(el("div", { class: "card" }, [
      el("h3", {}, "By Category"),
      donutData.length ? svgDonut(donutData) : empty("No spending yet"),
      ...donutData.map(d => el("div", { class: "row" }, [
        el("span", {}, `■ ${d.label}`), el("span", {}, formatCurrency(d.value, cur))
      ]))
    ]));

    root.appendChild(el("div", { class: "card" }, [
      el("h3", {}, "Daily Spend"),
      vm.dailySpend.length
        ? svgBars(vm.dailySpend.map(d => ({ label: d.day.slice(5), value: d.total })))
        : empty("No daily data")
    ]));

    const list = el("div", { class: "card" }, [el("h3", {}, "Entries")]);
    if (!vm.entries.length) list.appendChild(empty("No entries yet"));
    for (const e of vm.entries) {
      const c = categoryById(e.category);
      list.appendChild(el("div", { class: "row", style: "padding:8px 0" }, [
        el("div", {}, [
          el("div", {}, `${c.emoji} ${e.title}`),
          el("div", { class: "muted" }, dayLabel(e.date))
        ]),
        el("div", { class: "row" }, [
          el("span", {}, formatCurrency(e.amount, cur)),
          el("button", { class: "btn-text danger", "aria-label": "Delete",
            onclick: async () => { await vm.deleteEntry(e.id); paint(); } }, "🗑")
        ])
      ]));
    }
    root.appendChild(list);
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
        BUDGET_CATEGORIES.map(c => el("option", { value: c.id }, c.label)));
      const date = el("input", { type: "date",
        value: new Date().toISOString().slice(0, 10) });
      const note = el("textarea", { rows: "2" });
      return el("div", {}, [
        el("h3", {}, "New Entry"),
        field("Title", title), field("Amount", amount),
        field("Category", cat), field("Date", date), field("Note", note),
        el("button", { class: "btn-primary", onclick: async () => {
          const ok = await vm.addEntry({
            title: title.value, amount: amount.value, category: cat.value,
            date: new Date(date.value + "T12:00").getTime(), note: note.value });
          if (ok) { close(); paint(); } else alert("Enter a title and amount > 0.");
        } }, "Save")
      ]);
    });
  }

  paint();
}
```

- [ ] **Step 2: Create `src/views/staysView.js`**

```js
import { StaysViewModel } from "../viewmodels/StaysViewModel.js";
import { TRANSPORT_MODES } from "../domain/enums.js";
import { dayLabel } from "../domain/datetime.js";
import { el, empty, openSheet, field } from "./components.js";

export async function render(root, header, repo) {
  const vm = new StaysViewModel(repo);
  await vm.load();

  header.setTitle("Stays & Transport");
  header.setActions([
    el("button", { class: "btn-text", "aria-label": "Add stay",
      onclick: () => addSheet() }, "＋")
  ]);

  function paint() {
    root.replaceChildren();
    if (!vm.stays.length) {
      root.appendChild(empty("No stays yet — add the first hotel."));
      return;
    }
    for (const s of vm.stays) {
      const mode = TRANSPORT_MODES.find(m => m.id === s.onwardTransport);
      root.appendChild(el("div", { class: "card" }, [
        el("div", { class: "row" }, [
          el("strong", {}, s.hotelName),
          el("button", { class: "btn-text danger", "aria-label": "Delete",
            onclick: async () => { await vm.deleteStay(s.id); paint(); } }, "🗑")
        ]),
        el("div", { class: "muted" },
          `${dayLabel(s.checkIn)} → ${dayLabel(s.checkOut)} · ${vm.nights(s)} night(s)`),
        s.bookingReference ? el("div", { class: "muted" },
          `Booking: ${s.bookingReference}`) : null,
        s.address ? el("div", { class: "muted" }, s.address) : null,
        mode ? el("div", {}, [el("span", { class: "pill" },
          `Onward: ${mode.label}${s.onwardNote ? " · " + s.onwardNote : ""}`)]) : null,
        s.note ? el("div", { class: "muted" }, s.note) : null
      ]));
    }
  }

  function addSheet() {
    openSheet(close => {
      const hotel = el("input", { type: "text" });
      const addr = el("input", { type: "text" });
      const ref = el("input", { type: "text" });
      const ci = el("input", { type: "date",
        value: new Date().toISOString().slice(0, 10) });
      const co = el("input", { type: "date",
        value: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });
      const mode = el("select", {},
        TRANSPORT_MODES.map(m => el("option", { value: m.id }, m.label)));
      const onwardNote = el("input", { type: "text",
        placeholder: "e.g. Shinkansen 08:00" });
      const note = el("textarea", { rows: "2" });
      return el("div", {}, [
        el("h3", {}, "New Stay"),
        field("Hotel name", hotel), field("Address", addr),
        field("Booking reference", ref),
        field("Check-in", ci), field("Check-out", co),
        field("Onward transport", mode), field("Transport details", onwardNote),
        field("Note", note),
        el("button", { class: "btn-primary", onclick: async () => {
          const ok = await vm.addStay({
            hotelName: hotel.value, address: addr.value,
            bookingReference: ref.value,
            checkIn: new Date(ci.value + "T12:00").getTime(),
            checkOut: new Date(co.value + "T12:00").getTime(),
            onwardTransport: mode.value, onwardNote: onwardNote.value,
            note: note.value });
          if (ok) { close(); paint(); } else alert(vm.lastError);
        } }, "Save")
      ]);
    });
  }

  paint();
}
```

- [ ] **Step 3: Create `src/views/flightsView.js`**

```js
import { FlightsViewModel } from "../viewmodels/FlightsViewModel.js";
import { formatInstant } from "../domain/datetime.js";
import { el, empty, openSheet, field } from "./components.js";

const ZONES = (Intl.supportedValuesOf?.("timeZone") || [
  "Asia/Tokyo", "America/Los_Angeles", "America/New_York",
  "Europe/London", "Australia/Sydney", "UTC"
]).sort();

export async function render(root, header, repo) {
  const vm = new FlightsViewModel(repo);
  await vm.load();

  header.setTitle("Flights");
  header.setActions([
    el("button", { class: "btn-text", "aria-label": "Add flight",
      onclick: () => addSheet() }, "＋")
  ]);

  function paint() {
    root.replaceChildren();
    if (!vm.flights.length) { root.appendChild(empty("No flights yet.")); return; }
    for (const f of vm.flights) {
      root.appendChild(el("div", { class: "card" }, [
        el("div", { class: "row" }, [
          el("strong", {}, `${f.flightNumber}${f.airline ? " · " + f.airline : ""}`),
          el("button", { class: "btn-text danger", "aria-label": "Delete",
            onclick: async () => { await vm.deleteFlight(f.id); paint(); } }, "🗑")
        ]),
        el("div", {}, `${f.from} → ${f.to} · ${vm.durationText(f)}`),
        el("div", { class: "muted" },
          `Dep: ${formatInstant(f.departureEpoch, f.departureTZ)}`),
        el("div", { class: "muted" },
          `Arr: ${formatInstant(f.arrivalEpoch, f.arrivalTZ)}`),
        el("div", { class: "muted" }, `Passengers: ${f.passengers}`),
        (f.departureTerminal || f.departureGate) ? el("div", { class: "muted" },
          `Dep T${f.departureTerminal || "–"} · Gate ${f.departureGate || "–"}`) : null,
        f.note ? el("div", { class: "muted" }, f.note) : null
      ]));
    }
  }

  function zoneSelect(def) {
    return el("select", {},
      ZONES.map(z => el("option",
        z === def ? { value: z, selected: "selected" } : { value: z }, z)));
  }

  function addSheet() {
    openSheet(close => {
      const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const num = el("input", { type: "text" });
      const air = el("input", { type: "text" });
      const from = el("input", { type: "text", placeholder: "SFO" });
      const to = el("input", { type: "text", placeholder: "HND" });
      const dep = el("input", { type: "datetime-local" });
      const depTZ = zoneSelect(localTZ);
      const arr = el("input", { type: "datetime-local" });
      const arrTZ = zoneSelect(localTZ);
      const pax = el("input", { type: "number", value: "1", min: "1" });
      const dT = el("input", { type: "text" });
      const dG = el("input", { type: "text" });
      const aT = el("input", { type: "text" });
      const aG = el("input", { type: "text" });
      const note = el("textarea", { rows: "2" });
      return el("div", {}, [
        el("h3", {}, "New Flight"),
        field("Flight number", num), field("Airline", air),
        field("From", from), field("To", to),
        field("Departure (local)", dep), field("Departure time zone", depTZ),
        field("Arrival (local)", arr), field("Arrival time zone", arrTZ),
        field("Passengers", pax),
        field("Dep terminal", dT), field("Dep gate", dG),
        field("Arr terminal", aT), field("Arr gate", aG),
        field("Note", note),
        el("button", { class: "btn-primary", onclick: async () => {
          if (!dep.value || !arr.value) { alert("Enter departure & arrival times."); return; }
          const ok = await vm.addFlight({
            flightNumber: num.value, airline: air.value,
            from: from.value, to: to.value,
            departureLocal: dep.value, departureTZ: depTZ.value,
            arrivalLocal: arr.value, arrivalTZ: arrTZ.value,
            passengers: pax.value,
            departureTerminal: dT.value, departureGate: dG.value,
            arrivalTerminal: aT.value, arrivalGate: aG.value, note: note.value });
          if (ok) { close(); paint(); }
          else alert("Flight number, from, and to are required.");
        } }, "Save")
      ]);
    });
  }

  paint();
}
```

- [ ] **Step 4: Create `src/views/foodView.js`**

```js
import { FoodJournalViewModel } from "../viewmodels/FoodJournalViewModel.js";
import { MEAL_TYPES } from "../domain/enums.js";
import { dayLabel } from "../domain/datetime.js";
import { el, empty, openSheet, field, starRating } from "./components.js";
import { isSpeechSupported, SpeechInput } from "../services/speech.js";

export async function render(root, header, repo) {
  const vm = new FoodJournalViewModel(repo);
  await vm.load();
  let mode = "journal"; // or "summary"

  header.setTitle("Food Journal");
  setActions();

  function setActions() {
    header.setActions([
      el("button", { class: "btn-text", "aria-label": "Toggle summary",
        onclick: () => { mode = mode === "journal" ? "summary" : "journal"; paint(); } },
        mode === "journal" ? "📊" : "📋"),
      el("button", { class: "btn-text", "aria-label": "Add meal",
        onclick: () => addSheet() }, "＋")
    ]);
  }

  function mealCard(m, withDelete) {
    return el("div", { class: "card" }, [
      el("div", { class: "row" }, [
        el("strong", {}, m.restaurant),
        el("span", {}, "★".repeat(m.rating))
      ]),
      m.mealType ? el("span", { class: "pill" }, m.mealType) : null,
      m.comment ? el("div", { class: "muted" }, m.comment) : null,
      el("div", { class: "muted" }, dayLabel(m.date)),
      withDelete ? el("button", { class: "btn-text danger",
        onclick: async () => { await vm.deleteMeal(m.id); paint(); } }, "Delete") : null
    ]);
  }

  function paint() {
    setActions();
    root.replaceChildren();
    if (mode === "summary") {
      root.appendChild(el("h3", { class: "good" }, "Loved it (4–5★)"));
      root.appendChild(vm.goodMeals.length
        ? el("div", {}, vm.goodMeals.map(m => mealCard(m, false)))
        : empty("Nothing yet"));
      root.appendChild(el("h3", { class: "danger" }, "Skip it (1–2★)"));
      root.appendChild(vm.badMeals.length
        ? el("div", {}, vm.badMeals.map(m => mealCard(m, false)))
        : empty("Nothing yet"));
      root.appendChild(el("h3", { class: "muted" }, "Just okay (3★)"));
      root.appendChild(vm.neutralMeals.length
        ? el("div", {}, vm.neutralMeals.map(m => mealCard(m, false)))
        : empty("Nothing yet"));
      return;
    }
    if (!vm.meals.length) { root.appendChild(empty("No meals logged.")); return; }
    for (const m of vm.meals) root.appendChild(mealCard(m, true));
  }

  function addSheet() {
    openSheet(close => {
      let rating = 3;
      const rest = el("input", { type: "text" });
      const type = el("select", {},
        [el("option", { value: "" }, "—"),
         ...MEAL_TYPES.map(t => el("option", { value: t.id }, t.label))]);
      const comment = el("textarea", { rows: "4",
        placeholder: "Type or dictate your notes…" });
      const stars = starRating(rating, v => { rating = v; });

      const voiceBtn = el("button", { class: "btn-text" }, "🎙️ Dictate");
      const voiceMsg = el("div", { class: "muted" });
      if (!isSpeechSupported()) {
        voiceBtn.disabled = true;
        voiceMsg.textContent =
          "Voice input not available on this browser — type instead.";
      } else {
        const speech = new SpeechInput(
          text => { comment.value = text; },
          err => { voiceMsg.textContent = err; voiceBtn.textContent = "🎙️ Dictate"; });
        voiceBtn.addEventListener("click", () => {
          if (speech.recording) {
            speech.stop(); voiceBtn.textContent = "🎙️ Dictate";
          } else {
            speech.start(); voiceBtn.textContent = "⏹ Stop"; voiceMsg.textContent = "";
          }
        });
      }

      return el("div", {}, [
        el("h3", {}, "New Meal"),
        field("Restaurant", rest), field("Meal", type),
        field("Rating", stars),
        field("Notes", comment),
        el("div", { class: "row" }, [voiceBtn]), voiceMsg,
        el("button", { class: "btn-primary", onclick: async () => {
          const ok = await vm.addMeal({
            restaurant: rest.value, mealType: type.value || null,
            rating, comment: comment.value, date: Date.now() });
          if (ok) { close(); paint(); } else alert("Restaurant name is required.");
        } }, "Save")
      ]);
    });
  }

  paint();
}
```

- [ ] **Step 5: Commit**

```bash
git add src/views/budgetView.js src/views/staysView.js src/views/flightsView.js src/views/foodView.js
git commit -m "feat: budget, stays, flights, food views"
```

---

## Task 11: App Bootstrap, Router & Service Worker Registration

**Files:**
- Create: `src/main.js`

- [ ] **Step 1: Create `src/main.js`**

```js
import { IndexedDBRepository } from "./data/repository.js";

const repo = new IndexedDBRepository();
const viewRoot = document.getElementById("viewRoot");
const titleEl = document.getElementById("headerTitle");
const actionsEl = document.getElementById("headerActions");
const tabs = [...document.querySelectorAll(".tab")];

const header = {
  setTitle: t => { titleEl.textContent = t; },
  setActions: nodes => { actionsEl.replaceChildren(...nodes); }
};

const ROUTES = {
  budget:  () => import("./views/budgetView.js"),
  stays:   () => import("./views/staysView.js"),
  flights: () => import("./views/flightsView.js"),
  food:    () => import("./views/foodView.js")
};

async function route() {
  const name = (location.hash.replace("#/", "") || "budget");
  const key = ROUTES[name] ? name : "budget";
  tabs.forEach(t =>
    t.setAttribute("aria-selected", String(t.dataset.route === key)));
  viewRoot.replaceChildren();
  const mod = await ROUTES[key]();
  await mod.render(viewRoot, header, repo);
}

tabs.forEach(t =>
  t.addEventListener("click", () => { location.hash = "#/" + t.dataset.route; }));
window.addEventListener("hashchange", route);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

route();
```

- [ ] **Step 2: Serve locally and smoke-test (manual)**

Run: `cd "$PROJECT_ROOT" && python3 -m http.server 8000`
Then open `http://localhost:8000/` in a desktop browser (localhost is a secure context, so the service worker registers). Verify: four tabs switch; you can add a budget entry, a stay, a flight, a meal; charts render; food summary toggles. Stop the server with Ctrl-C.

> The implementing agent cannot drive a browser here — this step is run by the user (or at a manual checkpoint). Do not mark the app "working" without it.

- [ ] **Step 3: Run the full automated suite once more**

Run: `node --test test/`
Expected: PASS — 17 tests across 4 suites.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat: app bootstrap, hash router, service worker registration"
```

---

## Task 12: Deploy to a Free Static Host

**Files:** none (deployment).

> The whole repo root is the deployable artifact. Two zero-cost options — pick one. Netlify Drop needs no account and no CLI; GitHub Pages gives a stable URL tied to a repo. Either is a private/unlisted host, not the App Store.

- [ ] **Step 1 (Option A — Netlify Drop, fastest):**

Open `https://app.netlify.com/drop` in a desktop browser. Drag the **project root folder** (`$PROJECT_ROOT`) onto the page. It returns an HTTPS URL like `https://random-name.netlify.app`. That URL is the app.

- [ ] **Step 1 (Option B — GitHub Pages, stable URL):**

```bash
cd "$PROJECT_ROOT"
gh repo create jp-trip-planner --private --source=. --remote=origin --push
```

Then in the repo on GitHub: **Settings ▸ Pages ▸ Source: Deploy from a branch ▸ main / (root)**. URL: `https://<user>.github.io/jp-trip-planner/`.

> Confirm with the user before running Option B — it creates a remote repository and pushes code. Private keeps it unlisted.

- [ ] **Step 2: Verify HTTPS + offline on desktop**

Open the deployed HTTPS URL. Confirm the app loads, then go offline (devtools ▸ Network ▸ Offline) and reload — it should still work (service-worker shell cache).

---

## Task 13: Manual QA on iPhone (verification only)

**Files:** none.

> Automated tests cover all ViewModel + time-zone logic. The following require the physical iPhone and cannot be verified by the agent.

- [ ] **Step 1: Install as a PWA**
  - On the iPhone, open the deployed HTTPS URL in **Safari**.
  - Share ▸ **Add to Home Screen**. Launch from the home-screen icon — it opens full-screen (standalone), no Safari chrome.

- [ ] **Step 2: Functional smoke test**
  - Budget: set total budget; add entries across ≥3 categories; confirm donut + daily bars render; delete one; numbers update.
  - Stays: add 2 stays with booking ref + onward transport; try checkout-before-checkin (rejected with message).
  - Flights: add SFO (America/Los_Angeles) → HND (Asia/Tokyo); confirm each time shows in its own zone with a zone abbreviation and duration ≈ 11h30m.
  - Food: add meals rated 1/3/5; toggle Summary; confirm good/bad/neutral split.

- [ ] **Step 3: Voice (expected to be flaky on iOS — verifying graceful behavior)**
  - In New Meal, tap **Dictate**. If supported: grant mic permission, speak, confirm text fills the notes field, Stop works.
  - If unsupported or it errors: confirm the button is disabled or shows a clear message and **typed notes still work**. (This passing = the fallback works; voice itself failing on iOS is acceptable per platform limitation.)

- [ ] **Step 4: Offline, appearance, accessibility**
  - Enable Airplane Mode, relaunch from home screen: all previously entered data persists (IndexedDB) and the app loads (SW cache).
  - Toggle iOS Dark Mode: all screens legible.
  - Settings ▸ Accessibility ▸ Larger Text: layout scales, no clipped critical text.
  - Notch/home-indicator: header and tab bar respect safe areas (no content hidden).

- [ ] **Step 5: Final commit / tag**

```bash
cd "$PROJECT_ROOT"
git add -A && git commit -m "chore: JP Trip Planner PWA v1.0.0" || echo "nothing to commit"
git tag v1.0.0
```

---

## Self-Review

**Spec coverage (original feature spec, re-mapped to the web stack):**
- Budget: total budget (settings store), spend by category (`spentByCategory` + SVG donut), amount per entry (budgetEntries), daily view (`dailySpend` + SVG bars), visual breakdown ✓ Tasks 4, 8, 10
- Stays & transport: hotel per night + `nights()`, check-in/out, inter-hotel transport (`onwardTransport`/`onwardNote`), booking reference ✓ Tasks 5, 10
- Flights: number, dep/arr times, passengers, terminal/gate, **time zones** (dual epoch+IANA fields, `zonedWallClockToEpoch`, per-zone display) ✓ Tasks 2, 6, 10
- Food journal: per-meal comment, 1–5 star control, **voice input** (Web Speech API behind `SpeechInput`, typed fallback — the iOS-native Speech framework is N/A in a browser; this is the web-platform equivalent), good vs bad summary view ✓ Tasks 7, 9, 10
- Navigation: bottom tab bar (4 tabs), per-section sticky top header with contextual actions, all-DOM UI, safe-area insets, dark mode (`prefers-color-scheme`), scalable type ✓ Tasks 1, 10, 11
- Tech (revised per user decisions): web app run in iPhone Safari, **no App Store / Xcode / Apple account**; offline-first (IndexedDB + service worker); MVVM (pure ViewModels + repository); **zero third-party dependencies** ✓ all tasks
- Original "native SwiftUI / SwiftData / AVFoundation / iOS 16+" requirements are intentionally superseded by the user's two explicit decisions (browser app; free static host). Recorded here so the deviation is traceable.

**Placeholder scan:** No TBD/TODO; every implementation step has complete code; every test has real assertions and explicit pass/fail expectations.

**Type/contract consistency:** All ViewModels share `constructor(repo)` + `async load()`; flight fields `departureEpoch/departureTZ/arrivalEpoch/arrivalTZ` are written by `addFlight` and read identically by `flightsView.js` and `durationText`; `Repository` surface (`getAll/get/put/remove`) is identical across `IndexedDBRepository` and `InMemoryRepository`; every view exports `render(root, header, repo)` and `main.js` calls exactly that; `STORES` names in `db.js` match the store strings used in every ViewModel (`settings/budgetEntries/stays/flights/meals`). Cross-task ordering hazard called out inline: `test/helpers.js` (Task 2) imports `repository.js`, so Task 3 must land before any `node --test` that imports it; Task 2's own test imports only `datetime.js` and is safe to run at that point.

**Security note:** The `el()` DOM helper has no `innerHTML` path; all user-entered trip data is rendered via text nodes / attributes only — no HTML injection surface.

**Known limitations (by design / platform):**
- iOS Safari speech recognition is unreliable/often network-bound; mitigated by always-available typed notes + capability detection (acceptance criterion is the fallback, not voice itself).
- Money uses number + integer-minor-unit summation, not a true decimal type — adequate for a personal trip tracker, documented.
- UI/PWA/offline/voice are verified manually on-device (Task 13); the agent must not assert these pass without that checklist.

---

## Task 14: Receipt Photos + Expanded Budget Categories (post-plan addition, SHIPPED)

> Added during local-preview review at user request. Implemented TDD where logic is testable; browser-only image code verified by syntax + on-device checklist.

**Decisions (user-confirmed):**
- Budget categories overhauled: `food`→`foodDrink` ("Food & Drink"), `shopping` removed; added `groceries`, `clothing`, `souvenirs`. Final ids: `foodDrink, groceries, clothing, souvenirs, transport, accommodation, activities, other`. `categoryById` now falls back to the `other` entry by id (not a fixed index) so legacy/unknown ids degrade gracefully.
- Receipt photo: one per entry, on **Budget entries** AND **Food Journal meals**. Auto-downscaled to ≤1600px JPEG (`quality 0.8`) and stored as a data-URL string in the existing `receipt` field (round-trips through IndexedDB + InMemory repos unchanged). Tap a thumbnail → full-screen `lightbox`.

**Files changed:**
- `src/domain/enums.js` — new category list + id-based `categoryById` fallback
- `src/domain/image.js` (new) — `fileToScaledDataURL(file, maxPx=1600, quality=0.8)`; browser-only (FileReader/Image/canvas), kept out of ViewModels to preserve Node-testability
- `src/viewmodels/BudgetViewModel.js`, `src/viewmodels/FoodJournalViewModel.js` — `addEntry`/`addMeal` persist `receipt: receipt || null`
- `src/views/components.js` — `receiptPicker()` → `{ element, get() }` (lazy-imports image.js); `lightbox(src)`
- `src/views/budgetView.js`, `src/views/foodView.js` — picker in add-sheet, thumbnail in cards
- `styles.css` — `.receipt-thumb`, `.lightbox`
- `sw.js` — added `./src/domain/image.js` to SHELL, cache bumped `jp-trip-v1`→`jp-trip-v2`
- `test/budgetViewModel.test.js`, `test/foodJournalViewModel.test.js` — receipt persistence tests (TDD, red→green)

**Verification:** `node --test` → 21/21 pass. Syntax + import-resolution clean. Receipt capture/preview/lightbox and the JPEG downscale are browser-only — verify in the Task 13 on-device pass (add a photo to a Budget entry and a meal; confirm thumbnail + tap-to-enlarge; confirm offline persistence).

**Self-review (addendum):** All spec items above implemented; no placeholders; `receipt` field name consistent across VMs/views/tests; `receiptPicker` contract `{element,get}` matches both call sites; image.js never imported by a ViewModel (Node tests stay pure).
