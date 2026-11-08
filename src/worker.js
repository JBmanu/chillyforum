/**
 * Chillyforum — API (Cloudflare Worker + D1)
 * Le pagine statiche in /public sono servite direttamente da Cloudflare;
 * questo Worker risponde solo a /api/*.
 */
import { getCurrentUser } from './auth.js';
import { searchMovies, movieDetails, tmdbEnabled } from './tmdb.js';
import { GENRE_BY_ID, REACTIONS, NOTE_MAX, RATING, COMMENT_MAX } from '../public/js/config.js';

class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const fail = (status, message, code) => { throw new HttpError(status, message, code); };

async function body(request) {
  try { return await request.json(); } catch { fail(400, 'Richiesta non valida'); }
}

/* ------------------------- Validazione ------------------------- */
const cleanStr = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '') || null;
function cleanUrl(v) {
  const s = cleanStr(v, 1000);
  if (!s) return null;
  try { const u = new URL(s); if (u.protocol === 'https:' || u.protocol === 'http:') return u.href; } catch {}
  fail(400, 'Il link dell\'immagine non è valido');
}
function cleanGenres(list) {
  const g = [...new Set((Array.isArray(list) ? list : []).filter((x) => GENRE_BY_ID[x]))];
  if (!g.length) fail(400, 'Scegli almeno un genere');
  return g;
}
const cleanInt = (v, min, max) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const cleanDate = (v) => {
  if (v == null || v === '') return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) fail(400, 'Data non valida');
  return s;
};
const cleanEmail = (v) => {
  const e = cleanStr(v, 200)?.toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail(400, 'Email non valida');
  return e;
};

/* ------------------------- Query ------------------------- */
async function listMovies(env, me) {
  const { results } = await env.DB.prepare(`
    SELECT m.id, m.title, m.year, m.poster_url, m.created_at, m.added_by, m.watched_on, m.director,
      (SELECT COUNT(*) FROM interests i WHERE i.movie_id = m.id) AS interest,
      EXISTS (SELECT 1 FROM interests i WHERE i.movie_id = m.id AND i.person_id = ?1) AS my_interest,
      (SELECT group_concat(genre) FROM movie_genres g WHERE g.movie_id = m.id) AS genres,
      ROUND(AVG(v.value), 2) AS avg, AVG(v.value * v.value) AS avg_sq, COUNT(v.person_id) AS votes,
      MAX(CASE WHEN v.person_id = ?1 THEN v.value END) AS my_vote,
      MAX(v.updated_at) AS last_vote_at
    FROM movies m LEFT JOIN votes v ON v.movie_id = m.id
    GROUP BY m.id ORDER BY m.created_at DESC`).bind(me.id).all();
  return results.map((r) => ({ ...r, genres: r.genres ? r.genres.split(',') : [] }));
}

async function getMovie(env, id, me) {
  const movie = await env.DB.prepare(`
    SELECT m.*, p.name AS added_by_name,
      (SELECT COUNT(*) FROM comments c WHERE c.movie_id = m.id) AS comments_count,
      (SELECT c.body FROM comments c WHERE c.movie_id = m.id ORDER BY c.id DESC LIMIT 1) AS last_comment_body,
      (SELECT q.name FROM comments c JOIN people q ON q.id = c.person_id WHERE c.movie_id = m.id ORDER BY c.id DESC LIMIT 1) AS last_comment_name
    FROM movies m
    LEFT JOIN people p ON p.id = m.added_by WHERE m.id = ?`).bind(id).first();
  if (!movie) fail(404, 'Film non trovato');
  const [genres, votes, reactions, interests] = await env.DB.batch([
    env.DB.prepare('SELECT genre FROM movie_genres WHERE movie_id = ?').bind(id),
    env.DB.prepare(`SELECT v.person_id, v.value, v.note, v.updated_at, p.name, p.email, p.avatar_v
      FROM votes v JOIN people p ON p.id = v.person_id WHERE v.movie_id = ? ORDER BY v.updated_at DESC`).bind(id),
    env.DB.prepare(`SELECT r.voter_id, r.reactor_id, r.emoji, p.name AS reactor_name, p.email AS reactor_email, p.avatar_v AS reactor_av
      FROM reactions r JOIN people p ON p.id = r.reactor_id WHERE r.movie_id = ? ORDER BY r.created_at`).bind(id),
    env.DB.prepare(`SELECT p.id, p.name, p.email, p.avatar_v FROM interests i JOIN people p ON p.id = i.person_id
      WHERE i.movie_id = ? ORDER BY i.created_at`).bind(id),
  ]);
  const list = votes.results.map((v) => ({
    ...v,
    reactions: reactions.results.filter((r) => r.voter_id === v.person_id)
      .map(({ reactor_id, emoji, reactor_name, reactor_email, reactor_av }) => ({ reactor_id, emoji, reactor_name, reactor_email, reactor_av })),
  }));
  const avg = list.length ? list.reduce((s, v) => s + v.value, 0) / list.length : null;
  return {
    ...movie,
    genres: genres.results.map((g) => g.genre),
    votes: list,
    avg: avg === null ? null : Math.round(avg * 100) / 100,
    my_vote: list.find((v) => v.person_id === me.id) || null,
    interests: interests.results,
    my_interest: interests.results.some((p) => p.id === me.id),
    can_delete: Boolean(me.is_admin || movie.added_by === me.id),
  };
}

async function saveGenres(env, movieId, genres) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM movie_genres WHERE movie_id = ?').bind(movieId),
    ...genres.map((g) => env.DB.prepare('INSERT INTO movie_genres (movie_id, genre) VALUES (?, ?)').bind(movieId, g)),
  ]);
}

function movieFields(b) {
  const title = cleanStr(b.title, 200);
  if (!title) fail(400, 'Il titolo è obbligatorio');
  return {
    title,
    original_title: cleanStr(b.original_title, 200),
    year: cleanInt(b.year, 1870, 2100),
    poster_url: cleanUrl(b.poster_url),
    backdrop_url: cleanUrl(b.backdrop_url),
    overview: cleanStr(b.overview, 3000),
    runtime: cleanInt(b.runtime, 1, 1000),
    director: cleanStr(b.director, 200),
  };
}

/* ------------------------- Router ------------------------- */
const routes = [];
const route = (method, pattern, handler) =>
  routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), handler });

route('GET', '/api/me', async ({ me, env }) => json({ ...me, tmdb: tmdbEnabled(env), mock_tmdb: !env.TMDB_API_KEY && env.MOCK_TMDB === '1' }));

route('PATCH', '/api/me', async ({ me, env, request }) => {
  const b = await body(request);
  const name = cleanStr(b.name, 60);
  if (!name) fail(400, 'Il nome non può essere vuoto');
  await env.DB.prepare('UPDATE people SET name = ? WHERE id = ?').bind(name, me.id).run();
  return json({ ...me, name });
});

/* Foto profilo: il client la ridimensiona (JPEG quadrato ~192 px), qui si controlla e si salva */
const AVATAR_MAX = 100000; // caratteri base64, circa 75 KB
route('PUT', '/api/me/avatar', async ({ me, env, request }) => {
  const b = await body(request);
  const m = typeof b.image === 'string' && b.image.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!m || !m[1].startsWith('/9j/')) fail(400, 'Immagine non valida');
  if (m[1].length > AVATAR_MAX) fail(413, 'Immagine troppo grande');
  const v = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO avatars (person_id, data) VALUES (?, ?) ON CONFLICT(person_id) DO UPDATE SET data = excluded.data').bind(me.id, m[1]),
    env.DB.prepare('UPDATE people SET avatar_v = ? WHERE id = ?').bind(v, me.id),
  ]);
  return json({ avatar_v: v });
});

route('DELETE', '/api/me/avatar', async ({ me, env }) => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM avatars WHERE person_id = ?').bind(me.id),
    env.DB.prepare('UPDATE people SET avatar_v = NULL WHERE id = ?').bind(me.id),
  ]);
  return json({ avatar_v: null });
});

route('GET', '/api/people/:id/avatar', async ({ env, params }) => {
  const row = await env.DB.prepare('SELECT data FROM avatars WHERE person_id = ?').bind(Number(params.id)).first();
  if (!row) fail(404, 'Nessuna foto');
  const bin = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
  // L'indirizzo contiene ?v=versione: cambia quando cambia la foto, quindi si può tenere in cache a lungo
  return new Response(bin, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable' } });
});

route('GET', '/api/movies', async ({ env, me }) => json(await listMovies(env, me)));

route('POST', '/api/movies', async ({ env, me, request }) => {
  const b = await body(request);
  const f = movieFields(b);
  const genres = cleanGenres(b.genres);
  const tmdbId = cleanInt(b.tmdb_id, 1, 1e9);
  if (tmdbId) {
    const dup = await env.DB.prepare('SELECT id FROM movies WHERE tmdb_id = ?').bind(tmdbId).first();
    if (dup) return json({ id: dup.id, duplicate: true }, 409);
  }
  const dupTitle = await env.DB.prepare('SELECT id FROM movies WHERE lower(title) = lower(?) AND (year IS ? OR year = ?)')
    .bind(f.title, f.year, f.year).first();
  if (dupTitle) return json({ id: dupTitle.id, duplicate: true }, 409);
  const watchedOn = cleanDate(b.watched_on);
  const row = await env.DB.prepare(`INSERT INTO movies (title, original_title, year, poster_url, backdrop_url, overview, runtime, director, tmdb_id, added_by, watched_on)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .bind(f.title, f.original_title, f.year, f.poster_url, f.backdrop_url, f.overview, f.runtime, f.director, tmdbId, me.id, watchedOn).first();
  await saveGenres(env, row.id, genres);
  // Chi propone un film "da vedere" lo vuole vedere
  if (!watchedOn) await env.DB.prepare('INSERT INTO interests (movie_id, person_id) VALUES (?, ?)').bind(row.id, me.id).run();
  return json({ id: row.id }, 201);
});

route('GET', '/api/movies/:id', async ({ env, me, params }) => json(await getMovie(env, Number(params.id), me)));

route('PATCH', '/api/movies/:id', async ({ env, me, params, request }) => {
  const id = Number(params.id);
  const exists = await env.DB.prepare('SELECT id FROM movies WHERE id = ?').bind(id).first();
  if (!exists) fail(404, 'Film non trovato');
  const b = await body(request);
  const f = movieFields(b);
  await env.DB.prepare(`UPDATE movies SET title=?, original_title=?, year=?, poster_url=?, backdrop_url=?, overview=?, runtime=?, director=? WHERE id=?`)
    .bind(f.title, f.original_title, f.year, f.poster_url, f.backdrop_url, f.overview, f.runtime, f.director, id).run();
  await saveGenres(env, id, cleanGenres(b.genres));
  return json(await getMovie(env, id, me));
});

route('DELETE', '/api/movies/:id', async ({ env, me, params }) => {
  const m = await env.DB.prepare('SELECT added_by FROM movies WHERE id = ?').bind(Number(params.id)).first();
  if (!m) fail(404, 'Film non trovato');
  if (!me.is_admin && m.added_by !== me.id) fail(403, 'Solo chi l\'ha aggiunto o un admin può eliminarlo');
  await env.DB.prepare('DELETE FROM movies WHERE id = ?').bind(Number(params.id)).run();
  return json({ ok: true });
});

route('PUT', '/api/movies/:id/vote', async ({ env, me, params, request }) => {
  const id = Number(params.id);
  const b = await body(request);
  const value = cleanInt(b.value, RATING.min, RATING.max);
  if (value === null) fail(400, 'Voto non valido');
  const note = cleanStr(b.note, NOTE_MAX);
  const exists = await env.DB.prepare('SELECT watched_on FROM movies WHERE id = ?').bind(id).first();
  if (!exists) fail(404, 'Film non trovato');
  if (!exists.watched_on) fail(400, 'Segna il film come visto prima di votarlo');
  await env.DB.prepare(`INSERT INTO votes (movie_id, person_id, value, note) VALUES (?, ?, ?, ?)
    ON CONFLICT (movie_id, person_id) DO UPDATE SET value = excluded.value, note = excluded.note, updated_at = datetime('now')`)
    .bind(id, me.id, value, note).run();
  return json(await getMovie(env, id, me));
});

// Segna come visto (con data) o rimetti tra i "da vedere" (solo se nessuno l'ha ancora votato)
route('PUT', '/api/movies/:id/watched', async ({ env, me, params, request }) => {
  const id = Number(params.id);
  const b = await body(request);
  const watchedOn = cleanDate(b.watched_on);
  const m = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM votes WHERE movie_id = ?1) AS votes FROM movies WHERE id = ?1').bind(id).first();
  if (!m) fail(404, 'Film non trovato');
  if (!watchedOn && m.votes) fail(400, 'Ha già dei voti: non può tornare tra i film da vedere');
  await env.DB.prepare('UPDATE movies SET watched_on = ? WHERE id = ?').bind(watchedOn, id).run();
  return json(await getMovie(env, id, me));
});

// "Lo voglio vedere" (attiva/disattiva)
route('POST', '/api/movies/:id/interest', async ({ env, me, params }) => {
  const id = Number(params.id);
  const m = await env.DB.prepare('SELECT id FROM movies WHERE id = ?').bind(id).first();
  if (!m) fail(404, 'Film non trovato');
  const del = await env.DB.prepare('DELETE FROM interests WHERE movie_id = ? AND person_id = ?').bind(id, me.id).run();
  if (!del.meta.changes) await env.DB.prepare('INSERT INTO interests (movie_id, person_id) VALUES (?, ?)').bind(id, me.id).run();
  return json(await getMovie(env, id, me));
});

route('DELETE', '/api/movies/:id/vote', async ({ env, me, params }) => {
  const id = Number(params.id);
  await env.DB.prepare('DELETE FROM votes WHERE movie_id = ? AND person_id = ?').bind(id, me.id).run();
  return json(await getMovie(env, id, me));
});

route('POST', '/api/movies/:id/votes/:voter/reactions', async ({ env, me, params, request }) => {
  const movieId = Number(params.id), voterId = Number(params.voter);
  const { emoji } = await body(request);
  if (!REACTIONS.includes(emoji)) fail(400, 'Emoji non disponibile');
  if (voterId === me.id) fail(400, 'Non puoi reagire al tuo voto');
  const vote = await env.DB.prepare('SELECT 1 FROM votes WHERE movie_id = ? AND person_id = ?').bind(movieId, voterId).first();
  if (!vote) fail(404, 'Voto non trovato');
  const del = await env.DB.prepare('DELETE FROM reactions WHERE movie_id=? AND voter_id=? AND reactor_id=? AND emoji=?')
    .bind(movieId, voterId, me.id, emoji).run();
  if (!del.meta.changes) {
    await env.DB.prepare('INSERT INTO reactions (movie_id, voter_id, reactor_id, emoji) VALUES (?, ?, ?, ?)')
      .bind(movieId, voterId, me.id, emoji).run();
  }
  return json(await getMovie(env, movieId, me));
});

route('GET', '/api/people', async ({ env }) => {
  const { results } = await env.DB.prepare(`
    SELECT p.id, p.name, p.email, p.is_admin, p.created_at, p.avatar_v,
      COUNT(v.movie_id) AS votes, ROUND(AVG(v.value), 2) AS avg_given
    FROM people p LEFT JOIN votes v ON v.person_id = p.id
    GROUP BY p.id ORDER BY lower(p.name)`).all();
  return json(results);
});

route('GET', '/api/people/:id', async ({ env, params }) => {
  const id = Number(params.id);
  const person = await env.DB.prepare('SELECT id, name, email, is_admin, created_at, avatar_v FROM people WHERE id = ?').bind(id).first();
  if (!person) fail(404, 'Persona non trovata');
  const { results } = await env.DB.prepare(`
    SELECT m.id, m.title, m.year, m.poster_url, v.value, v.note, v.updated_at,
      (SELECT ROUND(AVG(value), 2) FROM votes WHERE movie_id = m.id) AS avg
    FROM votes v JOIN movies m ON m.id = v.movie_id WHERE v.person_id = ? ORDER BY v.updated_at DESC`).bind(id).all();
  return json({ ...person, votes: results });
});

route('POST', '/api/people', async ({ env, me, request }) => {
  if (!me.is_admin) fail(403, 'Solo un admin può aggiungere persone');
  const b = await body(request);
  const email = cleanEmail(b.email);
  const name = cleanStr(b.name, 60) || email.split('@')[0];
  const dup = await env.DB.prepare('SELECT id FROM people WHERE email = ?').bind(email).first();
  if (dup) fail(409, 'Questa email è già nel gruppo');
  const row = await env.DB.prepare('INSERT INTO people (email, name, is_admin) VALUES (?, ?, ?) RETURNING *')
    .bind(email, name, b.is_admin ? 1 : 0).first();
  return json(row, 201);
});

route('PATCH', '/api/people/:id', async ({ env, me, params, request }) => {
  if (!me.is_admin) fail(403, 'Solo un admin può modificare le persone');
  const b = await body(request);
  const name = cleanStr(b.name, 60);
  if (!name) fail(400, 'Il nome non può essere vuoto');
  const email = cleanEmail(b.email);
  const id = Number(params.id);
  if (id === me.id && !b.is_admin) fail(400, 'Non puoi togliere i permessi admin a te stesso');
  await env.DB.prepare('UPDATE people SET name = ?, email = ?, is_admin = ? WHERE id = ?')
    .bind(name, email, b.is_admin ? 1 : 0, id).run();
  return json({ ok: true });
});

route('DELETE', '/api/people/:id', async ({ env, me, params }) => {
  if (!me.is_admin) fail(403, 'Solo un admin può rimuovere persone');
  if (Number(params.id) === me.id) fail(400, 'Non puoi rimuovere te stesso');
  await env.DB.prepare('DELETE FROM people WHERE id = ?').bind(Number(params.id)).run();
  return json({ ok: true });
});

route('GET', '/api/activity', async ({ env }) => {
  const { results } = await env.DB.prepare(`
    SELECT v.movie_id, v.person_id, v.value, v.note, v.updated_at, p.name, p.email, p.avatar_v, m.title
    FROM votes v JOIN people p ON p.id = v.person_id JOIN movies m ON m.id = v.movie_id
    ORDER BY v.updated_at DESC LIMIT 15`).all();
  return json(results);
});

route('GET', '/api/tmdb/search', async ({ env, url }) => {
  if (!tmdbEnabled(env)) fail(501, 'Ricerca automatica non configurata');
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2) return json([]);
  return json(await searchMovies(env, q));
});

route('GET', '/api/tmdb/movie/:id', async ({ env, params }) => {
  if (!tmdbEnabled(env)) fail(501, 'Ricerca automatica non configurata');
  return json(await movieDetails(env, Number(params.id)));
});

/* Discussione per film: gli ultimi 200 messaggi (la pagina li richiede di nuovo ogni pochi secondi) */
route('GET', '/api/movies/:id/comments', async ({ env, params }) => {
  const id = Number(params.id);
  const { results } = await env.DB.prepare(`
    SELECT * FROM (
      SELECT c.id, c.person_id, c.body, c.created_at, p.name, p.email, p.avatar_v
      FROM comments c JOIN people p ON p.id = c.person_id WHERE c.movie_id = ? ORDER BY c.id DESC LIMIT 200
    ) ORDER BY id`).bind(id).all();
  return json(results);
});

route('POST', '/api/movies/:id/comments', async ({ env, me, params, request }) => {
  const id = Number(params.id);
  const text = cleanStr((await body(request)).body, COMMENT_MAX);
  if (!text) fail(400, 'Scrivi qualcosa');
  const movie = await env.DB.prepare('SELECT id FROM movies WHERE id = ?').bind(id).first();
  if (!movie) fail(404, 'Film non trovato');
  const row = await env.DB.prepare('INSERT INTO comments (movie_id, person_id, body) VALUES (?, ?, ?) RETURNING id, created_at')
    .bind(id, me.id, text).first();
  return json({ ...row, person_id: me.id, body: text, name: me.name, email: me.email, avatar_v: me.avatar_v ?? null }, 201);
});

route('DELETE', '/api/comments/:id', async ({ env, me, params }) => {
  const c = await env.DB.prepare('SELECT person_id FROM comments WHERE id = ?').bind(Number(params.id)).first();
  if (!c) fail(404, 'Messaggio non trovato');
  if (c.person_id !== me.id && !me.is_admin) fail(403, 'Puoi cancellare solo i tuoi messaggi');
  await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(Number(params.id)).run();
  return json({ ok: true });
});

/* ------------------------- Entry ------------------------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      const { email, user } = await getCurrentUser(request, env).catch((e) => fail(401, e.message, 'unauthenticated'));
      if (!user) return json({ error: 'La tua email non è nel gruppo Chilly. Chiedi a un admin di aggiungerti.', code: 'not_member', email }, 403);
      for (const r of routes) {
        if (r.method !== request.method) continue;
        const m = url.pathname.match(r.re);
        if (m) return await r.handler({ request, env, url, me: user, params: m.groups || {} });
      }
      fail(404, 'Endpoint inesistente');
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
      if (String(e.message).includes('UNIQUE')) return json({ error: 'Esiste già' }, 409);
      console.error(e);
      return json({ error: 'Errore del server, riprova' }, 500);
    }
  },
};
