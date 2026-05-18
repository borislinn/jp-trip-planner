import { FlightsViewModel } from "../viewmodels/FlightsViewModel.js";
import { formatFlightArrival, formatFlightDeparture } from "../domain/flights.js";
import { t } from "../domain/i18n.js";
import { el, emptyAction, openSheet, field, toast, confirmDialog } from "./components.js";

const ZONES = (Intl.supportedValuesOf?.("timeZone") || [
  "Asia/Tokyo", "America/Los_Angeles", "America/New_York",
  "Europe/London", "Australia/Sydney", "UTC"
]).sort();

export async function render(root, header, repo) {
  const vm = new FlightsViewModel(repo);
  await vm.load();

  header.setTitle(t("Flights"));
  header.setActions([
    el("button", { class: "btn-text", "aria-label": t("Add flight"),
      onclick: () => addSheet() }, "＋")
  ]);

  function terminalGateLine(label, terminal, gate) {
    if (!terminal && !gate) return null;
    const parts = [];
    if (terminal) parts.push(`${t("Terminal")} ${terminal}`);
    if (gate) parts.push(`${t("Gate")} ${gate}`);
    return el("div", { class: "muted" }, `${label}: ${parts.join(" · ")}`);
  }

  function paint() {
    root.replaceChildren();
    if (!vm.flights.length) {
      root.appendChild(emptyAction(t("No flights yet."),
        t("Add Flight"), () => addSheet()));
      return;
    }
    for (const f of vm.flights) {
      root.appendChild(el("div", { class: "card" }, [
        el("div", { class: "row" }, [
          el("strong", {}, `${f.flightNumber}${f.airline ? " · " + f.airline : ""}`),
          el("button", { class: "btn-text", type: "button",
            "aria-label": `Delete flight ${f.flightNumber}`, title: "Delete flight",
            onclick: async () => {
              const ok = await confirmDialog({
                title: t("Delete flight?"),
                message: `${f.flightNumber} · ${f.from} → ${f.to}`
              });
              if (!ok) return;
              await vm.deleteFlight(f.id); paint();
            } }, "×")
        ]),
        el("div", {}, `${f.from} → ${f.to}`),
        el("div", { class: "muted" },
          `${t("Departure")}: ${formatFlightDeparture(f)}`),
        el("div", { class: "muted" },
          `${t("Arrival")}: ${formatFlightArrival(f)}`),
        terminalGateLine(t("Departure"), f.departureTerminal, f.departureGate),
        terminalGateLine(t("Arrival"), f.arrivalTerminal, f.arrivalGate)
      ]));
    }
  }

  function zoneSelect(def) {
    return el("select", {},
      ZONES.map(z => el("option",
        z === def ? { value: z, selected: "selected" } : { value: z }, z)));
  }

  function addSheet() {
    openSheet(close => {
      const localTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const num = el("input", { type: "text" });
      const air = el("input", { type: "text" });
      const from = el("input", { type: "text", placeholder: "SFO" });
      const to = el("input", { type: "text", placeholder: "HND" });
      const dep = el("input", { type: "datetime-local" });
      const depTZ = zoneSelect(localTZ);
      const arr = el("input", { type: "datetime-local" });
      const arrTZ = zoneSelect(localTZ);
      const pax = el("input", { type: "text", inputmode: "numeric",
        autocomplete: "off", value: "1" });
      const dT = el("input", { type: "text" });
      const dG = el("input", { type: "text" });
      const aT = el("input", { type: "text" });
      const aG = el("input", { type: "text" });
      const note = el("textarea", { rows: "2" });
      const error = el("div", { class: "form-error", role: "alert", hidden: "hidden" });
      const fail = message => {
        error.textContent = message;
        error.hidden = false;
      };
      return el("div", {}, [
        el("h3", {}, t("New Flight")),
        field(t("Flight number"), num), field(t("Airline"), air),
        field(t("From"), from), field(t("To"), to),
        field(t("Departure (local)"), dep), field(t("Departure time zone"), depTZ),
        field(t("Arrival (local)"), arr), field(t("Arrival time zone"), arrTZ),
        field(t("Passengers"), pax),
        field(t("Dep terminal"), dT), field(t("Dep gate"), dG),
        field(t("Arr terminal"), aT), field(t("Arr gate"), aG),
        field(t("Note"), note),
        error,
        el("button", { class: "btn-primary", onclick: async () => {
          error.hidden = true;
          if (!dep.value || !arr.value) {
            fail(t("Enter departure & arrival times."));
            return;
          }
          const ok = await vm.addFlight({
            flightNumber: num.value, airline: air.value,
            from: from.value, to: to.value,
            departureLocal: dep.value, departureTZ: depTZ.value,
            arrivalLocal: arr.value, arrivalTZ: arrTZ.value,
            passengers: pax.value,
            departureTerminal: dT.value, departureGate: dG.value,
            arrivalTerminal: aT.value, arrivalGate: aG.value, note: note.value });
          if (ok) { close(); paint(); toast(t("Flight saved")); }
          else fail(t("Flight number, from, and to are required."));
        } }, t("Save"))
      ]);
    });
  }

  paint();
}
