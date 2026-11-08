// Pagina "Classifica": migliori, peggiori, più divisivi, filtrabili per genere
import { GENRE_BY_ID } from '../config.js';
import { api } from '../api.js';
import { esc, fmtAvg, prefs, stars, thumb } from '../ui.js';

const state = { mode: 'best', genre: 'all' };
const ORDER = ['best', 'worst', 'split'];
const MODES = {
  best: { label: 'Migliori', hint: 'Media più alta' },
  worst: { label: 'Peggiori', hint: 'Media più bassa' },
  split: { label: 'Divisivi', hint: 'Voti più lontani tra loro (almeno 2 voti)' },
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

    main.innerHTML = `
      <div class="page-head"><h1>Classifica</h1></div>
      <div class="segmented" role="group" aria-label="Tipo di classifica">
        ${Object.entries(MODES).map(([k, v]) => `<button type="button" data-mode="${k}" aria-pressed="${state.mode === k}">${v.label}</button>`).join('')}
      </div>
      <p class="faint" style="margin:10px 4px">${MODES[state.mode].hint}. Scorri di lato per cambiare classifica.</p>
      <div class="chips scroll" role="group" aria-label="Filtra per genere" style="margin-bottom:12px">
        <button class="chip" type="button" data-g="all" aria-pressed="${state.genre === 'all'}">Tutti i generi</button>
        ${genres.map((g) => `<button class="chip" type="button" data-g="${g}" aria-pressed="${state.genre === g}">${GENRE_BY_ID[g].emoji} ${GENRE_BY_ID[g].label}</button>`).join('')}
      </div>
      <div class="panel ${slide}">
        ${rows.length ? `<ol class="list">${rows.map((m, i) => `<li><a class="list-item" href="#/film/${m.id}">
            <span class="rank ${i < 3 ? 'top' : ''}">${i + 1}</span>${thumb(m)}
            <span class="grow"><span class="name">${esc(m.title)}</span>
              <span class="meta">${[m.year, state.mode === 'split' ? `scarto ±${spread(m).toFixed(1).replace('.', ',')}★` : `${m.votes} ${m.votes === 1 ? 'voto' : 'voti'}`].filter(Boolean).join(', ')}</span>
              <span style="display:block;font-size:.85rem">${stars(Math.round(m.avg))}</span></span>
            <span class="logo-type" style="font-size:1.7rem">${fmtAvg(m.avg)}</span>
          </a></li>`).join('')}</ol>`
        : `<div class="empty"><div class="big">🏆</div><h2>Classifica vuota</h2><p class="muted">${state.mode === 'split' ? 'Servono film con almeno 2 voti.' : 'Votate qualche film per vedere la classifica.'}</p></div>`}
      </div>
      <p class="faint" style="margin-top:10px;text-align:center">Voti su ${prefs.scale}</p>`;

    main.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { state.mode = b.dataset.mode; paint(movies); }));
    main.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => { state.genre = b.dataset.g; paint(movies); }));
  };
  // Scorri a sinistra/destra per passare tra Migliori, Peggiori e Divisivi
  const go = (dir) => {
    const i = ORDER.indexOf(state.mode) + dir;
    if (i < 0 || i >= ORDER.length) return;
    state.mode = ORDER[i];
    slide = dir > 0 ? 'slide-next' : 'slide-prev';
    paint(data);
    slide = '';
    navigator.vibrate?.(8);
  };
  let sx = 0, sy = 0, tracking = false;
  const onStart = (e) => {
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY;
    // niente swipe da: bordo schermo (gesto "indietro"), fila di generi scorrevole, campi
    tracking = e.touches.length === 1 && sx > 24 && sx < innerWidth - 24
      && !e.target.closest('.chips.scroll, input, select, textarea, dialog');
  };
  const onEnd = (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(dx < 0 ? 1 : -1);
  };
  main.addEventListener('touchstart', onStart, { passive: true });
  main.addEventListener('touchend', onEnd, { passive: true });
  const stop = () => { main.removeEventListener('touchstart', onStart); main.removeEventListener('touchend', onEnd); };

  const cached = api.peek('/movies');
  if (cached) paint(cached); else main.innerHTML = '<div class="skeleton" style="height:300px;margin-top:12px"></div>';
  const fresh = await api.get('/movies', { fresh: true });
  if (JSON.stringify(fresh) !== JSON.stringify(cached)) paint(fresh);
  return stop;
}
