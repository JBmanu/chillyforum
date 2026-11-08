// Pagina "Profilo": nome, tema, scala voti, esci
import { APP } from '../config.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, avatar, prefs, toast } from '../ui.js';
import { tastesHTML } from '../stats.js';

export async function render(main, { me, setMe }) {
  const seg = (name, opts, cur) => `<div class="segmented" role="group" aria-label="${name}">
    ${opts.map(([v, l]) => `<button type="button" data-${name}="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;

  main.innerHTML = `
    <div class="page-head"><h1>Profilo</h1></div>
    <section class="panel" style="display:flex;gap:14px;align-items:center">
      <div class="avatar-edit">
        <span class="avatar-btn">${avatar(me, 'lg')}</span>
        <button type="button" class="linkbtn" id="photoBtn">${me.avatar_v ? 'Cambia foto' : 'Aggiungi foto'}</button>
        ${me.avatar_v ? '<button type="button" class="linkbtn" id="photoDel">Togli foto</button>' : ''}
        <input type="file" id="photoFile" accept="image/*" hidden>
      </div>
      <form id="nameForm" class="grow" style="flex:1;min-width:0;display:grid;gap:6px">
        <label class="field"><span>Il tuo nome</span>
          <input class="input" name="name" value="${esc(me.name)}" maxlength="60" autocomplete="nickname" enterkeyhint="done"></label>
        <span class="faint" style="overflow-wrap:anywhere">${esc(me.email)}</span>
      </form>
    </section>
    <div id="tastes"></div>
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

  // I tuoi gusti (film e genere preferiti): subito dalla memoria, poi aggiornati
  const tastes = main.querySelector('#tastes');
  const fillTastes = (p) => { if (p && tastes.isConnected) tastes.innerHTML = tastesHTML(p.votes, { isMe: true }); };
  fillTastes(api.peek(`/people/${me.id}`));
  api.get(`/people/${me.id}`, { fresh: true }).then(fillTastes).catch(() => {});

  // Foto profilo: ritagliata quadrata, ridotta a 320 px e salvata come JPEG (~25 KB)
  const resize = async (file) => {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const side = Math.min(bmp.width, bmp.height), SIZE = 320;
    const c = document.createElement('canvas'); c.width = c.height = SIZE;
    c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
    return c.toDataURL('image/jpeg', 0.82);
  };
  const photoDone = (v) => { setMe({ avatar_v: v }); me.avatar_v = v; api.invalidate('/people', '/movies', '/activity'); render(main, { me, setMe }); };
  const fileIn = main.querySelector('#photoFile');
  main.querySelector('#photoBtn').addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0]; if (!f) return;
    try {
      const r = await api.put('/me/avatar', { image: await resize(f) });
      toast('Foto aggiornata'); photoDone(r.avatar_v);
    } catch (e) { toast(e.message || 'Non riesco a leggere questa immagine', { error: true }); }
  });
  main.querySelector('#photoDel')?.addEventListener('click', async () => {
    try { await api.del('/me/avatar'); toast('Foto tolta'); photoDone(null); } catch (e) { toast(e.message, { error: true }); }
  });

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
