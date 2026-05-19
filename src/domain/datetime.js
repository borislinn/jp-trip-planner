// Offset (ms) of `tz` relative to UTC at the given absolute instant.
function tzOffsetMs(tz, epochMs) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  const p = Object.fromEntries(
    dtf.formatToParts(new Date(epochMs))
       .filter(x => x.type !== "literal")
       .map(x => [x.type, x.value])
  );
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - epochMs;
}

// Interpret a wall-clock "YYYY-MM-DDTHH:mm" string AS LOCAL TIME IN `tz`,
// return the absolute instant (epoch ms). DST-safe via one refinement pass.
export function zonedWallClockToEpoch(localStr, tz) {
  const [d, t] = localStr.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const guessUTC = Date.UTC(y, mo - 1, da, h, mi);
  let epoch = guessUTC - tzOffsetMs(tz, guessUTC);
  const refined = tzOffsetMs(tz, epoch);
  epoch = guessUTC - refined;
  return epoch;
}

// Inverse of zonedWallClockToEpoch: render an absolute instant as the
// "YYYY-MM-DDTHH:mm" wall-clock string for `tz` (datetime-local input value).
export function epochToZonedWallClock(epochMs, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  }).formatToParts(new Date(epochMs));
  const p = Object.fromEntries(parts
    .filter(part => part.type !== "literal")
    .map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function formatInstant(epochMs, tz) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: tz, year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short"
  }).format(new Date(epochMs));
}

// Local-day bucket key (YYYY-MM-DD) for grouping spend/meals by day.
export function dayKey(epochMs) {
  const dt = new Date(epochMs);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}
export function dayLabel(epochMs) {
  return new Intl.DateTimeFormat(undefined,
    { weekday: "short", month: "short", day: "numeric" }).format(new Date(epochMs));
}
