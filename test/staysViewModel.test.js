import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRepo } from "./helpers.js";
import { StaysViewModel } from "../src/viewmodels/StaysViewModel.js";

const day = (y, m, d) => new Date(y, m - 1, d).getTime();

test("stays sorted by check-in; nights computed for hotels", async () => {
  const vm = new StaysViewModel(makeRepo());
  await vm.load();
  await vm.addStay({ hotelName: "B", checkIn: day(2026,5,5), checkOut: day(2026,5,7) });
  await vm.addStay({ hotelName: "A", checkIn: day(2026,5,1), checkOut: day(2026,5,5),
                     bookingReference: "ABC123" });

  assert.deepEqual(vm.stays.map(s => s.hotelName), ["A", "B"]);
  assert.equal(vm.nights(vm.stays[0]), 4);
  assert.equal(vm.stays[0].bookingReference, "ABC123");
  assert.equal(vm.stays[0].onwardTransport, undefined);
});

test("saved stays can be loaded by a fresh view model", async () => {
  const repo = makeRepo();
  const first = new StaysViewModel(repo);
  await first.load();
  await first.addStay({
    hotelName: "Hotel Monterey",
    address: "Osaka",
    bookingReference: "ABC123",
    checkIn: day(2026,5,17),
    checkOut: day(2026,5,20),
    note: "Near station"
  });

  const second = new StaysViewModel(repo);
  await second.load();

  assert.equal(second.stays.length, 1);
  assert.equal(second.stays[0].hotelName, "Hotel Monterey");
  assert.equal(second.stays[0].address, "Osaka");
  assert.equal(second.stays[0].bookingReference, "ABC123");
  assert.equal(second.stays[0].note, "Near station");
  assert.equal(second.nights(second.stays[0]), 3);
});

test("persistent stores start empty until the user adds local stays", async () => {
  const repo = makeRepo();
  const first = new StaysViewModel(repo);
  await first.load();

  assert.deepEqual(first.stays, []);

  const second = new StaysViewModel(repo);
  await second.load();
  assert.equal(second.stays.length, 0);
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
