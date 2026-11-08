// Pagina del singolo film: info, voto medio, il tuo voto + nota, voti del gruppo con reazioni
import { GENRE_BY_ID, REACTIONS, REACTION_GROUPS, REACTIONS_DEFAULT, NOTE_MAX } from '../config.js';
import { emojiBlast } from '../fx.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, fmtAvg, fmtVote, fmtDate, poster, prefs, avatar, timeAgo, toast, sheet, confirmSheet, todayISO } from '../ui.js';
import { mountRater, movieForm, bindMovieForm } from './parts.js';

const runtime = (min) => (min ? (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''}` : `${min} min`).trim() : null);

function distribution(votes) {
  // 5 fasce: in scala 5 = stelle (½ arrotondato su), in scala 10 = coppie di punti
  const rows = [5, 4, 3, 2, 1].map((b) => ({ b, n: votes.filter((v) => Math.max(1, Math.ceil(v.value / 2)) === b).length }));
  const max = Math.max(1, ...rows.map((r) => r.n));
  const label = (b) => (prefs.scale === 5 ? `${b}★` : `${b * 2 - 1}–${b * 2}`);
  return `<div class="dist" aria-hidden="true">${rows.map((r) =>
    `<div class="dist-row"><span>${label(r.b)}</span><span class="dist-bar"><i style="width:${(r.n / max) * 100}%"></i></span><span>${r.n}</span></div>`).join('')}</div>`;
}

function groupPanel(m) {
  const n = m.votes.length;
  return `<section class="panel" aria-labelledby="h-avg">
    <h2 class="sr-only" id="h-avg">Voto del gruppo</h2>
    ${n ? `<div class="big-score">
      <div><span class="logo-type">${fmtAvg(m.avg)}</span><span class="of">/${prefs.scale}</span>
        <div class="faint">media di ${n} ${n === 1 ? 'voto' : 'voti'}</div></div>
      ${distribution(m.votes)}
    </div>` : '<p class="muted">🍿 Ancora nessun voto: dai il primo qui sotto.</p>'}
  </section>`;
}

// Ultime emoji usate (solo su questo telefono)
const recents = () => {
  try { const r = JSON.parse(localStorage.getItem('chilly.recentReactions') || '[]').filter((e) => REACTIONS.includes(e)); return [...new Set([...r, ...REACTIONS_DEFAULT])].slice(0, 5); }
  catch { return REACTIONS_DEFAULT; }
};
const rememberReaction = (emoji) => {
  try { localStorage.setItem('chilly.recentReactions', JSON.stringify([emoji, ...recents().filter((e) => e !== emoji)].slice(0, 5))); } catch {}
};
const pickerHTML = (mine, all) => all
  ? REACTION_GROUPS.map((g) => `<div class="picker-group"><span class="picker-label">${g.label}</span><div class="picker-row">${g.list.map((r) => `<button type="button" data-react="${r}" aria-pressed="${mine.has(r)}">${r}</button>`).join('')}</div></div>`).join('')
  : `<div class="picker-row">${recents().map((r) => `<button type="button" data-react="${r}" aria-pressed="${mine.has(r)}">${r}</button>`).join('')}<button type="button" class="picker-more" data-more aria-label="Mostra tutte le emoji">＋</button></div>`;

function discussionLink(m) {
  const n = m.comments_count || 0;
  return `<a class="panel disc-link" href="#/film/${m.id}/discussione">
    <span class="disc-ico" aria-hidden="true">💬</span>
    <span class="grow"><b>Discussione</b>${n ? ` <span class="faint">(${n})</span>` : ''}
      <span class="meta">${n ? `${esc(m.last_comment_name)}: ${esc(m.last_comment_body)}` : 'Nessun messaggio: scrivi tu il primo'}</span></span>
    <span aria-hidden="true">›</span></a>`;
}

function reactionsHTML(v, me) {
  const groups = {};
  v.reactions.forEach((r) => (groups[r.emoji] ||= []).push(r));
  const own = v.person_id === me.id;
  const chips = Object.entries(groups).map(([emoji, rs]) => {
    const mine = rs.some((r) => r.reactor_id === me.id);
    const names = rs.map((r) => r.reactor_name).join(', ');
    return `<button type="button" class="react" data-emoji="${emoji}" aria-pressed="${mine}" ${own ? 'disabled' : ''}
      aria-label="${emoji} da ${esc(names)}${own ? '' : mine ? '. Tocca per togliere la tua' : '. Tocca per aggiungere la tua'}" title="${esc(names)}">
      <span>${emoji}</span><span class="faces">${rs.slice(0, 3).map((r) => avatar(r)).join('')}</span>${rs.length > 3 ? `<b>+${rs.length - 3}</b>` : ''}</button>`;
  }).join('');
  const add = own ? '' : `<button type="button" class="react react-add" data-pick aria-expanded="false" aria-label="Aggiungi una reazione al voto di ${esc(v.name)}">${icon.smile}<b class="plus" aria-hidden="true">+</b></button>`;
  return chips + add;
}

function watchlistPanel(m) {
  const n = m.interests.length;
  return `<section class="panel" aria-labelledby="h-want">
    <div class="panel-head"><h2 id="h-want" style="white-space:nowrap">Da vedere</h2>
      <button type="button" class="want" id="want" aria-pressed="${m.my_interest}">
        <span aria-hidden="true">🙋</span>${m.my_interest ? 'Voglio vederlo' : 'Anch\'io'}</button></div>
    <p class="muted" style="margin-bottom:10px">${n ? `${n === 1 ? 'Lo vuole' : 'Lo vogliono'} vedere:` : 'Ancora nessuno ha detto di volerlo vedere.'}</p>
    ${n ? `<div class="faces-row">${m.interests.map((p) => `<span class="person">${avatar(p)}${esc(p.name)}</span>`).join('')}</div>` : ''}
    <div class="watch-actions">
      <label class="field"><span>L'avete visto? Quando</span>
        <input class="input" type="date" id="watchedDate" value="${todayISO()}" max="${todayISO()}"></label>
      <button type="button" class="btn" id="markWatched">${icon.check}Visto</button>
    </div>
  </section>`;
}

function votesPanel(m, me) {
  if (!m.votes.length) return '';
  return `<section class="panel" aria-labelledby="h-votes">
    <div class="panel-head"><h2 id="h-votes">Voti del gruppo</h2><span class="faint">${m.votes.length}</span></div>
    <ul class="vote-list">${m.votes.map((v) => `
      <li class="vote-item" data-voter="${v.person_id}">
        ${avatar(v)}
        <div><a class="who" href="#/persone/${v.person_id}" style="color:inherit;text-decoration:none">${esc(v.person_id === me.id ? 'Tu' : v.name)}</a>
          <div class="when">${timeAgo(v.updated_at)}</div></div>
        <div class="vote-val"><span class="logo-type">${fmtVote(v.value)}</span></div>
        ${v.note ? `<p class="note">${esc(v.note)}</p>` : ''}
        <div class="reacts">${reactionsHTML(v, me)}</div>
      </li>`).join('')}</ul>
  </section>`;
}

export async function render(main, { me, params }) {
  const id = Number(params.id);
  const path = `/movies/${id}`;
  let m = api.peek(path);
  if (!m) main.innerHTML = '<div class="skeleton" style="height:220px;margin-top:12px"></div><div class="skeleton" style="height:120px;margin-top:16px"></div>';
  try { m = await api.get(path, { fresh: true }); } catch (e) {
    if (e.status === 404) {
      main.innerHTML = `<div class="empty"><div class="big">🎬</div><h2>Film non trovato</h2><p class="muted">Forse è stato eliminato.</p><a class="btn" href="#/">Torna ai film</a></div>`;
      return;
    }
    throw e;
  }

  // In barra di navigazione evidenzia la sezione giusta
  document.querySelectorAll('[data-nav]').forEach((a) => a.toggleAttribute('aria-current', false));
  document.querySelector(`[data-nav="${m.watched_on ? 'film' : 'davedere'}"]`)?.setAttribute('aria-current', 'page');

  const genres = m.genres.map((g) => GENRE_BY_ID[g]).filter(Boolean);
  const facts = [m.watched_on && `Visto il ${fmtDate(m.watched_on)}`, m.year, runtime(m.runtime), m.director && `Regia: ${m.director}`].filter(Boolean);
  main.innerHTML = `
    <div class="hero">
      ${m.backdrop_url || m.poster_url ? `<div class="hero-bg" style="background-image:url('${esc(m.backdrop_url || m.poster_url)}')"></div>` : ''}
      <a class="iconbtn back" href="${m.watched_on ? '#/' : '#/da-vedere'}" aria-label="Indietro">${icon.back}</a>
      <div class="hero-inner">
        ${poster(m)}
        <div>
          <h1>${esc(m.title)}</h1>
          ${m.original_title && m.original_title !== m.title ? `<div class="orig">${esc(m.original_title)}</div>` : ''}
          <div class="facts">${facts.map((f) => `<span class="fact">${esc(f)}</span>`).join('')}</div>
          <div class="chips" style="margin-top:10px;gap:6px">${genres.map((g) => `<span class="tag">${g.emoji} ${g.label}</span>`).join('')}</div>
        </div>
      </div>
    </div>
    ${m.watched_on ? `<div id="group"></div>
    <section class="panel" aria-labelledby="h-mine">
      <div class="panel-head"><h2 id="h-mine">Il tuo voto</h2><span class="save-state" id="saveState" aria-live="polite"></span></div>
      <div id="rater"></div>
      <label class="field" style="margin-top:14px"><span>Nota <span class="faint">(facoltativa)</span></span>
        <textarea class="textarea" id="note" rows="2" maxlength="${NOTE_MAX}" placeholder="Cosa ti è piaciuto o no?"></textarea></label>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
        <span class="faint" id="noteCount"></span>
        <button type="button" class="linkbtn" id="removeVote">Togli il mio voto</button>
      </div>
    </section>
    <div id="votes"></div>` : watchlistPanel(m)}
    ${discussionLink(m)}
    ${m.overview ? `<section class="panel"><h2 style="margin-bottom:8px">Trama</h2>
      <p class="overview clamp" id="ov">${esc(m.overview)}</p>
      <button type="button" class="linkbtn" id="more" hidden>Leggi tutto</button></section>` : ''}
    <div style="display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:20px;flex-wrap:wrap">
      <span class="faint">Aggiunto ${m.added_by_name ? `da ${esc(m.added_by_name)} ` : ''}${timeAgo(m.created_at)}</span>
      <div style="display:flex;gap:4px;align-items:center">
        ${m.watched_on && !m.votes.length ? '<button class="linkbtn" id="unwatch">Sposta nei da vedere</button>' : ''}
        <button class="btn btn-ghost" id="edit">${icon.edit}Modifica</button>
        ${m.can_delete ? `<button class="iconbtn" id="del" aria-label="Elimina film" style="color:var(--tomato)">${icon.trash}</button>` : ''}
      </div>
    </div>`;

  const $ = (s) => main.querySelector(s);
  const refreshLists = () => api.invalidate('/movies', '/people', '/activity');
  const rerender = () => render(main, { me, params });
  const setWatched = async (date) => {
    m = await api.put(`/movies/${id}/watched`, { watched_on: date });
    api.set(path, m); refreshLists();
  };

  if (!m.watched_on) {
    $('#want').addEventListener('click', async () => {
      try { m = await api.post(`/movies/${id}/interest`); api.set(path, m); refreshLists(); rerender(); }
      catch (e) { toast(e.message, { error: true }); }
    });
    $('#markWatched').addEventListener('click', async () => {
      try {
        await setWatched($('#watchedDate').value || todayISO());
        toast('Segnato come visto. Ora dai il tuo voto!');
        rerender();
      } catch (e) { toast(e.message, { error: true }); }
    });
  } else {
  const note = $('#note');
  const saveState = $('#saveState');
  const removeBtn = $('#removeVote');

  const paintGroup = () => {
    $('#group').innerHTML = groupPanel(m);
    $('#votes').innerHTML = votesPanel(m, me);
    note.value = m.my_vote?.note || '';
    note.disabled = !m.my_vote;
    note.placeholder = m.my_vote ? 'Cosa ti è piaciuto o no?' : 'Vota con le stelle per aggiungere una nota';
    removeBtn.hidden = !m.my_vote;
    $('#noteCount').textContent = m.my_vote ? `${note.value.length}/${NOTE_MAX}` : '';
  };
  const save = async (value, noteText) => {
    saveState.textContent = 'Salvo…';
    try {
      m = await api.put(`/movies/${id}/vote`, { value, note: noteText });
      api.set(path, m); refreshLists(); paintGroup();
      saveState.textContent = '✓ Salvato';
      setTimeout(() => (saveState.textContent = ''), 2000);
    } catch (e) { saveState.textContent = ''; toast(e.message, { error: true }); }
  };

  const rater = mountRater($('#rater'), m.my_vote?.value ?? null, (v) => save(v, note.value.trim() || null));
  paintGroup();

  note.addEventListener('input', () => ($('#noteCount').textContent = `${note.value.length}/${NOTE_MAX}`));
  note.addEventListener('blur', () => {
    const t = note.value.trim() || null;
    if (m.my_vote && t !== (m.my_vote.note || null)) save(m.my_vote.value, t);
  });

  removeBtn.addEventListener('click', async () => {
    const prev = m.my_vote;
    m = await api.del(`/movies/${id}/vote`);
    api.set(path, m); refreshLists(); rater.set(null); paintGroup();
    toast('Voto tolto', { action: 'Annulla', onAction: () => { rater.set(prev.value); save(prev.value, prev.note); } });
  });

  // Reazioni: tocca un'emoji per aggiungere/togliere la tua
  const react = async (voter, emoji) => {
    const v = m.votes.find((x) => x.person_id === voter);
    const i = v.reactions.findIndex((r) => r.reactor_id === me.id && r.emoji === emoji);
    if (i >= 0) v.reactions.splice(i, 1);
    else { v.reactions.push({ reactor_id: me.id, emoji, reactor_name: me.name, reactor_email: me.email, reactor_av: me.avatar_v }); emojiBlast(emoji); }
    $('#votes').innerHTML = votesPanel(m, me); // aggiornamento immediato
    try { m = await api.post(`/movies/${id}/votes/${voter}/reactions`, { emoji }); api.set(path, m); $('#votes').innerHTML = votesPanel(m, me); }
    catch (e) { toast(e.message, { error: true }); }
  };
  const closePickers = () => {
    main.querySelectorAll('.picker').forEach((p) => p.remove());
    main.querySelectorAll('[data-pick]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    document.removeEventListener('pointerdown', outside);
  };
  function outside(e) { if (!e.target.closest('.picker, [data-pick]')) closePickers(); }
  $('#votes').addEventListener('keydown', (e) => { if (e.key === 'Escape') closePickers(); });
  $('#votes').addEventListener('click', (e) => {
    const li = e.target.closest('[data-voter]');
    if (!li) return;
    const voter = Number(li.dataset.voter);
    const chip = e.target.closest('[data-emoji]');
    if (chip && !chip.closest('.picker')) return react(voter, chip.dataset.emoji);
    const pickBtn = e.target.closest('[data-pick]');
    if (pickBtn) {
      const open = li.querySelector('.picker');
      closePickers();
      if (open) return;
      const mine = new Set((m.votes.find((x) => x.person_id === voter)?.reactions || []).filter((r) => r.reactor_id === me.id).map((r) => r.emoji));
      const p = document.createElement('div');
      p.className = 'picker'; p.setAttribute('role', 'group'); p.setAttribute('aria-label', 'Scegli una reazione');
      p.innerHTML = pickerHTML(mine, false);
      li.append(p); // sta in sovrapposizione (position:absolute): non sposta nulla
      // sopra al pulsante; se non c'è spazio, sotto
      const place = () => {
        p.style.top = p.style.bottom = ''; p.classList.remove('below');
        const above = pickBtn.getBoundingClientRect().top > p.offsetHeight + 90;
        if (above) p.style.bottom = `${li.clientHeight - pickBtn.offsetTop + 6}px`;
        else { p.style.top = `${pickBtn.offsetTop + pickBtn.offsetHeight + 6}px`; p.classList.add('below'); }
      };
      p._place = place; place();
      pickBtn.setAttribute('aria-expanded', 'true');
      p.querySelector('button').focus({ preventScroll: true });
      setTimeout(() => document.addEventListener('pointerdown', outside), 0);
      return;
    }
    if (e.target.closest('[data-more]')) {
      const p = li.querySelector('.picker');
      const mine = new Set((m.votes.find((x) => x.person_id === voter)?.reactions || []).filter((r) => r.reactor_id === me.id).map((r) => r.emoji));
      p.innerHTML = pickerHTML(mine, true); p.classList.add('all'); p._place();
      p.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const r = e.target.closest('[data-react]');
    if (r) { closePickers(); rememberReaction(r.dataset.react); react(voter, r.dataset.react); }
  });
  }

  $('#unwatch')?.addEventListener('click', async () => {
    try { await setWatched(null); toast('Spostato nei film da vedere'); rerender(); }
    catch (e) { toast(e.message, { error: true }); }
  });

  const ov = $('#ov');
  if (ov && ov.scrollHeight > ov.clientHeight + 2) {
    const more = $('#more'); more.hidden = false;
    more.onclick = () => { ov.classList.toggle('clamp'); more.textContent = ov.classList.contains('clamp') ? 'Leggi tutto' : 'Mostra meno'; };
  }

  $('#edit').addEventListener('click', () => {
    sheet('Modifica film', movieForm(m, { submitLabel: 'Salva modifiche', dateOnly: Boolean(m.watched_on) }), {
      onMount: (el, close) => bindMovieForm(el.querySelector('form'), async (data) => {
        const newDate = data.watched_on;
        m = await api.patch(path, data);
        if (newDate && newDate !== m.watched_on) await setWatched(newDate);
        api.set(path, m); refreshLists(); close();
        toast('Modifiche salvate');
        rerender();
      }),
    });
  });

  $('#del')?.addEventListener('click', async () => {
    const ok = await confirmSheet({ title: 'Eliminare il film?', text: `“${m.title}” e tutti i suoi voti verranno cancellati per tutti. Non si può annullare.`, ok: 'Elimina', danger: true });
    if (!ok) return;
    await api.del(path);
    refreshLists(); api.invalidate(path);
    toast('Film eliminato');
    location.hash = m.watched_on ? '#/' : '#/da-vedere';
  });
}
