// db.js — thin IndexedDB wrapper for VLR Cutz Manager
const DB_NAME = "vlr_cutz_db";
const DB_VERSION = 1;
const STORES = ["services", "sales", "expenses", "customers", "settings"];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("services")) {
        db.createObjectStore("services", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("sales")) {
        const s = db.createObjectStore("sales", { keyPath: "id" });
        s.createIndex("timestamp", "timestamp");
      }
      if (!db.objectStoreNames.contains("expenses")) {
        const s = db.createObjectStore("expenses", { keyPath: "id" });
        s.createIndex("timestamp", "timestamp");
      }
      if (!db.objectStoreNames.contains("customers")) {
        db.createObjectStore("customers", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

function tx(storeName, mode = "readonly") {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  async getAll(store) {
    const os = await tx(store);
    return new Promise((resolve, reject) => {
      const req = os.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async get(store, id) {
    const os = await tx(store);
    return new Promise((resolve, reject) => {
      const req = os.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async put(store, value) {
    const os = await tx(store, "readwrite");
    return new Promise((resolve, reject) => {
      const req = os.put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(store, id) {
    const os = await tx(store, "readwrite");
    return new Promise((resolve, reject) => {
      const req = os.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },

  async clearAll() {
    const db = await openDB();
    return Promise.all(
      STORES.map(
        (name) =>
          new Promise((resolve, reject) => {
            const req = db.transaction(name, "readwrite").objectStore(name).clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          })
      )
    );
  },

  // Dump entire DB to a plain object (used for cloud backup)
  async exportAll() {
    const out = {};
    for (const name of STORES) {
      out[name] = await this.getAll(name);
    }
    out._exportedAt = new Date().toISOString();
    return out;
  },

  // Replace entire DB contents from a backup object
  async importAll(data) {
    await this.clearAll();
    for (const name of STORES) {
      if (Array.isArray(data[name])) {
        for (const item of data[name]) {
          await this.put(name, item);
        }
      }
    }
  },

  async getSetting(key, fallback = null) {
    const row = await this.get("settings", key);
    return row ? row.value : fallback;
  },

  async setSetting(key, value) {
    return this.put("settings", { key, value });
  },
};
