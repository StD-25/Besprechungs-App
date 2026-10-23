// Herunterladen, Teilen (E-Mail-Anhang) und ZIP-Erstellung.
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function canShareFiles() {
  try {
    const probe = new File(['x'], 'x.pdf', { type: 'application/pdf' });
    return !!(navigator.canShare && navigator.canShare({ files: [probe] }));
  } catch {
    return false;
  }
}

// Öffnet den Android-Teilen-Dialog (Gmail, Outlook …) mit der Datei als Anhang.
// Fallback: Datei herunterladen und E-Mail-Programm öffnen.
export async function shareFile(blob, filename, { title, text } = {}) {
  const file = new File([blob], filename, { type: blob.type || 'application/pdf' });
  if (canShareFiles()) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'aborted';
    }
  }
  download(blob, filename);
  const body = `${text || ''}\n\nDie Datei "${filename}" wurde heruntergeladen – bitte als Anhang hinzufügen.`;
  location.href = `mailto:?subject=${encodeURIComponent(title || filename)}&body=${encodeURIComponent(body)}`;
  return 'downloaded';
}

export async function makeZip(entries) {
  const zip = new window.JSZip();
  for (const { name, blob } of entries) zip.file(name, blob);
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}
