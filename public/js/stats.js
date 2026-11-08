// Gusti di una persona: film e genere preferiti, calcolati dai suoi voti
import { GENRE_BY_ID } from './config.js';
import { esc, fmtAvg, fmtVote, thumb } from './ui.js';

/** Film preferito = voto più alto (a parità, il più recente: i voti arrivano già dal più recente). */
export function favoriteFilm(votes) {
  let best = null;
  for (const v of votes) if (!best || v.value > best.value) best = v;
  return best;
}

/** Genere preferito = media dei voti dati ai film di quel genere.
 *  Conta solo se ha almeno 2 film (se nessun genere ne ha 2, basta 1). A parità vince chi ha più film. */
export function favoriteGenre(votes) {
  const acc = {};
  for (const v of votes) for (const g of v.genres || []) {
    if (!GENRE_BY_ID[g]) continue;
    (acc[g] ||= { genre: g, sum: 0, n: 0 }).sum += v.value; acc[g].n += 1;
  }
  const all = Object.values(acc).map((x) => ({ ...x, avg: x.sum / x.n }));
  const eligible = all.some((x) => x.n >= 2) ? all.filter((x) => x.n >= 2) : all;
  return eligible.sort((a, b) => b.avg - a.avg || b.n - a.n)[0] || null;
}

export function tastesHTML(votes, { isMe = true } = {}) {
  if (!votes.length) return '';
  const film = favoriteFilm(votes), genre = favoriteGenre(votes);
  const g = genre && GENRE_BY_ID[genre.genre];
  return `<section class="panel tastes">
    <div class="panel-head"><h2>${isMe ? 'I tuoi gusti' : 'Gusti'}</h2></div>
    <div class="taste-grid">
      <a class="taste" href="#/film/${film.id}">
        ${thumb(film)}
        <span class="taste-text"><small>Film preferito</small><b>${esc(film.title)}</b>
          <span class="faint">voto ${fmtVote(film.value)}</span></span>
      </a>
      ${g ? `<div class="taste">
        <span class="taste-emoji" aria-hidden="true">${g.emoji}</span>
        <span class="taste-text"><small>Genere preferito</small><b>${esc(g.label)}</b>
          <span class="faint">media ${fmtAvg(genre.avg)} su ${genre.n} ${genre.n === 1 ? 'film' : 'film'}</span></span>
      </div>` : ''}
    </div></section>`;
}
