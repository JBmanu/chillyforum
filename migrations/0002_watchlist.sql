-- Data "visto il" e lista "da vedere".
-- watched_on NULL = il film è nella lista "Da vedere".
ALTER TABLE movies ADD COLUMN watched_on TEXT;
UPDATE movies SET watched_on = date(created_at);

-- Chi vuole vedere un film della lista "Da vedere"
CREATE TABLE interests (
  movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  person_id  INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (movie_id, person_id)
);
CREATE INDEX idx_movies_watched ON movies(watched_on);
