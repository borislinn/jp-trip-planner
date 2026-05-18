const DB_NAME = "jp-trip-planner";
const DB_VERSION = 5;
export const STORES = ["settings", "budgetEntries", "stays", "flights", "meals", "restaurants"];

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function store(db, name, mode) {
  return db.transaction(name, mode).objectStore(name);
}
export function idbGetAll(db, name) {
  return new Promise((res, rej) => {
    const r = store(db, name, "readonly").getAll();
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export function idbGet(db, name, id) {
  return new Promise((res, rej) => {
    const r = store(db, name, "readonly").get(id);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export function idbPut(db, name, value) {
  return new Promise((res, rej) => {
    const r = store(db, name, "readwrite").put(value);
    r.onsuccess = () => res(value); r.onerror = () => rej(r.error);
  });
}
export function idbDelete(db, name, id) {
  return new Promise((res, rej) => {
    const r = store(db, name, "readwrite").delete(id);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  });
}
