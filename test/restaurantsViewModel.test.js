import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryRepository } from "../src/data/repository.js";
import { RestaurantsViewModel } from "../src/viewmodels/RestaurantsViewModel.js";

test("restaurants save cuisine, map, reservation, status, area, and notes", async () => {
  const repo = new InMemoryRepository();
  const vm = new RestaurantsViewModel(repo);
  await vm.load();

  const reservedAt = new Date("2026-05-24T19:00:00+09:00").getTime();
  const ok = await vm.addRestaurant({
    name: "Sushi Osaka",
    cuisine: "Sushi",
    mapUrl: "https://maps.google.com/?q=Sushi%20Osaka",
    area: "Umeda",
    status: "Reserved",
    reservationEpoch: reservedAt,
    notes: "Counter seats"
  });

  assert.equal(ok, true);
  assert.equal(vm.restaurants.length, 1);
  assert.equal(vm.restaurants[0].name, "Sushi Osaka");
  assert.equal(vm.restaurants[0].cuisine, "Sushi");
  assert.equal(vm.restaurants[0].mapUrl, "https://maps.google.com/?q=Sushi%20Osaka");
  assert.equal(vm.restaurants[0].area, "Umeda");
  assert.equal(vm.restaurants[0].status, "Reserved");
  assert.equal(vm.restaurants[0].reservationEpoch, reservedAt);
  assert.equal(vm.restaurants[0].notes, "Counter seats");
});

test("restaurants require a name and default to want to go", async () => {
  const repo = new InMemoryRepository();
  const vm = new RestaurantsViewModel(repo);
  await vm.load();

  assert.equal(await vm.addRestaurant({ name: " " }), false);
  assert.equal(vm.lastError, "Restaurant name is required.");

  assert.equal(await vm.addRestaurant({ name: "Cafe" }), true);
  assert.equal(vm.restaurants[0].status, "Want to go");
  assert.equal(vm.restaurants[0].reservationEpoch, null);
});

test("restaurants fall back when the IndexedDB restaurant store is missing", async () => {
  const settings = new Map();
  const repo = {
    async getAll(name) {
      if (name === "restaurants") throw new Error("missing store");
      return [];
    },
    async get(name, id) {
      return settings.get(`${name}:${id}`);
    },
    async put(name, obj) {
      settings.set(`${name}:${obj.id}`, { ...obj });
      return { ...obj };
    },
    async remove() {}
  };
  const vm = new RestaurantsViewModel(repo);
  await vm.load();

  assert.equal(vm.usesFallbackStore, true);
  assert.deepEqual(vm.restaurants, []);

  assert.equal(await vm.addRestaurant({ name: "Fallback Sushi", cuisine: "Sushi" }), true);
  assert.equal(vm.restaurants.length, 1);
  assert.equal(vm.restaurants[0].name, "Fallback Sushi");
  assert.equal(settings.get("settings:restaurants-fallback-v1").items.length, 1);
});
