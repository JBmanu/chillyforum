// Pagina "Da vedere": film proposti, ordinati per quante persone li vogliono vedere
import { GENRE_BY_ID } from '../config.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, thumb, toast } from '../ui.js';

const state = { by: 'all' }; // filtro "Proposto da"

export async function render(main, { me }) {
  const paint = (movies) => {
    const all = movies.filter((m) => !m.watched_on);
    // Chi ha proposte in lista (con quante), chi ne ha di più per primo
    const counts = new Map();
    for (const m of all) if (m.added_by) counts.set(m.added_by, { name: m.added_by_name, n: (counts.get(m.added_by)?.n || 0) + 1 });
    if (state.by !== 'all' && !counts.has(Number(state.by))) state.by = 'all';
    const proposers = [...counts].sort((a, b) => b[1].n - a[1].n || a[1].name.localeCompare(b[1].name));
    const list = all.filter((m) => state.by === 'all' || m.added_by === Number(state.by))
      .sort((a, b) => b.interest - a.interest || a.created_at.localeCompare(b.created_at));
    const top = list[0]?.interest ? list[0] : null;

    main.innerHTML = `
      <div class="page-head"><h1>Da vedere</h1><span class="faint">${list.length} ${list.length === 1 ? 'proposta' : 'proposte'}</span></div>
      ${proposers.length > 1 ? `<div class="chips scroll" role="group" aria-label="Proposto da" style="margin-bottom:12px">
        <button class="chip" type="button" data-by="all" aria-pressed="${state.by === 'all'}">Tutti <span class="count">${all.length}</span></button>
        ${proposers.map(([id, x]) => `<button class="chip" type="button" data-by="${id}" aria-pressed="${state.by === String(id)}">${esc(id === me.id ? 'Tue' : x.name)} <span class="count">${x.n}</span></button>`).join('')}
      </div>` : ''}
      ${list.length ? `
        <p class="muted" style="margin:-4px 4px 14px">Tocca 🙋 sui film che vuoi vedere: in cima c'è il più richiesto.</p>
        <div class="panel"><ol class="list">${list.map((m, i) => `<li><div class="list-item">
          <a href="#/film/${m.id}" style="display:contents;color:inherit">
            ${thumb(m)}
            <span class="grow"><span class="name">${top && m.id === top.id ? '👑 ' : ''}${esc(m.title)}</span>
              <span class="meta">${[m.year, m.director].filter(Boolean).map(esc).join(', ')}</span>
              <span class="meta">${m.genres.map((g) => GENRE_BY_ID[g]?.emoji).filter(Boolean).join(' ')}${m.added_by_name ? `${m.genres.length ? ' · ' : ''}proposto da ${esc(m.added_by === me.id ? 'te' : m.added_by_name)}` : ''}</span></span>
          </a>
          <button type="button" class="want" data-want="${m.id}" aria-pressed="${Boolean(m.my_interest)}"
            aria-label="${m.my_interest ? 'Non voglio più vederlo' : 'Lo voglio vedere'}: ${esc(m.title)}, ${m.interest} ${m.interest === 1 ? 'persona' : 'persone'}">
            <span aria-hidden="true">🙋</span><b>${m.interest}</b></button>
        </div></li>`).join('')}</ol></div>`
      : state.by !== 'all' ? `<div class="empty"><div class="big">📌</div><h2>Nessuna proposta</h2><p class="muted">Questa persona non ha film in attesa.</p></div>`
      : `<div class="empty"><div class="big">📌</div><h2>Nessun film da vedere</h2>
          <p class="muted">Proponi un film per la prossima serata: gli altri potranno dire se lo vogliono vedere.</p></div>`}
      <a class="btn fab" href="#/aggiungi/da-vedere">${icon.plus}Proponi film</a>`;

    main.querySelectorAll('[data-by]').forEach((b) => b.addEventListener('click', () => { state.by = b.dataset.by; paint(movies); }));
    main.querySelectorAll('[data-want]').forEach((b) => b.addEventListener('click', async () => {
      const id = Number(b.dataset.want);
      const m = movies.find((x) => x.id === id);
      m.my_interest = m.my_interest ? 0 : 1;
      m.interest += m.my_interest ? 1 : -1;
      paint(movies); // risposta immediata
      try {
        await api.post(`/movies/${id}/interest`);
        api.invalidate(`/movies/${id}`);
        api.set('/movies', movies);
      } catch (e) { toast(e.message, { error: true }); api.invalidate('/movies'); render(main); }
    }));
  };

  const cached = api.peek('/movies');
  if (cached) paint(cached); else main.innerHTML = '<div class="skeleton" style="height:300px;margin-top:12px"></div>';
  const fresh = await api.get('/movies', { fresh: true });
  if (JSON.stringify(fresh) !== JSON.stringify(cached)) paint(fresh);
}
