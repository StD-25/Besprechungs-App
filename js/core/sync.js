// OneDrive-Abgleich: Alle Daten liegen zusätzlich im App-Ordner des Nutzers
// (OneDrive → Apps/Besprechungsprotokoll): data.json mit allen Einträgen, Fotos als Dateien.
// Zusammenführen je Eintrag: der neuere Stand (_mod) gewinnt; Löschvermerke werden übernommen.
import * as db from './db.js';
import { getToken, getAccount, initAuth, isRedirectReturn, LoginRequiredError } from './auth.js';

const GRAPH = 'https://graph.microsoft.com/v1.0/me/drive/special/approot:';
const DATA_FILE = 'data.json';
const STORES = ['reports', 'points', 'photos', 'persons', 'settings'];

// Lokale Merker je Gerät (nicht abgeglichen); App-Präfix wegen gemeinsamer Herkunft std-25.github.io
const LS = (k) => `besprechungsprotokoll:sync-${k}`;
const lsGet = (k) => { try { return localStorage.getItem(LS(k)); } catch { return null; } };
const lsSet = (k, v) => { try { if (v === null) localStorage.removeItem(LS(k)); else localStorage.setItem(LS(k), v); } catch { /* egal */ } };

export const isEnabled = () => lsGet('enabled') === '1';

// ---- Status für die Anzeige ----
let state = { status: 'off', lastSync: Number(lsGet('last')) || 0, message: '', account: null };
const listeners = new Set();
export const getState = () => state;
export function onState(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); }
function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

// ---- Graph-Aufrufe ----
class HttpError extends Error {
  constructor(status, text) { super(`OneDrive meldet Fehler ${status}${text ? `: ${text}` : ''}`); this.status = status; }
}

async function graph(path, { method = 'GET', body, headers = {} } = {}) {
  const token = await getToken();
  const res = await fetch(GRAPH + path, { method, body, headers: { Authorization: `Bearer ${token}`, ...headers } });
  if (!res.ok) throw new HttpError(res.status, res.status === 404 ? '' : (await res.text()).slice(0, 200));
  return res;
}

// Datei lesen: Metadaten (eTag, Download-Adresse) und Inhalt; null, wenn es sie nicht gibt
async function readFile(name) {
  let meta;
  try {
    meta = await (await graph(`/${name}`)).json();
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
  const res = await fetch(meta['@microsoft.graph.downloadUrl']);
  if (!res.ok) throw new HttpError(res.status);
  return { eTag: meta.eTag, blob: await res.blob() };
}

// Datei schreiben; eTag: nur überschreiben, wenn sie seitdem niemand geändert hat ('*' = darf noch nicht existieren)
async function writeFile(name, blob, { eTag, contentType } = {}) {
  const headers = { 'Content-Type': contentType || blob.type || 'application/octet-stream' };
  if (eTag === '*') headers['If-None-Match'] = '*';
  else if (eTag) headers['If-Match'] = eTag;
  return (await graph(`/${name}:/content`, { method: 'PUT', body: blob, headers })).json();
}

async function deleteFile(name) {
  try {
    await graph(`/${name}`, { method: 'DELETE' });
  } catch (err) {
    if (err.status !== 404) throw err;
  }
}

// ---- Daten für data.json (ohne Fotodateien und gerätebezogene Merker) ----
const forCloud = {
  photos: ({ full, thumb, uploaded, ...meta }) => meta,
};
const tombForCloud = ({ filesDone, ...t }) => t;

async function readLocal() {
  const data = {};
  for (const s of STORES) data[s] = await db.getAll(s);
  data.tombstones = await db.getAll('tombstones');
  return data;
}

const keyOf = (s, rec) => rec[db.KEY_OF[s]];
const mod = (rec) => rec?._mod || 0;
const byKey = (s) => (a, b) => String(keyOf(s, a)).localeCompare(String(keyOf(s, b)));

// Einheitliche Form (feste Reihenfolge), damit unveränderte Daten nicht erneut hochgeladen werden
function normalize(stores = {}, tombstones = []) {
  const out = { app: 'besprechungsprotokoll', format: 1, stores: {}, tombstones: [...tombstones].sort((a, b) => a.k.localeCompare(b.k)) };
  for (const s of STORES) out.stores[s] = [...(stores[s] || [])].sort(byKey(s));
  return out;
}

// Lokal und OneDrive zusammenführen. Ergebnis: neuer Stand für OneDrive und Änderungen für lokal.
function merge(local, remote) {
  const tombs = new Map();
  for (const t of [...(remote.tombstones || []), ...local.tombstones]) {
    const prev = tombs.get(t.k);
    if (!prev || mod(t) > mod(prev)) tombs.set(t.k, t);
  }
  const cloudStores = {};
  const toPut = [];
  const toDelete = [];
  for (const s of STORES) {
    const loc = new Map(local[s].map((r) => [keyOf(s, r), r]));
    const rem = new Map((remote.stores?.[s] || []).map((r) => [keyOf(s, r), r]));
    const out = [];
    for (const key of new Set([...loc.keys(), ...rem.keys()])) {
      const l = loc.get(key);
      const r = rem.get(key);
      const winner = !l ? r : !r ? l : mod(r) > mod(l) ? r : l;
      const tomb = tombs.get(`${s}|${key}`);
      if (tomb && mod(tomb) >= mod(winner)) {
        if (l) toDelete.push({ store: s, key });
        continue;
      }
      if (tomb) tombs.delete(`${s}|${key}`); // später neu angelegt: Vermerk erledigt
      const strip = forCloud[s] || ((x) => x);
      out.push(strip(winner));
      if (winner !== l) toPut.push({ store: s, rec: winner, local: l });
    }
    cloudStores[s] = out;
  }
  const cloud = normalize(cloudStores, [...tombs.values()].map(tombForCloud));
  return { cloud, toPut, toDelete, tombs: [...tombs.values()] };
}

// Änderungen aus OneDrive lokal übernehmen, aber nur, wenn der lokale Eintrag
// sich während des Abgleichs nicht geändert hat (sonst gewinnt die neue Eingabe beim nächsten Abgleich)
async function applyLocal({ toPut, toDelete, tombs }) {
  let changes = 0;
  for (const { store, rec, local } of toPut) {
    const current = await db.get(store, keyOf(store, rec));
    if (mod(current) !== mod(local)) continue;
    // Fotodateien und Merker des Geräts behalten
    const value = store === 'photos' && current ? { ...rec, full: current.full, thumb: current.thumb, uploaded: current.uploaded } : rec;
    await db.put(store, value, { sync: true });
    changes++;
  }
  for (const { store, key } of toDelete) {
    await db.del(store, key, { sync: true });
    changes++;
  }
  const localTombs = new Map((await db.getAll('tombstones')).map((t) => [t.k, t]));
  for (const t of tombs) {
    const prev = localTombs.get(t.k);
    if (!prev || mod(t) > mod(prev)) await db.put('tombstones', { ...t, filesDone: prev?.filesDone }, { sync: true });
  }
  return changes;
}

// ---- Fotos als Dateien (fotos/<id>.jpg und fotos/<id>_t.jpg) ----
const photoPath = (id, thumb) => `fotos/${id}${thumb ? '_t' : ''}.jpg`;

async function syncPhotos() {
  let changes = 0;
  for (const ph of await db.getAll('photos')) {
    const hasBlobs = ph.full instanceof Blob && ph.thumb instanceof Blob;
    if (hasBlobs && !ph.uploaded) {
      await writeFile(photoPath(ph.id, false), ph.full, { contentType: 'image/jpeg' });
      await writeFile(photoPath(ph.id, true), ph.thumb, { contentType: 'image/jpeg' });
      await db.put('photos', { ...ph, uploaded: true }, { sync: true });
    } else if (!hasBlobs) {
      // Foto von einem anderen Gerät: Dateien holen (fehlen sie noch, beim nächsten Mal erneut versuchen)
      const full = await readFile(photoPath(ph.id, false));
      const thumb = await readFile(photoPath(ph.id, true));
      if (full && thumb) {
        await db.put('photos', { ...ph, full: full.blob, thumb: thumb.blob, uploaded: true }, { sync: true });
        changes++;
      }
    }
  }
  // Fotodateien gelöschter Fotos entfernen
  for (const t of await db.getAll('tombstones')) {
    if (t.store !== 'photos' || t.filesDone) continue;
    await deleteFile(photoPath(t.key, false));
    await deleteFile(photoPath(t.key, true));
    await db.put('tombstones', { ...t, filesDone: true }, { sync: true });
  }
  return changes;
}

// ---- Ablauf ----
let running = null;
let again = false;

async function runOnce() {
  let changes = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = await readLocal();
    const file = await readFile(DATA_FILE);
    const remote = file ? JSON.parse(await file.blob.text()) : { stores: {}, tombstones: [] };
    if (remote.app && remote.app !== 'besprechungsprotokoll') throw new Error('Im OneDrive-Ordner liegen Daten einer anderen App');
    const result = merge(local, remote);
    changes += await applyLocal(result);
    const json = JSON.stringify(result.cloud);
    const remoteJson = file ? JSON.stringify(normalize(remote.stores, remote.tombstones)) : null;
    if (json === remoteJson) break;
    try {
      await writeFile(DATA_FILE, new Blob([json], { type: 'application/json' }), { eTag: file ? file.eTag : '*' });
      break;
    } catch (err) {
      // Inzwischen von einem anderen Gerät geändert: neu lesen und erneut zusammenführen
      if (err.status !== 412 && err.status !== 409) throw err;
    }
  }
  changes += await syncPhotos();
  return changes;
}

export function syncNow() {
  if (!isEnabled()) return Promise.resolve(0);
  if (running) { again = true; return running; }
  running = (async () => {
    let total = 0;
    try {
      do {
        again = false;
        if (!navigator.onLine) { setState({ status: 'offline', message: 'Kein Internet – wird später abgeglichen' }); return total; }
        setState({ status: 'syncing', message: 'Abgleich läuft …' });
        total += await runOnce();
      } while (again);
      lsSet('last', String(Date.now()));
      setState({ status: 'ok', lastSync: Date.now(), message: '' });
      if (total) window.dispatchEvent(new CustomEvent('sync-applied', { detail: { changes: total } }));
    } catch (err) {
      console.error(err);
      if (err instanceof LoginRequiredError) setState({ status: 'login', message: 'Bitte erneut bei Microsoft anmelden' });
      else if (!navigator.onLine || err instanceof TypeError) setState({ status: 'offline', message: 'Keine Verbindung – wird später abgeglichen' });
      else setState({ status: 'error', message: err.message || String(err) });
    } finally {
      running = null;
    }
    return total;
  })();
  return running;
}

// Nach lokalen Änderungen kurz warten und dann abgleichen
let timer;
function scheduleSync(delay = 3000) {
  if (!isEnabled()) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

export async function enable() {
  lsSet('enabled', '1');
  await initAuth();
}

export async function disable() {
  lsSet('enabled', null);
  lsSet('last', null);
  setState({ status: 'off', account: null, message: '', lastSync: 0 });
}

// Beim Start aufrufen (Haupt-App und Kurznachricht)
export async function startSync() {
  if (!isEnabled() && !isRedirectReturn()) return;
  try {
    const account = await getAccount();
    if (account) lsSet('enabled', '1');
    setState({ account, status: account ? 'idle' : 'login', message: account ? '' : 'Bitte bei Microsoft anmelden' });
    if (!account) return;
  } catch (err) {
    console.error(err);
    setState({ status: navigator.onLine ? 'error' : 'offline', message: err.message || String(err) });
    return;
  }
  window.addEventListener('db-change', () => scheduleSync());
  window.addEventListener('online', () => scheduleSync(500));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - state.lastSync > 30000) scheduleSync(500);
  });
  syncNow();
}

// Direkter Dateizugriff im OneDrive-App-Ordner (z.B. für die Archiv-Ablage)
export const cloudReady = () => isEnabled() && !!state.account && navigator.onLine;
export const cloudRead = readFile;
export const cloudWrite = writeFile;
