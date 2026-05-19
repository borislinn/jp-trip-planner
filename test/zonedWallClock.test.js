import { test } from "node:test";
import assert from "node:assert/strict";
import {
  zonedWallClockToEpoch,
  epochToZonedWallClock
} from "../src/domain/datetime.js";

test("epochToZonedWallClock renders the wall-clock time in the given zone", () => {
  // 2026-05-24 19:00 JST == 2026-05-24 10:00 UTC
  const epoch = Date.UTC(2026, 4, 24, 10, 0);
  assert.equal(epochToZonedWallClock(epoch, "Asia/Tokyo"), "2026-05-24T19:00");
  assert.equal(epochToZonedWallClock(epoch, "UTC"), "2026-05-24T10:00");
});

test("epochToZonedWallClock round-trips with zonedWallClockToEpoch", () => {
  const local = "2026-12-31T23:45";
  const epoch = zonedWallClockToEpoch(local, "Asia/Tokyo");
  assert.equal(epochToZonedWallClock(epoch, "Asia/Tokyo"), local);
});
