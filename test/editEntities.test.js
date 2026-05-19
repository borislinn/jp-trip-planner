import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryRepository } from "../src/data/repository.js";
import { StaysViewModel } from "../src/viewmodels/StaysViewModel.js";
import { FlightsViewModel } from "../src/viewmodels/FlightsViewModel.js";
import { RestaurantsViewModel } from "../src/viewmodels/RestaurantsViewModel.js";
import { FoodJournalViewModel } from "../src/viewmodels/FoodJournalViewModel.js";

test("editing a stay updates in place instead of adding a duplicate", async () => {
  const repo = new InMemoryRepository();
  const vm = new StaysViewModel(repo);
  await vm.load();
  await vm.addStay({ hotelName: "Old Inn", checkIn: 1, checkOut: 2 });
  const id = vm.stays[0].id;

  const ok = await vm.addStay({
    id, hotelName: "New Hotel", checkIn: 10, checkOut: 20,
    address: "1 Osaka St"
  });

  assert.equal(ok, true);
  assert.equal(vm.stays.length, 1);
  assert.equal(vm.stays[0].id, id);
  assert.equal(vm.stays[0].hotelName, "New Hotel");
  assert.equal(vm.stays[0].checkIn, 10);
  assert.equal(vm.stays[0].address, "1 Osaka St");
});

test("editing a flight updates in place instead of adding a duplicate", async () => {
  const repo = new InMemoryRepository();
  const vm = new FlightsViewModel(repo);
  await vm.load();
  await vm.addFlight({
    flightNumber: "NH1", from: "SFO", to: "KIX",
    departureLocal: "2026-05-20T10:00", departureTZ: "America/Los_Angeles",
    arrivalLocal: "2026-05-21T14:00", arrivalTZ: "Asia/Tokyo"
  });
  const id = vm.flights[0].id;

  const ok = await vm.addFlight({
    id, flightNumber: "NH7", from: "SFO", to: "KIX",
    departureLocal: "2026-05-20T11:30", departureTZ: "America/Los_Angeles",
    arrivalLocal: "2026-05-21T15:30", arrivalTZ: "Asia/Tokyo"
  });

  assert.equal(ok, true);
  assert.equal(vm.flights.length, 1);
  assert.equal(vm.flights[0].id, id);
  assert.equal(vm.flights[0].flightNumber, "NH7");
});

test("editing a restaurant updates in place instead of adding a duplicate", async () => {
  const repo = new InMemoryRepository();
  const vm = new RestaurantsViewModel(repo);
  await vm.load();
  await vm.addRestaurant({ name: "Old Sushi", status: "Want to go" });
  const id = vm.restaurants[0].id;

  const ok = await vm.addRestaurant({
    id, name: "New Sushi", status: "Reserved", reservationEpoch: 1779616800000
  });

  assert.equal(ok, true);
  assert.equal(vm.restaurants.length, 1);
  assert.equal(vm.restaurants[0].id, id);
  assert.equal(vm.restaurants[0].name, "New Sushi");
  assert.equal(vm.restaurants[0].status, "Reserved");
  assert.equal(vm.restaurants[0].reservationEpoch, 1779616800000);
});

test("editing an expense updates the meal and its linked budget entry, no duplicates", async () => {
  const repo = new InMemoryRepository();
  const vm = new FoodJournalViewModel(repo);
  await vm.load();
  await vm.addExpense({ name: "Lunch", amount: "1000", expenseType: "food", date: 5 });
  const mealId = vm.expenses[0].id;

  const ok = await vm.addExpense({
    id: mealId, name: "Dinner", amount: "2500", expenseType: "food", date: 9
  });

  assert.equal(ok, true);
  assert.equal(vm.expenses.length, 1);
  assert.equal(vm.expenses[0].id, mealId);
  assert.equal(vm.expenses[0].name, "Dinner");
  assert.equal(vm.expenses[0].amount, 2500);

  const entries = await repo.getAll("budgetEntries");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, 2500);
  assert.equal(entries[0].title, "Dinner");
  assert.equal(entries[0].sourceExpenseId, mealId);
});
