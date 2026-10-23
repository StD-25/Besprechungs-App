import { releaseObjectURLs, toast } from './core/ui.js';
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

window.addEventListener('hashchange', route);
route();

// Daten vor automatischem Löschen durch den Browser schützen
navigator.storage?.persist?.();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(console.error);
}
