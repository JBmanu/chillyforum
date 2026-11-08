// Utility di interfaccia condivise da tutte le pagine
import { AVATAR_COLORS, STORAGE_KEYS, RATING, APP } from './config.js';
import { icon, star } from './icons.js';

/* ---------- Preferenze del dispositivo ---------- */
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export const prefs = {
  get scale() { return Number(read(STORAGE_KEYS.scale, RATING.defaultScale)) === 10 ? 10 : 5; },
  set scale(v) { write(STORAGE_KEYS.scale, v); },
  get theme() { return read(STORAGE_KEYS.theme, 'system'); },
  set theme(v) { write(STORAGE_KEYS.theme, v); applyTheme(); },
  get sort() { return read(STORAGE_KEYS.sort, 'recent'); },
  set sort(v) { write(STORAGE_KEYS.sort, v); },
};

const darkMq = matchMedia('(prefers-color-scheme: dark)');
export function applyTheme() {
  const t = prefs.theme === 'system' ? (darkMq.matches ? 'dark' : 'light') : prefs.theme;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--sky-top').trim());
}
darkMq.addEventListener?.('change', () => prefs.theme === 'system' && applyTheme());

/* ---------- Testo ---------- */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf1 = new Intl.NumberFormat(APP.locale, { maximumFractionDigits: 1 });

/** Voto singolo (salvato 0–10) nella scala scelta: 5 → "3,5", 10 → "7". */
export const fmtVote = (v) => (v == null ? '–' : prefs.scale === 5 ? nf1.format(v / 2) : String(v));
/** Media (0–10) nella scala scelta, 1 decimale. */
export const fmtAvg = (a) => (a == null ? '–' : nf1.format(Math.round((prefs.scale === 5 ? a / 2 : a) * 10) / 10));
export const scaleMax = () => prefs.scale;

export function stars(v10) {
  if (v10 == null) return '';
  const v = v10 / 2;
  let out = '';
  for (let i = 1; i <= 5; i++) out += star(v >= i ? 1 : v >= i - 0.5 ? 0.5 : 0);
  return `<span class="stars" role="img" aria-label="${nf1.format(v)} stelle su 5">${out}</span>`;
}

/** Data di oggi (fuso del telefono) in formato AAAA-MM-GG. */
export const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
/** "7 nov 2026" da "2026-11-07". */
export const fmtDate = (iso) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(APP.locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'));
  const s = (Date.now() - d) / 1000;
  const rtf = new Intl.RelativeTimeFormat(APP.locale, { numeric: 'auto' });
  if (s < 60) return 'adesso';
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  if (s < 86400 * 30) return rtf.format(-Math.round(s / 86400), 'day');
  return d.toLocaleDateString(APP.locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ---------- Avatar e poster ---------- */
function hash(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
export const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
export const avatar = (p, cls = '') => {
  // L'oggetto può essere una persona, un voto (person_id) o una reazione (reactor_id)
  const id = p.person_id ?? p.reactor_id ?? p.id;
  const v = p.reactor_av ?? p.avatar_v;
  const src = `/api/people/${id}/avatar?v=${v}`;
  const photo = v && id ? `<img src="${src}" alt="" ${imgAttrs(src)} onerror="this.remove()">` : '';
  return `<span class="avatar ${cls}"${photo ? ` data-photo="/api/people/${id}/avatar?v=${v}" data-who="${esc(p.name ?? p.reactor_name)}"` : ''} style="background:${AVATAR_COLORS[hash(p.email || p.name || p.reactor_email) % AVATAR_COLORS.length]}" aria-hidden="true">${esc(initials(p.name ?? p.reactor_name))}${photo}</span>`;
};

/* Immagini già viste: al cambio pagina i tag <img> vengono ricreati. Se l'immagine è già stata caricata
   la mostriamo subito (decodifica sincrona, niente lazy) e senza dissolvenza, così non c'è nessun lampeggio. */
const seenImgs = new Set();
document.addEventListener('load', (e) => { if (e.target.tagName === 'IMG') seenImgs.add(e.target.getAttribute('src')); }, true);
const imgAttrs = (src) => (seenImgs.has(src) ? 'loading="eager" decoding="sync"' : 'loading="lazy" decoding="async" class="fresh"');

export function poster(m, extra = '') {
  const img = m.poster_url
    ? `<img src="${esc(m.poster_url)}" alt="" ${imgAttrs(m.poster_url)} onerror="this.remove()">`
    : '';
  return `<div class="poster">${img ? '' : `<div class="ph">${esc(m.title)}</div>`}${img}${extra}</div>`;
}
export const thumb = (m) =>
  `<span class="thumb">${m.poster_url || m.poster_thumb ? `<img src="${esc(m.poster_url || m.poster_thumb)}" alt="" ${imgAttrs(m.poster_url || m.poster_thumb)} onerror="this.remove()">` : ''}</span>`;

/* ---------- Toast ---------- */
export function toast(msg, { error = false, action, onAction, ms = 3200 } = {}) {
  const box = document.querySelector('.toasts');
  const el = document.createElement('div');
  el.className = `toast${error ? ' error' : ''}`;
  el.innerHTML = `${error ? '' : icon.check}<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { el.remove(); onAction?.(); };
  box.append(el);
  setTimeout(() => el.remove(), action ? ms + 2500 : ms);
}

/* ---------- Bottom sheet (dialog) ---------- */
export function sheet(title, html, { onMount } = {}) {
  const d = document.createElement('dialog');
  d.className = 'sheet';
  d.setAttribute('aria-label', title);
  d.innerHTML = `<div class="sheet-grip"></div><div class="sheet-body">
    <div class="sheet-head"><h2>${esc(title)}</h2><button class="iconbtn" data-close aria-label="Chiudi">${icon.close}</button></div>
    ${html}</div>`;
  document.body.append(d);
  const close = () => d.close();
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) close(); });
  d.showModal();
  onMount?.(d, close);
  return { el: d, close };
}

export function confirmSheet({ title, text, ok = 'Conferma', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const { el } = sheet(title, `<p class="muted">${esc(text)}</p>
      <div class="sheet-actions"><button class="btn btn-ghost" data-close>Annulla</button>
      <button class="btn ${danger ? 'btn-danger' : ''}" data-ok>${esc(ok)}</button></div>`);
    el.querySelector('[data-ok]').onclick = () => { result = true; el.close(); };
    el.addEventListener('close', () => resolve(result));
  });
}

export const skeletonGrid = (n = 6) =>
  `<div class="grid">${Array.from({ length: n }, () => '<div class="card"><div class="poster skeleton"></div><div class="skeleton" style="height:16px;width:80%"></div></div>').join('')}</div>`;

/** Anteprima grande della foto profilo (si chiude toccando o con Esc). */
export function photoPreview(src, who = '') {
  const d = document.createElement('dialog');
  d.className = 'photo-preview';
  d.setAttribute('aria-label', `Foto di ${who}`);
  d.innerHTML = `<img src="${esc(src)}" alt="Foto di ${esc(who)}"><p>${esc(who)}</p>`;
  document.body.append(d);
  d.addEventListener('click', () => d.close());
  d.addEventListener('close', () => d.remove());
  d.showModal();
}
