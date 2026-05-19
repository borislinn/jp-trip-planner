export class StaysViewModel {
  constructor(repo) { this.repo = repo; this.stays = []; this.lastError = null; }

  async load() {
    const rows = await this.repo.getAll("stays");
    this.stays = rows.sort((a, b) => a.checkIn - b.checkIn);
  }

  nights(stay) {
    const ms = stay.checkOut - stay.checkIn;
    return Math.max(0, Math.round(ms / 86400000));
  }

  async addStay(d) {
    if (!d.hotelName || !d.hotelName.trim()) {
      this.lastError = "Hotel name is required."; return false;
    }
    if (!(d.checkOut >= d.checkIn)) {
      this.lastError = "Check-out must be on or after check-in."; return false;
    }
    this.lastError = null;
    await this.repo.put("stays", {
      ...(d.id ? { id: d.id } : {}),
      hotelName: d.hotelName.trim(),
      checkIn: d.checkIn, checkOut: d.checkOut,
      bookingReference: d.bookingReference?.trim() || null,
      address: d.address?.trim() || null,
      note: d.note?.trim() || null
    });
    await this.load();
    return true;
  }

  async deleteStay(id) {
    await this.repo.remove("stays", id);
    await this.load();
  }
}
