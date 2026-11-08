// Pagina "Classifica": migliori, peggiori, più divisivi, filtrabili per genere
import { GENRE_BY_ID } from '../config.js';
import { api } from '../api.js';
import { esc, fmtAvg, prefs, stars, thumb, capped, limitBar, bindLimitBar } from '../ui.js';

const state = { mode: 'best', genre: 'all' };
const ORDER = ['best', 'worst', 'split', 'genre'];
const MODES = {
  best: { label: 'Migliori', hint: 'Media più alta' },
  worst: { label: 'Peggiori', hint: 'Media più bassa' },
  split: { label: 'Divisivi', hint: 'Voti più lontani tra loro (almeno 2 voti)' },
  genre: { label: 'Generi', hint: 'Media di tutti i voti ai film di ogni genere. Tocca un genere per vedere i suoi film' },
};
const spread = (m) => Math.sqrt(Math.max(0, m.avg_sq - m.avg * m.avg)) / 2; // in stelle

export async function render(main) {
  let data = [];
  let slide = '';
  const paint = (movies) => {
    data = movies;
    const voted = movies.filter((m) => m.votes > 0);
    const genres = [...new Set(voted.flatMap((m) => m.genres))].filter((g) => GENRE_BY_ID[g]);
    if (state.genre !== 'all' && !genres.includes(state.genre)) state.genre = 'all';
    let rows = voted.filter((m) => state.genre === 'all' || m.genres.includes(state.genre));
    if (state.mode === 'best') rows.sort((a, b) => b.avg - a.avg || b.votes - a.votes);
    if (state.mode === 'worst') rows.sort((a, b) => a.avg - b.avg || b.votes - a.votes);
    if (state.mode === 'split') rows = rows.filter((m) => m.votes >= 2).sort((a, b) => spread(b) - spread(a));

    // Classifica dei generi: media di tutti i voti dati ai film di quel genere
    const genreRows = state.mode !== 'genre' ? [] : genres.map((g) => {
      const fs = voted.filter((m) => m.genres.includes(g));
      const n = fs.reduce((s, m) => s + m.votes, 0);
      return { g, films: fs.length, votes: n, avg: fs.reduce((s, m) => s + m.avg * m.votes, 0) / n };
    }).sort((a, b) => b.avg - a.avg || b.films - a.films);
    const genreList = `<ol class="list">${capped(genreRows, 'ranking').map((r, i) => `<li><button type="button" class="list-item genre-row" data-pickgenre="${r.g}">
        <span class="rank ${i < 3 ? 'top' : ''}">${i + 1}</span>
        <span class="taste-emoji" aria-hidden="true">${GENRE_BY_ID[r.g].emoji}</span>
        <span class="grow"><span class="name">${esc(GENRE_BY_ID[r.g].label)}</span>
          <span class="meta">${r.films} ${r.films === 1 ? 'film' : 'film'}, ${r.votes} ${r.votes === 1 ? 'voto' : 'voti'}</span>
          <span style="display:block;font-size:.85rem">${stars(Math.round(r.avg))}</span></span>
        <span class="logo-type" style="font-size:1.7rem">${fmtAvg(r.avg)}</span>
      </button></li>`).join('')}</ol>`;

    main.innerHTML = `
      <div class="page-head"><h1>Classifica</h1></div>
      <div class="segmented" role="group" aria-label="Tipo di classifica">
        ${Object.entries(MODES).map(([k, v]) => `<button type="button" data-mode="${k}" aria-pressed="${state.mode === k}">${v.label}</button>`).join('')}
      </div>
      <p class="faint" style="margin:10px 4px">${MODES[state.mode].hint}. Scorri di lato per cambiare classifica.</p>
      ${state.mode === 'genre' ? '' : `<div class="chips scroll" role="group" aria-label="Filtra per genere" style="margin-bottom:12px">
        <button class="chip" type="button" data-g="all" aria-pressed="${state.genre === 'all'}">Tutti i generi</button>
        ${genres.map((g) => `<button class="chip" type="button" data-g="${g}" aria-pressed="${state.genre === g}">${GENRE_BY_ID[g].emoji} ${GENRE_BY_ID[g].label}</button>`).join('')}
      </div>`}
      ${limitBar('ranking', state.mode === 'genre' ? genreRows.length : rows.length)}
      <div class="panel ${slide}">
        ${state.mode === 'genre' ? (genreRows.length ? genreList : '<div class="empty"><div class="big">🎭</div><h2>Nessun genere ancora</h2><p class="muted">Votate qualche film per vedere i generi preferiti.</p></div>') : rows.length ? `<ol class="list">${rows.map((m, i) => `<li><a class="list-item" href="#/film/${m.id}">
            <span class="rank ${i < 3 ? 'top' : ''}">${i + 1}</span>${thumb(m)}
            <span class="grow"><span class="name">${esc(m.title)}</span>
              <span class="meta">${[m.year, state.mode === 'split' ? `scarto ±${spread(m).toFixed(1).replace('.', ',')}★` : `${m.votes} ${m.votes === 1 ? 'voto' : 'voti'}`].filter(Boolean).join(', ')}</span>
              <span style="display:block;font-size:.85rem">${stars(Math.round(m.avg))}</span></span>
            <span class="logo-type" style="font-size:1.7rem">${fmtAvg(m.avg)}</span>
          </a></li>`).join('')}</ol>`
        : `<div class="empty"><div class="big">🏆</div><h2>Classifica vuota</h2><p class="muted">${state.mode === 'split' ? 'Servono film con almeno 2 voti.' : 'Votate qualche film per vedere la classifica.'}</p></div>`}
      </div>
      <p class="faint" style="margin-top:10px;text-align:center">Voti su ${prefs.scale}</p>`;

    main.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
      const d = ORDER.indexOf(b.dataset.mode) - ORDER.indexOf(state.mode);
      if (!d) return;
      state.mode = b.dataset.mode; slide = d > 0 ? 'slide-next' : 'slide-prev'; paint(movies); slide = '';
    }));
    bindLimitBar(main, 'ranking', () => paint(movies));
    main.querySelectorAll('[data-pickgenre]').forEach((b) => b.addEventListener('click', () => {
      state.genre = b.dataset.pickgenre; state.mode = 'best'; slide = 'slide-prev'; paint(movies); slide = '';
    }));
    main.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => { state.genre = b.dataset.g; paint(movies); }));
  };
  // Scorri a sinistra/destra per passare tra Migliori, Peggiori e Divisivi.
  // La lista segue il dito; al rilascio esce da un lato e la nuova entra dall'altro.
  const canGo = (dir) => { const i = ORDER.indexOf(state.mode) + dir; return i >= 0 && i < ORDER.length; };
  let busy = false;
  const go = (dir) => {
    if (!canGo(dir) || busy) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const panel = main.querySelector('.panel');
    const swap = () => {
      state.mode = ORDER[ORDER.indexOf(state.mode) + dir];
      slide = reduce ? '' : dir > 0 ? 'slide-next' : 'slide-prev';
      paint(data); slide = ''; busy = false;
      navigator.vibrate?.(8);
    };
    if (!panel || reduce) return swap();
    busy = true;
    panel.style.transition = 'transform .16s ease-in, opacity .16s ease-in';
    panel.style.transform = `translateX(${dir > 0 ? -45 : 45}%)`;
    panel.style.opacity = '0';
    setTimeout(swap, 150);
  };
  let sx = 0, sy = 0, tracking = false, locked = false, panel = null;
  const onStart = (e) => {
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY; locked = false;
    // niente swipe da: bordo schermo (gesto "indietro"), fila di generi scorrevole, campi
    tracking = !busy && e.touches.length === 1 && sx > 24 && sx < innerWidth - 24
      && !e.target.closest('.chips.scroll, input, select, textarea, dialog');
    panel = tracking ? main.querySelector('.panel') : null;
  };
  const onMove = (e) => {
    if (!tracking || !panel) return;
    const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (!locked) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { tracking = false; return; }
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) locked = true; else return;
    }
    const k = canGo(dx < 0 ? 1 : -1) ? 1 : 0.2; // ai due estremi la lista "resiste"
    panel.style.transition = 'none';
    panel.style.transform = `translateX(${dx * k}px)`;
    panel.style.opacity = String(1 - Math.min(Math.abs(dx) * k, 240) / 480);
  };
  const onEnd = (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    const commit = locked && Math.abs(dx) >= 70 && Math.abs(dx) >= Math.abs(dy) * 1.5 && canGo(dx < 0 ? 1 : -1);
    if (commit) return go(dx < 0 ? 1 : -1);
    if (locked && panel) { // torna al suo posto con un piccolo rimbalzo
      panel.style.transition = 'transform .35s cubic-bezier(.34,1.56,.64,1), opacity .2s';
      panel.style.transform = ''; panel.style.opacity = '';
    }
  };
  main.style.touchAction = 'pan-y';
  main.addEventListener('touchstart', onStart, { passive: true });
  main.addEventListener('touchmove', onMove, { passive: true });
  main.addEventListener('touchend', onEnd, { passive: true });
  main.addEventListener('touchcancel', onEnd, { passive: true });
  const stop = () => {
    main.style.touchAction = '';
    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((n, i) => main.removeEventListener(n, [onStart, onMove, onEnd, onEnd][i]));
  };

  const cached = api.peek('/movies');
  if (cached) paint(cached); else main.innerHTML = '<div class="skeleton" style="height:300px;margin-top:12px"></div>';
  const fresh = await api.get('/movies', { fresh: true });
  if (JSON.stringify(fresh) !== JSON.stringify(cached)) paint(fresh);
  return stop;
}
