// Anpassbare Konfiguration – für weitere Programme hier Gründe/Bereiche ändern.
export const APP_NAME = 'Besprechungsprotokoll';

export const REASONS = [
  { id: 'safetywalk', label: 'Safety Walk', file: 'SafetyWalk' },
  { id: 'poolmanager', label: 'Poolmanager Besprechung', file: 'PoolmanagerBesprechung' },
  { id: 'reko', label: 'Reko Produktion', file: 'RekoProduktion' },
  { id: 'sonstige', label: 'Sonstige', file: null }, // Name wird frei eingetragen
];

const range = (prefix, from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix} ${from + i}`);

export const AREA_GROUPS = [
  { name: 'Hallen', areas: range('Halle', 1, 8) },
  { name: 'VB', areas: range('VB', 1, 17) },
  { name: 'Stationen', areas: range('Station', 1, 4) },
  { name: 'Außen', areas: ['Außenbereich', 'Parkplatz'] },
];

// Bildgrößen: Original für den Bilder-Export, Thumbnail für das PDF.
export const PHOTO_FULL = { maxPx: 1600, quality: 0.8 };
export const PHOTO_THUMB = { maxPx: 240, quality: 0.5 };
