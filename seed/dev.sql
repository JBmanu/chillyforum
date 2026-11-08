-- Dati di prova SOLO per lo sviluppo locale (npm run db:seed)
INSERT OR IGNORE INTO people (id, email, name, is_admin) VALUES
 (1,'buizomanuel@gmail.com','Manuel',1),(2,'luca@example.com','Luca',0),(3,'giulia@example.com','Giulia',0),
 (4,'marco@example.com','Marco',0),(5,'sara@example.com','Sara',0);
INSERT OR IGNORE INTO movies (id,title,year,runtime,director,tmdb_id,added_by,overview,created_at) VALUES
 (1,'Inception',2010,148,'Christopher Nolan',27205,1,'Dom Cobb è un ladro specializzato nel rubare segreti dal subconscio durante il sonno.','2026-10-01 20:00:00'),
 (2,'Pulp Fiction',1994,154,'Quentin Tarantino',680,2,'Storie intrecciate di criminali, pugili e rapinatori a Los Angeles.','2026-10-08 20:00:00'),
 (3,'La città incantata',2001,125,'Hayao Miyazaki',129,3,'Chihiro finisce in un mondo popolato da spiriti.','2026-10-15 20:00:00'),
 (4,'Parasite',2019,133,'Bong Joon-ho',496243,4,'Una famiglia povera si infiltra nella vita di una famiglia ricca.','2026-10-22 20:00:00'),
 (5,'Il grande Lebowski',1998,117,'Joel Coen',115,5,'Il Drugo viene scambiato per un milionario omonimo.','2026-10-29 20:00:00');
INSERT OR IGNORE INTO movie_genres VALUES (1,'azione'),(1,'fantascienza'),(2,'crime'),(2,'thriller'),(3,'animazione'),(3,'fantasy'),(4,'thriller'),(4,'dramma'),(5,'commedia'),(5,'cult');
INSERT OR IGNORE INTO votes (movie_id,person_id,value,note) VALUES
 (1,1,9,'Il finale con la trottola 🤯'),(1,2,8,NULL),(1,3,10,'Capolavoro'),(1,4,7,NULL),
 (2,1,10,NULL),(2,2,9,'Dialoghi top'),(2,5,6,'Troppo lungo'),
 (3,3,10,NULL),(3,1,9,NULL),(3,4,8,NULL),(3,5,9,NULL),
 (4,2,8,NULL),(4,4,9,'Non me l''aspettavo');
INSERT OR IGNORE INTO reactions (movie_id,voter_id,reactor_id,emoji) VALUES (1,1,2,'🔥'),(1,1,3,'🔥'),(1,3,1,'😍'),(2,5,1,'🙄'),(2,5,2,'😂');
UPDATE movies SET watched_on = date(created_at) WHERE watched_on IS NULL AND id <= 5;
INSERT OR IGNORE INTO movies (id,title,year,runtime,director,tmdb_id,added_by,overview,created_at,watched_on) VALUES
 (20,'Dune - Parte due',2024,166,'Denis Villeneuve',693134,2,'Paul Atreides si unisce ai Fremen per vendicarsi di chi ha distrutto la sua famiglia.','2026-11-01 10:00:00',NULL),
 (21,'Everything Everywhere All at Once',2022,139,'Daniel Kwan, Daniel Scheinert',545611,3,'Una lavandaia scopre di poter accedere alle vite delle sue versioni in altri universi.','2026-11-03 10:00:00',NULL);
INSERT OR IGNORE INTO movie_genres VALUES (20,'fantascienza'),(20,'avventura'),(21,'azione'),(21,'commedia');
INSERT OR IGNORE INTO interests (movie_id,person_id) VALUES (20,2),(20,4),(20,5),(21,3);
