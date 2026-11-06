// Generischer IndexedDB-Wrapper (wiederverwendbar).
const DB_NAME = 'besprechungsprotokoll';
const DB_VERSION = 3;

let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const has = (name) => db.objectStoreNames.contains(name);
      if (!has('reports')) db.createObjectStore('reports', { keyPath: 'id' });
      if (!has('points')) {
        const points = db.createObjectStore('points', { keyPath: 'id' });
        points.createIndex('reportId', 'reportId');
      }
      // Fotos getrennt von den Berichtsdaten
      if (!has('photos')) {
        const photos = db.createObjectStore('photos', { keyPath: 'id' });
        photos.createIndex('pointId', 'pointId');
        photos.createIndex('reportId', 'reportId');
      }
      if (!has('persons')) db.createObjectStore('persons', { keyPath: 'name' });
      if (!has('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      // Gelöschte Einträge (für den OneDrive-Abgleich): k = "store|schlüssel"
      if (!has('tombstones')) db.createObjectStore('tombstones', { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function get(name, key) {
  return wrap((await store(name)).get(key));
}
export async function getAll(name) {
  return wrap((await store(name)).getAll());
}
export async function getBy(name, index, value) {
  return wrap((await store(name)).index(index).getAll(value));
}
// Schlüsselfeld je Store (für Löschvermerke)
export const KEY_OF = { reports: 'id', points: 'id', photos: 'id', persons: 'name', settings: 'key' };
const tombKey = (name, key) => `${name}|${key}`;

// Lokale Änderung melden (der OneDrive-Abgleich hört darauf)
const changed = () => { try { window.dispatchEvent(new CustomEvent('db-change')); } catch { /* kein Fenster */ } };

// Jede lokale Änderung bekommt einen Zeitstempel _mod, damit der Abgleich den neueren
// Stand erkennt. { sync: true } schreibt Daten aus dem Abgleich unverändert.
export async function put(name, value, { sync = false } = {}) {
  if (!sync && name in KEY_OF) value._mod = Date.now();
  await wrap((await store(name, 'readwrite')).put(value));
  if (!sync && name in KEY_OF) {
    await wrap((await store('tombstones', 'readwrite')).delete(tombKey(name, value[KEY_OF[name]])));
    changed();
  }
  return value;
}
export async function del(name, key, { sync = false } = {}) {
  await wrap((await store(name, 'readwrite')).delete(key));
  if (!sync && name in KEY_OF) {
    await wrap((await store('tombstones', 'readwrite')).put({ k: tombKey(name, key), store: name, key, _mod: Date.now() }));
    changed();
  }
}
export async function clear(name) {
  return wrap((await store(name, 'readwrite')).clear());
}
