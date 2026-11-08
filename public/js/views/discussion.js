// Pagina "Discussione" di un film: messaggi del gruppo, si aggiorna da sola mentre è aperta
import { COMMENT_MAX } from '../config.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, avatar, timeAgo, toast, confirmSheet } from '../ui.js';

const POLL_MS = 8000;

export async function render(main, { me, params }) {
  const id = Number(params.id);
  let movie;
  try { movie = await api.get(`/movies/${id}`); } catch { main.innerHTML = '<div class="empty"><div class="big">🎬</div><h2>Film non trovato</h2><a class="btn" href="#/">Torna ai film</a></div>'; return; }

  main.innerHTML = `
    <div class="page-head" style="justify-content:flex-start;gap:4px;margin-bottom:6px">
      <a class="iconbtn back" href="#/film/${id}" aria-label="Torna al film">${icon.back}</a>
      <div style="min-width:0"><h1 style="font-size:1.4rem;line-height:1.15">Discussione</h1>
        <p class="faint" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(movie.title)}</p></div>
    </div>
    <div id="msgs" class="msgs" aria-live="polite"><div class="skeleton" style="height:70px"></div></div>
    <form id="composer" class="composer">
      <textarea class="textarea" name="body" rows="1" maxlength="${COMMENT_MAX}" placeholder="Scrivi un messaggio…" aria-label="Scrivi un messaggio" enterkeyhint="send"></textarea>
      <button class="btn send" type="submit" aria-label="Invia">${icon.send || '➤'}</button>
    </form>`;

  const box = main.querySelector('#msgs');
  const form = main.querySelector('#composer');
  const input = form.elements.body;
  let list = [];
  let sig = '';

  const nearBottom = () => innerHeight + scrollY >= document.documentElement.scrollHeight - 140;
  const paint = (items, { stick = false } = {}) => {
    const s = items.map((c) => c.id).join(',');
    if (s === sig) return;
    const wasBottom = nearBottom();
    sig = s; list = items;
    box.innerHTML = items.length ? items.map((c) => {
      const mine = c.person_id === me.id;
      return `<div class="msg ${mine ? 'mine' : ''}" data-id="${c.id}">
        ${mine ? '' : avatar(c)}
        <div class="bubble">
          ${mine ? '' : `<span class="msg-who">${esc(c.name)}</span>`}
          <p>${esc(c.body)}</p>
          <span class="msg-time">${timeAgo(c.created_at.includes('T') ? c.created_at : `${c.created_at.replace(' ', 'T')}Z`)}${mine || me.is_admin ? ` · <button type="button" class="msg-del" data-del="${c.id}">Elimina</button>` : ''}</span>
        </div></div>`;
    }).join('') : '<div class="empty" style="padding:24px 0"><div class="big">💬</div><p class="muted">Ancora nessun messaggio.<br>Scrivi tu il primo!</p></div>';
    if (stick || wasBottom) requestAnimationFrame(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: stick ? 'auto' : 'smooth' }));
  };

  const load = async (opts) => { try { paint(await api.get(`/movies/${id}/comments`, { fresh: true }), opts); } catch {} };
  await load({ stick: true });

  // Aggiornamento periodico, solo se la pagina è visibile (e fermo mentre scrivi un messaggio lungo non serve: è leggero)
  const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
  const onVis = () => { if (document.visibilityState === 'visible') load(); };
  document.addEventListener('visibilitychange', onVis);

  const grow = () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 140)}px`; };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(hover: hover)').matches) { e.preventDefault(); form.requestSubmit(); } });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    form.querySelector('.send').disabled = true;
    try {
      await api.post(`/movies/${id}/comments`, { body: text });
      input.value = ''; grow();
      api.invalidate(`/movies/${id}`);
      await load({ stick: true });
    } catch (err) { toast(err.message, { error: true }); }
    form.querySelector('.send').disabled = false;
    input.focus();
  });

  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    if (!(await confirmSheet({ title: 'Eliminare il messaggio?', text: 'Sparisce per tutti.', ok: 'Elimina', danger: true }))) return;
    try { await api.del(`/comments/${b.dataset.del}`); api.invalidate(`/movies/${id}`); await load(); }
    catch (err) { toast(err.message, { error: true }); }
  });

  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
}
