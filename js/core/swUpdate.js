// Service Worker registrieren und neue App-Versionen sofort übernehmen.
import { toast } from './ui.js';

const FLAG = 'app-updated';

export function registerServiceWorker(url, scope) {
  if (!('serviceWorker' in navigator)) return;

  // Nach dem automatischen Neuladen einmal Bescheid geben
  try {
    if (sessionStorage.getItem(FLAG)) {
      sessionStorage.removeItem(FLAG);
      setTimeout(() => toast('App wurde aktualisiert'), 300);
    }
  } catch { /* sessionStorage nicht verfügbar */ }

  // Neue Version aktiv → Seite genau einmal neu laden
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return; // erste Installation: kein Neuladen nötig
    reloading = true;
    try { sessionStorage.setItem(FLAG, '1'); } catch { /* egal */ }
    location.reload();
  });

  navigator.serviceWorker
    .register(url, { scope, updateViaCache: 'none' })
    .then((reg) => {
      // Bei jeder Rückkehr in die App nach Updates schauen
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
    })
    .catch(console.error);
}
