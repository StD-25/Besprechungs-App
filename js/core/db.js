// Generischer IndexedDB-Wrapper (wiederverwendbar).
const DB_NAME = 'besprechungsprotokoll';
const DB_VERSION = 2;

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
export async function put(name, value) {
  await wrap((await store(name, 'readwrite')).put(value));
  return value;
}
export async function del(name, key) {
  return wrap((await store(name, 'readwrite')).delete(key));
}
export async function clear(name) {
  return wrap((await store(name, 'readwrite')).clear());
}
