// Offline-Cache. Bei Änderungen an der App die Versionsnummer erhöhen
// (zusammen mit APP_VERSION in js/config.js).
const CACHE = 'besprechungsprotokoll-v17';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/kurz-192.png', 'icons/kurz-512.png',
  'kurz/', 'kurz/index.html', 'kurz/kurz.js', 'kurz/manifest.webmanifest',
  'vendor/jspdf.umd.min.js', 'vendor/jspdf.plugin.autotable.min.js', 'vendor/jszip.min.js', 'vendor/pdf.min.js', 'vendor/pdf.worker.min.js',
  'js/app.js', 'js/config.js', 'js/model.js', 'js/export.js',
  'js/core/db.js', 'js/core/image.js', 'js/core/filename.js', 'js/core/share.js', 'js/core/pdf.js', 'js/core/ui.js', 'js/core/personPicker.js', 'js/core/areaPicker.js', 'js/core/pdfPreview.js', 'js/core/picker.js', 'js/core/listEditor.js', 'js/core/swUpdate.js',
  'js/views/home.js', 'js/views/report.js', 'js/views/pointForm.js', 'js/views/todos.js',
  'js/views/archive.js', 'js/views/settings.js',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' – frische Dateien vom Server, nicht aus dem HTTP-Cache des Browsers
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Netz zuerst (damit Updates ankommen), sonst Cache.
// cache: 'no-cache' – beim Server nachfragen statt bis zu 10 Min. alte Dateien
// aus dem HTTP-Cache zu nehmen (unveränderte Dateien kommen schnell per 304).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const sameOrigin = new URL(e.request.url).origin === self.location.origin;
  e.respondWith(
    fetch(sameOrigin ? new Request(e.request, { cache: 'no-cache' }) : e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
