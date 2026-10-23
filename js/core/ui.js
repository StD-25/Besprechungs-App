// Kleine UI-Helfer (wiederverwendbar).
export const app = () => document.getElementById('app');

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function setHeader(title, backHash = null) {
  document.getElementById('title').textContent = title;
  document.title = title;
  const back = document.getElementById('back');
  back.hidden = !backHash;
  back.onclick = () => { location.hash = backHash; };
}

export function setActiveTab(name) {
  document.querySelectorAll('nav.tabbar a').forEach((a) => {
    a.classList.toggle('active', a.dataset.tab === name);
  });
}

export function toast(msg, ms = 2500) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// Rückfrage-Dialog; Bestätigen- und Abbrechen-Button weit auseinander.
export function confirmDialog(message, { ok = 'OK', cancel = 'Abbrechen', danger = false } = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="dialog" role="dialog">
        <p>${esc(message)}</p>
        <div class="action-bar">
          <button class="btn danger-outline" data-r="0">${esc(cancel)}</button>
          <button class="btn ${danger ? 'danger' : ''}" data-r="1">${esc(ok)}</button>
        </div>
      </div>`;
    ov.addEventListener('click', (e) => {
      const r = e.target.dataset?.r;
      if (r === undefined && e.target !== ov) return;
      ov.remove();
      resolve(r === '1');
    });
    document.body.appendChild(ov);
  });
}

// Auswahl mehrerer Aktionen (z.B. nach PDF-Erstellung).
export function actionDialog(message, actions) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="dialog" role="dialog">
        <p>${esc(message)}</p>
        ${actions.map((a, i) => `<button class="btn block ${a.cls || ''}" style="margin-top:10px" data-i="${i}">${esc(a.label)}</button>`).join('')}
      </div>`;
    ov.addEventListener('click', async (e) => {
      const i = e.target.dataset?.i;
      if (i === undefined) {
        if (e.target === ov) { ov.remove(); resolve(); }
        return;
      }
      const action = actions[Number(i)];
      if (action.close !== false) ov.remove();
      await action.run?.();
      if (action.close !== false) resolve();
    });
    document.body.appendChild(ov);
  });
}

export function objectURL(blob) {
  const url = URL.createObjectURL(blob);
  (window.__urls ||= []).push(url);
  return url;
}

export function releaseObjectURLs() {
  (window.__urls || []).forEach((u) => URL.revokeObjectURL(u));
  window.__urls = [];
}
