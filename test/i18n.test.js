import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CUISINES,
  OSAKA_AREAS,
  getLanguage,
  optionLabel,
  setLanguage,
  t
} from "../src/domain/i18n.js";

test("language switch translates app labels and option labels", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => store.get(key) || null,
    setItem: (key, value) => store.set(key, value)
  };

  setLanguage("zh");
  assert.equal(getLanguage(), "zh");
  assert.equal(t("Restaurants"), "餐廳");
  assert.equal(t("{count} restaurants", { count: 2 }), "2 間餐廳");
  assert.equal(t("After {time} arrival + 60 min", { time: "14:50" }),
    "14:50 抵達後 + 60 分鐘");
  assert.equal(t("Airport Hotel to KIX"), "機場飯店到關西機場");
  assert.equal(optionLabel("Ramen"), "拉麵");
  assert.equal(optionLabel("Umeda"), "梅田");

  setLanguage("en");
  assert.equal(t("Restaurants"), "Restaurants");
  assert.equal(optionLabel("Ramen"), "Ramen");
  delete globalThis.localStorage;
});

test("restaurant dropdown source lists include requested cuisines and Osaka areas", () => {
  for (const cuisine of ["Ramen", "Yakiniku", "Yakitori", "Sukiyaki", "Kaiseki", "Dessert", "Drinks"]) {
    assert.ok(CUISINES.includes(cuisine));
  }
  for (const area of ["Umeda", "Namba", "Shinsaibashi", "Dotonbori", "Tennoji", "Rinku Town / KIX"]) {
    assert.ok(OSAKA_AREAS.includes(area));
  }
});
