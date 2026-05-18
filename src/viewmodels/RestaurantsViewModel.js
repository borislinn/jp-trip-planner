export const RESTAURANT_STATUSES = ["Want to go", "Reserved", "Visited"];

const clean = value => (value || "").trim();
const FALLBACK_ID = "restaurants-fallback-v1";
const newId = () =>
  (globalThis.crypto?.randomUUID?.() ??
   "restaurant-" + Date.now() + "-" + Math.random().toString(16).slice(2));

export class RestaurantsViewModel {
  constructor(repo) {
    this.repo = repo;
    this.restaurants = [];
    this.lastError = null;
    this.usesFallbackStore = false;
  }

  async load() {
    let rows;
    try {
      rows = await this.repo.getAll("restaurants");
      this.usesFallbackStore = false;
    } catch {
      const fallback = await this.repo.get("settings", FALLBACK_ID).catch(() => null);
      rows = fallback?.items || [];
      this.usesFallbackStore = true;
    }
    this.restaurants = rows.sort((a, b) => {
      const aTime = a.reservationEpoch || Number.MAX_SAFE_INTEGER;
      const bTime = b.reservationEpoch || Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return a.name.localeCompare(b.name);
    });
  }

  async addRestaurant(d) {
    const name = clean(d.name);
    if (!name) {
      this.lastError = "Restaurant name is required.";
      return false;
    }
    const status = RESTAURANT_STATUSES.includes(d.status) ? d.status : "Want to go";
    const restaurant = {
      id: d.id || newId(),
      name,
      cuisine: clean(d.cuisine) || null,
      mapUrl: clean(d.mapUrl) || null,
      area: clean(d.area) || null,
      status,
      reservationEpoch: Number.isFinite(d.reservationEpoch) ? d.reservationEpoch : null,
      notes: clean(d.notes) || null
    };
    if (this.usesFallbackStore) {
      await this.saveFallback([...this.restaurants, restaurant]);
    } else {
      try {
        await this.repo.put("restaurants", restaurant);
      } catch {
        this.usesFallbackStore = true;
        await this.saveFallback([...this.restaurants, restaurant]);
      }
    }
    this.lastError = null;
    await this.load();
    return true;
  }

  async deleteRestaurant(id) {
    if (this.usesFallbackStore) {
      await this.saveFallback(this.restaurants.filter(restaurant => restaurant.id !== id));
    } else {
      try {
        await this.repo.remove("restaurants", id);
      } catch {
        this.usesFallbackStore = true;
        await this.saveFallback(this.restaurants.filter(restaurant => restaurant.id !== id));
      }
    }
    await this.load();
  }

  async saveFallback(items) {
    await this.repo.put("settings", { id: FALLBACK_ID, items });
  }
}
