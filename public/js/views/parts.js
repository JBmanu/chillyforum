// Componenti riusati: modulo film, selettore voto
import { GENRES } from '../config.js';
import { esc, fmtVote, prefs, todayISO } from '../ui.js';
import { raterStar } from '../icons.js';

/* ---------- Modulo film (aggiunta e modifica) ---------- */
/** status: 'watched' | 'watchlist' mostra la scelta "Già visto / Da vedere" (aggiunta);
 *  dateOnly: mostra solo la data "Visto il" (modifica di un film già visto). */
export function movieForm(m = {}, { submitLabel = 'Salva', compact = false, status = null, dateOnly = false } = {}) {
  const sel = new Set(m.genres || []);
  const dateField = (show) => `<label class="field" data-datefield ${show ? '' : 'hidden'}><span>Visto il</span>
      <input class="input" name="watched_on" type="date" max="${todayISO()}" value="${esc(m.watched_on || todayISO())}"></label>`;
  return `<form class="form" id="movieForm" novalidate>
    ${status ? `<div class="field"><span id="slabel">Lo avete già visto?</span>
      <div class="segmented" role="group" aria-labelledby="slabel">
        <button type="button" data-status="watchlist" aria-pressed="${status === 'watchlist'}">📌 Non ancora</button>
        <button type="button" data-status="watched" aria-pressed="${status === 'watched'}">🎬 Sì, già visto</button>
      </div></div>${dateField(status === 'watched')}` : ''}
    ${dateOnly ? dateField(true) : ''}
    <label class="field"><span>Titolo *</span>
      <input class="input" name="title" required maxlength="200" value="${esc(m.title)}" autocomplete="off"></label>
    <div class="field"><span id="glabel">Generi * <span class="faint">(almeno uno)</span></span>
      <div class="chips" role="group" aria-labelledby="glabel">
        ${GENRES.map((g) => `<button type="button" class="chip" data-genre="${g.id}" aria-pressed="${sel.has(g.id)}">${g.emoji} ${g.label}</button>`).join('')}
      </div></div>
    ${compact ? '<details class="more-fields"><summary class="linkbtn">Modifica anno, regia, locandina e trama</summary><div class="form" style="margin-top:12px">' : ''}
    <div class="row2">
      <label class="field"><span>Anno</span><input class="input" name="year" inputmode="numeric" pattern="[0-9]*" maxlength="4" value="${esc(m.year ?? '')}"></label>
      <label class="field"><span>Durata (min)</span><input class="input" name="runtime" inputmode="numeric" pattern="[0-9]*" maxlength="4" value="${esc(m.runtime ?? '')}"></label>
    </div>
    <label class="field"><span>Regia</span><input class="input" name="director" maxlength="200" value="${esc(m.director)}"></label>
    <label class="field"><span>Link immagine locandina</span>
      <input class="input" name="poster_url" type="url" inputmode="url" placeholder="https://…" value="${esc(m.poster_url)}">
      <span class="faint">Incolla l'indirizzo di un'immagine trovata online (tieni premuto sull'immagine → Copia indirizzo).</span></label>
    <label class="field"><span>Trama</span><textarea class="textarea" name="overview" rows="4" maxlength="3000">${esc(m.overview)}</textarea></label>
    ${compact ? '</div></details>' : ''}
    <input type="hidden" name="original_title" value="${esc(m.original_title)}">
    <input type="hidden" name="backdrop_url" value="${esc(m.backdrop_url)}">
    <input type="hidden" name="tmdb_id" value="${esc(m.tmdb_id ?? '')}">
    <p class="faint" data-error role="alert" style="color:var(--tomato);font-weight:700"></p>
    <button class="btn btn-block" type="submit">${esc(submitLabel)}</button>
  </form>`;
}

export function bindMovieForm(form, onSubmit) {
  form.querySelectorAll('[data-genre]').forEach((b) =>
    b.addEventListener('click', () => b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true')));
  form.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
    form.querySelectorAll('[data-status]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    form.querySelector('[data-datefield]').hidden = b.dataset.status !== 'watched';
    [...form.querySelectorAll('[type=submit]'), ...document.querySelectorAll(`[type=submit][form="${form.id}"]`)]
      .forEach((x) => (x.textContent = b.dataset.status === 'watched' ? 'Aggiungi ai film visti' : 'Aggiungi ai da vedere'));
  }));
  const err = form.querySelector('[data-error]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const num = (k) => (f.get(k) ? Number(f.get(k)) : null);
    const data = {
      title: f.get('title').trim(),
      year: num('year'), runtime: num('runtime'),
      director: f.get('director').trim() || null,
      poster_url: f.get('poster_url').trim() || null,
      overview: f.get('overview').trim() || null,
      original_title: f.get('original_title') || null,
      backdrop_url: f.get('backdrop_url') || null,
      tmdb_id: num('tmdb_id'),
      genres: [...form.querySelectorAll('[data-genre][aria-pressed="true"]')].map((b) => b.dataset.genre),
    };
    const dateEl = form.elements.watched_on;
    if (dateEl) {
      const status = form.querySelector('[data-status][aria-pressed="true"]')?.dataset.status || 'watched';
      data.watched_on = status === 'watched' ? dateEl.value || todayISO() : null;
    }
    if (!data.title) { err.textContent = 'Scrivi il titolo del film.'; form.elements.title.focus(); return; }
    if (!data.genres.length) { err.textContent = 'Scegli almeno un genere.'; form.querySelector('[data-genre]').focus(); return; }
    if (data.poster_url && !/^https?:\/\//i.test(data.poster_url)) { err.textContent = 'Il link dell\'immagine deve iniziare con https://'; const d = form.querySelector('details'); if (d) d.open = true; form.elements.poster_url.focus(); return; }
    err.textContent = '';
    const btns = [...form.querySelectorAll('[type=submit]'), ...document.querySelectorAll(`[type=submit][form="${form.id}"]`)];
    btns.forEach((b) => (b.disabled = true));
    try { await onSubmit(data); } catch (ex) { err.textContent = ex.message; err.scrollIntoView({ block: 'center' }); } finally { btns.forEach((b) => (b.disabled = false)); }
  });
}

/* ---------- Selettore voto (stelle trascinabili) ----------
   Valore interno 0–10. Scala 5: 5 stelle con mezze; scala 10: 10 stelle intere. */
export function mountRater(el, value, onCommit) {
  let v = value;
  const scale = prefs.scale;
  const n = scale; // numero di stelle
  const unit = 10 / n; // punti interni per stella

  el.innerHTML = `<div class="rater">
    <div class="rater-row">
      <button type="button" class="zero-btn" aria-label="Voto zero" aria-pressed="false">0</button>
      <div class="rater-track" data-scale="${scale}" role="slider" tabindex="0"
        aria-label="Il tuo voto" aria-valuemin="0" aria-valuemax="${scale}"></div>
      <div class="rater-value" aria-hidden="true"></div>
    </div>
  </div>`;
  const track = el.querySelector('.rater-track');
  const out = el.querySelector('.rater-value');
  const zero = el.querySelector('.zero-btn');

  const paint = (x) => {
    let html = '';
    for (let i = 1; i <= n; i++) {
      const full = x != null && x >= i * unit;
      const half = x != null && !full && x >= i * unit - 1 && unit === 2;
      html += raterStar(full, half);
    }
    track.innerHTML = html;
    out.innerHTML = x == null
      ? '<small>Non hai<br>votato</small>'
      : `<span class="logo-type">${fmtVote(x)}</span><small>su ${scale}</small>`;
    zero.setAttribute('aria-pressed', x === 0);
    track.setAttribute('aria-valuenow', x == null ? 0 : scale === 5 ? x / 2 : x);
    track.setAttribute('aria-valuetext', x == null ? 'Nessun voto' : `${fmtVote(x)} su ${scale}`);
  };
  paint(v);

  const fromX = (clientX) => {
    const r = track.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.max(1, Math.ceil(frac * 10 - 1e-6));
  };
  let dragging = false, temp = null;
  track.addEventListener('pointerdown', (e) => {
    dragging = true; track.classList.add('dragging');
    track.setPointerCapture(e.pointerId);
    temp = fromX(e.clientX); paint(temp);
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const t = fromX(e.clientX);
    if (t !== temp) { temp = t; paint(temp); navigator.vibrate?.(4); }
  });
  // Animazione quando il voto viene confermato: stelle che "saltano" e piccola pioggia di emoji
  const celebrate = (x) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    track.querySelectorAll('svg.on').forEach((svg, i) => {
      svg.classList.remove('pop'); void svg.getBoundingClientRect();
      svg.style.animationDelay = `${i * 40}ms`; svg.classList.add('pop');
    });
    out.classList.remove('bump'); void out.offsetWidth; out.classList.add('bump');
    const row = el.querySelector('.rater-row');
    const emoji = x >= 8 ? '⭐' : x <= 3 ? '🍅' : '🍿';
    const count = x >= 8 ? 9 : 6;
    for (let i = 0; i < count; i++) {
      const b = document.createElement('span');
      b.className = 'burst'; b.textContent = emoji; b.setAttribute('aria-hidden', 'true');
      const ang = (-90 + (Math.random() - .5) * 140) * Math.PI / 180, dist = 50 + Math.random() * 50;
      b.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
      b.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
      b.style.setProperty('--rot', `${(Math.random() - .5) * 120}deg`);
      b.style.animationDelay = `${Math.random() * 120}ms`;
      row.append(b);
      setTimeout(() => b.remove(), 1000);
    }
    navigator.vibrate?.(x >= 8 ? [10, 30, 10] : 10);
  };
  const end = () => {
    if (!dragging) return;
    dragging = false; track.classList.remove('dragging');
    if (temp != null) {
      const changed = temp !== v;
      v = temp;
      if (changed) onCommit(v);
      celebrate(v); // anche se rimetti lo stesso voto
    }
  };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end); // se il browser interrompe il gesto, il voto scelto conta lo stesso

  zero.addEventListener('click', () => { if (v !== 0) { v = 0; paint(v); onCommit(v); celebrate(0); } });

  let kTimer;
  track.addEventListener('keydown', (e) => {
    const step = scale === 5 ? 1 : 1;
    let nv = v ?? 0;
    if (['ArrowRight', 'ArrowUp'].includes(e.key)) nv = Math.min(10, nv + step);
    else if (['ArrowLeft', 'ArrowDown'].includes(e.key)) nv = Math.max(0, nv - step);
    else if (e.key === 'Home') nv = 0;
    else if (e.key === 'End') nv = 10;
    else return;
    e.preventDefault();
    v = nv; paint(v);
    clearTimeout(kTimer); kTimer = setTimeout(() => { onCommit(v); celebrate(v); }, 500);
  });

  return { set: (x) => { v = x; paint(v); } };
}
