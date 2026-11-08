// Avvio dell'app: login, struttura, router (hash) e pulsante scala voti
import { APP } from './config.js';
import { api, ApiError } from './api.js';
import { icon } from './icons.js';
import { prefs, applyTheme, esc, photoPreview } from './ui.js';
import * as films from './views/films.js';
import * as movie from './views/movie.js';
import * as add from './views/add.js';
import * as ranking from './views/ranking.js';
import * as people from './views/people.js';
import * as person from './views/person.js';
import * as profile from './views/profile.js';
import * as watchlist from './views/watchlist.js';
import * as discussion from './views/discussion.js';

const ROUTES = [
  { re: /^\/?$/, view: films, nav: 'film', title: 'Film' },
  { re: /^\/film\/(\d+)$/, view: movie, nav: 'film', title: 'Film', keys: ['id'] },
  { re: /^\/film\/(\d+)\/discussione$/, view: discussion, nav: 'film', title: 'Discussione', keys: ['id'] },
  { re: /^\/aggiungi$/, view: add, nav: 'film', title: 'Aggiungi film' },
  { re: /^\/aggiungi\/(da-vedere)$/, view: add, nav: 'davedere', title: 'Proponi un film', keys: ['mode'] },
  { re: /^\/da-vedere$/, view: watchlist, nav: 'davedere', title: 'Da vedere' },
  { re: /^\/classifica$/, view: ranking, nav: 'classifica', title: 'Classifica' },
  { re: /^\/persone$/, view: people, nav: 'persone', title: 'Persone' },
  { re: /^\/persone\/(\d+)$/, view: person, nav: 'persone', title: 'Persona', keys: ['id'] },
  { re: /^\/profilo$/, view: profile, nav: 'profilo', title: 'Profilo' },
];

const NAV = [
  { id: 'film', href: '#/', label: 'Film', icon: icon.film },
  { id: 'davedere', href: '#/da-vedere', label: 'Da vedere', icon: icon.bookmark },
  { id: 'classifica', href: '#/classifica', label: 'Classifica', icon: icon.trophy },
  { id: 'persone', href: '#/persone', label: 'Persone', icon: icon.people },
  { id: 'profilo', href: '#/profilo', label: 'Profilo', icon: icon.user },
];

const app = document.getElementById('app');
let me = null;
let cleanup = null;

function shell() {
  app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <a class="brand" href="#/" aria-label="${esc(APP.fullName)}, vai ai film">
        <img src="/img/chilly.jpg" alt="" width="38" height="38">
        <span class="logo-type" aria-hidden="true">${esc(APP.name)}</span><span class="sunnies" aria-hidden="true">😎</span>
      </a>
      <button class="scale-toggle" id="scaleToggle" type="button"></button>
    </header>
    <nav class="bottomnav" aria-label="Sezioni">
      ${NAV.map((n) => `<a class="navlink" href="${n.href}" data-nav="${n.id}">${n.icon}<span>${n.label}</span></a>`).join('')}
    </nav>
    <main class="main" id="main" tabindex="-1"></main>
  </div>`;
  const t = document.getElementById('scaleToggle');
  const paintToggle = () => {
    const s = prefs.scale;
    t.setAttribute('aria-label', `Scala voti: ${s === 5 ? 'da 0 a 5' : 'da 0 a 10'}. Tocca per cambiare`);
    t.innerHTML = `<span aria-hidden="${s !== 5}">0–5★</span><span aria-hidden="${s !== 10}">0–10</span>`;
  };
  paintToggle();
  t.onclick = () => {
    prefs.scale = prefs.scale === 5 ? 10 : 5;
    paintToggle();
    route({ keepScroll: true });
  };
}

async function route({ keepScroll = false } = {}) {
  const path = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  const r = ROUTES.find((x) => x.re.test(path)) || ROUTES[0];
  const m = path.match(r.re) || [];
  const params = Object.fromEntries((r.keys || []).map((k, i) => [k, m[i + 1]]));
  document.querySelectorAll('[data-nav]').forEach((a) => a.toggleAttribute('aria-current', false));
  document.querySelector(`[data-nav="${r.nav}"]`)?.setAttribute('aria-current', 'page');
  document.title = `${r.title} · ${APP.fullName}`;
  const y = window.scrollY;
  try { cleanup?.(); } catch {}
  cleanup = null;
  const main = document.getElementById('main');
  try {
    cleanup = (await r.view.render(main, { me, params, setMe: (u) => { me = { ...me, ...u }; } })) || null;
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="empty"><div class="big">🌧️</div><h2>Qualcosa non va</h2>
      <p class="muted">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Ricarica</button></div>`;
  }
  if (keepScroll) window.scrollTo(0, y);
  else window.scrollTo(0, 0);
}

function gate(title, text, extra = '') {
  app.innerHTML = `<div class="gate"><div class="card-gate">
    <img src="/img/chilly.jpg" alt="Logo del gruppo Chilly">
    <h1>${esc(title)}</h1><p class="muted">${text}</p>${extra}</div></div>`;
}

async function boot() {
  applyTheme();
  try {
    me = await api.get('/me', { fresh: true });
  } catch (e) {
    if (e instanceof ApiError && e.data?.code === 'not_member') {
      return gate('Non sei ancora nel gruppo',
        `Hai fatto l'accesso come <b>${esc(e.data.email)}</b>, ma questa email non è tra le persone di Chilly. Chiedi a un admin di aggiungerti, poi ricarica la pagina.`,
        `<a class="btn btn-ghost" href="/cdn-cgi/access/logout">Esci e usa un'altra email</a>`);
    }
    return gate('Impossibile caricare', esc(e.message), `<button class="btn" onclick="location.reload()">Riprova</button>`);
  }
  shell();
  // Indietro: se la pagina precedente è dell'app, usa la cronologia (come il tasto del telefono)
  let idx = 0;
  history.replaceState({ idx }, '');
  window.addEventListener('hashchange', () => {
    if (history.state?.idx == null) history.replaceState({ idx: ++idx }, '');
    else idx = history.state.idx;
    route();
  });
  window.addEventListener('popstate', () => { if (history.state?.idx != null) idx = history.state.idx; });
  document.addEventListener('click', (e) => {
    const ph = e.target.closest('.avatar[data-photo]');
    if (ph && !ph.closest('a, button')) return photoPreview(ph.dataset.photo, ph.dataset.who);
    const a = e.target.closest('a.back');
    if (a && idx > 0 && !e.metaKey && !e.ctrlKey) { e.preventDefault(); history.back(); }
  });
  route();
}

boot();
