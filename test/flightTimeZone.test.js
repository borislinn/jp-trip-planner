import { test } from "node:test";
import assert from "node:assert/strict";
import { zonedWallClockToEpoch, formatInstant } from "../src/domain/datetime.js";
import { formatFlightArrival, flightArrivalEpoch } from "../src/domain/flights.js";

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

test("KIX arrival displays in Osaka local time even if saved with Taiwan zone", () => {
  const flight = {
    from: "TPE",
    to: "KIX",
    arrivalEpoch: zonedWallClockToEpoch("2026-05-23T14:50", "Asia/Taipei"),
    arrivalTZ: "Asia/Taipei"
  };

  assert.equal(new Date(flightArrivalEpoch(flight)).toISOString(), "2026-05-23T05:50:00.000Z");
  assert.match(formatFlightArrival(flight), /2:50|14:50/);
  assert.match(formatFlightArrival(flight), /GMT\+9|JST/);
});

test("duration across zones equals difference of absolute instants", () => {
  const dep = zonedWallClockToEpoch("2026-05-01T11:00", "America/Los_Angeles");
  const arr = zonedWallClockToEpoch("2026-05-02T14:30", "Asia/Tokyo");
  assert.equal((arr - dep) / 3600000, 11.5); // 11h30m
});

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

test("known airport codes override form time zones when saving flights", async () => {
  const vm = new FlightsViewModel(makeRepo());
  await vm.load();
  await vm.addFlight({
    flightNumber: "CX564",
    airline: "Cathay Pacific",
    from: "TPE",
    to: "KIX",
    departureLocal: "2026-05-23T11:05",
    departureTZ: "UTC",
    arrivalLocal: "2026-05-23T14:50",
    arrivalTZ: "Asia/Taipei"
  });

  const f = vm.flights[0];
  assert.equal(f.departureTZ, "Asia/Taipei");
  assert.equal(f.arrivalTZ, "Asia/Tokyo");
  assert.equal(new Date(f.arrivalEpoch).toISOString(), "2026-05-23T05:50:00.000Z");
});

test("saved flights can be loaded by a fresh view model", async () => {
  const repo = makeRepo();
  const first = new FlightsViewModel(repo);
  await first.load();
  await first.addFlight({
    flightNumber: "JL1", airline: "JAL",
    from: "SFO", to: "HND",
    departureLocal: "2026-05-01T12:00", departureTZ: "America/Los_Angeles",
    arrivalLocal: "2026-05-02T15:00", arrivalTZ: "Asia/Tokyo",
    passengers: "2", departureTerminal: "I", departureGate: "A4"
  });

  const second = new FlightsViewModel(repo);
  await second.load();

  assert.equal(second.flights.length, 1);
  assert.equal(second.flights[0].flightNumber, "JL1");
  assert.equal(second.flights[0].airline, "JAL");
  assert.equal(second.flights[0].from, "SFO");
  assert.equal(second.flights[0].to, "HND");
  assert.equal(second.flights[0].passengers, 2);
  assert.equal(second.flights[0].departureGate, "A4");
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
