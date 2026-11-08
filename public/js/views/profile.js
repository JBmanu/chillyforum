// Pagina "Profilo": nome, tema, scala voti, esci
import { APP } from '../config.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, avatar, prefs, toast } from '../ui.js';

export async function render(main, { me, setMe }) {
  const seg = (name, opts, cur) => `<div class="segmented" role="group" aria-label="${name}">
    ${opts.map(([v, l]) => `<button type="button" data-${name}="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;

  main.innerHTML = `
    <div class="page-head"><h1>Profilo</h1></div>
    <section class="panel" style="display:flex;gap:14px;align-items:center">
      ${avatar(me, 'lg')}
      <form id="nameForm" class="grow" style="flex:1;min-width:0;display:grid;gap:6px">
        <label class="field"><span>Il tuo nome</span>
          <input class="input" name="name" value="${esc(me.name)}" maxlength="60" autocomplete="nickname" enterkeyhint="done"></label>
        <span class="faint" style="overflow-wrap:anywhere">${esc(me.email)}</span>
      </form>
    </section>
    <section class="panel" style="display:grid;gap:18px">
      <div class="field"><span>Tema</span>${seg('theme', [['light', '☀️ Chiaro'], ['dark', '🌙 Scuro'], ['system', 'Auto']], prefs.theme)}</div>
      <div class="field"><span>Scala dei voti</span>${seg('scale', [[5, '0–5 ★'], [10, '0–10']], prefs.scale)}
        <span class="faint">0–5 con i mezzi voti, 0–10 solo interi. Cambia solo come vedi i voti: 3,5★ e 7/10 sono lo stesso voto.</span></div>
    </section>
    <section class="panel">
      <h2 style="margin-bottom:6px">Usala come un'app</h2>
      <p class="muted">Dal telefono apri il menu del browser e scegli “Aggiungi a schermata Home”: Chilly avrà la sua icona.</p>
    </section>
    <a class="btn btn-ghost btn-block" style="margin-top:20px" href="/cdn-cgi/access/logout">${icon.logout}Esci</a>
    <p class="faint" style="text-align:center;margin-top:16px">${esc(APP.fullName)} 😎<br>Dati dei film da <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>. Questo prodotto usa l'API di TMDB ma non è approvato né certificato da TMDB.</p>`;

  const form = main.querySelector('#nameForm');
  const saveName = async () => {
    const name = form.elements.name.value.trim();
    if (!name || name === me.name) { form.elements.name.value = me.name; return; }
    try {
      await api.patch('/me', { name });
      setMe({ name }); me.name = name;
      api.invalidate('/people', '/movies', '/activity');
      toast('Nome aggiornato');
    } catch (e) { toast(e.message, { error: true }); }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); form.elements.name.blur(); });
  form.elements.name.addEventListener('blur', saveName);

  main.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => {
    prefs.theme = b.dataset.theme;
    main.querySelectorAll('[data-theme]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  }));
  main.querySelectorAll('[data-scale]').forEach((b) => b.addEventListener('click', () => {
    if (Number(b.dataset.scale) !== prefs.scale) document.getElementById('scaleToggle').click();
  }));
}
