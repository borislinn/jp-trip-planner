import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRepo } from "./helpers.js";
import { BudgetViewModel } from "../src/viewmodels/BudgetViewModel.js";
import { FlightsViewModel } from "../src/viewmodels/FlightsViewModel.js";
import { FoodJournalViewModel } from "../src/viewmodels/FoodJournalViewModel.js";
import { StaysViewModel } from "../src/viewmodels/StaysViewModel.js";

const day = (y, m, d) => new Date(y, m - 1, d, 12).getTime();

test("all user-entered trip data survives fresh view-model loads", async () => {
  const repo = makeRepo();

  const budget = new BudgetViewModel(repo);
  await budget.load();
  await budget.setBudgetSettings({
    totalBudget: "¥100,000",
    categoryBudgets: {
      foodDrink: "¥35,000",
      shopping: "¥40,000",
      transport: "¥25,000"
    }
  });

  const expense = new FoodJournalViewModel(repo);
  await expense.load();
  await expense.addExpense({
    name: "Nankai train",
    expenseType: "transport",
    amount: "¥1,200",
    comment: "Airport transfer",
    date: day(2026, 5, 17),
    receipt: "data:image/jpeg;base64,TEST"
  });

  const stays = new StaysViewModel(repo);
  await stays.load();
  await stays.addStay({
    hotelName: "Sample Hotel",
    address: "1 Example Street, Osaka, Japan",
    bookingReference: "Booking site",
    checkIn: day(2026, 5, 25),
    checkOut: day(2026, 5, 26),
    note: "Paid in advance."
  });

  const flights = new FlightsViewModel(repo);
  await flights.load();
  await flights.addFlight({
    flightNumber: "NH7",
    airline: "ANA",
    from: "SFO",
    to: "HND",
    departureLocal: "2026-05-01T11:00",
    departureTZ: "America/Los_Angeles",
    arrivalLocal: "2026-05-02T14:30",
    arrivalTZ: "Asia/Tokyo",
    passengers: "2",
    departureTerminal: "I",
    departureGate: "G1",
    arrivalTerminal: "3",
    note: "Window seat"
  });

  const reloadedBudget = new BudgetViewModel(repo);
  const reloadedExpense = new FoodJournalViewModel(repo);
  const reloadedStays = new StaysViewModel(repo);
  const reloadedFlights = new FlightsViewModel(repo);
  await Promise.all([
    reloadedBudget.load(),
    reloadedExpense.load(),
    reloadedStays.load(),
    reloadedFlights.load()
  ]);

  assert.equal(reloadedBudget.totalBudget, 100000);
  assert.equal(reloadedBudget.categoryBudgets.foodDrink, 35000);
  assert.equal(reloadedBudget.categoryBudgets.shopping, 40000);
  assert.equal(reloadedBudget.categoryBudgets.transport, 25000);
  assert.equal(reloadedBudget.totalSpent, 1200);
  assert.equal(reloadedBudget.spentByCategory.transport, 1200);

  assert.equal(reloadedExpense.expenses.length, 1);
  assert.equal(reloadedExpense.expenses[0].name, "Nankai train");
  assert.equal(reloadedExpense.expenses[0].receipt, "data:image/jpeg;base64,TEST");

  assert.equal(reloadedStays.stays.length, 1);
  assert.equal(reloadedStays.stays[0].hotelName, "Sample Hotel");
  assert.equal(reloadedStays.stays[0].address, "1 Example Street, Osaka, Japan");
  assert.equal(reloadedStays.stays[0].bookingReference, "Booking site");
  assert.equal(reloadedStays.stays[0].note, "Paid in advance.");

  assert.equal(reloadedFlights.flights.length, 1);
  assert.equal(reloadedFlights.flights[0].flightNumber, "NH7");
  assert.equal(reloadedFlights.flights[0].airline, "ANA");
  assert.equal(reloadedFlights.flights[0].departureGate, "G1");
  assert.equal(reloadedFlights.flights[0].note, "Window seat");
});
