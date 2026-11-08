// Pagina "Aggiungi film": cerca su TMDB → tocca → conferma. Oppure inserimento a mano.
import { api } from '../api.js';
import { icon } from '../icons.js';
import { esc, thumb, toast, poster } from '../ui.js';
import { movieForm, bindMovieForm } from './parts.js';

export async function render(main, { me, params }) {
  const mode = params.mode === 'da-vedere' ? 'watchlist' : 'watched';
  const label = mode === 'watched' ? 'Aggiungi film' : 'Aggiungi ai da vedere';
  // I doppioni sono gestiti dal server (risponde 409 con l'id del film già presente)
  main.innerHTML = `
    <div class="page-head" style="justify-content:flex-start;gap:4px">
      <a class="iconbtn back" href="${mode === 'watched' ? '#/' : '#/da-vedere'}" aria-label="Indietro">${icon.back}</a><h1>${mode === 'watched' ? 'Aggiungi film' : 'Proponi un film'}</h1></div>
    <div id="step"></div>`;
  const step = main.querySelector('#step');

  const submit = async (data) => {
    try {
      const { id } = await api.post('/movies', data);
      api.invalidate('/movies');
      toast(data.watched_on ? 'Film aggiunto. Ora dai il tuo voto!' : 'Aggiunto ai film da vedere');
      location.hash = `#/film/${id}`;
    } catch (e) {
      if (e.status === 409 && e.data?.id) {
        toast('Questo film è già in lista');
        location.hash = `#/film/${e.data.id}`;
        return;
      }
      throw e;
    }
  };

  const showForm = (prefill = {}, fromSearch = false) => {
    step.innerHTML = `
      ${fromSearch ? `<div class="preview panel" style="margin-bottom:16px">${poster(prefill)}
        <div><h2>${esc(prefill.title)}</h2><p class="faint">${[prefill.year, prefill.director].filter(Boolean).map(esc).join(', ')}</p>
        <button class="btn btn-block" type="submit" form="movieForm" style="margin-top:12px">${label}</button></div></div>
      <p class="faint" style="margin:-6px 4px 10px">Generi già scelti da TMDB: puoi cambiarli qui sotto.</p>` : ''}
      <div class="panel">${movieForm(prefill, { submitLabel: label, compact: fromSearch, status: mode })}</div>
      ${me.tmdb ? `<button class="linkbtn" id="backSearch" style="margin-top:12px">← Torna alla ricerca</button>` : ''}`;
    bindMovieForm(step.querySelector('form'), submit);
    step.querySelector('#backSearch')?.addEventListener('click', () => showSearch(prefill.title || ''));
    if (!fromSearch) step.querySelector('[name=title]').focus();
  };

  const showSearch = (q0 = '') => {
    step.innerHTML = `
      <label class="search"><span class="sr-only">Cerca un film</span>${icon.search}
        <input class="input" id="tq" type="search" placeholder="Scrivi il titolo…" autocomplete="off" enterkeyhint="search" value="${esc(q0)}"></label>
      ${me.mock_tmdb ? '<p class="faint" style="margin-top:8px">Modalità prova: ricerca con dati finti (prova “Inter” o “Matrix”).</p>' : ''}
      <div id="res" style="margin-top:14px" aria-live="polite"></div>
      <p style="margin-top:8px"><button class="linkbtn" id="manual">Non lo trovi? Inseriscilo a mano</button></p>`;
    const input = step.querySelector('#tq');
    const res = step.querySelector('#res');
    let timer, seq = 0;
    const search = async () => {
      const q = input.value.trim();
      if (q.length < 2) { res.innerHTML = '<p class="faint">Bastano 2 lettere per iniziare.</p>'; return; }
      const my = ++seq;
      res.innerHTML = '<p class="faint">Cerco…</p>';
      try {
        const list = await api.get(`/tmdb/search?q=${encodeURIComponent(q)}`);
        if (my !== seq) return;
        res.innerHTML = list.length
          ? `<ul class="results">${list.map((r, i) => `<li><button class="result" data-i="${i}">${thumb(r)}
              <span class="grow"><b>${esc(r.title)}</b> <span class="y">${r.year ?? ''}</span>
              ${r.overview ? `<span class="ov">${esc(r.overview)}</span>` : ''}</span></button></li>`).join('')}</ul>`
          : `<p class="muted">Nessun risultato per “${esc(q)}”. Prova il titolo originale o inseriscilo a mano.</p>`;
        res.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', async () => {
          b.disabled = true;
          try {
            const d = await api.get(`/tmdb/movie/${list[b.dataset.i].tmdb_id}`);
            showForm(d, true);
          } catch (e) { toast(e.message, { error: true }); b.disabled = false; }
        }));
      } catch (e) { if (my === seq) res.innerHTML = `<p class="muted">${esc(e.message)}</p>`; }
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 300); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(timer); search(); } });
    step.querySelector('#manual').addEventListener('click', () => showForm({ title: input.value.trim() }));
    input.focus();
    if (q0) search();
  };

  if (me.tmdb) showSearch();
  else showForm();
}
