-- Discussione sotto ogni film
CREATE TABLE comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_comments_movie ON comments(movie_id, id);
