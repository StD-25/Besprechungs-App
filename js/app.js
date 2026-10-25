import { releaseObjectURLs, toast } from './core/ui.js';
import { registerServiceWorker } from './core/swUpdate.js';
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

// Daten vor automatischem Löschen durch den Browser schützen
navigator.storage?.persist?.();

registerServiceWorker('service-worker.js', './');
