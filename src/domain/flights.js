import { formatInstant, zonedWallClockToEpoch } from "./datetime.js";

const AIRPORT_TIME_ZONES = [
  { pattern: /\b(KIX|KANSAI|OSAKA)\b/i, timeZone: "Asia/Tokyo" },
  { pattern: /\b(TPE|TAOYUAN|TAIPEI|TAIWAN)\b/i, timeZone: "Asia/Taipei" }
];

export function airportTimeZone(value) {
  const text = String(value || "");
  return AIRPORT_TIME_ZONES.find(row => row.pattern.test(text))?.timeZone || null;
}

function wallClockValue(epochMs, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(new Date(epochMs));
  const p = Object.fromEntries(parts
    .filter(part => part.type !== "literal")
    .map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function airportLocalEpoch(epochMs, savedTz, airportText) {
  const targetTz = airportTimeZone(airportText) || savedTz;
  if (!savedTz || savedTz === targetTz) return epochMs;
  return zonedWallClockToEpoch(wallClockValue(epochMs, savedTz), targetTz);
}

export function flightDepartureTimeZone(flight) {
  return airportTimeZone(`${flight.from || ""} ${flight.departureAirport || ""}`) ||
    flight.departureTZ;
}

export function flightArrivalTimeZone(flight) {
  return airportTimeZone(`${flight.to || ""} ${flight.arrivalAirport || ""}`) ||
    flight.arrivalTZ;
}

export function flightDepartureEpoch(flight) {
  return airportLocalEpoch(
    flight.departureEpoch,
    flight.departureTZ,
    `${flight.from || ""} ${flight.departureAirport || ""}`
  );
}

export function flightArrivalEpoch(flight) {
  return airportLocalEpoch(
    flight.arrivalEpoch,
    flight.arrivalTZ,
    `${flight.to || ""} ${flight.arrivalAirport || ""}`
  );
}

export function formatFlightDeparture(flight) {
  return formatInstant(flightDepartureEpoch(flight), flightDepartureTimeZone(flight));
}

export function formatFlightArrival(flight) {
  return formatInstant(flightArrivalEpoch(flight), flightArrivalTimeZone(flight));
}
