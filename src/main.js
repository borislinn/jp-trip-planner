import { IndexedDBRepository } from "./data/repository.js";
import { languageButtonLabel, t, toggleLanguage } from "./domain/i18n.js";

const repo = new IndexedDBRepository();
const viewRoot = document.getElementById("viewRoot");
const titleEl = document.getElementById("headerTitle");
const actionsEl = document.getElementById("headerActions");
const tabs = [...document.querySelectorAll(".tab")];

const header = {
  setTitle: t => { titleEl.textContent = t; },
  setActions: nodes => {
    actionsEl.replaceChildren(...nodes, elLangButton());
  }
};

const ROUTES = {
  journey: () => import("./views/journeyView.js"),
  budget:  () => import("./views/budgetView.js"),
  trip:    () => import("./views/tripView.js"),
  restaurants: () => import("./views/restaurantsView.js"),
  stays:   () => import("./views/staysView.js"),
  flights: () => import("./views/flightsView.js"),
  food:    () => import("./views/foodView.js")
};

const TAB_ROUTE = {
  stays: "trip",
  flights: "trip",
  food: "restaurants"
};

function elLangButton() {
  const button = document.createElement("button");
  button.className = "btn-text lang-toggle";
  button.type = "button";
  button.setAttribute("aria-label", t("Switch language"));
  button.textContent = languageButtonLabel();
  button.addEventListener("click", () => {
    toggleLanguage();
    updateStaticLabels();
    route();
  });
  return button;
}

function updateStaticLabels() {
  document.documentElement.lang = languageButtonLabel() === "EN" ? "zh-Hant" : "en";
  const labels = {
    journey: t("Home"),
    budget: t("Money"),
    restaurants: t("Restaurants"),
    trip: t("Trip")
  };
  for (const tab of tabs) {
    tab.querySelector(".tab-label").textContent = labels[tab.dataset.route] || tab.dataset.route;
  }
}

async function route() {
  const name = (location.hash.replace("#/", "") || "journey");
  const key = ROUTES[name] ? name : "journey";
  const selectedTab = TAB_ROUTE[key] || key;
  tabs.forEach(t =>
    t.setAttribute("aria-selected", String(t.dataset.route === selectedTab)));
  const loader = document.createElement("div");
  loader.className = "view-loading";
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-label", t("Loading"));
  viewRoot.replaceChildren(loader);
  try {
    const mod = await ROUTES[key]();
    await mod.render(viewRoot, header, repo);
  } catch (error) {
    console.error(error);
    header.setTitle(key === "food" ? t("Expenses") :
      key === "restaurants" ? t("Restaurants") :
      key === "budget" ? t("Money") :
      key === "trip" ? t("Trip") :
      t(key.charAt(0).toUpperCase() + key.slice(1)));
    header.setActions([]);
    viewRoot.replaceChildren(Object.assign(document.createElement("div"), {
      className: "empty",
      textContent: t("This section could not load. Refresh once and try again.")
    }));
  }
}

tabs.forEach(t =>
  t.addEventListener("click", () => { location.hash = "#/" + t.dataset.route; }));
window.addEventListener("hashchange", route);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

updateStaticLabels();
route();
