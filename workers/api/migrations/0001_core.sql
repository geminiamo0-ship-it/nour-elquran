-- Cloudflare D1 relational foundation. Apply once through D1 migration tooling.
-- No auth/session tables or production data are supplied by this migration.
CREATE TABLE noor_schema_meta (
  component TEXT NOT NULL PRIMARY KEY,
  version INTEGER NOT NULL CHECK(version > 0)
) STRICT;
CREATE TABLE accounts (
  id TEXT NOT NULL PRIMARY KEY,
  auth_subject TEXT NOT NULL UNIQUE CHECK(length(auth_subject) > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
  created_at_ms INTEGER NOT NULL CHECK(created_at_ms >= 0)
) STRICT;
CREATE TABLE learners (
  id TEXT NOT NULL PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 80),
  learner_type TEXT NOT NULL CHECK(learner_type IN ('adult','child')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at_ms INTEGER NOT NULL CHECK(created_at_ms >= 0),
  UNIQUE(id,account_id)
) STRICT;
CREATE INDEX learners_account ON learners(account_id,status,id);

CREATE TABLE teachers (
  id TEXT NOT NULL PRIMARY KEY,
  auth_subject TEXT NOT NULL UNIQUE,
  qualified INTEGER NOT NULL DEFAULT 0 CHECK(qualified IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled'))
) STRICT;
CREATE TABLE staff_grants (
  auth_subject TEXT NOT NULL,
  permission TEXT NOT NULL CHECK(permission IN ('learning.read','attendance.review','roles.manage')),
  revoked_at_ms INTEGER CHECK(revoked_at_ms IS NULL OR revoked_at_ms >= 0),
  PRIMARY KEY(auth_subject,permission)
) STRICT;
CREATE TABLE teacher_assignments (
  id TEXT NOT NULL PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  starts_at_ms INTEGER NOT NULL CHECK(starts_at_ms >= 0),
  ends_at_ms INTEGER NOT NULL CHECK(ends_at_ms > starts_at_ms),
  revoked_at_ms INTEGER CHECK(revoked_at_ms IS NULL OR revoked_at_ms >= 0)
) STRICT;
CREATE INDEX assignments_lookup ON teacher_assignments(learner_id,teacher_id,starts_at_ms,ends_at_ms);
CREATE TRIGGER primary_assignment_no_overlap_insert
BEFORE INSERT ON teacher_assignments WHEN NEW.revoked_at_ms IS NULL
BEGIN
  SELECT RAISE(ABORT,'overlapping primary teacher assignment')
  WHERE EXISTS (
    SELECT 1 FROM teacher_assignments a
    WHERE a.learner_id=NEW.learner_id AND a.revoked_at_ms IS NULL
      AND a.starts_at_ms<NEW.ends_at_ms AND NEW.starts_at_ms<a.ends_at_ms
  );
END;
CREATE TRIGGER primary_assignment_no_overlap_update
BEFORE UPDATE ON teacher_assignments WHEN NEW.revoked_at_ms IS NULL
BEGIN
  SELECT RAISE(ABORT,'overlapping primary teacher assignment')
  WHERE EXISTS (
    SELECT 1 FROM teacher_assignments a
    WHERE a.id<>NEW.id AND a.learner_id=NEW.learner_id AND a.revoked_at_ms IS NULL
      AND a.starts_at_ms<NEW.ends_at_ms AND NEW.starts_at_ms<a.ends_at_ms
  );
END;

CREATE TABLE lessons (
  id TEXT NOT NULL PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
  actual_teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK(kind IN ('trial','standard','makeup')),
  status TEXT NOT NULL CHECK(status IN ('scheduled','live','completed','cancelled')),
  starts_at_ms INTEGER NOT NULL CHECK(starts_at_ms >= 0),
  ends_at_ms INTEGER NOT NULL CHECK(ends_at_ms > starts_at_ms),
  ended_at_ms INTEGER CHECK(ended_at_ms IS NULL OR ended_at_ms >= starts_at_ms),
  UNIQUE(id,learner_id)
) STRICT;
CREATE INDEX lessons_learner_time ON lessons(learner_id,starts_at_ms DESC,id);
CREATE INDEX lessons_teacher_time ON lessons(actual_teacher_id,starts_at_ms,ends_at_ms);
CREATE TABLE lesson_access_grants (
  id TEXT NOT NULL PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  learner_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK(kind IN ('primary','substitute')),
  accepted_at_ms INTEGER CHECK(accepted_at_ms IS NULL OR accepted_at_ms >= 0),
  consent_deadline_ms INTEGER CHECK(consent_deadline_ms IS NULL OR consent_deadline_ms >= 0),
  starts_at_ms INTEGER NOT NULL CHECK(starts_at_ms >= 0),
  ends_at_ms INTEGER NOT NULL CHECK(ends_at_ms > starts_at_ms),
  revoked_at_ms INTEGER CHECK(revoked_at_ms IS NULL OR revoked_at_ms >= 0),
  FOREIGN KEY(lesson_id,learner_id) REFERENCES lessons(id,learner_id) ON DELETE RESTRICT,
  CHECK(kind='primary' OR (consent_deadline_ms IS NOT NULL AND
    (accepted_at_ms IS NULL OR accepted_at_ms<=consent_deadline_ms))),
  UNIQUE(lesson_id,teacher_id,kind)
) STRICT;
CREATE INDEX lesson_grants_teacher ON lesson_access_grants(teacher_id,lesson_id,revoked_at_ms);

CREATE TABLE quran_editions (
  id TEXT NOT NULL PRIMARY KEY,
  riwayah TEXT NOT NULL CHECK(riwayah='hafs'),
  page_count INTEGER NOT NULL CHECK(page_count=604),
  manifest_sha256 TEXT NOT NULL CHECK(length(manifest_sha256)=64)
) STRICT;
-- Imported only from verified edition metadata; this table contains no generated Quran text.
CREATE TABLE quran_ayah_anchors (
  edition_id TEXT NOT NULL REFERENCES quran_editions(id) ON DELETE RESTRICT,
  surah INTEGER NOT NULL CHECK(surah BETWEEN 1 AND 114),
  ayah INTEGER NOT NULL CHECK(ayah > 0),
  page INTEGER NOT NULL CHECK(page BETWEEN 1 AND 604),
  word_count INTEGER NOT NULL CHECK(word_count > 0),
  PRIMARY KEY(edition_id,surah,ayah),
  UNIQUE(edition_id,surah,ayah,page)
) STRICT;
CREATE TABLE personal_annotations (
  id TEXT NOT NULL PRIMARY KEY,
  learner_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  lesson_id TEXT,
  edition_id TEXT NOT NULL,
  surah INTEGER NOT NULL,
  ayah INTEGER NOT NULL,
  page INTEGER NOT NULL,
  word_index INTEGER CHECK(word_index IS NULL OR word_index > 0),
  kind TEXT NOT NULL CHECK(kind IN ('text','ink','highlight')),
  layer TEXT NOT NULL DEFAULT 'private' CHECK(layer='private'),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND length(payload_json)<=65536),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  operation_id TEXT NOT NULL CHECK(length(operation_id) > 0),
  created_at_ms INTEGER NOT NULL CHECK(created_at_ms >= 0),
  FOREIGN KEY(learner_id,account_id) REFERENCES learners(id,account_id) ON DELETE RESTRICT,
  FOREIGN KEY(lesson_id,learner_id) REFERENCES lessons(id,learner_id) ON DELETE RESTRICT,
  FOREIGN KEY(edition_id,surah,ayah,page)
    REFERENCES quran_ayah_anchors(edition_id,surah,ayah,page) ON DELETE RESTRICT,
  UNIQUE(learner_id,operation_id)
) STRICT;
CREATE INDEX annotations_learner_page ON personal_annotations(learner_id,edition_id,page,id);
CREATE INDEX annotations_lesson ON personal_annotations(learner_id,lesson_id,id);
CREATE TRIGGER annotation_word_insert
BEFORE INSERT ON personal_annotations WHEN NEW.word_index IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'invalid Quran word anchor') WHERE NOT EXISTS (
    SELECT 1 FROM quran_ayah_anchors q WHERE q.edition_id=NEW.edition_id
      AND q.surah=NEW.surah AND q.ayah=NEW.ayah AND q.page=NEW.page
      AND NEW.word_index<=q.word_count
  );
END;
CREATE TRIGGER annotation_word_update
BEFORE UPDATE ON personal_annotations WHEN NEW.word_index IS NOT NULL
BEGIN
  SELECT RAISE(ABORT,'invalid Quran word anchor') WHERE NOT EXISTS (
    SELECT 1 FROM quran_ayah_anchors q WHERE q.edition_id=NEW.edition_id
      AND q.surah=NEW.surah AND q.ayah=NEW.ayah AND q.page=NEW.page
      AND NEW.word_index<=q.word_count
  );
END;

CREATE TRIGGER annotation_owner_immutable
BEFORE UPDATE OF learner_id,account_id ON personal_annotations
WHEN NEW.learner_id<>OLD.learner_id OR NEW.account_id<>OLD.account_id
BEGIN SELECT RAISE(ABORT,'annotation ownership is immutable'); END;
CREATE TRIGGER lesson_learner_immutable
BEFORE UPDATE OF learner_id ON lessons WHEN NEW.learner_id<>OLD.learner_id
BEGIN SELECT RAISE(ABORT,'lesson learner is immutable'); END;
INSERT INTO noor_schema_meta(component,version) VALUES('core',1);
