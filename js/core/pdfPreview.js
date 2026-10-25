// PDF-Vorschau im Vollbild. Chrome auf Android zeigt PDFs nicht in <iframe>/<embed>,
// deshalb werden die Seiten mit PDF.js auf Canvas gezeichnet.
import { esc } from './ui.js';

const LIB_URL = new URL('../../vendor/pdf.min.js', import.meta.url).href;
const WORKER_URL = new URL('../../vendor/pdf.worker.min.js', import.meta.url).href;

let libPromise;

// PDF.js erst bei Bedarf laden, damit der App-Start schnell bleibt
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  libPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LIB_URL;
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;
      resolve(window.pdfjsLib);
    };
    s.onerror = () => { libPromise = null; reject(new Error('PDF.js konnte nicht geladen werden')); };
    document.head.appendChild(s);
  });
  return libPromise;
}

async function renderPages(blob, container) {
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
  container.innerHTML = '';
  const ratio = window.devicePixelRatio || 1;
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const width = container.clientWidth - 24;
    const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * ratio });
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-page';
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / ratio}px`;
    container.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  }
}

/**
 * Zeigt das PDF mit Aktions-Buttons. Löst auf, sobald die Vorschau geschlossen wird.
 * actions: [{ label, cls?, run?, close? }] – close: false lässt die Vorschau offen.
 */
export function showPdfPreview({ blob, filename, actions }) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'pdf-preview';
    ov.innerHTML = `
      <div class="pdf-head">
        <div class="pdf-name">${esc(filename)}</div>
        <div class="pdf-size">${Math.max(1, Math.round(blob.size / 1024))} KB</div>
      </div>
      <div class="pdf-pages"><p class="empty">Vorschau wird geladen …</p></div>
      <div class="pdf-actions">
        ${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}
      </div>`;
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';

    const close = () => {
      ov.remove();
      document.body.style.overflow = '';
      resolve();
    };

    ov.querySelector('.pdf-actions').addEventListener('click', async (e) => {
      const i = e.target.closest('button')?.dataset.i;
      if (i === undefined) return;
      const action = actions[Number(i)];
      await action.run?.();
      if (action.close !== false) close();
    });

    const pages = ov.querySelector('.pdf-pages');
    renderPages(blob, pages).catch((err) => {
      console.error(err);
      pages.innerHTML = '<p class="empty">Vorschau nicht verfügbar – das PDF kann trotzdem gespeichert oder gesendet werden.</p>';
    });
  });
}
