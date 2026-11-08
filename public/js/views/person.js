// Pagina della singola persona: i suoi voti (confrontati con la media) + gestione per admin
import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, avatar, fmtAvg, fmtVote, fmtDate, thumb, toast, sheet, confirmSheet, prefs, capped, limitBar, bindLimitBar } from '../ui.js';
import { personForm, bindPersonForm } from './people.js';
import { tastesHTML } from '../stats.js';

const tabState = { person: null, tab: null }; // scheda scelta (Da vedere / Visti)

export async function render(main, { me, params, setMe }) {
  const id = Number(params.id);
  let p;
  try { p = await api.get(`/people/${id}`, { fresh: true }); } catch (e) {
    if (e.status === 404) { main.innerHTML = `<div class="empty"><div class="big">👤</div><h2>Persona non trovata</h2><a class="btn" href="#/persone">Torna alle persone</a></div>`; return; }
    throw e;
  }
  const avg = p.votes.length ? p.votes.reduce((s, v) => s + v.value, 0) / p.votes.length : null;
  const diff = p.votes.length ? p.votes.reduce((s, v) => s + (v.value - v.avg), 0) / p.votes.length : 0;
  const mood = !p.votes.length ? '' : diff > 0.6 ? '😇 Più generoso del gruppo' : diff < -0.6 ? '🧐 Più severo del gruppo' : '😎 In linea con il gruppo';
  const isMe = p.id === me.id;
  const toSee = p.proposed.filter((m) => !m.watched_on), seen = p.proposed.filter((m) => m.watched_on);
  if (tabState.person !== p.id) { tabState.person = p.id; tabState.tab = toSee.length || !seen.length ? 'todo' : 'seen'; }
  const proposalsHTML = () => {
    const rows = tabState.tab === 'todo' ? toSee : seen;
    return `<section class="panel" aria-labelledby="h-prop">
      <div class="panel-head"><h2 id="h-prop">${isMe ? 'I film che hai proposto' : 'Film proposti'}</h2></div>
      <div class="segmented" role="group" aria-label="Stato dei film proposti">
        <button type="button" data-tab="todo" aria-pressed="${tabState.tab === 'todo'}">Da vedere (${toSee.length})</button>
        <button type="button" data-tab="seen" aria-pressed="${tabState.tab === 'seen'}">Già visti (${seen.length})</button>
      </div>
      <div style="margin-top:10px">${limitBar('proposals', rows.length)}
      ${rows.length ? `<ul class="list">${capped(rows, 'proposals').map((m) => `<li><a class="list-item" href="#/film/${m.id}">${thumb(m)}
        <span class="grow"><span class="name">${esc(m.title)}</span>
          <span class="meta">${[m.year, m.watched_on && `visto il ${fmtDate(m.watched_on)}`].filter(Boolean).join(', ')}</span></span>
        ${m.watched_on
          ? (m.avg != null ? `<span class="logo-type" style="font-size:1.5rem">${fmtAvg(m.avg)}</span>` : '<span class="faint">nessun voto</span>')
          : `<span class="faint" aria-label="${m.interest} ${m.interest === 1 ? 'persona lo vuole' : 'persone lo vogliono'} vedere">🙋 ${m.interest}</span>`}
      </a></li>`).join('')}</ul>`
      : `<p class="muted">${tabState.tab === 'todo' ? 'Nessun film in attesa di essere visto.' : 'Nessun film proposto è stato ancora visto.'}</p>`}</div>
    </section>`;
  };

  main.innerHTML = `
    <div class="page-head" style="justify-content:flex-start;gap:4px"><a class="iconbtn back" href="#/persone" aria-label="Torna alle persone">${icon.back}</a></div>
    <section class="panel" style="display:flex;gap:16px;align-items:center">
      ${avatar(p, 'lg')}
      <div class="grow" style="min-width:0">
        <h1 style="font-size:1.6rem">${esc(p.name)}${isMe ? ' (tu)' : ''}</h1>
        <p class="faint" style="overflow-wrap:anywhere">${esc(p.email)}${p.is_admin ? '<span class="badge-admin">admin</span>' : ''}</p>
        <p style="margin-top:6px;font-weight:700">${p.votes.length} ${p.votes.length === 1 ? 'voto' : 'voti'}${avg != null ? `, media ${fmtAvg(avg)}/${prefs.scale}` : ''}</p>
        ${mood ? `<p class="muted">${mood}</p>` : ''}
      </div>
    </section>
    ${tastesHTML(p.votes, { isMe })}
    <div id="proposals">${p.proposed.length ? proposalsHTML() : ''}</div>
    <section class="panel">
      <div class="panel-head"><h2>Voti dati</h2><span class="faint">suo voto / media</span></div>
      ${p.votes.length ? `<ul class="list">${p.votes.map((v) => `<li><a class="list-item" href="#/film/${v.id}">${thumb(v)}
        <span class="grow"><span class="name">${esc(v.title)}</span>
          <span class="meta">${v.note ? `“${esc(v.note)}”` : v.year ?? ''}</span></span>
        <span style="text-align:right"><span class="logo-type" style="font-size:1.6rem">${fmtVote(v.value)}</span>
          <span class="faint" style="display:block">media ${fmtAvg(v.avg)}</span></span></a></li>`).join('')}</ul>`
      : `<p class="muted">${isMe ? 'Non hai ancora votato nessun film.' : 'Non ha ancora votato.'}</p>`}
    </section>
    ${me.is_admin ? `<div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
      <button class="btn btn-ghost" id="editP">${icon.edit}Modifica</button>
      ${!isMe ? `<button class="btn btn-ghost" id="delP" style="color:var(--tomato)">${icon.trash}Rimuovi dal gruppo</button>` : ''}</div>` : ''}`;

  const paintProposals = () => {
    const box = main.querySelector('#proposals');
    box.innerHTML = proposalsHTML();
    box.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tabState.tab = b.dataset.tab; paintProposals(); }));
    bindLimitBar(box, 'proposals', paintProposals);
  };
  if (p.proposed.length) paintProposals();

  main.querySelector('#editP')?.addEventListener('click', () => {
    sheet('Modifica persona', personForm(p, { submitLabel: 'Salva modifiche', showAdmin: !isMe }), {
      onMount: (el, close) => bindPersonForm(el.querySelector('form'), async (data) => {
        if (isMe) data.is_admin = true;
        await api.patch(`/people/${id}`, data);
        if (isMe) setMe({ name: data.name, email: data.email });
        api.invalidate('/people', '/movies', '/activity');
        close(); toast('Modifiche salvate'); render(main, { me, params, setMe });
      }),
    });
  });

  main.querySelector('#delP')?.addEventListener('click', async () => {
    const ok = await confirmSheet({ title: `Rimuovere ${p.name}?`, text: 'Non potrà più entrare e i suoi voti verranno cancellati. Non si può annullare.', ok: 'Rimuovi', danger: true });
    if (!ok) return;
    await api.del(`/people/${id}`);
    api.invalidate('/people', '/movies', '/activity');
    toast(`${p.name} rimosso dal gruppo`);
    location.hash = '#/persone';
  });
}
