/**
 * TMDB (themoviedb.org): dati dei film gratis per uso non commerciale.
 * La chiave resta sul server; il browser chiama /api/tmdb/*.
 * Accetta sia la "API Key" (v3) sia il "Read Access Token" (v4).
 */
import { GENRE_BY_TMDB, TMDB_IMG } from '../public/js/config.js';

const API = 'https://api.themoviedb.org/3';

export const img = (path, size) => (path ? `${TMDB_IMG.base}${size}${path}` : null);

async function tmdb(env, path, params = {}) {
  const key = env.TMDB_API_KEY;
  const url = new URL(API + path);
  url.searchParams.set('language', env.TMDB_LANGUAGE || 'it-IT');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers = { accept: 'application/json' };
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`;
  else url.searchParams.set('api_key', key);
  const res = await fetch(url, { headers, cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!res.ok) throw new Error(`TMDB ha risposto ${res.status}`);
  return res.json();
}

export const tmdbEnabled = (env) => Boolean(env.TMDB_API_KEY) || env.MOCK_TMDB === '1';

export async function searchMovies(env, q) {
  if (!env.TMDB_API_KEY) return mockSearch(q);
  const data = await tmdb(env, '/search/movie', { query: q, include_adult: 'false' });
  return data.results.slice(0, 12).map((m) => ({
    tmdb_id: m.id,
    title: m.title,
    original_title: m.original_title,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    poster_thumb: img(m.poster_path, TMDB_IMG.posterThumb),
    overview: m.overview,
  }));
}

export async function movieDetails(env, id) {
  if (!env.TMDB_API_KEY) return mockDetails(id);
  const m = await tmdb(env, `/movie/${id}`, { append_to_response: 'credits' });
  const directors = (m.credits?.crew || []).filter((c) => c.job === 'Director').map((c) => c.name);
  return {
    tmdb_id: m.id,
    title: m.title,
    original_title: m.original_title,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    poster_url: img(m.poster_path, TMDB_IMG.poster),
    backdrop_url: img(m.backdrop_path, TMDB_IMG.backdrop),
    overview: m.overview || null,
    runtime: m.runtime || null,
    director: directors.join(', ') || null,
    genres: [...new Set((m.genres || []).map((g) => GENRE_BY_TMDB[g.id]).filter(Boolean))],
  };
}

/* ---------- Dati finti per provare in locale senza chiave ---------- */
const MOCK = [
  { tmdb_id: 27205, title: 'Inception', year: 2010, runtime: 148, director: 'Christopher Nolan', genres: ['azione', 'fantascienza', 'avventura'], overview: 'Dom Cobb è un ladro specializzato nel rubare segreti dal subconscio durante il sonno. Gli viene offerta una possibilità di redenzione: impiantare un\'idea invece di rubarla.' },
  { tmdb_id: 157336, title: 'Interstellar', year: 2014, runtime: 169, director: 'Christopher Nolan', genres: ['avventura', 'dramma', 'fantascienza'], overview: 'Un gruppo di esploratori attraversa un wormhole alla ricerca di un nuovo pianeta per l\'umanità.' },
  { tmdb_id: 680, title: 'Pulp Fiction', year: 1994, runtime: 154, director: 'Quentin Tarantino', genres: ['thriller', 'crime'], overview: 'Storie intrecciate di criminali, pugili e rapinatori nella Los Angeles degli anni \'90.' },
  { tmdb_id: 129, title: 'La città incantata', year: 2001, runtime: 125, director: 'Hayao Miyazaki', genres: ['animazione', 'famiglia', 'fantasy'], overview: 'Chihiro finisce in un mondo popolato da spiriti e deve trovare il modo di salvare i suoi genitori.' },
  { tmdb_id: 496243, title: 'Parasite', year: 2019, runtime: 133, director: 'Bong Joon-ho', genres: ['commedia', 'thriller', 'dramma'], overview: 'Una famiglia povera si infiltra, uno alla volta, nella vita di una famiglia ricca.' },
  { tmdb_id: 603, title: 'Matrix', year: 1999, runtime: 136, director: 'Lana Wachowski, Lilly Wachowski', genres: ['azione', 'fantascienza'], overview: 'Un hacker scopre che la realtà che conosce è una simulazione controllata dalle macchine.' },
];

function mockSearch(q) {
  const s = q.toLowerCase();
  return MOCK.filter((m) => m.title.toLowerCase().includes(s) || s.length < 2)
    .map(({ tmdb_id, title, year, overview }) => ({ tmdb_id, title, original_title: title, year, poster_thumb: null, overview }));
}

function mockDetails(id) {
  const m = MOCK.find((x) => x.tmdb_id === Number(id));
  if (!m) throw new Error('Film non trovato');
  return { ...m, original_title: m.title, poster_url: null, backdrop_url: null };
}
