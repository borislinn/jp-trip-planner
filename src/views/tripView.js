import { dayLabel } from "../domain/datetime.js";
import { formatFlightArrival, formatFlightDeparture } from "../domain/flights.js";
import { t } from "../domain/i18n.js";
import { FlightsViewModel } from "../viewmodels/FlightsViewModel.js";
import { StaysViewModel } from "../viewmodels/StaysViewModel.js";
import {
  el, empty, sectionTitle, helpText, toast, confirmDialog,
  downloadJSON, pickJSONFile
} from "./components.js";
import {
  buildBackup, restoreBackup, backupFileName
} from "../domain/backup.js";

export async function render(root, header, repo) {
  const staysVm = new StaysViewModel(repo);
  const flightsVm = new FlightsViewModel(repo);
  await Promise.all([staysVm.load(), flightsVm.load()]);

  header.setTitle(t("Trip"));
  header.setActions([]);

  function stayCard(stay) {
    return el("article", { class: "trip-mini-card" }, [
      el("div", {}, [
        el("strong", {}, stay.hotelName),
        el("small", {}, `${dayLabel(stay.checkIn)} -> ${dayLabel(stay.checkOut)}`)
      ]),
      stay.bookingReference ? el("span", { class: "status-chip" }, stay.bookingReference) : null
    ]);
  }

  function flightCard(flight) {
    return el("article", { class: "trip-mini-card" }, [
      el("div", {}, [
        el("strong", {}, `${flight.flightNumber}${flight.airline ? " · " + flight.airline : ""}`),
        el("small", {}, `${flight.from} -> ${flight.to}`)
      ]),
      el("div", { class: "trip-mini-card__times" }, [
        el("small", {}, `${t("Depart")} ${formatFlightDeparture(flight)}`),
        el("small", {}, `${t("Arrive")} ${formatFlightArrival(flight)}`)
      ])
    ]);
  }

  function manageButton(label, route) {
    return el("button", {
      class: "btn-secondary",
      type: "button",
      onclick: () => { location.hash = `#/${route}`; }
    }, label);
  }

  function paint() {
    root.replaceChildren();
    root.appendChild(el("section", { class: "trip-hero" }, [
      el("span", { class: "eyebrow" }, t("Bookings")),
      el("h2", {}, t("Stays & Flights")),
      el("p", {}, t("Hotel reservations and flight details live together here."))
    ]));

    root.appendChild(el("section", { class: "card trip-section" }, [
      sectionTitle(t("Stays"), `${staysVm.stays.length} ${t("saved")}`),
      staysVm.stays.length
        ? el("div", { class: "trip-stack" }, staysVm.stays.map(stayCard))
        : empty(t("No stays yet.")),
      manageButton(t("Manage Stays"), "stays")
    ]));

    root.appendChild(el("section", { class: "card trip-section" }, [
      sectionTitle(t("Flights"), `${flightsVm.flights.length} ${t("saved")}`),
      flightsVm.flights.length
        ? el("div", { class: "trip-stack" }, flightsVm.flights.map(flightCard))
        : empty(t("No flights yet.")),
      manageButton(t("Manage Flights"), "flights")
    ]));

    root.appendChild(el("section", { class: "card trip-section" }, [
      sectionTitle(t("Backup")),
      helpText(t("Your trip data lives only on this device. Export a backup "
        + "file and keep it in Files or iCloud — you can restore it on any "
        + "device, even after reinstalling.")),
      el("div", { class: "quick-actions" }, [
        el("button", { class: "btn-primary", type: "button",
          onclick: exportBackup }, t("Export Backup")),
        el("button", { class: "btn-secondary", type: "button",
          onclick: importBackup }, t("Restore Backup"))
      ])
    ]));
  }

  async function exportBackup() {
    try {
      downloadJSON(backupFileName(), await buildBackup(repo));
      toast(t("Backup exported"));
    } catch {
      toast(t("Could not export backup"));
    }
  }

  async function importBackup() {
    let data;
    try {
      data = await pickJSONFile();
    } catch {
      toast(t("That file isn't a valid backup"));
      return;
    }
    if (!data) return;
    const ok = await confirmDialog({
      title: t("Restore from backup?"),
      message: t("This adds the backed-up flights, budget, stays and "
        + "expenses to this device. Existing entries are kept."),
      confirmLabel: t("Restore"),
      danger: false
    });
    if (!ok) return;
    try {
      await restoreBackup(repo, data);
      toast(t("Backup restored"));
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      toast(e.message || t("Could not restore backup"));
    }
  }

  paint();
}
