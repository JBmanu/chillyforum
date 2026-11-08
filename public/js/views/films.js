// Pagina "Film": elenco con ricerca, filtri per genere e ordinamento
import { GENRE_BY_ID } from '../config.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, fmtAvg, fmtDate, fmtVote, poster, prefs, skeletonGrid } from '../ui.js';

const state = { q: '', filter: 'all' };

const SORTS = {
  recent: { label: 'Visti di recente', fn: (a, b) => (b.watched_on || '').localeCompare(a.watched_on || '') || b.created_at.localeCompare(a.created_at) },
  avg: { label: 'Voto medio', fn: (a, b) => (b.avg ?? -1) - (a.avg ?? -1) || b.votes - a.votes },
  votes: { label: 'Più votati', fn: (a, b) => b.votes - a.votes || (b.avg ?? -1) - (a.avg ?? -1) },
  activity: { label: 'Ultimi votati', fn: (a, b) => (b.last_vote_at || '').localeCompare(a.last_vote_at || '') },
  title: { label: 'Titolo A–Z', fn: (a, b) => a.title.localeCompare(b.title, 'it') },
  year: { label: 'Anno di uscita', fn: (a, b) => (b.year ?? 0) - (a.year ?? 0) },
};

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function card(m) {
  const flag = m.my_vote == null
    ? '<span class="todo-flag">Da votare</span>'
    : `<span class="mine-flag" title="Il tuo voto">Tu ${fmtVote(m.my_vote)}</span>`;
  const score = m.avg == null
    ? '<span class="score none"><b class="logo-type">Nuovo</b></span>'
    : `<span class="score"><b class="logo-type">${fmtAvg(m.avg)}</b><small>/${prefs.scale}</small></span>`;
  const label = `${m.title}${m.year ? `, ${m.year}` : ''}. ${m.avg == null ? 'Nessun voto' : `Media ${fmtAvg(m.avg)} su ${prefs.scale}, ${m.votes} voti`}. ${m.my_vote == null ? 'Non hai ancora votato' : `Il tuo voto ${fmtVote(m.my_vote)}`}`;
  return `<a class="card" href="#/film/${m.id}" aria-label="${esc(label)}">
    ${poster(m, flag + score)}
    <div class="title">${esc(m.title)}</div>
    <div class="sub"><span>${fmtDate(m.watched_on)}</span><span>${m.votes} ${m.votes === 1 ? 'voto' : 'voti'}</span></div>
  </a>`;
}

export async function render(main) {
  const cached = api.peek('/movies');
  if (!cached) main.innerHTML = skeletonGrid();

  const paint = (all) => {
    const movies = all.filter((m) => m.watched_on);
    const proposals = all.length - movies.length;
    const todo = movies.filter((m) => m.my_vote == null).length;
    const genreCount = {};
    movies.forEach((m) => m.genres.forEach((g) => (genreCount[g] = (genreCount[g] || 0) + 1)));
    const genres = Object.keys(genreCount).filter((g) => GENRE_BY_ID[g]).sort((a, b) => genreCount[b] - genreCount[a]);
    if (state.filter !== 'all' && state.filter !== 'todo' && !genreCount[state.filter]) state.filter = 'all';

    const chip = (id, label, count) =>
      `<button class="chip" type="button" data-filter="${id}" aria-pressed="${state.filter === id}">${label}${count != null ? ` <span class="count">${count}</span>` : ''}</button>`;

    main.innerHTML = `
      <div class="page-head"><h1>Film visti</h1><span class="faint">${movies.length} ${movies.length === 1 ? 'film' : 'film'}</span></div>
      <div class="toolbar">
        <label class="search"><span class="sr-only">Cerca tra i film</span>${icon.search}
          <input class="input" id="q" type="search" placeholder="Cerca titolo o regista…" value="${esc(state.q)}" autocomplete="off" enterkeyhint="search"></label>
        <div class="chips scroll" role="group" aria-label="Filtra">
          ${chip('all', 'Tutti')}${chip('todo', '⭐ Da votare', todo || null)}
          ${genres.map((g) => chip(g, `${GENRE_BY_ID[g].emoji} ${GENRE_BY_ID[g].label}`)).join('')}
        </div>
        <div class="sortline"><span class="faint" id="count"></span>
          <label><span class="sr-only">Ordina per</span><select class="select" id="sort">
            ${Object.entries(SORTS).map(([k, s]) => `<option value="${k}" ${prefs.sort === k ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select></label></div>
      </div>
      <div id="list"></div>
      <a class="btn fab" href="#/aggiungi">${icon.plus}Aggiungi film</a>`;

    const list = main.querySelector('#list');
    const count = main.querySelector('#count');
    const update = () => {
      const q = norm(state.q.trim());
      let rows = movies.filter((m) =>
        (state.filter === 'all' || (state.filter === 'todo' ? m.my_vote == null : m.genres.includes(state.filter))) &&
        (!q || norm(`${m.title} ${m.year ?? ''} ${m.director ?? ''}`).includes(q)));
      rows = rows.sort(SORTS[prefs.sort]?.fn || SORTS.recent.fn);
      count.textContent = rows.length === movies.length ? '' : `${rows.length} risultati`;
      if (!movies.length) {
        list.innerHTML = `<div class="empty"><div class="big">🍿</div><h2>Ancora nessun film</h2>
          <p class="muted">Aggiungi il primo film che avete visto insieme${proposals ? `, oppure guarda i <a href="#/da-vedere">${proposals} da vedere</a>` : ''}.</p><a class="btn" href="#/aggiungi">${icon.plus}Aggiungi film</a></div>`;
      } else if (!rows.length) {
        list.innerHTML = state.filter === 'todo' && !q
          ? `<div class="empty"><div class="big">😎</div><h2>Hai votato tutto</h2><p class="muted">Sei in pari con il gruppo.</p></div>`
          : `<div class="empty"><div class="big">🔎</div><h2>Nessun film trovato</h2><p class="muted">Prova con un'altra parola o togli il filtro.</p>
             <button class="btn btn-ghost" id="reset">Mostra tutti</button></div>`;
        list.querySelector('#reset')?.addEventListener('click', () => { state.q = ''; state.filter = 'all'; paint(all); });
      } else {
        list.innerHTML = `<div class="grid">${rows.map(card).join('')}</div>`;
      }
    };
    update();

    main.querySelector('#q').addEventListener('input', (e) => { state.q = e.target.value; update(); });
    main.querySelector('#sort').addEventListener('change', (e) => { prefs.sort = e.target.value; update(); });
    main.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
      state.filter = state.filter === b.dataset.filter && b.dataset.filter !== 'all' ? 'all' : b.dataset.filter;
      main.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.filter === state.filter));
      update();
    }));
  };

  if (cached) paint(cached);
  const fresh = await api.get('/movies', { fresh: true });
  if (JSON.stringify(fresh) !== JSON.stringify(cached)) {
    const focused = document.activeElement?.id === 'q';
    paint(fresh);
    if (focused) { const q = main.querySelector('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }
}
