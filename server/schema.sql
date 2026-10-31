-- Računi, sesije, profili i ljestvice za CCOW RACING.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  failed INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);

-- U bazi je samo SHA-256 tokena, ne sam token.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated INTEGER NOT NULL
);

-- Najbolji krug po igraču, stazi i klasi auta (ljestvice su podijeljene po klasama).
CREATE TABLE IF NOT EXISTS best_laps (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track TEXT NOT NULL,
  cls TEXT NOT NULL,
  time REAL NOT NULL,
  car TEXT NOT NULL,
  driver TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (user_id, track, cls)
);
CREATE INDEX IF NOT EXISTS best_laps_board ON best_laps(track, cls, time);

-- Najdalje na beskrajnoj stazi po danu (seed = datum).
CREATE TABLE IF NOT EXISTS best_endless (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed TEXT NOT NULL,
  meters INTEGER NOT NULL,
  car TEXT NOT NULL,
  driver TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (user_id, seed)
);
CREATE INDEX IF NOT EXISTS best_endless_board ON best_endless(seed, meters);
