import { formatInstant } from "../domain/datetime.js";
import {
  flightArrivalEpoch,
  flightArrivalTimeZone,
  flightDepartureEpoch,
  flightDepartureTimeZone,
  formatFlightArrival,
  formatFlightDeparture
} from "../domain/flights.js";
import { getLanguage, t } from "../domain/i18n.js";
import { formatCurrency } from "../domain/money.js";
import { BudgetViewModel } from "../viewmodels/BudgetViewModel.js";
import { StaysViewModel } from "../viewmodels/StaysViewModel.js";
import {
  AIRPORT_TRANSFER,
  ARRIVAL_TRANSFER,
  harukaScheduleRows,
  nextHarukaDepartures,
  scheduleTypeForEpoch,
  uberAirportUrl,
  uberUrlFor
} from "../domain/transfers.js";
import {
  el, empty, emptyAction, helpText, mapsUrl, openSheet, sectionTitle, toast
} from "./components.js";

const JAPAN_TZ = "Asia/Tokyo";
const isKix = value => /KIX|KANSAI/i.test(value || "");

export async function render(root, header, repo) {
  const staysVm = new StaysViewModel(repo);
  const budgetVm = new BudgetViewModel(repo);
  await Promise.all([staysVm.load(), budgetVm.load()]);
  const stays = staysVm.stays;
  const flights = (await repo.getAll("flights").catch(() => []))
    .sort((a, b) => a.departureEpoch - b.departureEpoch);
  const arrivalFlight = flights.find(f => isKix(`${f.to} ${f.arrivalAirport}`)) || null;
  const returnFlight = flights.find(f => isKix(`${f.from} ${f.departureAirport}`)) || null;
  const firstStay = stays[0] || null;
  const lastStay = stays[stays.length - 1] || null;
  const harukaOptions = arrivalFlight
    ? nextHarukaDepartures(flightArrivalEpoch(arrivalFlight), { bufferMinutes: 60, count: 3 })
    : [];
  const arrivalDropoff = firstStay
    ? { nickname: firstStay.hotelName, address: firstStay.address || firstStay.hotelName }
    : { nickname: ARRIVAL_TRANSFER.railDestination, address: ARRIVAL_TRANSFER.railDestination };
  let selectedDay = pickInitialDay();

  header.setTitle(t("Osaka 2026"));
  header.setActions([]);

  const openUrl = url => { window.location.href = url; };

  async function copyAddress(address) {
    try {
      await navigator.clipboard.writeText(address);
      toast(t("Address copied"));
    } catch {
      toast(t("Copy unavailable"));
    }
  }

  function japanParts(epochMs) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: JAPAN_TZ,
      weekday: "short",
      month: "2-digit",
      day: "2-digit",
      year: "numeric"
    }).formatToParts(new Date(epochMs));
    return Object.fromEntries(parts
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]));
  }

  function dayKey(epochMs) {
    const p = japanParts(epochMs);
    return `${p.year}-${p.month.padStart(2, "0")}-${p.day}`;
  }

  function addDays(key, count) {
    const date = new Date(`${key}T00:00:00+09:00`);
    date.setUTCDate(date.getUTCDate() + count);
    return dayKey(date.getTime());
  }

  function dayStartEpoch(key) {
    return new Date(`${key}T00:00:00+09:00`).getTime();
  }

  function dayName(key) {
    const parts = new Intl.DateTimeFormat(getLanguage() === "zh" ? "zh-TW" : "en-US", {
      timeZone: JAPAN_TZ,
      weekday: "short",
      month: "short",
      day: "numeric"
    }).formatToParts(new Date(dayStartEpoch(key) + 12 * 60 * 60000));
    const p = Object.fromEntries(parts
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value]));
    return { weekday: p.weekday.toUpperCase(), day: p.day, month: p.month };
  }

  function shortDate(key) {
    const p = dayName(key);
    return `${p.month} ${p.day}`;
  }

  function timeInJapan(epochMs) {
    return new Intl.DateTimeFormat(getLanguage() === "zh" ? "zh-TW" : undefined, {
      timeZone: JAPAN_TZ,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(epochMs));
  }

  function daysForTrip() {
    const times = [
      ...stays.flatMap(stay => [stay.checkIn, stay.checkOut]),
      ...flights.map(flightDisplayEpoch)
    ].filter(Number.isFinite);
    if (!times.length) return [];
    const start = dayKey(Math.min(...times));
    const end = dayKey(Math.max(...times));
    const days = [];
    for (let key = start; key <= end && days.length < 21; key = addDays(key, 1)) {
      days.push(key);
    }
    return days;
  }

  function pickInitialDay() {
    const days = daysForTrip();
    if (!days.length) return dayKey(Date.now());
    const today = dayKey(Date.now());
    return days.find(key => key >= today) || days[days.length - 1];
  }

  function targetAirportArrival(flight) {
    return flightDepartureEpoch(flight) - AIRPORT_TRANSFER.airportBufferMinutes * 60000;
  }

  function transferStep(number, title, body) {
    return el("div", { class: "transfer-step" }, [
      el("span", {}, String(number)),
      el("div", {}, [
        el("strong", {}, title),
        el("p", {}, body)
      ])
    ]);
  }

  function scheduleList(type) {
    return el("div", { class: "haruka-schedule" },
      harukaScheduleRows(type).map(row => el("div", {}, [
        el("strong", {}, row.departure),
        el("span", {}, t("Est. Osaka {time}", { time: row.arrival }))
      ])));
  }

  function flightLine(flight, direction) {
    if (!flight) return null;
    return el("div", { class: "journey-flight-line" }, [
      el("span", {}, t(direction)),
      el("strong", {}, `${flight.from} -> ${flight.to}`),
      el("span", {}, direction === "Arrive"
        ? formatFlightArrival(flight)
        : formatFlightDeparture(flight))
    ]);
  }

  function flightKind(flight) {
    if (isKix(`${flight.to} ${flight.arrivalAirport}`)) return "arrival";
    if (isKix(`${flight.from} ${flight.departureAirport}`)) return "departure";
    return "flight";
  }

  function flightDisplayEpoch(flight) {
    return flightKind(flight) === "arrival" ? flightArrivalEpoch(flight) : flightDepartureEpoch(flight);
  }

  function flightDisplayDay(flight) {
    return dayKey(flightDisplayEpoch(flight));
  }

  function flightKindLabel(flight) {
    const kind = flightKind(flight);
    if (kind === "arrival") return t("Arrival");
    if (kind === "departure") return t("Departure");
    return t("Flight");
  }

  function routeChips(items) {
    return el("div", { class: "transfer-route" },
      items.map((item, index) => index % 2
        ? el("strong", {}, item)
        : el("span", {}, item)));
  }

  function selectedFlights() {
    return flights.filter(flight => flightDisplayDay(flight) === selectedDay);
  }

  function stayForNight(key) {
    return stays.find(stay =>
      dayKey(stay.checkIn) <= key && dayKey(stay.checkOut) > key) || null;
  }

  function checkIns(key) {
    return stays.filter(stay => dayKey(stay.checkIn) === key);
  }

  function checkOuts(key) {
    return stays.filter(stay => dayKey(stay.checkOut) === key);
  }

  function arrivalCard(featured = false) {
    const primary = harukaOptions[0] || null;
    return el("section", { class: featured ? "card journey-hero" : "card transfer-card" }, [
      el("div", { class: "transfer-card__head" }, [
        el("div", {}, [
          el("span", { class: "eyebrow" }, t("Arrival Day")),
          el("h2", {}, t("KIX to Osaka"))
        ]),
        el("span", { class: "status-chip" }, t("KIX -> Hotel"))
      ]),
      flightLine(arrivalFlight, "Arrive"),
      routeChips(["KIX", "HARUKA", t("Osaka Station"), "Uber", t("Hotel")]),
      primary
        ? el("div", { class: "haruka-pick" }, [
          el("span", {}, t("After {time} arrival + 60 min", {
            time: timeInJapan(flightArrivalEpoch(arrivalFlight))
          })),
          el("strong", {}, `${primary.departure} -> ${primary.arrival}`),
          el("small", {}, `${t("Backups")}: ${harukaOptions.slice(1)
            .map(train => train.departure).join(", ") || t("Check JR West")}`)
        ])
        : el("p", { class: "transfer-note" },
          t("Add your KIX arrival flight to get recommended HARUKA departures. The static schedule is saved offline.")),
      el("div", { class: "quick-actions" }, [
        el("button", { class: "btn-primary", type: "button", onclick: arrivalSheet },
          t("View Steps")),
        el("button", { class: "btn-secondary", type: "button",
          onclick: () => openUrl(uberUrlFor(arrivalDropoff)) }, t("Open Uber"))
      ])
    ]);
  }

  function arrivalSheet() {
    const type = arrivalFlight ? scheduleTypeForEpoch(flightArrivalEpoch(arrivalFlight)) : "weekend";
    openSheet(() => el("div", { class: "transfer-sheet" }, [
      el("h3", {}, t("Arrival Playbook")),
      flightLine(arrivalFlight, "Arrive"),
      transferStep(1, t("At KIX"), t("Follow signs for JR / Kansai-Airport Station after arrivals.")),
      transferStep(2, t("Take HARUKA"), t("Take the JR HARUKA Limited Express from Kansai-Airport Station to Osaka Station.")),
      transferStep(3, t("At Osaka Station"), firstStay
        ? t("Open Uber and set your first stay as the dropoff.")
        : t("Restore or add your first stay to use its hotel address here.")),
      firstStay ? transferStep(4, t("Hotel address"), arrivalDropoff.address) : null,
      harukaOptions.length
        ? el("div", { class: "recommended-trains" }, [
          sectionTitle(t("Recommended Trains"), t("KIX -> Osaka")),
          ...harukaOptions.map((train, index) => el("div", { class: "train-row" }, [
            el("span", {}, index === 0 ? t("Pick") : t("Backup")),
            el("strong", {}, train.departure),
            el("span", {}, t("Est. arr. {time}", { time: train.arrival }))
          ]))
        ])
        : null,
      sectionTitle(type === "weekend" ? t("Weekend Schedule") : t("Weekday Schedule"), t("offline")),
      scheduleList(type),
      helpText(t("Stored from {source}. Last verified {date}. Check JR West if plans change.", {
        source: ARRIVAL_TRANSFER.scheduleSource,
        date: ARRIVAL_TRANSFER.scheduleVerified
      })),
      el("div", { class: "quick-actions" }, [
        el("button", { class: "btn-primary", type: "button",
          onclick: () => openUrl(uberUrlFor(arrivalDropoff)) }, t("Open Uber")),
        firstStay ? el("button", { class: "btn-secondary", type: "button",
          onclick: () => copyAddress(arrivalDropoff.address) }, t("Copy Address")) : null
      ]),
      el("div", { class: "quick-actions" }, [
        firstStay ? el("button", { class: "btn-secondary", type: "button",
          onclick: () => openUrl(mapsUrl(`${arrivalDropoff.nickname} ${arrivalDropoff.address}`)) }, t("Open Maps")) : null,
        el("button", { class: "btn-secondary", type: "button",
          onclick: () => openUrl(ARRIVAL_TRANSFER.jrWestUrl) }, t("Check JR West"))
      ])
    ]));
  }

  function returnCard(featured = false) {
    const target = returnFlight ? targetAirportArrival(returnFlight) : null;
    return el("section", { class: featured ? "card journey-hero" : "card transfer-card" }, [
      el("div", { class: "transfer-card__head" }, [
        el("div", {}, [
          el("span", { class: "eyebrow" }, t("Return Day")),
          el("h2", {}, t("Airport Hotel to KIX"))
        ]),
        el("span", { class: "status-chip" }, "Uber")
      ]),
      flightLine(returnFlight, "Depart"),
      routeChips([lastStay?.hotelName || t("Hotel"), "Uber", "KIX"]),
      target
        ? el("div", { class: "haruka-pick" }, [
          el("span", {}, t("Target airport arrival")),
          el("strong", {}, timeInJapan(target)),
          el("small", {}, t("Built from departure time minus {hours} hours", {
            hours: AIRPORT_TRANSFER.airportBufferMinutes / 60
          }))
        ])
        : el("p", { class: "transfer-note" },
          t("Add your KIX departure flight to calculate the target airport arrival time.")),
      el("div", { class: "quick-actions" }, [
        el("button", { class: "btn-primary", type: "button", onclick: returnSheet },
          t("View Steps")),
        el("button", { class: "btn-secondary", type: "button",
          onclick: () => openUrl(uberAirportUrl()) }, t("Open Uber"))
      ])
    ]);
  }

  function returnSheet() {
    const target = returnFlight ? targetAirportArrival(returnFlight) : null;
    openSheet(() => el("div", { class: "transfer-sheet" }, [
      el("h3", {}, t("Return Playbook")),
      flightLine(returnFlight, "Depart"),
      target ? transferStep(1, t("Airport arrival target"),
        t("Be at KIX around {time}.", { time: timeInJapan(target) })) : null,
      transferStep(2, t("Leave hotel"), t("Open Uber from {hotel} to Kansai International Airport.", {
        hotel: lastStay?.hotelName || t("hotel")
      })),
      transferStep(3, t("At KIX"), t("Head to the departure terminal, airline check-in, and security.")),
      el("div", { class: "quick-actions" }, [
        el("button", { class: "btn-primary", type: "button",
          onclick: () => openUrl(uberAirportUrl()) }, t("Open Uber")),
        el("button", { class: "btn-secondary", type: "button",
          onclick: () => copyAddress(AIRPORT_TRANSFER.address) }, t("Copy KIX Address"))
      ])
    ]));
  }

  function hotelMoveCard(fromStay, toStay, featured = false) {
    return el("section", { class: featured ? "card journey-hero" : "card journey-card" }, [
      el("div", { class: "transfer-card__head" }, [
        el("div", {}, [
          el("span", { class: "eyebrow" }, t("Hotel Move")),
          el("h2", {}, `${fromStay.hotelName} -> ${toStay.hotelName}`)
        ]),
        el("span", { class: "status-chip" }, "Uber")
      ]),
      routeChips([t("Hotel"), "Uber", t("Next Stay")]),
      el("p", { class: "transfer-note" }, toStay.address || t("Add the next hotel address.")),
      el("div", { class: "quick-actions" }, [
        el("button", { class: "btn-primary", type: "button",
          onclick: () => openUrl(uberUrlFor({
            nickname: toStay.hotelName,
            address: toStay.address || toStay.hotelName
          })) }, t("Open Uber")),
        el("button", { class: "btn-secondary", type: "button",
          onclick: () => copyAddress(toStay.address || toStay.hotelName) }, t("Copy Address"))
      ])
    ]);
  }

  function journeyItems() {
    const items = [];
    if (arrivalFlight || firstStay) {
      items.push({
        id: "arrival",
        time: arrivalFlight?.arrivalEpoch || firstStay.checkIn,
        day: dayKey(arrivalFlight?.arrivalEpoch || firstStay.checkIn),
        priority: 1,
        render: featured => arrivalCard(featured),
        label: t("Arrival from KIX")
      });
    }
    for (let i = 0; i < stays.length - 1; i++) {
      const fromStay = stays[i];
      const toStay = stays[i + 1];
      items.push({
        id: `hotel-${i}`,
        time: fromStay.checkOut,
        day: dayKey(fromStay.checkOut),
        priority: 2,
        render: featured => hotelMoveCard(fromStay, toStay, featured),
        label: t("Move hotels")
      });
    }
    if (returnFlight || lastStay) {
      items.push({
        id: "return",
        time: returnFlight?.departureEpoch || lastStay.checkOut,
        day: dayKey(returnFlight?.departureEpoch || lastStay.checkOut),
        priority: 1,
        render: featured => returnCard(featured),
        label: t("Return to KIX")
      });
    }
    return items.sort((a, b) => a.time - b.time);
  }

  function dateRail(days) {
    return el("div", { class: "date-rail", role: "tablist", "aria-label": t("Trip days") },
      days.map(key => {
        const p = dayName(key);
        return el("button", {
          class: key === selectedDay ? "date-pill is-selected" : "date-pill",
          type: "button",
          role: "tab",
          "aria-selected": String(key === selectedDay),
          onclick: () => { selectedDay = key; paint(); }
        }, [
          el("span", {}, p.weekday),
          el("strong", {}, p.day),
          el("small", {}, p.month)
        ]);
      }));
  }

  function featureTile({ icon, iconClass, kicker, title, body, action, onClick }) {
    return el("button", { class: "feature-tile", type: "button", onclick: onClick }, [
      el("span", { class: iconClass ? `tile-icon ${iconClass}` : "tile-icon" },
        iconClass ? null : icon),
      el("span", { class: "tile-kicker" }, kicker),
      el("strong", {}, title),
      body ? el("small", {}, body) : null,
      action ? el("em", {}, action) : null
    ]);
  }

  function dayHero(days) {
    const p = dayName(selectedDay);
    const stay = stayForNight(selectedDay);
    return el("section", { class: "home-hero" }, [
      el("div", { class: "home-hero__copy" }, [
        el("span", { class: "eyebrow" }, "Go Go Osaka"),
        el("h2", {}, `${p.weekday} ${p.month} ${p.day}`),
        el("p", {}, stay
          ? `${t("Tonight")}: ${stay.hotelName}`
          : t("Travel day details and quick actions in one place."))
      ]),
      dateRail(days)
    ]);
  }

  function todayPlanCard() {
    const flightsToday = selectedFlights();
    const ins = checkIns(selectedDay);
    const outs = checkOuts(selectedDay);
    const stay = stayForNight(selectedDay);
    const rows = [
      ...flightsToday.map(flight => ({
        icon: flightKind(flight) === "arrival" ? "ARR" :
          flightKind(flight) === "departure" ? "DEP" : "FLT",
        title: `${flightKindLabel(flight)}: ${flight.flightNumber}` +
          `${flight.airline ? " · " + flight.airline : ""}`,
        body: `${flight.from} -> ${flight.to}`,
        details: [
          `${t("Depart")}: ${formatInstant(flightDepartureEpoch(flight), flightDepartureTimeZone(flight))}`,
          `${t("Arrive")}: ${formatInstant(flightArrivalEpoch(flight), flightArrivalTimeZone(flight))}`
        ]
      })),
      ...outs.map(stayRow => ({
        icon: "□",
        title: `${t("Check out")}: ${stayRow.hotelName}`,
        body: shortDate(dayKey(stayRow.checkOut))
      })),
      ...ins.map(stayRow => ({
        icon: "◇",
        title: `${t("Check in")}: ${stayRow.hotelName}`,
        body: stayRow.address || stayRow.bookingReference || ""
      })),
      stay && !ins.includes(stay) ? {
        icon: "⌂",
        title: `${t("Tonight")}: ${stay.hotelName}`,
        body: stay.address || stay.bookingReference || ""
      } : null
    ].filter(Boolean);

    return el("section", { class: "card day-plan-card" }, [
      sectionTitle(t("Today"), shortDate(selectedDay)),
      rows.length
        ? el("div", { class: "day-plan-list" }, rows.map(row =>
          el("div", { class: "plan-row" }, [
            el("span", {}, row.icon),
            el("div", {}, [
              el("strong", {}, row.title),
              row.body ? el("small", {}, row.body) : null,
              row.details ? el("div", { class: "plan-details" },
                row.details.map(detail => el("small", {}, detail))) : null
            ])
          ])))
        : empty(t("No saved plans for this day yet."))
    ]);
  }

  function tileGrid() {
    const stay = stayForNight(selectedDay) || checkIns(selectedDay)[0] || lastStay;
    const flight = selectedFlights()[0] || null;
    const fmt = value => formatCurrency(value, budgetVm.settings.currencyCode);
    return el("section", { class: "tile-grid" }, [
      featureTile({
        icon: "⌖",
        kicker: t("Map"),
        title: t("Addresses"),
        body: stay?.hotelName || t("Hotels, KIX, Osaka Station"),
        action: t("Open hub"),
        onClick: mapSheet
      }),
      featureTile({
        icon: "¥",
        kicker: t("Money"),
        title: fmt(budgetVm.remaining),
        body: t("Remaining trip balance"),
        action: t("Add expense"),
        onClick: () => { location.hash = "#/food"; }
      }),
      featureTile({
        icon: "⌂",
        kicker: t("Trip"),
        title: stay?.hotelName || t("Stays & flights"),
        body: flight ? `${flight.flightNumber} · ${flight.from} -> ${flight.to}` :
          stay?.bookingReference || t("Bookings in one place"),
        action: t("Open trip"),
        onClick: () => { location.hash = "#/trip"; }
      }),
      featureTile({
        iconClass: "tile-icon--food",
        kicker: t("Restaurants"),
        title: t("Meals"),
        body: t("Track restaurants and food spend"),
        action: t("Open"),
        onClick: () => { location.hash = "#/restaurants"; }
      })
    ]);
  }

  function mapSheet() {
    const places = [
      { name: t("Kansai International Airport"), address: AIRPORT_TRANSFER.address },
      { name: t("Osaka Station"), address: "Osaka Station, Umeda, Kita Ward, Osaka, Japan" },
      ...stays.map(stay => ({ name: stay.hotelName, address: stay.address || stay.hotelName }))
    ];
    openSheet(() => el("div", { class: "transfer-sheet" }, [
      el("h3", {}, t("Map & Addresses")),
      ...places.map(place => el("div", { class: "address-row" }, [
        el("div", {}, [
          el("strong", {}, place.name),
          el("small", {}, place.address)
        ]),
        el("button", { class: "btn-text", type: "button",
          onclick: () => openUrl(mapsUrl(`${place.name} ${place.address}`)) }, t("Map")),
        el("button", { class: "btn-text", type: "button",
          onclick: () => copyAddress(place.address) }, t("Copy"))
      ]))
    ]));
  }

  function paint() {
    root.replaceChildren();
    const days = daysForTrip();
    const items = journeyItems();
    if (!days.length && !items.length) {
      root.appendChild(emptyAction(
        t("Add flights and stays to build your journey."),
        t("Open Trip"), () => { location.hash = "#/trip"; }));
      return;
    }
    if (!days.includes(selectedDay)) selectedDay = days[0] || dayKey(Date.now());
    const todaysItems = items.filter(item => item.day === selectedDay);
    const nextItem = todaysItems[0] ||
      items.find(item => item.time >= Date.now()) ||
      items[items.length - 1] ||
      null;

    root.appendChild(dayHero(days));
    if (nextItem) {
      root.appendChild(el("section", { class: "journey-next" }, [
        el("span", { class: "eyebrow" }, todaysItems.length ? t("Next Move") : t("Upcoming Move")),
        nextItem.render(true)
      ]));
    }
    root.appendChild(todayPlanCard());
    root.appendChild(tileGrid());
  }

  paint();
}
