const CACHE = "jp-trip-v42";
const SHELL = [
  "./", "./index.html", "./styles.css", "./app.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png",
  "./src/main.js",
  "./src/data/db.js", "./src/data/repository.js",
  "./src/domain/enums.js", "./src/domain/money.js", "./src/domain/datetime.js",
  "./src/domain/flights.js",
  "./src/domain/i18n.js",
  "./src/domain/image.js", "./src/domain/transfers.js",
  "./src/domain/backup.js",
  "./src/viewmodels/BudgetViewModel.js", "./src/viewmodels/StaysViewModel.js",
  "./src/viewmodels/FlightsViewModel.js", "./src/viewmodels/FoodJournalViewModel.js",
  "./src/viewmodels/RestaurantsViewModel.js",
  "./src/views/components.js", "./src/views/charts.js", "./src/views/journeyView.js",
  "./src/views/tripView.js", "./src/views/restaurantsView.js",
  "./src/views/budgetView.js", "./src/views/staysView.js",
  "./src/views/flightsView.js", "./src/views/foodView.js"
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
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() =>
      caches.match(e.request).then(hit => hit || caches.match("./index.html")))
  );
});
