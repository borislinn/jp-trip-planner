import { zonedWallClockToEpoch } from "../domain/datetime.js";
import { airportTimeZone } from "../domain/flights.js";

export class FlightsViewModel {
  constructor(repo) { this.repo = repo; this.flights = []; }

  async load() {
    const rows = await this.repo.getAll("flights");
    this.flights = rows.sort((a, b) => a.departureEpoch - b.departureEpoch);
  }

  async addFlight(d) {
    if (!d.flightNumber?.trim() || !d.from?.trim() || !d.to?.trim()) return false;
    const from = d.from.trim().toUpperCase();
    const to = d.to.trim().toUpperCase();
    const departureTZ = airportTimeZone(from) || d.departureTZ;
    const arrivalTZ = airportTimeZone(to) || d.arrivalTZ;
    await this.repo.put("flights", {
      ...(d.id ? { id: d.id } : {}),
      flightNumber: d.flightNumber.trim(),
      airline: d.airline?.trim() || null,
      from,
      to,
      departureEpoch: zonedWallClockToEpoch(d.departureLocal, departureTZ),
      departureTZ,
      arrivalEpoch: zonedWallClockToEpoch(d.arrivalLocal, arrivalTZ),
      arrivalTZ,
      passengers: Math.max(1, Number(d.passengers) || 1),
      departureTerminal: d.departureTerminal?.trim() || null,
      departureGate: d.departureGate?.trim() || null,
      arrivalTerminal: d.arrivalTerminal?.trim() || null,
      arrivalGate: d.arrivalGate?.trim() || null,
      note: d.note?.trim() || null
    });
    await this.load();
    return true;
  }

  async deleteFlight(id) {
    await this.repo.remove("flights", id);
    await this.load();
  }

  durationText(f) {
    const mins = Math.round((f.arrivalEpoch - f.departureEpoch) / 60000);
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }
}
