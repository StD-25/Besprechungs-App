// Anpassbare Konfiguration – für weitere Programme hier Gründe/Bereiche ändern.
export const APP_NAME = 'Besprechungsprotokoll';

// Bei jeder Änderung zusammen mit CACHE in service-worker.js erhöhen
export const APP_VERSION = '2026-10-26.5';

export const REASONS = [
  { id: 'safetywalk', label: 'Safety Walk', file: 'SafetyWalk' },
  { id: 'poolmanager', label: 'Poolmanager Besprechung', file: 'PoolmanagerBesprechung' },
  { id: 'reko', label: 'Reko Produktion', file: 'RekoProduktion' },
  { id: 'sonstige', label: 'Sonstige', file: null }, // Name wird frei eingetragen
  // Wird nur über die Kurznachricht-App angelegt, nicht im Formular „Neuer Bericht“
  { id: 'kurznachricht', label: 'Kurznachricht', file: 'Kurznachricht', hidden: true },
];

const range = (prefix, from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix} ${from + i}`);

export const AREAS = [
  ...range('Halle', 1, 8),
  ...range('VB', 1, 17),
  ...range('Station', 1, 4),
  'Außenbereich',
  'Parkplatz',
];

// Letzte Auswahl im Bereich: freier Text
export const AREA_OTHER = 'Sonstiges';

// Bildgrößen: Original für den Bilder-Export, Thumbnail für das PDF.
export const PHOTO_FULL = { maxPx: 1600, quality: 0.8 };
export const PHOTO_THUMB = { maxPx: 240, quality: 0.5 };
