// "Scegli a caso": estrae un film dalla lista Da vedere di tutti, a tutto schermo.
// Non cambia nessun dato: è solo un suggerimento. Si chiude con ✕, Esc o toccando fuori.
import { GENRE_BY_ID } from './config.js';
import { esc, poster } from './ui.js';
import { emojiBlast } from './fx.js';

export function drawRandom(movies) {
  if (!movies.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const d = document.createElement('dialog');
  d.className = 'draw';
  d.setAttribute('aria-labelledby', 'draw-title');
  d.innerHTML = `
    <div class="draw-card">
      <button type="button" class="draw-close" aria-label="Chiudi">✕</button>
      <p class="draw-kicker" id="draw-kicker">🎲 Stasera si guarda…</p>
      <div class="draw-poster" aria-hidden="true"></div>
      <h2 class="draw-title" id="draw-title" aria-live="polite"></h2>
      <p class="draw-meta"></p>
      <div class="draw-actions">
        <button type="button" class="btn" data-again>🎲 Estrai un altro</button>
        <a class="btn btn-ghost" data-open href="#/">Vedi la scheda</a>
      </div>
    </div>`;
  document.body.append(d);
  const $ = (s) => d.querySelector(s);
  let last = null, timer = null;

  const show = (m, landed) => {
    $('.draw-poster').innerHTML = poster(m);
    $('.draw-title').textContent = m.title;
    if (landed) {
      const genres = m.genres.map((g) => GENRE_BY_ID[g]?.emoji).filter(Boolean).join(' ');
      $('.draw-meta').innerHTML = [m.year, m.director && esc(m.director), genres,
        m.added_by_name && `proposto da ${esc(m.added_by_name)}`, m.interest ? `🙋 ${m.interest}` : null].filter(Boolean).join(' · ');
      $('[data-open]').href = `#/film/${m.id}`;
    } else $('.draw-meta').textContent = '';
  };

  const roll = () => {
    clearTimeout(timer);
    const pool = movies.length > 1 ? movies.filter((m) => m.id !== last?.id) : movies; // niente ripetizione
    const pick = pool[Math.floor(Math.random() * pool.length)];
    last = pick;
    const card = $('.draw-card');
    const btns = d.querySelectorAll('[data-again], [data-open]');
    card.classList.remove('landed');
    if (reduce || movies.length === 1) { show(pick, true); card.classList.add('landed'); return; }
    btns.forEach((b) => b.setAttribute('aria-disabled', 'true'));
    card.classList.add('rolling'); $('#draw-kicker').textContent = '🎲 Sto estraendo…';
    // come una slot machine: scorre veloce e rallenta fino al film estratto
    const delays = [70, 70, 70, 70, 70, 70, 80, 90, 110, 140, 180, 240, 320, 420];
    let i = 0, prev = null;
    const step = () => {
      const last = i === delays.length - 1;
      let m = pick;
      if (!last) { do { m = movies[Math.floor(Math.random() * movies.length)]; } while (movies.length > 1 && (m.id === prev?.id || m.id === pick.id)); }
      prev = m; show(m, false);
      const p = $('.draw-poster'); p.classList.remove('tick'); void p.offsetWidth; p.classList.add('tick');
      navigator.vibrate?.(6);
      if (last) {
        card.classList.remove('rolling'); card.classList.add('landed');
        $('#draw-kicker').textContent = '🎬 Stasera si guarda…';
        show(pick, true);
        btns.forEach((b) => b.removeAttribute('aria-disabled'));
        emojiBlast('🍿'); navigator.vibrate?.([20, 40, 20]);
        return;
      }
      timer = setTimeout(step, delays[i++]);
    };
    step();
  };

  const close = () => { clearTimeout(timer); d.close(); };
  d.addEventListener('close', () => { clearTimeout(timer); d.remove(); });
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('.draw-close')) close(); });
  $('[data-again]').addEventListener('click', () => { if ($('.draw-card').classList.contains('rolling')) return; roll(); });
  $('[data-open]').addEventListener('click', (e) => { if ($('.draw-card').classList.contains('rolling')) e.preventDefault(); else close(); });
  d.showModal();
  roll();
}
