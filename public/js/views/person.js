// Pagina della singola persona: i suoi voti (confrontati con la media) + gestione per admin
import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, avatar, fmtAvg, fmtVote, thumb, toast, sheet, confirmSheet, prefs } from '../ui.js';
import { personForm, bindPersonForm } from './people.js';
import { tastesHTML } from '../stats.js';

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
