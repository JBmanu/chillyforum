// Pagina "Persone": attività recente, elenco del gruppo, aggiunta (solo admin)
import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, avatar, fmtAvg, fmtVote, timeAgo, toast, sheet, prefs, capped, limitBar, bindLimitBar } from '../ui.js';

export function personForm(p = {}, { submitLabel, showAdmin }) {
  return `<form class="form" novalidate>
    <label class="field"><span>Nome</span><input class="input" name="name" maxlength="60" value="${esc(p.name)}" placeholder="Es. Giulia" autocomplete="off"></label>
    <label class="field"><span>Email *</span><input class="input" name="email" type="email" inputmode="email" autocapitalize="off" required value="${esc(p.email)}" placeholder="nome@gmail.com">
      <span class="faint">Con questa email riceverà il codice per entrare.</span></label>
    ${showAdmin ? `<label style="display:flex;gap:10px;align-items:center;font-weight:700"><input type="checkbox" name="is_admin" ${p.is_admin ? 'checked' : ''} style="width:22px;height:22px"> Può gestire le persone (admin)</label>` : ''}
    <p class="faint" data-error role="alert" style="color:var(--tomato);font-weight:700"></p>
    <button class="btn btn-block" type="submit">${esc(submitLabel)}</button></form>`;
}

export function bindPersonForm(form, onSubmit) {
  const err = form.querySelector('[data-error]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.elements.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Scrivi un\'email valida, es. nome@gmail.com'; form.elements.email.focus(); return; }
    const btn = form.querySelector('[type=submit]'); btn.disabled = true;
    try { await onSubmit({ name: form.elements.name.value.trim() || email.split('@')[0], email, is_admin: form.elements.is_admin?.checked || false }); }
    catch (ex) { err.textContent = ex.message; } finally { btn.disabled = false; }
  });
}

export async function render(main, { me }) {
  const paint = (people, activity) => {
    main.innerHTML = `
      <div class="page-head"><h1>Persone</h1>
        ${me.is_admin ? `<button class="btn" id="addP">${icon.plus}Aggiungi</button>` : ''}</div>
      <section class="panel" aria-labelledby="h-group">
        <div class="panel-head"><h2 id="h-group">Il gruppo</h2><span class="faint">${people.length}</span></div>
        <ul class="list">${people.map((p) => `<li><a class="list-item" href="#/persone/${p.id}">
          ${avatar(p)}<span class="grow"><span class="name">${esc(p.name)}${p.id === me.id ? ' (tu)' : ''}${p.is_admin ? '<span class="badge-admin">admin</span>' : ''}</span>
          <span class="meta">${p.votes} ${p.votes === 1 ? 'voto' : 'voti'}${p.votes ? `, media data ${fmtAvg(p.avg_given)}/${prefs.scale}` : ''}</span></span>
        </a></li>`).join('')}</ul>
      </section>
      <section class="panel" aria-labelledby="h-act">
        <div class="panel-head"><h2 id="h-act">Ultimi voti</h2></div>
        ${limitBar('activity', activity.length)}
        ${activity.length ? `<ul class="list">${capped(activity, 'activity').map((a) => `<li><a class="list-item" href="#/film/${a.movie_id}">
          ${avatar(a)}<span class="grow"><span class="name">${esc(a.person_id === me.id ? 'Tu' : a.name)} → ${esc(a.title)}</span>
          <span class="meta">${timeAgo(a.updated_at)}${a.note ? `: “${esc(a.note)}”` : ''}</span></span>
          <span class="logo-type" style="font-size:1.5rem">${fmtVote(a.value)}</span></a></li>`).join('')}</ul>`
        : '<p class="muted">Ancora nessun voto.</p>'}
      </section>`;

    bindLimitBar(main, 'activity', () => paint(people, activity));
    main.querySelector('#addP')?.addEventListener('click', () => {
      sheet('Aggiungi persona', personForm({}, { submitLabel: 'Aggiungi persona', showAdmin: true }), {
        onMount: (el, close) => {
          bindPersonForm(el.querySelector('form'), async (data) => {
            await api.post('/people', data);
            api.invalidate('/people');
            close();
            toast(`${data.name} aggiunto al gruppo`);
            render(main, { me });
          });
          el.querySelector('[name=name]').focus();
        },
      });
    });
  };

  const c1 = api.peek('/people'), c2 = api.peek('/activity');
  if (c1 && c2) paint(c1, c2); else main.innerHTML = '<div class="skeleton" style="height:300px;margin-top:12px"></div>';
  const [people, activity] = await Promise.all([api.get('/people', { fresh: true }), api.get('/activity', { fresh: true })]);
  if (JSON.stringify([people, activity]) !== JSON.stringify([c1, c2])) paint(people, activity);
}
