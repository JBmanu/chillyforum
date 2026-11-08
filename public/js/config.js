/**
 * ============================================================
 *  CONFIGURAZIONE CENTRALE — Chillyforum
 * ============================================================
 *  Tutto ciò che può cambiare nel tempo sta qui.
 *  Questo file è usato sia dal sito (browser) che dal server
 *  (Cloudflare Worker), quindi è l'unica fonte di verità.
 *
 *  Colori del tema  → public/css/theme.css
 *  Chiavi/segreti   → wrangler.jsonc (vars) + secrets Cloudflare
 * ============================================================
 */

export const APP = {
  name: 'Chillyforum',
  fullName: 'Chillyforum',
  tagline: 'Il cineforum del gruppo Chilly',
  locale: 'it-IT',
};

/** Scala voti. Internamente i voti sono salvati come interi 0–10
 *  (0 = 0★, 1 = 0,5★ … 10 = 5★): così le due scale coincidono. */
export const RATING = {
  min: 0,
  max: 10,
  scales: {
    5: { label: '0–5', max: 5, step: 0.5, icon: '★' },
    10: { label: '0–10', max: 10, step: 1, icon: '' },
  },
  defaultScale: 5,
};

/** Emoji disponibili come reazione ai voti degli altri. */
export const REACTION_GROUPS = [
  { label: 'Facce', list: ['😂', '🤣', '😍', '🥰', '😎', '🤩', '😱', '🥹', '😭', '😴', '🤔', '🙄', '😬', '🤮', '😡', '🥱'] },
  { label: 'Gesti', list: ['👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '🤌', '🫶', '❤️', '💔', '💯'] },
  { label: 'Cinema e altro', list: ['🔥', '🍿', '🎬', '🎭', '⭐', '🏆', '🍅', '💩', '👻', '💀', '🎉', '✨'] },
];
export const REACTIONS = REACTION_GROUPS.flatMap((g) => g.list);
/** Le 5 mostrate finché non hai usato nulla. */
export const REACTIONS_DEFAULT = ['👍', '😂', '🔥', '😍', '🤔'];

/** Lunghezza massima della nota al voto. */
export const NOTE_MAX = 280;

/** Lunghezza massima di un messaggio nella discussione. */
export const COMMENT_MAX = 500;

/**
 * Generi. `tmdb` = id del genere su TMDB (per l'import automatico).
 * Per aggiungerne uno: nuovo oggetto con id univoco (slug).
 */
export const GENRES = [
  { id: 'azione', label: 'Azione', emoji: '💥', tmdb: 28 },
  { id: 'avventura', label: 'Avventura', emoji: '🧭', tmdb: 12 },
  { id: 'animazione', label: 'Animazione', emoji: '🎨', tmdb: 16 },
  { id: 'commedia', label: 'Commedia', emoji: '😂', tmdb: 35 },
  { id: 'crime', label: 'Crime', emoji: '🕵️', tmdb: 80 },
  { id: 'documentario', label: 'Documentario', emoji: '🎥', tmdb: 99 },
  { id: 'dramma', label: 'Dramma', emoji: '🎭', tmdb: 18 },
  { id: 'famiglia', label: 'Famiglia', emoji: '👨‍👩‍👧', tmdb: 10751 },
  { id: 'fantasy', label: 'Fantasy', emoji: '🧙', tmdb: 14 },
  { id: 'fantascienza', label: 'Fantascienza', emoji: '🚀', tmdb: 878 },
  { id: 'storico', label: 'Storico', emoji: '🏛️', tmdb: 36 },
  { id: 'horror', label: 'Horror', emoji: '👻', tmdb: 27 },
  { id: 'musicale', label: 'Musicale', emoji: '🎵', tmdb: 10402 },
  { id: 'mistero', label: 'Mistero', emoji: '🔎', tmdb: 9648 },
  { id: 'romantico', label: 'Romantico', emoji: '💘', tmdb: 10749 },
  { id: 'thriller', label: 'Thriller', emoji: '🔪', tmdb: 53 },
  { id: 'guerra', label: 'Guerra', emoji: '🪖', tmdb: 10752 },
  { id: 'western', label: 'Western', emoji: '🤠', tmdb: 37 },
  { id: 'film-tv', label: 'Film TV', emoji: '📺', tmdb: 10770 },
  { id: 'biografico', label: 'Biografico', emoji: '📖', tmdb: null },
  { id: 'sportivo', label: 'Sportivo', emoji: '⚽', tmdb: null },
  { id: 'cult', label: 'Cult', emoji: '🍿', tmdb: null },
];

export const GENRE_BY_ID = Object.fromEntries(GENRES.map((g) => [g.id, g]));
export const GENRE_BY_TMDB = Object.fromEntries(
  GENRES.filter((g) => g.tmdb).map((g) => [g.tmdb, g.id]),
);

/** Immagini TMDB (servite dalla CDN di TMDB: niente peso sul DB). */
export const TMDB_IMG = {
  base: 'https://image.tmdb.org/t/p/',
  poster: 'w500',
  posterThumb: 'w185',
  backdrop: 'w1280',
};

/** Colori avatar persone (assegnati in base all'email). */
export const AVATAR_COLORS = ['#3b5bdb', '#e8590c', '#f59f00', '#d6336c', '#2b8a3e', '#7048e8', '#0c8599', '#c2255c'];

/** Chiavi di localStorage (preferenze del singolo dispositivo). */
export const STORAGE_KEYS = {
  theme: 'chilly.theme', // 'light' | 'dark' | 'system'
  scale: 'chilly.scale', // 5 | 10
  sort: 'chilly.sort',
};

/** Liste lunghe (classifiche, ultimi voti): all'inizio se ne vedono 5, poi si sceglie 10 o tutte. 0 = tutte. */
export const LIST_LIMITS = { first: 5, options: [5, 10, 0] };
