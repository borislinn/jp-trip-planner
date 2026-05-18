import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextHarukaDepartures,
  harukaScheduleRows,
  uberAirportUrl,
  uberHotelUrl
} from "../src/domain/transfers.js";

const tokyoEpoch = local =>
  new Date(`${local}:00+09:00`).getTime();

test("recommends next weekend HARUKA departures after airport buffer", () => {
  const out = nextHarukaDepartures(tokyoEpoch("2026-05-23T13:55"), {
    bufferMinutes: 60,
    count: 3
  });
  assert.deepEqual(out, [
    { departure: "15:14", arrival: "16:01" },
    { departure: "15:44", arrival: "16:31" },
    { departure: "16:14", arrival: "17:01" }
  ]);
});

test("weekday and weekend schedules can be rendered as rows", () => {
  assert.equal(harukaScheduleRows("weekday")[0].departure, "06:30");
  assert.equal(harukaScheduleRows("weekend")[0].departure, "06:40");
  assert.equal(harukaScheduleRows("weekend")[0].arrival, "07:27");
});

test("Uber link defaults to Osaka Station for public shell installs", () => {
  const url = uberHotelUrl();
  const params = new URL(url).searchParams;
  assert.match(url, /^https:\/\/m\.uber\.com\/ul\//);
  assert.match(params.get("dropoff[nickname]"), /Osaka Station/);
  assert.match(params.get("dropoff[formatted_address]"), /Osaka Station/);
});

test("Uber airport link targets KIX", () => {
  const params = new URL(uberAirportUrl()).searchParams;
  assert.match(params.get("dropoff[nickname]"), /Kansai International Airport/);
  assert.match(params.get("dropoff[formatted_address]"), /Izumisano/);
});
