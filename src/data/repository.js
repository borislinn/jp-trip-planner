const newId = () =>
  (globalThis.crypto?.randomUUID?.() ??
   "id-" + Date.now() + "-" + Math.random().toString(16).slice(2));

// Browser implementation backed by IndexedDB (db.js is lazily imported so
// this module stays importable under Node for tests).
export class IndexedDBRepository {
  constructor() {
    this._dbPromise = null;
    this._idb = null;
  }
  async _db() {
    if (!this._idb) {
      const mod = await import("./db.js");
      this._idb = mod;
      this._dbPromise = this._dbPromise || mod.openDB();
    }
    return { mod: this._idb, db: await this._dbPromise };
  }
  async getAll(name) { const { mod, db } = await this._db(); return mod.idbGetAll(db, name); }
  async get(name, id) { const { mod, db } = await this._db(); return mod.idbGet(db, name, id); }
  async put(name, obj) {
    const { mod, db } = await this._db();
    const rec = obj.id ? obj : { ...obj, id: newId() };
    return mod.idbPut(db, name, rec);
  }
  async remove(name, id) { const { mod, db } = await this._db(); return mod.idbDelete(db, name, id); }
}

// Pure in-memory implementation for unit tests (no IndexedDB needed).
export class InMemoryRepository {
  constructor() { this._stores = new Map(); }
  _s(name) {
    if (!this._stores.has(name)) this._stores.set(name, new Map());
    return this._stores.get(name);
  }
  async getAll(name) { return [...this._s(name).values()].map(v => ({ ...v })); }
  async get(name, id) { const v = this._s(name).get(id); return v ? { ...v } : undefined; }
  async put(name, obj) {
    const rec = obj.id ? { ...obj } : { ...obj, id: newId() };
    this._s(name).set(rec.id, rec);
    return { ...rec };
  }
  async remove(name, id) { this._s(name).delete(id); }
}
