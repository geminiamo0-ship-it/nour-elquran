-- CF-01 (#104): D1 schema foundation. No real data, no production migration.
-- Enable foreign key enforcement on each test/connection; D1 enforces SQLite FKs.
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'disabled')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS learner_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  owner_account_id TEXT NOT NULL,
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 100),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (owner_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  UNIQUE (id, owner_account_id)
);
CREATE INDEX IF NOT EXISTS idx_learner_owner ON learner_profiles(owner_account_id);

CREATE TABLE IF NOT EXISTS teachers (
  account_id TEXT PRIMARY KEY NOT NULL,
  qualified INTEGER NOT NULL DEFAULT 0 CHECK (qualified IN (0, 1)),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS teacher_assignments (
  learner_id TEXT NOT NULL,
  teacher_account_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'ended')),
  PRIMARY KEY (learner_id, teacher_account_id),
  FOREIGN KEY (learner_id) REFERENCES learner_profiles(id) ON DELETE RESTRICT,
  FOREIGN KEY (teacher_account_id) REFERENCES teachers(account_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON teacher_assignments(teacher_account_id, state);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY NOT NULL,
  learner_id TEXT NOT NULL,
  teacher_account_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'confirmed', 'completed', 'cancelled')),
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  CHECK (ends_at > starts_at),
  FOREIGN KEY (learner_id, teacher_account_id)
    REFERENCES teacher_assignments(learner_id, teacher_account_id) ON DELETE RESTRICT,
  UNIQUE (id, learner_id)
);
CREATE INDEX IF NOT EXISTS idx_lessons_learner_start ON lessons(learner_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_lessons_teacher_start ON lessons(teacher_account_id, starts_at);

CREATE TABLE IF NOT EXISTS annotation_events (
  id TEXT PRIMARY KEY NOT NULL,
  lesson_id TEXT NOT NULL,
  learner_id TEXT NOT NULL,
  author_account_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('teacher', 'learner_private')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (lesson_id, learner_id) REFERENCES lessons(id, learner_id) ON DELETE RESTRICT,
  FOREIGN KEY (author_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
  UNIQUE (lesson_id, operation_id)
);
CREATE INDEX IF NOT EXISTS idx_annotations_lesson ON annotation_events(lesson_id, created_at);
