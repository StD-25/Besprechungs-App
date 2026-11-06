import { releaseObjectURLs, toast } from './core/ui.js';
import { registerServiceWorker } from './core/swUpdate.js';
import { startSync, syncNow, onState } from './core/sync.js';
import * as home from './views/home.js';
import * as report from './views/report.js';
import * as pointForm from './views/pointForm.js';
import * as todos from './views/todos.js';
import * as archive from './views/archive.js';
import * as settings from './views/settings.js';

const routes = [
  [/^#\/report\/([^/]+)\/point\/([^/]+)$/, (m) => pointForm.render({ id: m[1], pid: m[2] })],
  [/^#\/report\/([^/]+)$/, (m) => report.render({ id: m[1] })],
  [/^#\/todos$/, () => todos.render()],
  [/^#\/archive$/, () => archive.render()],
  [/^#\/settings$/, () => settings.render()],
  [/.*/, () => home.render()],
];

async function route() {
  releaseObjectURLs();
  document.getElementById('app').classList.remove('split');
  const hash = location.hash || '#/';
  for (const [re, handler] of routes) {
    const m = hash.match(re);
    if (m) {
      try {
        await handler(m);
      } catch (err) {
        console.error(err);
        toast('Fehler: ' + err.message, 4000);
      }
      window.scrollTo(0, 0);
      return;
    }
  }
}

// Höhen von Kopf- und Tab-Leiste für das Layout mit fester Startseite
function measureBars() {
  const root = document.documentElement.style;
  root.setProperty('--topbar-h', `${document.querySelector('header.topbar').offsetHeight}px`);
  root.setProperty('--tabbar-h', `${document.querySelector('nav.tabbar').offsetHeight}px`);
}
measureBars();
window.addEventListener('resize', measureBars);

window.addEventListener('hashchange', route);
route();

// ---- OneDrive-Abgleich ----
const SYNC_ICONS = { ok: '☁︎✓', idle: '☁︎', syncing: '⟳', offline: '☁︎✕', error: '⚠', login: '☁︎!' };
const syncBtn = document.getElementById('syncBtn');
onState((s) => {
  syncBtn.hidden = s.status === 'off';
  syncBtn.textContent = SYNC_ICONS[s.status] || '☁︎';
  syncBtn.className = `sync-btn ${s.status}`;
  syncBtn.title = s.message || (s.lastSync ? `Mit OneDrive abgeglichen ${new Date(s.lastSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'OneDrive-Abgleich');
});
syncBtn.onclick = () => {
  const s = syncBtn.className;
  if (s.includes('login') || s.includes('error')) location.hash = '#/settings';
  else syncNow();
};

// Neue Daten von OneDrive: Ansicht auffrischen, aber keine laufende Eingabe stören
window.addEventListener('sync-applied', () => {
  const editing = /\/point\//.test(location.hash) || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
    || document.querySelector('.overlay, .picker-overlay, .pdf-preview');
  if (!editing) route();
  toast('Neue Daten von OneDrive übernommen');
});

startSync();

// Daten vor automatischem Löschen durch den Browser schützen
navigator.storage?.persist?.();

registerServiceWorker('service-worker.js', './');
