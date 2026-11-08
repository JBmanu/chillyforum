-- Chilly Cineforum — schema iniziale
-- I voti sono interi 0–10 (0,5★ = 1). Le medie si calcolano al volo.

CREATE TABLE people (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name        TEXT NOT NULL,
  is_admin    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE movies (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,
  original_title TEXT,
  year           INTEGER,
  poster_url     TEXT,
  backdrop_url   TEXT,
  overview       TEXT,
  runtime        INTEGER,
  director       TEXT,
  tmdb_id        INTEGER UNIQUE,
  added_by       INTEGER REFERENCES people(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE movie_genres (
  movie_id  INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  genre     TEXT NOT NULL,
  PRIMARY KEY (movie_id, genre)
);

CREATE TABLE votes (
  movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  value      INTEGER NOT NULL CHECK (value BETWEEN 0 AND 10),
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (movie_id, person_id)
);

CREATE TABLE reactions (
  movie_id    INTEGER NOT NULL,
  voter_id    INTEGER NOT NULL,
  reactor_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (movie_id, voter_id, reactor_id, emoji),
  FOREIGN KEY (movie_id, voter_id) REFERENCES votes(movie_id, person_id) ON DELETE CASCADE
);

CREATE INDEX idx_votes_person ON votes(person_id);
CREATE INDEX idx_genres_genre ON movie_genres(genre);
CREATE INDEX idx_reactions_vote ON reactions(movie_id, voter_id);
