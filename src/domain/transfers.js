const JAPAN_TZ = "Asia/Tokyo";
const HARUKA_TO_OSAKA_MINUTES = 47;

export const ARRIVAL_TRANSFER = {
  title: "After Landing",
  summary: "KIX to Osaka",
  route: "HARUKA to Osaka Station, then local transfer",
  origin: "Kansai International Airport",
  railStation: "Kansai-Airport Station",
  railDestination: "Osaka Station",
  railService: "JR HARUKA Limited Express",
  rideService: "Uber",
  scheduleSource: "JR West official timetable",
  scheduleVerified: "2026-05-18",
  jrWestUrl: "https://www.westjr.co.jp/travel-information/en/plan-your-trip/routes-schedule/"
};

export const AIRPORT_TRANSFER = {
  destination: "Kansai International Airport",
  address: "1 Senshukukokita, Izumisano, Osaka 549-0001, Japan",
  airportBufferMinutes: 150
};

export const HARUKA_KIX_TO_OSAKA = {
  weekday: [
    "06:30", "07:27", "07:55", "08:45", "09:16", "09:46",
    "10:16", "10:46", "11:14", "11:44", "12:14", "12:44",
    "13:14", "13:44", "14:14", "14:44", "15:14", "15:44",
    "16:14", "16:44", "17:16", "17:46", "18:16", "18:46",
    "19:16", "19:46", "20:16", "20:46", "21:25", "22:16"
  ],
  weekend: [
    "06:40", "07:41", "08:08", "08:43", "09:16", "09:46",
    "10:16", "10:44", "11:14", "11:44", "12:14", "12:44",
    "13:14", "13:44", "14:14", "14:44", "15:14", "15:44",
    "16:14", "16:44", "17:14", "17:44", "18:16", "18:46",
    "19:16", "19:46", "20:16", "20:46", "21:25", "22:16"
  ]
};

const timeToMinutes = time => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = total => {
  const minutes = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:` +
    `${String(minutes % 60).padStart(2, "0")}`;
};

const japanParts = epochMs => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JAPAN_TZ,
    hourCycle: "h23",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(new Date(epochMs));
  return Object.fromEntries(parts
    .filter(part => part.type !== "literal")
    .map(part => [part.type, part.value]));
};

export function scheduleTypeForEpoch(epochMs) {
  const weekday = japanParts(epochMs).weekday;
  return weekday === "Sat" || weekday === "Sun" ? "weekend" : "weekday";
}

export function minutesAfterMidnightInJapan(epochMs) {
  const parts = japanParts(epochMs);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function harukaDeparturesForEpoch(epochMs) {
  return HARUKA_KIX_TO_OSAKA[scheduleTypeForEpoch(epochMs)];
}

export function nextHarukaDepartures(afterEpochMs, options = {}) {
  const bufferMinutes = options.bufferMinutes ?? 60;
  const count = options.count ?? 3;
  const readyMinute = minutesAfterMidnightInJapan(afterEpochMs) + bufferMinutes;
  const times = harukaDeparturesForEpoch(afterEpochMs).map(timeToMinutes);
  return times
    .filter(departure => departure >= readyMinute)
    .slice(0, count)
    .map(departure => ({
      departure: minutesToTime(departure),
      arrival: minutesToTime(departure + HARUKA_TO_OSAKA_MINUTES)
    }));
}

export function harukaScheduleRows(type = "weekend") {
  return HARUKA_KIX_TO_OSAKA[type].map(time => ({
    departure: time,
    arrival: minutesToTime(timeToMinutes(time) + HARUKA_TO_OSAKA_MINUTES)
  }));
}

export function uberHotelUrl() {
  return uberUrlFor({
    nickname: ARRIVAL_TRANSFER.railDestination,
    address: ARRIVAL_TRANSFER.railDestination
  });
}

export function uberAirportUrl() {
  return uberUrlFor({
    nickname: AIRPORT_TRANSFER.destination,
    address: AIRPORT_TRANSFER.address
  });
}

export function uberUrlFor({ nickname, address }) {
  const params = new URLSearchParams({
    action: "setPickup",
    pickup: "my_location",
    "dropoff[nickname]": nickname,
    "dropoff[formatted_address]": address
  });
  return `https://m.uber.com/ul/?${params.toString()}`;
}

export function hotelMapsUrl() {
  return "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(ARRIVAL_TRANSFER.railDestination);
}
